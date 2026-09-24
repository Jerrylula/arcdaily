import { FetchRequest, JsonRpcProvider, getAddress, isAddress, ZeroAddress } from 'ethers';
import { t } from './i18n';

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
  if (configured && !validAddress(configured)) throw new Error(t('invalidContract'));
  return configured || '';
}
export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
export function errorText(error: unknown): string {
  const e = error as { code?: string | number; message?: string; shortMessage?: string; info?: { error?: { code?: number; message?: string } } };
  const message = `${e?.shortMessage || e?.message || ''} ${e?.info?.error?.message || ''}`;
  if (e?.code === 4001 || e?.code === 'ACTION_REJECTED' || e?.info?.error?.code === 4001) return t('rejected');
  if (/insufficient funds/i.test(message)) return t('insufficientFunds');
  if (/AlreadyCheckedIn/i.test(message)) return t('alreadyChecked');
  if (/timeout|TIMEOUT|Failed to fetch|network|SERVER_ERROR|fetch|ECONNREFUSED/i.test(message)) return t('networkError');
  return e instanceof Error ? (e.message.length < 180 ? e.message : t('requestFailed')) : t('retry');
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
