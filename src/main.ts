import { Contract, type TransactionReceipt } from 'ethers';
import { ARC, arrow, contractAddress, el, errorText, logo, rpc, savedValue, saveValue, setMessage, shortAddress } from './config';
import { artifact, feeQuote, isCheckInReceipt, usdc, verifyContract } from './chain';
import { refreshLeaderboard, type LeaderboardSnapshot } from './leaderboard';
import { connect, disconnect, initializeWallet, refreshWalletChoices, session, signerForArc, switchToArc } from './wallet';
import { language, setLanguage, t, type CopyKey, type Language } from './i18n';
import './style.css';

el('app').innerHTML = `
  <div class="page-shell">
    <header class="site-header">
      <a class="brand" href="/" data-i18n-aria="home" aria-label="Arc Daily 首页">${logo}</a>
      <div class="header-actions"><span class="network-badge"><i></i> ARC MAINNET</span><label class="language-picker"><span data-i18n="language">语言</span><select id="language" aria-label="Language"><option value="zh">中文</option><option value="en">EN</option></select></label><select id="wallet-choice" data-i18n-aria="walletChoice" aria-label="选择 EVM 钱包" hidden></select><button class="button secondary" id="connect">连接钱包 ${arrow}</button></div>
    </header>
    <main>
      <div class="page-heading"><div><p class="eyebrow"><span class="signal-dot"></span> <span data-i18n="heroEyebrow">ARC MAINNET / 每日仪式</span></p><h1 data-i18n="heroTitle">签到签到，共同奔向A8！</h1><p class="muted" data-i18n="heroSubtitle">在月光下留下今日的印记。每一次签到，都由 Arc 主网珍藏。</p><p class="wallet-support" data-i18n="walletSupport">支持 MetaMask · Binance Wallet · 其他 EVM 钱包</p></div><div class="date-block"><span data-i18n="utcDay">UTC 签到日</span><strong id="date">—</strong><small data-i18n="dailyReset">每日 00:00 更新</small></div></div>
      <div class="workspace">
        <section class="checkin-card" aria-labelledby="checkin-title">
          <div class="card-top"><span class="eyebrow" data-i18n="cardEyebrow">01 / 每日签到</span><span class="pill" id="status">等待连接</span></div>
          <div class="checkin-center"><div class="check-symbol" aria-hidden="true"><svg viewBox="0 0 80 80"><path d="m21 41 13 13 26-29" /></svg></div><h2 id="checkin-title" data-i18n="dailyCheckIn">每日签到</h2><p id="checkin-description">连接钱包，留下今天的链上印记。</p></div>
          <div class="cost-row"><span data-i18n="feeLabel">项目收取费用</span><strong>0 <small>USDC</small></strong></div>
          <button class="button primary" id="checkin">连接钱包开始 ${arrow}</button>
          <p class="gas-note" id="gas-note">仅支付 Arc 网络 Gas，由钱包中的 USDC 支付。</p>
        </section>
        <section class="records" aria-labelledby="records-title">
          <div class="section-heading"><div><p class="eyebrow" data-i18n="personalEyebrow">你的链上足迹</p><h2 id="records-title" data-i18n="myCheckIns">我的签到</h2></div><button class="text-button" id="refresh" data-i18n="refreshRecords">刷新记录 ↻</button></div>
          <div class="stats"><div><span data-i18n="totalChecks">累计签到</span><strong id="total">—</strong><small data-i18n="dayUnit">天</small></div><div><span data-i18n="currentStreak">连续签到</span><strong id="streak">—</strong><small data-i18n="dayUnit">天</small></div><div><span data-i18n="longestStreak">最长连续</span><strong id="longest">—</strong><small data-i18n="dayUnit">天</small></div></div>
          <div class="week-panel"><div class="section-heading"><h3 data-i18n="lastSeven">最近 7 天</h3><span class="legend"><i></i> <span data-i18n="checkedIn">已签到</span></span></div><div class="week" id="week"></div><p id="week-note" class="muted small">连接钱包后显示链上记录</p></div>
          <div class="reset-row"><span class="reset-icon" aria-hidden="true">◷</span><div><h3 data-i18n="resetTitle">午夜之后，新的篇章</h3><p data-i18n="resetDescription">每日 UTC 00:00（北京时间 08:00）重置</p></div><span class="countdown" id="countdown">—</span></div>
        </section>
      </div>
      <section class="leaderboard" aria-labelledby="leaderboard-title">
        <div class="leaderboard-head"><div><p class="eyebrow" data-i18n="rankEyebrow">02 / 链上排行榜</p><h2 id="leaderboard-title" data-i18n="leaderboard">签到排行榜</h2><p class="muted" data-i18n="rankDescription">按累计签到次数排名 · 每 1 分钟自动同步</p></div><div class="rank-head-actions"><span class="live-badge"><i></i> LIVE ON ARC</span><button class="text-button" id="rank-refresh" data-i18n="refreshNow">立即刷新 ↻</button></div></div>
        <div class="rank-meta"><span id="rank-status" role="status">正在读取链上记录…</span><span id="rank-total">— 个钱包参与</span></div>
        <div class="rank-table-head"><span data-i18n="rankWallet">名次 / 钱包</span><span data-i18n="rankStreak">连续签到</span><span data-i18n="rankTotal">累计签到</span></div>
        <div id="rank-rows" class="rank-rows"></div>
        <div id="rank-self" class="rank-self" hidden></div>
        <button id="rank-more" class="rank-more" hidden>查看更多钱包 ↓</button>
      </section>
      <div id="message" class="message" role="status" aria-live="polite" hidden></div>
      <div id="transaction" class="transaction" hidden><span id="transaction-label"></span><a id="transaction-link" target="_blank" rel="noreferrer" data-i18n="txView">查看交易 ↗</a></div>
      <div class="info-strip"><span><b>01</b> <span data-i18n="ruleOne">每个钱包每天一次</span></span><span><b>02</b> <span data-i18n="ruleTwo">记录保存在 Arc 主网</span></span><span><b>03</b> <span data-i18n="ruleThree">无项目费用 · 无代币授权</span></span></div>
      <div id="setup-notice" class="setup-notice" data-i18n="setupNotice" hidden>签到服务暂未开放。</div>
    </main>
    <footer><span>ARC DAILY <span class="footer-divider">/</span> <span data-i18n="footerLine">每一天，都算数。</span></span><div><a id="contract-link" target="_blank" rel="noreferrer" data-i18n="contractLink" hidden>签到合约 ↗</a><a href="${ARC.explorer}" target="_blank" rel="noreferrer" data-i18n="explorerLink">Arc 浏览器 ↗</a></div></footer>
  </div>`;

