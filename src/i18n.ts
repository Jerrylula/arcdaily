export type Language = 'zh' | 'en';

const copy = {
  zh: {
    pageTitle: '签到签到，共同奔向A8！ · ARC DAILY', description: 'Arc 主网每日链上签到。项目费用为零，只需支付网络 Gas。',
    home: 'Arc Daily 首页', walletChoice: '选择 EVM 钱包', language: '语言', connect: '连接钱包 ↗', disconnect: '{address} · 断开',
    heroEyebrow: 'ARC MAINNET / 每日仪式', heroTitle: '签到签到，共同奔向A8！', heroSubtitle: '在月光下留下今日的印记。每一次签到，都由 Arc 主网珍藏。', walletSupport: '支持 MetaMask · Binance Wallet · 其他 EVM 钱包',
    utcDay: 'UTC 签到日', dailyReset: '每日 00:00 更新', cardEyebrow: '01 / 每日签到', waiting: '等待连接', dailyCheckIn: '每日签到', connectDescription: '连接钱包，留下今天的链上印记。', feeLabel: '项目收取费用', connectStart: '连接钱包开始 ↗', gasNote: '仅支付 Arc 网络 Gas，由钱包中的 USDC 支付。',
    personalEyebrow: '你的链上足迹', myCheckIns: '我的签到', refreshRecords: '刷新记录 ↻', totalChecks: '累计签到', currentStreak: '连续签到', longestStreak: '最长连续', dayUnit: '天', lastSeven: '最近 7 天', checkedIn: '已签到', weekConnect: '连接钱包后显示链上记录', resetTitle: '午夜之后，新的篇章', resetDescription: '每日 UTC 00:00（北京时间 08:00）重置',
    rankEyebrow: '02 / 链上排行榜', leaderboard: '签到排行榜', rankDescription: '按累计签到次数排名 · 每 1 分钟自动同步', refreshNow: '立即刷新 ↻', rankLoading: '正在读取链上记录…', walletsJoined: '{count} 个钱包参与', rankWallet: '名次 / 钱包', rankStreak: '连续签到', rankTotal: '累计签到', moreWallets: '查看更多钱包 · 还剩 {count} 位 ↓', myRank: '我的名次', me: '我', rankEmpty: '还没有钱包签到。成为链上的第一位。', rankUnavailable: '签到服务暂未开放', rankUpdating: '正在更新链上排行…', rankReading: '正在读取链上签到事件…', rankUpdated: '已同步至区块 {block} · {time} 更新', rankUpdateFailed: '更新失败，显示上次结果。', rankReadFailed: '暂时无法读取排行榜。', rankProgress: '正在同步链上签到：区块 {current} / {latest}',
    txView: '查看交易 ↗', ruleOne: '每个钱包每天一次', ruleTwo: '记录保存在 Arc 主网', ruleThree: '无项目费用 · 无代币授权', setupNotice: '签到服务暂未开放。', footerLine: '每一天，都算数。', contractLink: '签到合约 ↗', explorerLink: 'Arc 浏览器 ↗',
    walletConfirm: '请在钱包中确认…', switchArc: '切换至 Arc 主网 ↗', waitContract: '等待项目配置合约', txPending: '交易已提交，等待确认…', readingChain: '正在读取链上记录…', unavailableCheckIn: '暂时无法签到，请刷新', doneToday: '今日已签到 ✓', checkInToday: '签到，记录今天 ↗', switchNetwork: '请切换网络', unopened: '尚未开放', confirming: '确认中', waitChain: '等待链上记录', complete: '已完成', dueToday: '今日待签到', doneDescription: '今天的足迹已上链，明天再见。', connectedDescription: '每一天的小坚持，都有迹可循。', gasEstimate: 'Gas 预估上限 {amount} USDC，以钱包确认为准。', today: '今天', notChecked: '未签到', notRead: '尚未读取', waitingMainnet: '等待读取主网记录', fromChain: '来自链上记录 · 按 UTC 日期展示',
    checkSuccess: '签到成功！今天的记录已经保存在 Arc 主网。', confirmedGas: '签到已确认 · 实际 Gas {amount} USDC', checkFailed: '交易已结束，但未完成签到。请查看交易详情后重试。', checkNotDone: '签到未完成', pendingRecovered: '此前交易已结束，正在刷新实际签到记录。', pendingMainnet: '交易已提交，等待主网确认', txSubmitted: '交易已提交，请等待确认。', txUnconfirmed: '交易已提交，暂未确认。请查看交易详情，或稍后刷新记录。', walletChanged: '钱包或网络已变更，请重试。', latestBlockError: '未能读取 Arc 最新区块，请稍后重试。',
    invalidContract: '配置的签到合约地址无效，请检查 VITE_CHECKIN_CONTRACT_ADDRESS。', rejected: '已取消钱包请求，没有发起新的交易。', insufficientFunds: '钱包中的原生 USDC 不足以支付 Gas，请补充 Arc 主网 USDC 后重试。', alreadyChecked: '这个钱包今天已经签到了，请刷新记录。', networkError: '网络请求未完成，请检查连接并重试。已提交的交易可在浏览器中查看。', requestFailed: '请求失败，请检查钱包提示和网络状态后重试。', retry: '请求失败，请重试。',
    missingWallet: '未检测到 EVM 钱包。请安装 MetaMask、Binance Wallet 等钱包扩展，或在钱包内置浏览器中打开。', noAccount: '钱包未返回可用地址，请重试。', connectFirst: '请先连接钱包。', switchFirst: '请先切换到 Arc 主网。', walletAccountChanged: '钱包账户已变更，请重新连接。', selectArc: '请在钱包中切换到 Arc 主网。', genericWallet: 'EVM 浏览器钱包',
    wrongRpc: 'RPC 网络与 Arc 主网不符，已停止操作。', noContract: '该地址在 Arc 主网上没有合约，请先部署或检查地址。', wrongContract: '该地址的合约代码与本项目不一致，已停止操作。', invalidRankBlock: '排行榜部署区块配置无效，请检查 VITE_CHECKIN_DEPLOYMENT_BLOCK。', counterOverflow: '链上签到计数超出安全范围。', rankLatestError: '无法读取 Arc 最新区块。', rankIncomplete: '排行榜链上记录尚未同步完整，请稍后刷新。',
  },
  en: {
    pageTitle: 'Check In, Check In — Onward to A8 Together! · ARC DAILY', description: 'Daily on-chain check-ins on Arc Mainnet. No project fee; pay network gas only.',
    home: 'Arc Daily home', walletChoice: 'Choose an EVM wallet', language: 'Language', connect: 'Connect wallet ↗', disconnect: '{address} · Disconnect',
    heroEyebrow: 'ARC MAINNET / DAILY RITUAL', heroTitle: 'Check In, Check In — Onward to A8 Together!', heroSubtitle: 'Leave today’s mark beneath the moon. Every check-in is kept on Arc Mainnet.', walletSupport: 'MetaMask · Binance Wallet · other EVM wallets',
    utcDay: 'UTC DAY', dailyReset: 'Resets at 00:00 daily', cardEyebrow: '01 / DAILY CHECK-IN', waiting: 'Not connected', dailyCheckIn: 'Daily check-in', connectDescription: 'Connect your wallet and leave today’s on-chain mark.', feeLabel: 'Project fee', connectStart: 'Connect wallet to begin ↗', gasNote: 'Pay Arc network gas only, in native USDC from your wallet.',
    personalEyebrow: 'YOUR ON-CHAIN FOOTPRINT', myCheckIns: 'My check-ins', refreshRecords: 'Refresh records ↻', totalChecks: 'Total check-ins', currentStreak: 'Current streak', longestStreak: 'Longest streak', dayUnit: 'days', lastSeven: 'Last 7 days', checkedIn: 'Checked in', weekConnect: 'Connect your wallet to see on-chain records', resetTitle: 'A new chapter after midnight', resetDescription: 'Resets daily at 00:00 UTC (08:00 Beijing)',
    rankEyebrow: '02 / ON-CHAIN LEADERBOARD', leaderboard: 'Check-in leaderboard', rankDescription: 'Ranked by total check-ins · syncs every minute', refreshNow: 'Refresh now ↻', rankLoading: 'Reading on-chain records…', walletsJoined: '{count} wallets joined', rankWallet: 'Rank / wallet', rankStreak: 'Streak', rankTotal: 'Total', moreWallets: 'Show more · {count} remaining ↓', myRank: 'My rank', me: 'Me', rankEmpty: 'No check-ins yet. Be the first on chain.', rankUnavailable: 'Check-in service is not yet available', rankUpdating: 'Updating on-chain rankings…', rankReading: 'Reading on-chain check-in events…', rankUpdated: 'Synced to block {block} · updated {time}', rankUpdateFailed: 'Update failed; showing the previous results.', rankReadFailed: 'Leaderboard is temporarily unavailable.', rankProgress: 'Syncing on-chain check-ins: block {current} / {latest}',
    txView: 'View transaction ↗', ruleOne: 'One check-in per wallet each day', ruleTwo: 'Records stored on Arc Mainnet', ruleThree: 'No project fee · no token approval', setupNotice: 'Check-in service is not yet available.', footerLine: 'Every day counts.', contractLink: 'Check-in contract ↗', explorerLink: 'Arc Explorer ↗',
    walletConfirm: 'Confirm in your wallet…', switchArc: 'Switch to Arc Mainnet ↗', waitContract: 'Waiting for contract configuration', txPending: 'Transaction submitted; awaiting confirmation…', readingChain: 'Reading on-chain records…', unavailableCheckIn: 'Check-in unavailable; please refresh', doneToday: 'Checked in today ✓', checkInToday: 'Check in today ↗', switchNetwork: 'Switch network', unopened: 'Not open', confirming: 'Confirming', waitChain: 'Waiting for on-chain records', complete: 'Complete', dueToday: 'Ready to check in', doneDescription: 'Today’s mark is on chain. See you tomorrow.', connectedDescription: 'Small daily rituals leave a lasting trace.', gasEstimate: 'Estimated gas cap {amount} USDC; confirm the amount in your wallet.', today: 'Today', notChecked: 'Not checked in', notRead: 'Not loaded', waitingMainnet: 'Waiting for Mainnet records', fromChain: 'On-chain records · shown by UTC date',
    checkSuccess: 'Check-in complete! Today’s record is saved on Arc Mainnet.', confirmedGas: 'Confirmed · actual gas {amount} USDC', checkFailed: 'Transaction ended without a check-in. Inspect it and try again.', checkNotDone: 'Check-in not completed', pendingRecovered: 'The earlier transaction has ended; refreshing the actual check-in status.', pendingMainnet: 'Transaction submitted; awaiting Mainnet confirmation', txSubmitted: 'Transaction submitted. Please wait for confirmation.', txUnconfirmed: 'Transaction submitted but not yet confirmed. Inspect it or refresh later.', walletChanged: 'Wallet or network changed. Please try again.', latestBlockError: 'Could not read the latest Arc block. Please try again.',
    invalidContract: 'Invalid contract address. Check VITE_CHECKIN_CONTRACT_ADDRESS.', rejected: 'Wallet request canceled; no new transaction was sent.', insufficientFunds: 'Not enough native USDC to pay gas. Add USDC on Arc Mainnet and try again.', alreadyChecked: 'This wallet has already checked in today. Refresh the records.', networkError: 'Network request did not finish. Check your connection and retry. You can inspect submitted transactions in the explorer.', requestFailed: 'Request failed. Check your wallet prompt and network, then retry.', retry: 'Request failed. Please retry.',
    missingWallet: 'No EVM wallet detected. Install MetaMask or Binance Wallet, or open this page in a wallet browser.', noAccount: 'The wallet did not return a usable address. Please retry.', connectFirst: 'Connect a wallet first.', switchFirst: 'Switch to Arc Mainnet first.', walletAccountChanged: 'Wallet account changed. Reconnect your wallet.', selectArc: 'Switch to Arc Mainnet in your wallet.', genericWallet: 'EVM browser wallet',
    wrongRpc: 'RPC network does not match Arc Mainnet. Operation stopped.', noContract: 'No contract exists at this address on Arc Mainnet. Check the address.', wrongContract: 'Contract code does not match this project. Operation stopped.', invalidRankBlock: 'Invalid leaderboard deployment block. Check VITE_CHECKIN_DEPLOYMENT_BLOCK.', counterOverflow: 'On-chain check-in count exceeds the safe range.', rankLatestError: 'Could not read the latest Arc block.', rankIncomplete: 'Leaderboard records are not fully synced. Refresh again later.',
  },
} as const;

export type CopyKey = keyof typeof copy.zh;
const storageKey = 'arc-daily:language';
function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch { /* Local storage is optional. */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export let language: Language = initialLanguage();
export function setLanguage(next: Language) {
  language = next;
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  try { localStorage.setItem(storageKey, next); } catch { /* Local storage is optional. */ }
}
export function t(key: CopyKey, values: Record<string, string | number> = {}): string {
  const template: string = copy[language][key];
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ''));
}
