import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import { Contract, ContractFactory, JsonRpcProvider, getAddress } from 'ethers';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { compileContract } from './compile.mjs';

// Everything in this test, including wallet transactions, stays on loopback.
// Ganache's public deterministic accounts are test-only and have no real funds.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = resolve(root, 'test-results');
const baseUrl = 'http://127.0.0.1:5175';
const today = new Date().toISOString().slice(0, 10);
const initialTime = new Date(`${today}T12:00:00.000Z`);
const chain = ganache.server({
  // An explicit database avoids Ganache's Windows temp-folder cleanup race.
  database: { dbPath: resolve(outputDir, `ganache-ui-${process.pid}-${Date.now()}`) },
  chain: { chainId: 5042, hardfork: 'shanghai', time: initialTime },
  wallet: { deterministic: true, totalAccounts: 3, defaultBalance: 100 },
  logging: { quiet: true },
});
let vite;
let browser;
let rpc;
const sentTransactions = [];
const pageErrors = [];
const blockedRequests = [];

async function waitText(page, selector, text) {
  await page.waitForFunction(
    ({ selector, text }) => document.querySelector(selector)?.textContent?.includes(text),
    { selector, text },
    { timeout: 30_000 },
  );
}

async function waitEnabled(page, selector) {
  await page.waitForFunction(
    selector => document.querySelector(selector)?.disabled === false,
    selector,
    { timeout: 30_000 },
  );
}

async function assertNoOverflow(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    `Page must not overflow at ${page.viewportSize().width}px`);
}

async function makeContext({ wallet = true, viewport = { width: 1440, height: 1040 } } = {}) {
  const context = await browser.newContext({ viewport, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  context.setDefaultTimeout(30_000);
  context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    blockedRequests.push(url.href);
    return route.abort();
  });
  if (wallet) {
    const accounts = await chain.provider.request({ method: 'eth_accounts', params: [] });
    await context.exposeBinding('__localWalletRpc', async (_source, payload) => {
      if (payload.method === 'eth_sendTransaction') sentTransactions.push(payload.params[0]);
      return chain.provider.request(payload);
    });
    await context.addInitScript(({ accounts }) => {
      let selected = 0;
      let chainId = '0x13b2';
      let rejectMethod = '';
      let missingChain = false;
      const listeners = new Map();
      const requests = [];
      const emit = (event, payload) => {
        for (const listener of listeners.get(event) || []) listener(payload);
      };
      const injected = {
        isMetaMask: true,
        on(event, handler) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(handler);
        },
        removeListener(event, handler) { listeners.get(event)?.delete(handler); },
        async request(payload) {
          requests.push(payload);
          if (rejectMethod === payload.method) {
            rejectMethod = '';
            const error = new Error('User rejected the request.');
            error.code = 4001;
            throw error;
          }
          if (payload.method === 'eth_requestAccounts' || payload.method === 'eth_accounts') return [accounts[selected]];
          if (payload.method === 'eth_chainId') return chainId;
          if (payload.method === 'wallet_switchEthereumChain') {
            if (missingChain) {
              const error = new Error('Unrecognized chain.');
              error.code = 4902;
              throw error;
            }
            chainId = payload.params[0].chainId;
            emit('chainChanged', chainId);
            return null;
          }
          if (payload.method === 'wallet_addEthereumChain') { missingChain = false; return null; }
          return window.__localWalletRpc(payload);
        },
      };
      const binance = {
        isBinance: true,
        on: injected.on.bind(injected),
        removeListener: injected.removeListener.bind(injected),
        async request(payload) {
          if (payload.method === 'eth_requestAccounts' || payload.method === 'eth_accounts') return [accounts[2]];
          return injected.request(payload);
        },
      };
      window.ethereum = injected;
      window.BinanceChain = binance;
      window.addEventListener('eip6963:requestProvider', () => {
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
          detail: { info: { name: 'MetaMask', rdns: 'io.metamask' }, provider: injected },
        }));
        window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
          detail: { info: { name: 'Binance Wallet', rdns: 'com.binance.wallet' }, provider: binance },
        }));
      });
      window.__walletTest = {
        requests,
        setAccount(index) { selected = index; emit('accountsChanged', [accounts[selected]]); },
        setChain(value, unknown = false) { chainId = value; missingChain = unknown; emit('chainChanged', chainId); },
        rejectNext(method) { rejectMethod = method; },
      };
    }, { accounts });
  }
  return context;
}

