import { Contract, type TransactionReceipt } from 'ethers';
import { ARC, arrow, contractAddress, el, errorText, logo, rpc, savedValue, saveValue, setMessage, shortAddress } from './config';
import { artifact, feeQuote, isCheckInReceipt, usdc, verifyContract } from './chain';
import { refreshLeaderboard, type LeaderboardSnapshot } from './leaderboard';
import { connect, disconnect, initializeWallet, session, signerForArc, switchToArc } from './wallet';
import './style.css';

el('app').innerHTML = `
  <div class="page-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="Arc Daily 首页">${logo}</a>
      <div class="header-actions"><span class="network-badge"><i></i> ARC MAINNET</span><select id="wallet-choice" aria-label="选择 EVM 钱包" hidden></select><button class="button secondary" id="connect">连接钱包 ${arrow}</button></div>
    </header>
    <main>
      <div class="page-heading"><div><p class="eyebrow"><span class="signal-dot"></span> ONCHAIN ATTENDANCE / ARC 5042</p><h1>让每一天，<em>都有链上回响。</em></h1><p class="muted">连接钱包，完成今日签到。每一次坚持，都由 Arc 主网记录。</p><p class="wallet-support">支持 MetaMask · Binance Wallet · 其他 EVM 钱包</p></div><div class="date-block"><span>UTC DAY</span><strong id="date">—</strong><small>每日 00:00 更新</small></div></div>
      <div class="workspace">
        <section class="checkin-card" aria-labelledby="checkin-title">
          <div class="card-top"><span class="eyebrow">01 / DAILY CHECK-IN</span><span class="pill" id="status">等待连接</span></div>
          <div class="checkin-center"><div class="check-symbol" aria-hidden="true"><svg viewBox="0 0 80 80"><path d="m21 41 13 13 26-29" /></svg></div><h2 id="checkin-title">每日签到</h2><p id="checkin-description">连接钱包，记录你的 Arc 日常。</p></div>
          <div class="cost-row"><span>项目收取费用</span><strong>0 <small>USDC</small></strong></div>
          <button class="button primary" id="checkin">连接钱包开始 ${arrow}</button>
          <p class="gas-note" id="gas-note">仅支付 Arc 网络 Gas，由钱包中的 USDC 支付。</p>
        </section>
        <section class="records" aria-labelledby="records-title">
          <div class="section-heading"><div><p class="eyebrow">PERSONAL SIGNAL</p><h2 id="records-title">我的签到</h2></div><button class="text-button" id="refresh">刷新记录 ↻</button></div>
          <div class="stats"><div><span>累计签到</span><strong id="total">—</strong><small>天</small></div><div><span>连续签到</span><strong id="streak">—</strong><small>天</small></div><div><span>最长连续</span><strong id="longest">—</strong><small>天</small></div></div>
          <div class="week-panel"><div class="section-heading"><h3>最近 7 天</h3><span class="legend"><i></i> 已签到</span></div><div class="week" id="week"></div><p id="week-note" class="muted small">连接钱包后显示链上记录</p></div>
          <div class="reset-row"><span class="reset-icon" aria-hidden="true">◷</span><div><h3>每天，都是新的开始</h3><p>每日 UTC 00:00（北京时间 08:00）重置</p></div><span class="countdown" id="countdown">—</span></div>
        </section>
      </div>
      <section class="leaderboard" aria-labelledby="leaderboard-title">
        <div class="leaderboard-head"><div><p class="eyebrow">02 / GLOBAL RANKING</p><h2 id="leaderboard-title">链上签到榜</h2><p class="muted">按累计签到次数排名 · 每 1 分钟自动同步</p></div><div class="rank-head-actions"><span class="live-badge"><i></i> LIVE ON ARC</span><button class="text-button" id="rank-refresh">立即刷新 ↻</button></div></div>
        <div class="rank-meta"><span id="rank-status" role="status">正在读取链上记录…</span><span id="rank-total">— 个钱包参与</span></div>
        <div class="rank-table-head"><span>名次 / 钱包</span><span>连续签到</span><span>累计签到</span></div>
        <div id="rank-rows" class="rank-rows"></div>
        <div id="rank-self" class="rank-self" hidden></div>
        <button id="rank-more" class="rank-more" hidden>查看更多钱包 ↓</button>
      </section>
      <div id="message" class="message" role="status" aria-live="polite" hidden></div>
      <div id="transaction" class="transaction" hidden><span id="transaction-label"></span><a id="transaction-link" target="_blank" rel="noreferrer">查看交易 ↗</a></div>
      <div class="info-strip"><span><b>01</b> 每个钱包每天一次</span><span><b>02</b> 记录保存在 Arc 主网</span><span><b>03</b> 无项目费用 · 无代币授权</span></div>
      <div id="setup-notice" class="setup-notice" hidden>签到服务暂未开放。</div>
    </main>
    <footer><span>ARC DAILY <span class="footer-divider">/</span> 每一天，都算数。</span><div><a id="contract-link" target="_blank" rel="noreferrer" hidden>签到合约 ↗</a><a href="${ARC.explorer}" target="_blank" rel="noreferrer">Arc 浏览器 ↗</a></div></footer>
  </div>`;

