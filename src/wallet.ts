import { BrowserProvider, type Eip1193Provider, type JsonRpcSigner } from 'ethers';
import { ARC, savedValue, saveValue, validAddress } from './config';
import { t } from './i18n';

type InjectedProvider = Eip1193Provider & {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  providers?: InjectedProvider[];
  isMetaMask?: boolean;
  isBinance?: boolean;
  isRabby?: boolean;
};
type WalletChoice = { id: string; name: string; provider: InjectedProvider };
type Announcement = { info?: { name?: string; rdns?: string }; provider?: InjectedProvider };
declare global { interface Window { ethereum?: InjectedProvider; BinanceChain?: InjectedProvider } }

const preferenceKey = `arc-daily:${ARC.id}:wallet`;
export const wallets: WalletChoice[] = [];
export const session = { account: '', chainId: 0, revision: 0 };
let injected: InjectedProvider | undefined;
let onChange = () => {};
let restoreInFlight = false;
let generation = 0;

function updateChoices() {
  const select = document.getElementById('wallet-choice') as HTMLSelectElement | null;
  if (!select) return;
  const selected = select.value;
  select.replaceChildren(...wallets.map((wallet, index) => new Option(wallet.name, String(index))));
  if (selected && Number(selected) < wallets.length) select.value = selected;
  select.hidden = Boolean(session.account) || wallets.length === 0;
  select.disabled = Boolean(session.account);
}

export function refreshWalletChoices() {
  for (const wallet of wallets) if (wallet.id === 'injected:browser') wallet.name = t('genericWallet');
  updateChoices();
}

function register(provider: InjectedProvider | undefined, name: string, id: string) {
  if (!provider || typeof provider.request !== 'function') return;
  const existing = wallets.find(wallet => wallet.provider === provider);
  if (existing) {
    if (name !== t('genericWallet')) existing.name = name;
  } else {
    wallets.push({ provider, name, id });
  }
  updateChoices();
  void restoreSession();
}

function fallbackName(provider: InjectedProvider) {
  return provider.isBinance ? 'Binance Wallet' : provider.isRabby ? 'Rabby' : provider.isMetaMask ? 'MetaMask' : t('genericWallet');
}

function fallbackId(provider: InjectedProvider) {
  return provider.isBinance ? 'injected:binance' : provider.isRabby ? 'injected:rabby' : provider.isMetaMask ? 'injected:metamask' : 'injected:browser';
}

function announce(event: Event) {
  const detail = (event as CustomEvent<Announcement>).detail;
  if (!detail?.provider) return;
  const name = detail.info?.name?.trim() || fallbackName(detail.provider);
  const id = detail.info?.rdns?.trim().toLowerCase() || fallbackId(detail.provider);
  register(detail.provider, name, id);
}

function discoverFallbacks() {
  const providers = window.ethereum?.providers ?? (window.ethereum ? [window.ethereum] : []);
  for (const provider of providers) register(provider, fallbackName(provider), fallbackId(provider));
  register(window.BinanceChain, 'Binance Wallet', 'injected:binance');
}

function detach() {
  injected?.removeListener?.('accountsChanged', accountsChanged);
  injected?.removeListener?.('chainChanged', chainChanged);
  injected?.removeListener?.('disconnect', disconnected);
  injected = undefined;
}

function attach(wallet: WalletChoice, account: string, chainId: number) {
  detach();
  injected = wallet.provider;
  injected.on?.('accountsChanged', accountsChanged);
  injected.on?.('chainChanged', chainChanged);
  injected.on?.('disconnect', disconnected);
  session.account = account;
  session.chainId = chainId;
  session.revision++;
  saveValue(preferenceKey, wallet.id);
  updateChoices();
  onChange();
}

export function initializeWallet(callback: () => void) {
  onChange = callback;
  window.addEventListener('eip6963:announceProvider', announce);
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  discoverFallbacks();
  window.addEventListener('focus', () => { discoverFallbacks(); void restoreSession(); });
  updateChoices();
}

export async function restoreSession() {
  const id = savedValue(preferenceKey);
  const wallet = wallets.find(choice => choice.id === id);
  if (!id || !wallet || session.account || restoreInFlight) return;
  restoreInFlight = true;
  const started = generation;
  try {
    // eth_accounts is read-only and never opens a wallet approval popup.
    const accounts = await wallet.provider.request({ method: 'eth_accounts' }) as string[];
    const account = validAddress(accounts?.[0] || '');
    if (!account) return;
    const chainId = Number(await wallet.provider.request({ method: 'eth_chainId' }));
    if (started !== generation || session.account || savedValue(preferenceKey) !== id) return;
    attach(wallet, account, chainId);
  } catch { /* The wallet may be locked or unavailable. A manual connect still works. */ }
  finally { restoreInFlight = false; }
}

const accountsChanged = (...args: unknown[]) => {
  session.account = validAddress((args[0] as string[] | undefined)?.[0] || '');
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
  generation++;
  saveValue(preferenceKey, '');
  detach();
  session.account = '';
  session.chainId = 0;
  session.revision++;
  updateChoices();
  onChange();
}

export async function connect() {
  discoverFallbacks();
  const index = Number((document.getElementById('wallet-choice') as HTMLSelectElement)?.value || 0);
  const wallet = wallets[index];
  if (!wallet) throw new Error(t('missingWallet'));
  generation++;
  const started = generation;
  const accounts = await wallet.provider.request({ method: 'eth_requestAccounts' }) as string[];
  const chainId = Number(await wallet.provider.request({ method: 'eth_chainId' }));
  const account = validAddress(accounts?.[0] || '');
  if (!account) throw new Error(t('noAccount'));
  if (started !== generation) return;
  attach(wallet, account, chainId);
}

export async function switchToArc() {
  if (!injected) throw new Error(t('connectFirst'));
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
  if (session.chainId !== ARC.id) throw new Error(t('selectArc'));
}

export async function signerForArc(): Promise<JsonRpcSigner> {
  if (!injected || !session.account) throw new Error(t('connectFirst'));
  if (Number(await injected.request({ method: 'eth_chainId' })) !== ARC.id) throw new Error(t('switchFirst'));
  const provider = new BrowserProvider(injected, undefined, { cacheTimeout: -1 });
  const signer = await provider.getSigner(session.account);
  if (signer.address !== session.account) throw new Error(t('walletAccountChanged'));
  return signer;
}
