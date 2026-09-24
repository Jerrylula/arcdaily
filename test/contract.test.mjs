import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BrowserProvider, ContractFactory } from 'ethers';
import ganache from 'ganache';
import { compileContract } from '../scripts/compile.mjs';

const artifact = await compileContract();
const DAY = 86_400;

async function fixture(t, timestamp = 30_000 * DAY + 12 * 3_600) {
  const rpc = ganache.provider({
    logging: { quiet: true },
    chain: { time: new Date(timestamp * 1_000), hardfork: 'shanghai' },
    miner: { timestampIncrement: 0 },
    wallet: { deterministic: true, totalAccounts: 3 },
  });
  const provider = new BrowserProvider(rpc, undefined, { cacheTimeout: -1 });
  provider.pollingInterval = 10;
  t.after(async () => {
    provider.destroy();
    await rpc.disconnect();
  });
  const signer = await provider.getSigner(0);
  const other = await provider.getSigner(1);
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy();
  await contract.waitForDeployment();

  async function setTime(nextTimestamp) {
    await rpc.request({ method: 'evm_setTime', params: [nextTimestamp * 1_000] });
    await rpc.request({ method: 'evm_mine', params: [] });
  }

  async function checkIn(connected = contract) {
    const transaction = await connected.checkIn();
    return transaction.wait();
  }

  return { rpc, provider, signer, other, contract, setTime, checkIn };
}

test('a first check-in on day zero counts once and emits the wallet and UTC day', async (t) => {
  const { contract, signer, checkIn } = await fixture(t, 12 * 3_600);
  const address = await signer.getAddress();
  assert.deepEqual(Array.from(await contract.getStats(address)), [0n, 0n, 0n, 0n, false]);

  const receipt = await checkIn();
  const event = receipt.logs.map((log) => contract.interface.parseLog(log)).find((log) => log?.name === 'CheckedIn');
  assert.ok(event);
  assert.deepEqual(Array.from(event.args), [address, 0n, 1n, 1n]);
  assert.deepEqual(Array.from(await contract.getStats(address)), [1n, 0n, 1n, 1n, true]);
  assert.equal(await contract.hasCheckedIn(address, 0), true);
  assert.equal(await contract.totalCheckIns(), 1n);
  assert.equal(await contract.totalUsers(), 1n);
});

test('a duplicate day fails with AlreadyCheckedIn and preserves totals', async (t) => {
  const { contract, signer, checkIn } = await fixture(t);
  await checkIn();
  await assert.rejects(contract.checkIn.staticCall(), (error) => {
    assert.equal(error.revert?.name, 'AlreadyCheckedIn');
    assert.equal(error.revert?.args[0], 30_000n);
    return true;
  });
  // Explicit gas makes the rejected transaction execute on the EVM as well.
  const rejected = await contract.checkIn({ gasLimit: 250_000 });
  await assert.rejects(rejected.wait());
  assert.equal((await contract.getStats(await signer.getAddress())).totalCheckIns, 1n);
  assert.equal(await contract.totalCheckIns(), 1n);
});

test('UTC midnight allows the next check-in without waiting 24 hours', async (t) => {
  const { contract, signer, checkIn, setTime } = await fixture(t, 30_001 * DAY - 1);
  const address = await signer.getAddress();
  await checkIn();
  await setTime(30_001 * DAY);
  assert.equal((await contract.getStats(address)).checkedInToday, false);
  assert.equal((await contract.getStats(address)).currentStreak, 1n);
  await checkIn();
  assert.deepEqual(Array.from(await contract.getStats(address)), [2n, 30_001n, 2n, 2n, true]);
  assert.equal(await contract.hasCheckedIn(address, 30_000), true);
  assert.equal(await contract.hasCheckedIn(address, 30_001), true);
});

test('missed UTC days expire the displayed streak and preserve the longest streak', async (t) => {
  const { contract, signer, checkIn, setTime } = await fixture(t);
  const address = await signer.getAddress();
  await checkIn();
  await setTime(30_001 * DAY);
  await checkIn();
  await setTime(30_002 * DAY);
  await checkIn();
  await setTime(30_003 * DAY);
  assert.equal((await contract.getStats(address)).currentStreak, 3n);
  await setTime(30_004 * DAY);
  assert.deepEqual(Array.from(await contract.getStats(address)), [3n, 30_002n, 0n, 3n, false]);
  await checkIn();
  assert.deepEqual(Array.from(await contract.getStats(address)), [4n, 30_004n, 1n, 3n, true]);
  assert.equal(await contract.hasCheckedIn(address, 30_003), false);
});

test('wallet records are isolated while global counters count users and check-ins', async (t) => {
  const { contract, signer, other, checkIn, setTime } = await fixture(t);
  const first = await signer.getAddress();
  const second = await other.getAddress();
  await checkIn();
  assert.deepEqual(Array.from(await contract.getStats(second)), [0n, 0n, 0n, 0n, false]);
  assert.equal(await contract.hasCheckedIn(second, 30_000), false);
  await checkIn(contract.connect(other));
  await setTime(30_001 * DAY);
  await checkIn();
  assert.deepEqual(Array.from(await contract.getStats(first)), [2n, 30_001n, 2n, 2n, true]);
  assert.deepEqual(Array.from(await contract.getStats(second)), [1n, 30_000n, 1n, 1n, false]);
  assert.equal(await contract.totalUsers(), 2n);
  assert.equal(await contract.totalCheckIns(), 3n);
});

test('check-in accepts no payment, rejects native transfers, and leaves contract balance zero', async (t) => {
  const { contract, provider, signer, checkIn } = await fixture(t);
  const address = await contract.getAddress();
  const paidCall = await signer.sendTransaction({
    to: address,
    data: contract.interface.encodeFunctionData('checkIn'),
    value: 1n,
    gasLimit: 250_000,
  });
  await assert.rejects(paidCall.wait());
  const transfer = await signer.sendTransaction({ to: address, value: 1n, gasLimit: 30_000 });
  await assert.rejects(transfer.wait());
  assert.equal(await contract.totalCheckIns(), 0n);

  const balanceBefore = await provider.getBalance(await signer.getAddress());
  const receipt = await checkIn();
  const balanceAfter = await provider.getBalance(await signer.getAddress());
  assert.equal(balanceBefore - balanceAfter, receipt.fee);
  assert.equal(await provider.getBalance(address), 0n);
  assert.equal(await contract.totalCheckIns(), 1n);
});