let address = '';
try { address = contractAddress(); } catch (error) { setMessage(errorText(error), 'error'); }
let busy = false;
let loading = false;
let ready = false;
let checked = false;
let chainTime = 0;
let syncedAt = 0;
let currentDay = 0;
let loadVersion = 0;
let pendingHash = '';
let pendingOwner = '';
let quote: Awaited<ReturnType<typeof feeQuote>> | undefined;
let ranking: LeaderboardSnapshot | undefined;
let visibleRanks = 10;
let rankingBusy = false;
let rankingNeedsRefresh = false;

const pendingKey = (account: string) => `arc-daily:${ARC.id}:${address}:${account}:pending`;

function displayTransaction(hash: string, text: string) {
  el('transaction').hidden = !hash;
  if (!hash) return;
  el('transaction-label').textContent = text;
  el<HTMLAnchorElement>('transaction-link').href = `${ARC.explorer}/tx/${hash}`;
}

function rankingItem(row: LeaderboardSnapshot['rows'][number], position: number) {
  const item = document.createElement('div');
  item.className = `rank-item ${position < 3 ? 'rank-top' : ''} ${row.address.toLowerCase() === session.account.toLowerCase() ? 'rank-mine' : ''}`;
  const identity = document.createElement('div');
  identity.className = 'rank-identity';
  const place = document.createElement('span');
  place.className = 'rank-position';
  place.textContent = String(position + 1).padStart(2, '0');
  const avatar = document.createElement('span');
  avatar.className = 'rank-avatar';
  avatar.textContent = row.address.slice(2, 4).toUpperCase();
  const wallet = document.createElement('a');
  wallet.href = `${ARC.explorer}/address/${row.address}`;
  wallet.target = '_blank';
  wallet.rel = 'noreferrer';
  wallet.textContent = shortAddress(row.address);
  identity.append(place, avatar, wallet);
  if (row.address.toLowerCase() === session.account.toLowerCase()) {
    const mine = document.createElement('span');
    mine.className = 'rank-me';
    mine.textContent = '我';
    identity.append(mine);
  }
  const streak = document.createElement('span');
  streak.className = 'rank-streak';
  streak.textContent = `${row.day + 1 < (ranking?.day ?? 0) ? 0 : row.streak} 天`;
  const total = document.createElement('strong');
  total.className = 'rank-total';
  total.textContent = `${row.total} 天`;
  item.append(identity, streak, total);
  return item;
}

function renderRanking() {
  const rows = ranking?.rows ?? [];
  const container = el('rank-rows');
  container.replaceChildren();
  if (!ranking) return;
  if (!session.account) el('date').textContent = new Date(ranking.day * 86400_000).toISOString().slice(0, 10);
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'rank-empty';
    empty.textContent = '还没有钱包签到。成为链上的第一位。';
    container.append(empty);
  } else rows.slice(0, visibleRanks).forEach((row, index) => container.append(rankingItem(row, index)));
  el('rank-total').textContent = `${ranking.totalUsers} 个钱包参与`;
  const ownRank = rows.findIndex(row => row.address.toLowerCase() === session.account.toLowerCase());
  const self = el('rank-self');
  self.replaceChildren();
  self.hidden = ownRank < visibleRanks || ownRank < 0;
  if (!self.hidden) {
    const label = document.createElement('span');
    label.textContent = '我的名次';
    self.append(label, rankingItem(rows[ownRank], ownRank));
  }
  const more = el<HTMLButtonElement>('rank-more');
  more.hidden = rows.length <= visibleRanks;
  more.textContent = `查看更多钱包 · 还剩 ${rows.length - visibleRanks} 位 ↓`;
}

