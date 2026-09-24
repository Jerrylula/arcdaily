import { ContractFactory, type TransactionReceipt } from 'ethers';
import { ARC, CONTRACT_KEY, arrow, el, errorText, logo, rpc, savedValue, saveValue, setMessage, shortAddress, validAddress } from './config';
import { artifact, ContractCodeError, feeQuote, usdc, verifyContract } from './chain';
import { connect, disconnect, initializeWallet, session, signerForArc, switchToArc } from './wallet';
import './style.css';

el('app').innerHTML = `<div class="page-shell setup-shell">
  <header class="site-header"><a class="brand" href="/">${logo}</a><a class="back-link" href="/">返回签到 ${arrow}</a></header>
  <main class="setup-main"><p class="eyebrow">PROJECT SETUP / ARC MAINNET</p><h1>让签到，上链。</h1><p class="muted">只需部署一次，所有钱包共用同一个签到合约。</p>
    <section class="setup-card"><h2>部署新的签到合约</h2><p>使用连接的钱包在 <strong>Arc 主网（5042）</strong>部署。部署会消耗真实 USDC Gas；合约不收取签到费，也没有管理员权限。</p>
      <div class="setup-wallet"><select id="wallet-choice" aria-label="选择钱包" hidden></select><button class="button secondary" id="connect">连接部署钱包 ${arrow}</button><span id="network-label">尚未连接</span></div>
      <div class="cost-row"><span>部署 Gas 预估上限</span><strong id="deploy-cost">—</strong></div>
      <label class="acknowledge"><input type="checkbox" id="acknowledge" />我了解这是主网部署，会支付真实的 USDC Gas。</label>
      <button class="button primary" id="deploy" disabled>部署签到合约 ${arrow}</button>
      <p class="gas-note">签名在你的钱包中完成，页面不读取私钥。</p>
    </section>
    <div id="message" class="message" role="status" aria-live="polite" hidden></div>
    <div id="deployment-result" class="deployment-result" hidden><h2>合约已部署</h2><code id="result-address"></code><div class="result-links"><a id="explorer-link" target="_blank" rel="noreferrer">查看合约 ↗</a><a href="/">前往签到 ↗</a></div><p>当前浏览器已保存地址。面向所有用户发布时，把以下配置写入项目的 <code>.env</code>，然后重新构建前端。</p><pre id="env-snippet"></pre></div>
    <section class="setup-card existing"><h2>已有签到合约？</h2><p>填入本项目部署的 Arc 主网合约地址，验证通过后用于当前浏览器。</p><form id="existing-form"><label for="existing-address">合约地址</label><div class="address-form"><input id="existing-address" placeholder="0x…" spellcheck="false" autocomplete="off" required /><button class="button secondary" id="save-address" type="submit">验证并保存</button></div></form><p class="gas-note">验证只读取链上数据，不会产生 Gas。</p></section>
  </main><footer><span>ARC DAILY <span class="footer-divider">/</span> 项目设置</span><a href="${ARC.explorer}" target="_blank" rel="noreferrer">Arc 主网浏览器 ↗</a></footer></div>`;

let busy = false;
let deployed = false;
let pendingDeployment = false;
let quoteVersion = 0;

function render() {
  const connected = Boolean(session.account);
  const correctChain = session.chainId === ARC.id;
  el<HTMLButtonElement>('connect').textContent = connected ? `${shortAddress(session.account)} · 断开` : '连接部署钱包 ↗';
  el<HTMLButtonElement>('connect').disabled = busy;
  el('network-label').textContent = !connected ? '尚未连接' : correctChain ? 'Arc 主网 · 5042' : '需要切换到 Arc 主网';
  el<HTMLButtonElement>('deploy').disabled = busy || deployed || pendingDeployment || !connected || !el<HTMLInputElement>('acknowledge').checked;
  el<HTMLButtonElement>('save-address').disabled = busy;
  el<HTMLButtonElement>('deploy').textContent = busy ? '正在处理，请留意钱包…' : deployed ? '合约已部署 ✓' : pendingDeployment ? '部署已提交，请核对结果' : connected && !correctChain ? '切换至 Arc 主网 ↗' : '部署签到合约 ↗';
}

async function updateQuote() {
  const version = ++quoteVersion;
  el('deploy-cost').textContent = '—';
  if (!session.account || session.chainId !== ARC.id) return;
  try {
    const cost = await feeQuote({ from: session.account, data: artifact.bytecode, value: 0n });
    if (version === quoteVersion) el('deploy-cost').textContent = `${usdc(cost.maximumCost)} USDC`;
  } catch { if (version === quoteVersion) el('deploy-cost').textContent = '以钱包预估为准'; }
}

function showResult(address: string) {
  saveValue(CONTRACT_KEY, address);
  el('deployment-result').hidden = false;
  el('result-address').textContent = address;
  el<HTMLAnchorElement>('explorer-link').href = `${ARC.explorer}/address/${address}`;
  el('env-snippet').textContent = `VITE_CHECKIN_CONTRACT_ADDRESS=${address}`;
}

function clearPendingDeployment() {
  pendingDeployment = false;
  saveValue('arc-daily:5042:pending-deployment', '');
  saveValue('arc-daily:5042:pending-deployment-tx', '');
  saveValue('arc-daily:5042:pending-deployment-nonce', '');
  saveValue('arc-daily:5042:pending-deployment-from', '');
}