let address = '';
let addressError: unknown;
try { address = contractAddress(); } catch (error) { addressError = error; }
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
let rankingError: unknown;
let weekDays: boolean[] | null = null;
let transactionLabel: { key: CopyKey; values?: Record<string, string | number> } | undefined;
let messageLabel: { key: CopyKey; kind: 'info' | 'error' | 'success'; values?: Record<string, string | number> } | undefined;

const pendingKey = (account: string) => `arc-daily:${ARC.id}:${address}:${account}:pending`;

function showMessage(key: CopyKey, kind: 'info' | 'error' | 'success' = 'info', values?: Record<string, string | number>) {
  messageLabel = { key, kind, values };
  setMessage(t(key, values), kind);
}

function clearMessage() {
  messageLabel = undefined;
  setMessage('');
}

function showError(error: unknown) {
  messageLabel = undefined;
  setMessage(errorText(error), 'error');
}

function displayTransaction(hash: string, key: CopyKey | '', values?: Record<string, string | number>) {
  el('transaction').hidden = !hash;
  transactionLabel = key ? { key, values } : undefined;
  if (!hash) return;
  el('transaction-label').textContent = t(key as CopyKey, values);
  el<HTMLAnchorElement>('transaction-link').href = `${ARC.explorer}/tx/${hash}`;
}

