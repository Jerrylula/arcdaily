import { Contract, Interface, getAddress, type Log } from 'ethers';
import { ARC, rpc, savedValue, saveValue } from './config';
import { artifact, verifyContract } from './chain';

export type LeaderboardRow = {
  address: string;
  total: number;
  streak: number;
  day: number;
  block: number;
  index: number;
};
export type LeaderboardSnapshot = { rows: LeaderboardRow[]; block: number; day: number; checkedAt: number; totalUsers: number };
type Cache = { fromBlock: number; nextBlock: number; rows: LeaderboardRow[] };

const events = new Interface(artifact.abi);
const topic = events.getEvent('CheckedIn')!.topicHash;
let inFlight: Promise<LeaderboardSnapshot> | undefined;

function cacheKey(address: string) {
  return `arc-daily:${ARC.id}:${address.toLowerCase()}:leaderboard:v1`;
}

function readCache(address: string): Cache | undefined {
  try {
    const value = JSON.parse(savedValue(cacheKey(address))) as Cache;
    if (!Number.isSafeInteger(value.fromBlock) || !Number.isSafeInteger(value.nextBlock) ||
        value.fromBlock < 0 || value.nextBlock < value.fromBlock || !Array.isArray(value.rows)) return;
    for (const row of value.rows) {
      if (!row || !/^0x[0-9a-fA-F]{40}$/.test(row.address) ||
          ![row.total, row.streak, row.day, row.block, row.index].every(Number.isSafeInteger)) return;
    }
    return value;
  } catch { return; }
}

async function firstBlock(address: string, latest: number): Promise<number> {
  const configured = import.meta.env.VITE_CHECKIN_DEPLOYMENT_BLOCK?.trim();
  if (configured) {
    const block = Number(configured);
    if (!/^(0|[1-9]\d*)$/.test(configured) || !Number.isSafeInteger(block) || block > latest) {
      throw new Error('排行榜部署区块配置无效，请检查 VITE_CHECKIN_DEPLOYMENT_BLOCK。');
    }
    return block;
  }
  // Historical code queries locate the creation block without another contract deployment.
  // Some public RPCs disable historical state; scanning logs from genesis still works then.
  try {
    let low = 0;
    let high = latest;
    while (low < high) {
      const mid = low + Math.floor((high - low) / 2);
      if (await rpc.getCode(address, mid) === '0x') low = mid + 1;
      else high = mid;
    }
    return low;
  } catch { return 0; }
}

function applyLog(rows: Map<string, LeaderboardRow>, log: Log) {
  const event = events.parseLog(log);
  if (event?.name !== 'CheckedIn') return;
  const address = getAddress(event.args.user);
  const total = Number(event.args.totalCheckIns);
  const streak = Number(event.args.currentStreak);
  const day = Number(event.args.day);
  if (![total, streak, day].every(Number.isSafeInteger)) throw new Error('链上签到计数超出安全范围。');
  const key = address.toLowerCase();
  const previous = rows.get(key);
  if (!previous || log.blockNumber > previous.block || (log.blockNumber === previous.block && log.index > previous.index)) {
    rows.set(key, { address, total, streak, day, block: log.blockNumber, index: log.index });
  }
}

async function load(address: string, progress: (message: string) => void): Promise<LeaderboardSnapshot> {
  await verifyContract(address);
  const latestBlock = await rpc.getBlock('latest');
  if (!latestBlock) throw new Error('无法读取 Arc 最新区块。');
  const latest = latestBlock.number;
  const existing = readCache(address);
  const start = import.meta.env.VITE_CHECKIN_DEPLOYMENT_BLOCK?.trim()
    ? await firstBlock(address, latest)
    : existing?.fromBlock ?? await firstBlock(address, latest);
  const cache: Cache = existing && existing.fromBlock === start && existing.nextBlock <= latest + 1
    ? existing : { fromBlock: start, nextBlock: start, rows: [] };
  const rows = new Map(cache.rows.map(row => [row.address.toLowerCase(), row]));
  let step = 2_000;
  while (cache.nextBlock <= latest) {
    const end = Math.min(latest, cache.nextBlock + step - 1);
    let logs: Log[];
    try {
      logs = await rpc.getLogs({ address, topics: [topic], fromBlock: cache.nextBlock, toBlock: end });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (step <= 1 || !/range|too many|more than|response size|limit|timeout|413|504/i.test(message)) throw error;
      step = Math.max(1, Math.floor(step / 2));
      continue;
    }
    for (const log of logs) applyLog(rows, log);
    cache.nextBlock = end + 1;
    cache.rows = [...rows.values()];
    saveValue(cacheKey(address), JSON.stringify(cache));
    if (cache.nextBlock <= latest) progress(`正在同步链上签到：区块 ${end.toLocaleString()} / ${latest.toLocaleString()}`);
    step = Math.min(2_000, step * 2);
  }
  const contract = new Contract(address, artifact.abi, rpc);
  const [checkIns, users] = await Promise.all([
    contract.totalCheckIns({ blockTag: latest }) as Promise<bigint>,
    contract.totalUsers({ blockTag: latest }) as Promise<bigint>,
  ]);
  const all = [...rows.values()];
  if (BigInt(all.length) !== users || all.reduce((sum, row) => sum + BigInt(row.total), 0n) !== checkIns) {
    // A stale browser cache or incomplete RPC result must never appear as a complete ranking.
    saveValue(cacheKey(address), '');
    throw new Error('排行榜链上记录尚未同步完整，请稍后刷新。');
  }
  all.sort((a, b) => b.total - a.total || b.day - a.day || a.address.localeCompare(b.address));
  return { rows: all, block: latest, day: Math.floor(latestBlock.timestamp / 86400), checkedAt: Date.now(), totalUsers: all.length };
}

export function refreshLeaderboard(address: string, progress: (message: string) => void) {
  if (!inFlight) inFlight = load(address, progress).finally(() => { inFlight = undefined; });
  return inFlight;
}