initializeWallet(() => { render(); void updateQuote(); });
el('acknowledge').addEventListener('change', render);
el('connect').addEventListener('click', async () => {
  if (session.account) { disconnect(); return; }
  busy = true;
  render();
  try { await connect(); } catch (error) { setMessage(errorText(error), 'error'); }
  finally { busy = false; render(); }
});
el('deploy').addEventListener('click', async () => {
  if (busy || deployed || pendingDeployment || !el<HTMLInputElement>('acknowledge').checked) return;
  busy = true;
  render();
  setMessage('');
  let txHash = '';
  try {
    if (session.chainId !== ARC.id) { await switchToArc(); return; }
    const revision = session.revision;
    const signer = await signerForArc();
    const factory = new ContractFactory(artifact.abi, artifact.bytecode, signer);
    const cost = await feeQuote({ from: session.account, data: artifact.bytecode, value: 0n });
    if (revision !== session.revision) throw new Error('钱包或网络已变更，请重试。');
    const contract = await factory.deploy({ chainId: ARC.id, value: 0n, gasLimit: cost.gasLimit, maxFeePerGas: cost.maxFeePerGas, maxPriorityFeePerGas: cost.maxPriorityFeePerGas });
    const transaction = contract.deploymentTransaction()!;
    txHash = transaction.hash;
    // Persist the predicted address so a page reload never loses a submitted deployment.
    const predictedAddress = await contract.getAddress();
    el<HTMLInputElement>('existing-address').value = predictedAddress;
    saveValue('arc-daily:5042:pending-deployment', predictedAddress);
    saveValue('arc-daily:5042:pending-deployment-tx', txHash);
    saveValue('arc-daily:5042:pending-deployment-nonce', String(transaction.nonce));
    saveValue('arc-daily:5042:pending-deployment-from', transaction.from);
    pendingDeployment = true;
    setMessage(`部署交易已提交：${txHash}。请等待确认，不要重复部署。`);
    let receipt: TransactionReceipt | null;
    try { receipt = await transaction.wait(1, 120_000); }
    catch (error) {
      const replacement = error as { code?: string; receipt?: TransactionReceipt };
      if (replacement.code === 'TRANSACTION_REPLACED' && replacement.receipt) receipt = replacement.receipt;
      else throw error;
    }
    if (!receipt?.contractAddress || receipt.status !== 1) {
      if (receipt) { clearPendingDeployment(); txHash = ''; }
      throw new Error('交易未完成合约部署，请检查交易详情后重试。');
    }
    await verifyContract(receipt.contractAddress);
    deployed = true;
    clearPendingDeployment();
    showResult(receipt.contractAddress);
    setMessage(`主网部署成功，实际 Gas 为 ${usdc(receipt.fee)} USDC。`, 'success');
  } catch (error) {
    if (txHash) {
      const receipt = await rpc.getTransactionReceipt(txHash).catch(() => null);
      if (receipt?.status === 0) {
        clearPendingDeployment();
        setMessage('部署交易执行失败。可查看交易详情后重新部署，失败交易仍会消耗网络 Gas。', 'error');
      } else {
        pendingDeployment = true;
        setMessage(`部署已提交，请在 Arc 浏览器核对交易 ${txHash}。确认后，可用下方预填地址验证并保存。`, 'info');
      }
      const link = document.createElement('a');
      link.href = `${ARC.explorer}/tx/${txHash}`;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = ' 查看部署交易 ↗';
      el('message').append(link);
    } else setMessage(errorText(error), 'error');
  } finally { busy = false; render(); }
});

el('existing-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy) return;
  const address = validAddress(el<HTMLInputElement>('existing-address').value.trim());
  if (!address) { setMessage('请输入有效的非零 EVM 合约地址。', 'error'); return; }
  busy = true;
  render();
  try {
    await verifyContract(address);
    showResult(address);
    if (savedValue('arc-daily:5042:pending-deployment').toLowerCase() === address.toLowerCase()) clearPendingDeployment();
    deployed = true;
    setMessage('合约验证通过，地址已保存到当前浏览器。', 'success');
  } catch (error) { setMessage(errorText(error), 'error'); }
  finally { busy = false; render(); }
});
try {
  const pending = localStorage.getItem('arc-daily:5042:pending-deployment');
  if (pending && validAddress(pending)) {
    el<HTMLInputElement>('existing-address').value = pending;
    setMessage('检测到此前提交的部署地址。请先在下方验证，避免重复部署。');
    pendingDeployment = true;
    const hash = savedValue('arc-daily:5042:pending-deployment-tx');
    if (/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      const link = document.createElement('a');
      link.href = `${ARC.explorer}/tx/${hash}`;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = ' 查看部署交易 ↗';
      el('message').append(link);
      void rpc.getTransactionReceipt(hash).then(async receipt => {
        if (receipt?.status === 0) {
          clearPendingDeployment();
          setMessage('此前部署交易已失败，可重新部署。失败交易仍会消耗网络 Gas。', 'error');
          render();
        } else if (!receipt) {
          const nonce = savedValue('arc-daily:5042:pending-deployment-nonce');
          const from = validAddress(savedValue('arc-daily:5042:pending-deployment-from'));
          if (from && /^\d+$/.test(nonce) && await rpc.getTransactionCount(from, 'latest') > Number(nonce)) {
            // A replacement deployment has the same from+nonce and predicted address.
            try {
              await verifyContract(pending);
              showResult(pending);
              deployed = true;
              clearPendingDeployment();
              setMessage('此前部署已确认，合约验证通过。', 'success');
            } catch (error) {
              if (error instanceof ContractCodeError) {
                clearPendingDeployment();
                setMessage('此前交易已被替换或取消，未找到本项目合约。请核对交易详情后再部署。');
              } else {
                setMessage('暂时无法核对此前部署结果，请稍后刷新或验证下方地址。');
              }
            }
            render();
          }
        }
      }).catch(() => {});
    }
  }
} catch { /* Storage is optional. */ }
render();
