import { BrowserProvider, type Eip1193Provider, type JsonRpcSigner } from 'ethers';
import { ARC, validAddress } from './config';

type InjectedProvider = Eip1193Provider & {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};
type WalletChoice = { name: string; provider: InjectedProvider };
declare global { interface Window { ethereum?: InjectedProvider } }

export const wallets: WalletChoice[] = [];
export const session = { account: '', chainId: 0, revision: 0 };
let injected: InjectedProvider | undefined;
let onChange = () => {};

function announce(event: Event) {
  const detail = (event as CustomEvent<{ info: { name: string }; provider: InjectedProvider }>).detail;
  if (!detail?.provider || wallets.some(wallet => wallet.provider === detail.provider)) return;
  wallets.push({ name: detail.info.name, provider: detail.provider });
  updateChoices();
}
function updateChoices() {
  const select = document.getElementById('wallet-choice') as HTMLSelectElement | null;
  if (!select) return;
  const selected = select.value;
  select.replaceChildren(...wallets.map((wallet, index) => new Option(wallet.name, String(index))));
  if (selected) select.value = selected;
  select.hidden = wallets.length < 2;
  select.disabled = Boolean(session.account);
}

export function initializeWallet(callback: () => void) {
  onChange = callback;
  window.addEventListener('eip6963:announceProvider', announce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  if (window.ethereum && !wallets.some(wallet => wallet.provider === window.ethereum)) {
    wallets.push({ name: '浏览器钱包', provider: window.ethereum });
  }
  updateChoices();
}

const accountsChanged = (...args: unknown[]) => {
  const accounts = args[0] as string[];
  session.account = validAddress(accounts?.[0] || '');
  session.revision++;
  updateChoices();
  onChange();
};
const chainChanged = (...args: unknown[]) => {
  session.chainId = Number(args[0]);
  session.revision++;
  onChange();
};
const disconnected = () => { disconnect(); };

export function disconnect() {
  injected?.removeListener?.('accountsChanged', accountsChanged);
  injected?.removeListener?.('chainChanged', chainChanged);
  injected?.removeListener?.('disconnect', disconnected);
  injected = undefined;
  session.account = '';
  session.chainId = 0;
  session.revision++;
  updateChoices();
  onChange();
}

export async function connect() {
  if (!wallets.length && window.ethereum) wallets.push({ name: '浏览器钱包', provider: window.ethereum });
  const index = Number((document.getElementById('wallet-choice') as HTMLSelectElement)?.value || 0);
  const selected = wallets[index]?.provider;
  if (!selected) throw new Error('未检测到钱包。请在安装了 MetaMask、Rabby 等钱包扩展的浏览器，或钱包内置浏览器中打开。');
  const accounts = await selected.request({ method: 'eth_requestAccounts' }) as string[];
  const chain = await selected.request({ method: 'eth_chainId' }) as string;
  const account = validAddress(accounts[0] || '');
  if (!account) throw new Error('钱包未返回可用地址，请重试。');
  disconnect();
  injected = selected;
  injected.on?.('accountsChanged', accountsChanged);
  injected.on?.('chainChanged', chainChanged);
  injected.on?.('disconnect', disconnected);
  session.account = account;
  session.chainId = Number(chain);
  session.revision++;
  updateChoices();
  onChange();
}

export async function switchToArc() {
  if (!injected) throw new Error('请先连接钱包。');
  try {
    await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC.hexId }] });
  } catch (error) {
    const e = error as { code?: number; data?: { originalError?: { code?: number } } };
    if (e.code !== 4902 && e.data?.originalError?.code !== 4902) throw error;
    await injected.request({ method: 'wallet_addEthereumChain', params: [{
      chainId: ARC.hexId,
      chainName: ARC.name,
      rpcUrls: [ARC.rpc],
      nativeCurrency: ARC.nativeCurrency,
      blockExplorerUrls: [ARC.explorer],
    }] });
    await injected.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC.hexId }] });
  }
  session.chainId = Number(await injected.request({ method: 'eth_chainId' }));
  session.revision++;
  onChange();
  if (session.chainId !== ARC.id) throw new Error('请在钱包中切换到 Arc 主网。');
}

export async function signerForArc(): Promise<JsonRpcSigner> {
  if (!injected || !session.account) throw new Error('请先连接钱包。');
  if (Number(await injected.request({ method: 'eth_chainId' })) !== ARC.id) throw new Error('请先切换到 Arc 主网。');
  const provider = new BrowserProvider(injected, undefined, { cacheTimeout: -1 });
  const signer = await provider.getSigner(session.account);
  if (signer.address !== session.account) throw new Error('钱包账户已变更，请重新连接。');
  return signer;
}