function applyLanguage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  refreshWalletChoices();
  document.title = t('pageTitle');
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', t('description'));
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(node => {
    node.textContent = t(node.dataset.i18n as CopyKey);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(node => {
    node.setAttribute('aria-label', t(node.dataset.i18nAria as CopyKey));
  });
  if (transactionLabel) el('transaction-label').textContent = t(transactionLabel.key, transactionLabel.values);
  if (messageLabel) setMessage(t(messageLabel.key, messageLabel.values), messageLabel.kind);
  else if (addressError) showError(new Error(t('invalidContract')));
  else setMessage('');
  render();
  renderWeek(weekDays);
  renderRanking();
  el('week-note').textContent = ready ? t('fromChain') : session.account ? t('waitingMainnet') : t('weekConnect');
  el('rank-total').textContent = ranking ? t('walletsJoined', { count: ranking.totalUsers }) : t('walletsJoined', { count: '—' });
  el('rank-status').textContent = !address ? t('rankUnavailable') : rankingBusy ? t(ranking ? 'rankUpdating' : 'rankReading') : rankingError
    ? `${t(ranking ? 'rankUpdateFailed' : 'rankReadFailed')} ${errorText(rankingError)}` : ranking
    ? t('rankUpdated', { block: ranking.block.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US'), time: new Date(ranking.checkedAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) })
    : t('rankLoading');
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
    mine.textContent = t('me');
    identity.append(mine);
  }
  const streak = document.createElement('span');
  streak.className = 'rank-streak';
  streak.textContent = `${row.day + 1 < (ranking?.day ?? 0) ? 0 : row.streak} ${t('dayUnit')}`;
  const total = document.createElement('strong');
  total.className = 'rank-total';
  total.textContent = `${row.total} ${t('dayUnit')}`;
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
    empty.textContent = t('rankEmpty');
    container.append(empty);
  } else rows.slice(0, visibleRanks).forEach((row, index) => container.append(rankingItem(row, index)));
  el('rank-total').textContent = t('walletsJoined', { count: ranking.totalUsers });
  const ownRank = rows.findIndex(row => row.address.toLowerCase() === session.account.toLowerCase());
  const self = el('rank-self');
  self.replaceChildren();
  self.hidden = ownRank < visibleRanks || ownRank < 0;
  if (!self.hidden) {
    const label = document.createElement('span');
    label.textContent = t('myRank');
    self.append(label, rankingItem(rows[ownRank], ownRank));
  }
  const more = el<HTMLButtonElement>('rank-more');
  more.hidden = rows.length <= visibleRanks;
  more.textContent = t('moreWallets', { count: rows.length - visibleRanks });
}

async function refreshRanks() {
  if (rankingBusy) { rankingNeedsRefresh = true; return; }
  if (!address) {
    el('rank-status').textContent = t('rankUnavailable');
    return;
  }
  rankingBusy = true;
  rankingError = undefined;
  el<HTMLButtonElement>('rank-refresh').disabled = true;
  el('rank-status').textContent = ranking ? t('rankUpdating') : t('rankReading');
  try {
    ranking = await refreshLeaderboard(address, message => { el('rank-status').textContent = message; });
    renderRanking();
    el('rank-status').textContent = t('rankUpdated', { block: ranking.block.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US'), time: new Date(ranking.checkedAt).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) });
  } catch (error) {
    rankingError = error;
    el('rank-status').textContent = `${t(ranking ? 'rankUpdateFailed' : 'rankReadFailed')} ${errorText(error)}`;
  } finally {
    rankingBusy = false;
    el<HTMLButtonElement>('rank-refresh').disabled = false;
    if (rankingNeedsRefresh) { rankingNeedsRefresh = false; void refreshRanks(); }
  }
}

function render() {
  const connected = Boolean(session.account);
  const correctChain = session.chainId === ARC.id;
  el<HTMLButtonElement>('connect').textContent = connected ? t('disconnect', { address: shortAddress(session.account) }) : t('connect');
  el<HTMLButtonElement>('connect').disabled = busy;
  el<HTMLSelectElement>('wallet-choice').hidden = connected || el<HTMLSelectElement>('wallet-choice').options.length === 0;
  el<HTMLSelectElement>('wallet-choice').disabled = connected;
  el('setup-notice').hidden = Boolean(address);
  if (address) {
    el<HTMLAnchorElement>('contract-link').href = `${ARC.explorer}/address/${address}`;
    el('contract-link').hidden = false;
  }
  const action = el<HTMLButtonElement>('checkin');
  action.disabled = busy || (connected && correctChain && (!address || loading || !ready || checked || Boolean(pendingHash)));
  action.textContent = t(busy ? 'walletConfirm' : !connected ? 'connectStart' : !correctChain ? 'switchArc' : !address ? 'waitContract' : pendingHash ? 'txPending' : loading ? 'readingChain' : !ready ? 'unavailableCheckIn' : checked ? 'doneToday' : 'checkInToday');
  el('status').textContent = t(!connected ? 'waiting' : !correctChain ? 'switchNetwork' : !address ? 'unopened' : pendingHash ? 'confirming' : !ready ? 'waitChain' : checked ? 'complete' : 'dueToday');
  el('checkin-description').textContent = t(checked && ready ? 'doneDescription' : connected ? 'connectedDescription' : 'connectDescription');
  document.querySelector('.checkin-card')?.classList.toggle('completed', checked && ready);
  el('gas-note').textContent = quote && ready && !checked ? t('gasEstimate', { amount: usdc(quote.maximumCost) }) : t('gasNote');
  el<HTMLButtonElement>('refresh').disabled = busy || loading || !connected || !address;
}

function renderWeek(days: boolean[] | null = null) {
  weekDays = days;
  const container = el('week');
  container.replaceChildren();
  for (let i = 0; i < 7; i++) {
    const day = document.createElement('div');
    day.className = `day ${i === 6 ? 'today' : ''} ${days?.[i] ? 'done' : ''}`;
    const date = currentDay ? new Date((currentDay - 6 + i) * 86400_000) : null;
    const label = i === 6 ? t('today') : date ? `${date.getUTCMonth() + 1}/${date.getUTCDate()}` : '—';
    day.innerHTML = `<span>${label}</span><div>${days?.[i] ? '✓' : '·'}</div>`;
    day.setAttribute('aria-label', `${label}, ${t(days ? days[i] ? 'checkedIn' : 'notChecked' : 'notRead')}`);
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
  el('week-note').textContent = t(session.account ? 'waitingMainnet' : 'weekConnect');
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
    showMessage('checkSuccess', 'success');
    displayTransaction(hash, 'confirmedGas', { amount: usdc(receipt.fee) });
  } else {
    showMessage('checkFailed', 'error');
    displayTransaction(hash, 'checkNotDone');
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
          showMessage('pendingRecovered');
        }
      }
    }
    const block = await rpc.getBlock('latest');
    if (!block) throw new Error(t('latestBlockError'));
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
    el('week-note').textContent = t('fromChain');
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
    if (!quiet || session.account) showError(error);
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
  displayTransaction(pendingHash, 'pendingMainnet');
  clearMessage();
  render();
  renderRanking();
  void refresh();
});