async function refreshRanks() {
  if (rankingBusy) { rankingNeedsRefresh = true; return; }
  if (!address) {
    el('rank-status').textContent = '签到服务暂未开放';
    return;
  }
  rankingBusy = true;
  el<HTMLButtonElement>('rank-refresh').disabled = true;
  el('rank-status').textContent = ranking ? '正在更新链上排行…' : '正在读取链上签到事件…';
  try {
    ranking = await refreshLeaderboard(address, message => { el('rank-status').textContent = message; });
    renderRanking();
    el('rank-status').textContent = `已同步至区块 ${ranking.block.toLocaleString()} · ${new Date(ranking.checkedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 更新`;
  } catch (error) {
    el('rank-status').textContent = `${ranking ? '更新失败，显示上次结果。' : '暂时无法读取排行榜。'} ${errorText(error)}`;
  } finally {
    rankingBusy = false;
    el<HTMLButtonElement>('rank-refresh').disabled = false;
    if (rankingNeedsRefresh) { rankingNeedsRefresh = false; void refreshRanks(); }
  }
}

function render() {
  const connected = Boolean(session.account);
  const correctChain = session.chainId === ARC.id;
  el<HTMLButtonElement>('connect').textContent = connected ? `${shortAddress(session.account)} · 断开` : '连接钱包 ↗';
  el<HTMLButtonElement>('connect').disabled = busy;
  el('setup-notice').hidden = Boolean(address);
  if (address) {
    el<HTMLAnchorElement>('contract-link').href = `${ARC.explorer}/address/${address}`;
    el('contract-link').hidden = false;
  }
  const action = el<HTMLButtonElement>('checkin');
  action.disabled = busy || (connected && correctChain && (!address || loading || !ready || checked || Boolean(pendingHash)));
  action.textContent = busy ? '请在钱包中确认…' : !connected ? '连接钱包开始 ↗' : !correctChain ? '切换至 Arc 主网 ↗' : !address ? '等待项目配置合约' : pendingHash ? '交易已提交，等待确认…' : loading ? '正在读取链上记录…' : !ready ? '暂时无法签到，请刷新' : checked ? '今日已签到 ✓' : '签到，记录今天 ↗';
  el('status').textContent = !connected ? '等待连接' : !correctChain ? '请切换网络' : !address ? '尚未开放' : pendingHash ? '确认中' : !ready ? '等待链上记录' : checked ? '已完成' : '今日待签到';
  el('checkin-description').textContent = checked && ready ? '今天的足迹已上链，明天再见。' : connected ? '每一天的小坚持，都有迹可循。' : '连接钱包，记录你的 Arc 日常。';
  document.querySelector('.checkin-card')?.classList.toggle('completed', checked && ready);
  el('gas-note').textContent = quote && ready && !checked ? `Gas 预估上限 ${usdc(quote.maximumCost)} USDC，以钱包确认为准。` : '仅支付 Arc 网络 Gas，由钱包中的 USDC 支付。';
  el<HTMLButtonElement>('refresh').disabled = busy || loading || !connected || !address;
}

