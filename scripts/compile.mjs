import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function compileContract() {
  const source = await readFile(resolve(root, 'contracts/ArcCheckIn.sol'), 'utf8');
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity',
    sources: { 'ArcCheckIn.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
    },
  })));
  const errors = (output.errors ?? []).filter((item) => item.severity === 'error');
  if (errors.length) throw new Error(errors.map((item) => item.formattedMessage).join('\n'));

  const contract = output.contracts['ArcCheckIn.sol'].ArcCheckIn;
  return {
    contractName: 'ArcCheckIn',
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
    deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const artifact = await compileContract();
  const frontendArtifact = {
    contractName: artifact.contractName,
    abi: artifact.abi,
    deployedBytecode: artifact.deployedBytecode,
  };
  for (const [relativePath, contents] of [
    ['artifacts/ArcCheckIn.json', artifact],
    ['src/generated/ArcCheckIn.json', frontendArtifact],
  ]) {
    const outputPath = resolve(root, relativePath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(contents, null, 2)}\n`);
  }
  console.log(`Compiled ${artifact.contractName} with solc ${solc.version()} (EVM paris).`);
}