el('connect').addEventListener('click', async () => {
  if (busy) return;
  if (session.account) { disconnect(); return; }
  busy = true;
  render();
  try { await connect(); } catch (error) { showError(error); }
  finally { busy = false; render(); }
});

el('checkin').addEventListener('click', async () => {
  if (busy) return;
  if (!session.account) { el('connect').click(); return; }
  busy = true;
  render();
  clearMessage();
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
    if (revision !== session.revision) throw new Error(t('walletChanged'));
    const tx = await contract.checkIn({ chainId: ARC.id, value: 0n, gasLimit: cost.gasLimit, maxFeePerGas: cost.maxFeePerGas, maxPriorityFeePerGas: cost.maxPriorityFeePerGas });
    sentHash = tx.hash;
    saveValue(pendingKey(owner), sentHash);
    saveValue(`${pendingKey(owner)}:nonce`, String(tx.nonce));
    if (owner === session.account) {
      pendingHash = sentHash;
      pendingOwner = owner;
      displayTransaction(sentHash, 'pendingMainnet');
      showMessage('txSubmitted');
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
      else showMessage('txUnconfirmed');
    } else showError(error);
    await refresh(true);
  } finally { if (ownsBusy) busy = false; render(); }
});

el('refresh').addEventListener('click', () => { clearMessage(); void refresh(); });
el('rank-refresh').addEventListener('click', () => { void refreshRanks(); });
el('rank-more').addEventListener('click', () => { visibleRanks += 20; renderRanking(); });
el<HTMLSelectElement>('language').value = language;
el<HTMLSelectElement>('language').addEventListener('change', event => {
  const next = (event.target as HTMLSelectElement).value as Language;
  if (next !== 'zh' && next !== 'en') return;
  setLanguage(next);
  applyLanguage();
});
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
applyLanguage();
if (addressError) showError(addressError);
void refreshRanks();