try {
  await mkdir(outputDir, { recursive: true });
  const artifact = await compileContract();
  const generated = JSON.parse(await readFile(resolve(root, 'src/generated/ArcCheckIn.json'), 'utf8'));
  assert.equal(generated.bytecode, undefined, 'The public frontend must not include deployment bytecode.');
  assert.equal(generated.deployedBytecode, artifact.deployedBytecode);
  await chain.listen(0, '127.0.0.1');
  const rpcUrl = `http://127.0.0.1:${chain.address().port}`;
  process.env.VITE_ARC_RPC_URL = rpcUrl;
  rpc = new JsonRpcProvider(rpcUrl, 5042, { cacheTimeout: -1 });
  rpc.pollingInterval = 100;
  const deployment = await new ContractFactory(artifact.abi, artifact.bytecode, await rpc.getSigner(0)).deploy();
  await deployment.waitForDeployment();
  const address = await deployment.getAddress();
  process.env.VITE_CHECKIN_CONTRACT_ADDRESS = address;
  assert.equal(await rpc.getCode(address), artifact.deployedBytecode);
  vite = await createServer({
    root,
    server: { host: '127.0.0.1', port: 5175, strictPort: true },
    clearScreen: false,
    logLevel: 'error',
  });
  await vite.listen();
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync(edge) ? edge : undefined);
  browser = await chromium.launch({ headless: true, executablePath });

  const noWallet = await makeContext({ wallet: false });
  const disconnected = await noWallet.newPage();
  await disconnected.goto(baseUrl);
  await waitText(disconnected, '#status', '等待连接');
  assert.equal(await disconnected.locator('#total').textContent(), '—');
  assert.equal(await disconnected.locator('#setup-notice').isVisible(), false);
  assert.equal(await disconnected.locator('a[href="/deploy.html"]').count(), 0);
  await disconnected.locator('#connect').click();
  await waitText(disconnected, '#message', '未检测到 EVM 钱包');
  await noWallet.close();
  console.log('PASS disconnected state and missing-wallet feedback');

  const context = await makeContext();
  const page = await context.newPage();
  await page.clock.install();
  await page.goto(baseUrl);
  assert.deepEqual(await page.locator('#wallet-choice option').allTextContents(), ['MetaMask', 'Binance Wallet']);
  await page.locator('#connect').click();
  await waitText(page, '#total', '0');
  await waitEnabled(page, '#checkin');
  await waitText(page, '#status', '今日待签到');
  assert.equal(await page.locator('#week .day').count(), 7);
  assert.equal(await page.locator('#week .done').count(), 0);
  const accounts = await chain.provider.request({ method: 'eth_accounts', params: [] });
  const beforeBalance = await rpc.getBalance(accounts[0]);
  await page.locator('#checkin').click();
  await waitText(page, '#message', '签到成功');
  await waitText(page, '#total', '1');
  await waitText(page, '#checkin', '今日已签到');
  assert.equal(await page.locator('#checkin').isDisabled(), true);
  assert.equal(await page.locator('#streak').textContent(), '1');
  assert.equal(await page.locator('#longest').textContent(), '1');
  assert.equal(await page.locator('#week .day.today.done').count(), 1);
  assert.equal(sentTransactions.length, 1);
  const checkInTx = sentTransactions[0];
  assert.equal(checkInTx.to.toLowerCase(), address.toLowerCase());
  assert.equal(BigInt(checkInTx.value ?? 0), 0n);
  const transactionUrl = await page.locator('#transaction-link').getAttribute('href');
  const receipt = await rpc.getTransactionReceipt(transactionUrl.split('/').at(-1));
  assert.ok(receipt && receipt.status === 1);
  assert.equal(beforeBalance - await rpc.getBalance(accounts[0]), receipt.fee, 'Only network gas is charged.');
  assert.equal(await rpc.getBalance(address), 0n);
  await waitText(page, '#rank-total', '1 个钱包参与');
  assert.equal(await page.locator('#rank-rows .rank-item').count(), 1);
  assert.equal((await page.locator('#rank-rows .rank-item').innerText()).includes('1 天'), true);
  await page.waitForFunction(() => /^\d{2}:\d{2}:\d{2}$/.test(document.querySelector('#countdown').textContent));
  await assertNoOverflow(page);
  await page.screenshot({ path: resolve(outputDir, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow(page);
  await page.screenshot({ path: resolve(outputDir, 'mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1040 });
  console.log('PASS check-in, zero transferred value, gas-only balance change, duplicate guard, and desktop/mobile layout');

  await page.evaluate(() => window.__walletTest.setAccount(1));
  await waitText(page, '#total', '0');
  await waitEnabled(page, '#checkin');
  assert.equal(await page.locator('#streak').textContent(), '0');
  assert.equal(await page.locator('#week .done').count(), 0);
  assert.equal(await page.locator('#transaction').isVisible(), false);
  await page.evaluate(() => window.__walletTest.setChain('0x1', true));
  await waitText(page, '#checkin', '切换至 Arc 主网');
  const sendsBeforeSwitch = sentTransactions.length;
  await page.locator('#checkin').click();
  await waitText(page, '#checkin', '签到，记录今天');
  await waitEnabled(page, '#checkin');
  assert.equal(sentTransactions.length, sendsBeforeSwitch, 'Switching networks must never also check in.');
  const addRequest = await page.evaluate(() => window.__walletTest.requests.find(item => item.method === 'wallet_addEthereumChain'));
  assert.equal(addRequest.params[0].chainId, '0x13b2');
  assert.equal(addRequest.params[0].nativeCurrency.symbol, 'USDC');
  assert.equal(addRequest.params[0].nativeCurrency.decimals, 18);
  await page.evaluate(() => window.__walletTest.rejectNext('eth_sendTransaction'));
  await page.locator('#checkin').click();
  await waitText(page, '#message', '已取消钱包请求');
  await waitEnabled(page, '#checkin');
  assert.equal(sentTransactions.length, sendsBeforeSwitch, 'Rejected wallet request must not send a transaction.');
  assert.equal(await page.locator('#total').textContent(), '0');
  await page.locator('#checkin').click();
  await waitText(page, '#message', '签到成功');
  await waitText(page, '#checkin', '今日已签到');
  await waitText(page, '#rank-total', '2 个钱包参与');
  console.log('PASS account changes, unknown-chain addition/switch, rejected transaction, and retry');

  await page.evaluate(() => window.__walletTest.setAccount(0));
  await waitText(page, '#checkin', '今日已签到');
  const tomorrow = new Date(initialTime.getTime() + 86400_000);
  await chain.provider.request({ method: 'evm_setTime', params: [tomorrow] });
  await chain.provider.request({ method: 'evm_mine', params: [] });
  await page.locator('#refresh').click();
  await waitText(page, '#checkin', '签到，记录今天');
  await waitEnabled(page, '#checkin');
  assert.equal(await page.locator('#date').textContent(), tomorrow.toISOString().slice(0, 10));
  assert.equal(await page.locator('#week .day.today.done').count(), 0);
  assert.equal(await page.locator('#week .done').count(), 1);
  await page.locator('#checkin').click();
  await waitText(page, '#message', '签到成功');
  await waitText(page, '#total', '2');
  assert.equal(await page.locator('#streak').textContent(), '2');
  assert.equal(await page.locator('#longest').textContent(), '2');
  assert.equal(await page.locator('#week .done').count(), 2);
  await waitText(page, '#rank-rows .rank-item:first-child', '2 天');
  const contract = new Contract(address, artifact.abi, rpc);
  assert.equal((await contract.getStats(accounts[0])).totalCheckIns, 2n);
  console.log('PASS UTC day rollover, consecutive streak, and seven-day history');

  const nonexistentHash = `0x${'f'.repeat(64)}`;
  const account = getAddress(accounts[0]);
  const oldNonce = (await rpc.getTransactionCount(account, 'latest')) - 1;
  assert.ok(oldNonce >= 0);
  const pendingKey = `arc-daily:5042:${address}:${account}:pending`;
  const sendsBeforeRecovery = sentTransactions.length;
  await page.evaluate(({ key, hash, nonce }) => {
    localStorage.setItem(key, hash);
    localStorage.setItem(`${key}:nonce`, String(nonce));
  }, { key: pendingKey, hash: nonexistentHash, nonce: oldNonce });
  await page.reload();
  await waitText(page, '#message', '此前交易已结束');
  await waitText(page, '#total', '2');
  await waitText(page, '#checkin', '今日已签到');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), pendingKey), null);
  assert.equal(await page.evaluate(key => localStorage.getItem(`${key}:nonce`), pendingKey), null);
  assert.equal(await page.locator('#transaction').isVisible(), false);
  assert.equal(sentTransactions.length, sendsBeforeRecovery);
  assert.equal(await page.evaluate(() => window.__walletTest.requests.some(request => request.method === 'eth_requestAccounts')), false,
    'A refresh must restore a permitted wallet without another approval request.');
  console.log('PASS reload recovers a replaced pending check-in by mined nonce without sending again');

  const wrongAddress = '0x1000000000000000000000000000000000000001';
  await page.evaluate(value => localStorage.setItem('arc-daily:5042:contract', value), wrongAddress);
  await page.reload();
  await waitText(page, '#total', '2');
  assert.equal(await page.locator('#checkin').isDisabled(), true);
  assert.equal(await page.locator('#contract-link').getAttribute('href'), `https://explorer.arc.io/address/${address}`);
  assert.equal(await page.locator('a[href="/deploy.html"]').count(), 0);
  console.log('PASS configured contract ignores legacy browser-stored override');

  await page.locator('#connect').click();
  await waitText(page, '#status', '等待连接');
  await page.reload();
  await waitText(page, '#status', '等待连接');
  assert.equal(await page.evaluate(() => localStorage.getItem('arc-daily:5042:wallet')), null);
  await page.locator('#wallet-choice').selectOption({ label: 'Binance Wallet' });
  await page.locator('#connect').click();
  await waitText(page, '#connect', getAddress(accounts[2]).slice(0, 6));
  await page.reload();
  await waitText(page, '#connect', getAddress(accounts[2]).slice(0, 6));
  assert.equal(await page.evaluate(() => window.__walletTest.requests.some(request => request.method === 'eth_requestAccounts')), false);
  console.log('PASS MetaMask/Binance wallet selection, silent reload restoration, and explicit disconnect');

  const thirdWallet = new Contract(address, artifact.abi, await rpc.getSigner(2));
  await (await thirdWallet.checkIn()).wait();
  await page.clock.fastForward(60_100);
  await waitText(page, '#rank-total', '3 个钱包参与');
  assert.equal(await page.locator('#rank-rows .rank-item').count(), 3);
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoOverflow(page);
  const publicContext = await makeContext({ wallet: false });
  const publicPage = await publicContext.newPage();
  await publicPage.goto(baseUrl);
  await waitText(publicPage, '#rank-total', '3 个钱包参与');
  assert.equal(await publicPage.locator('#status').textContent(), '等待连接');
  await publicContext.close();
  console.log('PASS chain-event leaderboard includes every wallet and refreshes after one minute');

  assert.deepEqual(pageErrors, [], 'No unhandled browser errors are allowed.');
  assert.ok(blockedRequests.every(url => /fonts\.(googleapis|gstatic)\.com/.test(url)),
    `Unexpected external requests: ${JSON.stringify(blockedRequests)}`);
  console.log(`All UI checks passed. ${sentTransactions.length} local transactions; screenshots: test-results/desktop.png and test-results/mobile.png`);
} catch (error) {
  if (browser) {
    const page = browser.contexts().flatMap(context => context.pages()).at(-1);
    if (page) {
      await page.screenshot({ path: resolve(outputDir, 'failure.png'), fullPage: true }).catch(() => {});
      console.error('Failure page:', await page.locator('body').innerText().catch(() => 'unavailable'));
    }
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await vite?.close();
  rpc?.destroy();
  await chain.close();
}
