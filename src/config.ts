import { FetchRequest, JsonRpcProvider, getAddress, isAddress, ZeroAddress } from 'ethers';

export const ARC = {
  id: 5042,
  hexId: '0x13b2',
  name: 'Arc Mainnet',
  rpc: import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.mainnet.arc.io',
  explorer: 'https://explorer.arc.io',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
} as const;

const request = new FetchRequest(ARC.rpc);
request.timeout = 15_000;
// Do not use staticNetwork: a wrongly configured RPC must fail chain validation.
export const rpc = new JsonRpcProvider(request, ARC.id, { batchMaxCount: 1, cacheTimeout: -1 });
rpc.pollingInterval = 3_000;

export function savedValue(key: string): string {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
export function saveValue(key: string, value: string): void {
  try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* Storage is optional. */ }
}
export function validAddress(value: string): string {
  return isAddress(value) && value.toLowerCase() !== ZeroAddress ? getAddress(value) : '';
}
export function contractAddress(): string {
  const configured = import.meta.env.VITE_CHECKIN_CONTRACT_ADDRESS?.trim();
  if (configured && !validAddress(configured)) throw new Error('配置的签到合约地址无效，请检查 VITE_CHECKIN_CONTRACT_ADDRESS。');
  return configured || '';
}
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function errorText(error: unknown): string {
  const e = error as { code?: string | number; message?: string; shortMessage?: string; info?: { error?: { code?: number; message?: string } } };
  const message = `${e?.shortMessage || e?.message || ''} ${e?.info?.error?.message || ''}`;
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED' || e?.info?.error?.code === 4001) return '已取消钱包请求，没有发起新的交易。';
  if (/insufficient funds/i.test(message)) return '钱包中的原生 USDC 不足以支付 Gas，请补充 Arc 主网 USDC 后重试。';
  if (/AlreadyCheckedIn/i.test(message)) return '这个钱包今天已经签到了，请刷新记录。';
  if (/timeout|TIMEOUT|Failed to fetch|network|SERVER_ERROR|fetch|ECONNREFUSED/i.test(message)) return '网络请求未完成，请检查连接并重试。已提交的交易可在浏览器中查看。';
  return e instanceof Error ? (e.message.length < 180 ? e.message : '请求失败，请检查钱包提示和网络状态后重试。') : '请求失败，请重试。';
}

export const logo = '<span class="brand-icon" aria-hidden="true">A</span><span>ARC<span class="brand-light"> DAILY</span></span>';
export const arrow = '<span aria-hidden="true">↗</span>';

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function setMessage(message: string, kind: 'info' | 'error' | 'success' = 'info'): void {
  const target = el('message');
  target.textContent = message;
  target.className = `message ${kind}`;
  target.hidden = !message;
}