function renderWeek(days: boolean[] | null = null) {
  const container = el('week');
  container.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const day = document.createElement('div');
    day.className = `day ${i === 6 ? 'today' : ''} ${days?.[i] ? 'done' : ''}`;
    const date = currentDay ? new Date((currentDay - 6 + i) * 86400_000) : null;
    const label = i === 6 ? '今天' : date ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}` : '—';
    day.innerHTML = `<span>${label}</span><div>${days?.[i] ? '✓' : '·'}</div>`;
    day.setAttribute('aria-label', `${label}，${days ? days[i] ? '已签到' : '未签到' : '尚未读取'}`);
    container.append(day);
  }
}

function resetRecords() {
  ready = false;
  checked = false;
  quote = undefined;
  currentDay = 0;
  chainTime = 0;
  for (const id of ['total', 'streak', 'longest', 'date', 'countdown']) el(id).textContent = '—';
  if (ranking) el('date').textContent = new Date(ranking.day * 86400_000).toISOString().slice(0, 10);
  el('week-note').textContent = session.account ? '等待读取主网记录' : '连接钱包后显示链上记录';
  renderWeek();
}

function completeReceipt(receipt: TransactionReceipt, owner: string, expectedHash: string) {
  const hash = receipt.hash;
  const savedHash = savedValue(pendingKey(owner));
  if (savedHash && savedHash !== expectedHash) return;
  if (owner === session.account && pendingHash && pendingHash !== expectedHash) return;
  saveValue(pendingKey(owner), '');
  saveValue(`${pendingKey(owner)}:nonce`, '');
  if (owner !== session.account) return;
  pendingHash = '';
  if (isCheckInReceipt(receipt, address, owner)) {
    setMessage('签到成功！今天的记录已经保存在 Arc 主网。', 'success');
    displayTransaction(hash, `签到已确认 · 实际 Gas ${usdc(receipt.fee)} USDC`);
  } else {
    setMessage('交易已结束，但未完成签到。请查看交易详情后重试。', 'error');
    displayTransaction(hash, '签到未完成');
  }
}

async function refresh(quiet = false) {
  if (!session.account || !address) { render(); return; }
  const version = ++loadVersion;
  const account = session.account;
  loading = true;
  render();
  try {
    await verifyContract(address);
    if (pendingHash && pendingOwner === account) {
      const checkingHash = pendingHash;
      const receipt = await rpc.getTransactionReceipt(checkingHash);
      if (version !== loadVersion) return;
      if (receipt) completeReceipt(receipt, account, checkingHash);
      else {
        const nonce = savedValue(`${pendingKey(account)}:nonce`);
        if (/^\d+$/.test(nonce) && await rpc.getTransactionCount(account, 'latest') > Number(nonce)) {
          if (version !== loadVersion) return;
          pendingHash = '';
          saveValue(pendingKey(account), '');
          saveValue(`${pendingKey(account)}:nonce`, '');
          displayTransaction('', '');
          setMessage('此前交易已结束，正在刷新实际签到记录。');
        }
      }
    }
    const block = await rpc.getBlock('latest');
    if (!block) throw new Error('未能读取 Arc 最新区块，请稍后重试。');
    const day = Math.floor(block.timestamp / 86400);
    const contract = new Contract(address, artifact.abi, rpc);
    const [stats, days] = await Promise.all([
      contract.getStats(account, { blockTag: block.number }),
      Promise.all(Array.from({ length: 7 }, (_, i) => contract.hasCheckedIn(account, day - 6 + i, { blockTag: block.number }) as Promise<boolean>)),
    ]);
    if (version !== loadVersion || account !== session.account) return;
    chainTime = block.timestamp;
    syncedAt = Date.now();
    currentDay = day;
    checked = Boolean(stats.checkedInToday);
    ready = true;
    el('total').textContent = String(stats.totalCheckIns);
    el('streak').textContent = String(stats.currentStreak);
    el('longest').textContent = String(stats.longestStreak);
    el('date').textContent = new Date(block.timestamp * 1000).toLocaleDateString('en-CA', { timeZone: 'UTC' });
    el('week-note').textContent = '来自链上记录 · 按 UTC 日期展示';
    renderWeek(days);
    quote = undefined;
    if (!checked && !pendingHash) {
      let nextQuote: Awaited<ReturnType<typeof feeQuote>> | undefined;
      try { nextQuote = await feeQuote({ to: address, from: account, data: contract.interface.encodeFunctionData('checkIn'), value: 0n }); }
      catch { /* Signing retries the required simulation; a preview failure must not fake a cost. */ }
      if (version !== loadVersion) return;
      quote = nextQuote;
    }
  } catch (error) {
    if (version !== loadVersion) return;
    resetRecords();
    if (!quiet || session.account) setMessage(errorText(error), 'error');
  } finally {
    if (version === loadVersion) { loading = false; render(); }
  }
}

initializeWallet(() => {
  loadVersion++;
  loading = false;
  resetRecords();
  pendingOwner = session.account;
  const stored = session.account ? savedValue(pendingKey(session.account)) : '';
  pendingHash = /^0x[0-9a-fA-F]{64}$/.test(stored) ? stored : '';
  displayTransaction(pendingHash, '交易已提交，等待主网确认');
  setMessage('');
  render();
  renderRanking();
  void refresh();
});

el('connect').addEventListener('click', async () => {
  if (busy) return;
  if (session.account) { disconnect(); return; }
  busy = true;
  render();
  try { await connect(); } catch (error) { setMessage(errorText(error), 'error'); }
  finally { busy = false; render(); }
});

el('checkin').addEventListener('click', async () => {
  if (busy) return;
  if (!session.account) { el('connect').click(); return; }
  busy = true;
  render();
  setMessage('');
  const owner = session.account;
  let sentHash = '';
  let ownsBusy = true;
  try {
    if (session.chainId !== ARC.id) { await switchToArc(); return; }
    if (!ready || !address || checked || pendingHash) return;
    const revision = session.revision;
    const signer = await signerForArc();
    await verifyContract(address, signer.provider);
    const contract = new Contract(address, artifact.abi, signer);
    await contract.checkIn.staticCall({ value: 0n });
    const cost = await feeQuote({ to: address, from: owner, value: 0n, data: contract.interface.encodeFunctionData('checkIn') });
    if (revision !== session.revision) throw new Error('钱包或网络已变更，请重试。');
    const tx = await contract.checkIn({ chainId: ARC.id, value: 0n, gasLimit: cost.gasLimit, maxFeePerGas: cost.maxFeePerGas, maxPriorityFeePerGas: cost.maxPriorityFeePerGas });
    sentHash = tx.hash;
    saveValue(pendingKey(owner), sentHash);
    saveValue(`${pendingKey(owner)}:nonce`, String(tx.nonce));
    if (owner === session.account) {
      pendingHash = sentHash;
      pendingOwner = owner;
      displayTransaction(sentHash, '交易已提交，等待主网确认');
      setMessage('交易已提交，请等待确认。');
    }
    busy = false;
    ownsBusy = false;
    render();
    let receipt: TransactionReceipt | null;
    try { receipt = await tx.wait(1, 120_000); }
    catch (error) {
      const replacement = error as { code?: string; receipt?: TransactionReceipt };
      if (replacement.code === 'TRANSACTION_REPLACED' && replacement.receipt) receipt = replacement.receipt;
      else throw error;
    }
    if (receipt) completeReceipt(receipt, owner, sentHash);
    await refresh(true);
    if (receipt) void refreshRanks();
  } catch (error) {
    if (owner !== session.account) return;
    if (sentHash) {
      const receipt = await rpc.getTransactionReceipt(sentHash).catch(() => null);
      if (receipt) completeReceipt(receipt, owner, sentHash);
      else setMessage('交易已提交，暂未确认。请查看交易详情，或稍后刷新记录。');
    } else setMessage(errorText(error), 'error');
    await refresh(true);
  } finally { if (ownsBusy) busy = false; render(); }
});

el('refresh').addEventListener('click', () => { setMessage(''); void refresh(); });
el('rank-refresh').addEventListener('click', () => { void refreshRanks(); });
el('rank-more').addEventListener('click', () => { visibleRanks += 20; renderRanking(); });
setInterval(() => {
  if (!chainTime) return;
  const timestamp = chainTime + Math.floor((Date.now() - syncedAt) / 1000);
  const seconds = Math.max(0, (currentDay + 1) * 86400 - timestamp);
  el('countdown').textContent = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  if (seconds === 0 && !loading && !busy) { ready = false; void refresh(true); }
}, 1000);
setInterval(() => { if (session.account && address && !busy && !loading && !document.hidden) void refresh(true); }, 30_000);
setInterval(() => { if (!document.hidden) void refreshRanks(); }, 60_000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!loading && !busy) void refresh(true);
  void refreshRanks();
});
renderWeek();
render();
void refreshRanks();
