import { Contract, formatUnits, keccak256, parseUnits, type Provider, type TransactionReceipt, type TransactionRequest } from 'ethers';
import artifact from './generated/ArcCheckIn.json';
import { ARC, rpc } from './config';

export { artifact };

export class ContractCodeError extends Error {}

export async function verifyContract(address: string, provider: Provider = rpc) {
  if ((await provider.getNetwork()).chainId !== BigInt(ARC.id)) throw new Error('RPC 网络与 Arc 主网不符，已停止操作。');
  const code = await provider.getCode(address);
  if (code === '0x') throw new ContractCodeError('该地址在 Arc 主网上没有合约，请先部署或检查地址。');
  if (keccak256(code) !== keccak256(artifact.deployedBytecode)) throw new ContractCodeError('该地址的合约代码与本项目不一致，已停止操作。');
}

export async function feeQuote(transaction: TransactionRequest) {
  const [gas, fee, block] = await Promise.all([
    rpc.estimateGas(transaction), rpc.getFeeData(), rpc.getBlock('latest'),
  ]);
  const tip = fee.maxPriorityFeePerGas ?? parseUnits('1', 'gwei');
  const candidates = [fee.maxFeePerGas ?? fee.gasPrice ?? 0n, (block?.baseFeePerGas ?? 0n) * 2n + tip, parseUnits('20', 'gwei')];
  const maxFeePerGas = candidates.reduce((a, b) => a > b ? a : b);
  const gasLimit = (gas * 120n + 99n) / 100n;
  return { gasLimit, maxFeePerGas, maxPriorityFeePerGas: tip, maximumCost: gasLimit * maxFeePerGas };
}

export function usdc(value: bigint) {
  const number = Number(formatUnits(value, 18));
  return number > 0 && number < 0.000001 ? '< 0.000001' : number.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function isCheckInReceipt(receipt: TransactionReceipt, address: string, account: string) {
  if (receipt.status !== 1 || receipt.to?.toLowerCase() !== address.toLowerCase()) return false;
  const contract = new Contract(address, artifact.abi);
  return receipt.logs.some(log => {
    if (log.address.toLowerCase() !== address.toLowerCase()) return false;
    try {
      const event = contract.interface.parseLog(log);
      return event?.name === 'CheckedIn' && event.args.user.toLowerCase() === account.toLowerCase();
    } catch { return false; }
  });
}
