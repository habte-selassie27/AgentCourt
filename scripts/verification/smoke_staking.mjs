// Live escrow/staking smoke test against GenLayer Studionet.
// Deposits stake on the new core contract, reads it back, and (after a
// successful verdict-less path check) verifies settlement is blocked pre-verdict.
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

const RPC = process.env.GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';
const CORE = process.env.AGENTCOURT_CORE;
const KEY = process.env.GENLAYER_PRIVATE_KEY;
const RESPONDENT = process.env.RESPONDENT || '0x37cdbd86743e2b80486413e89ca4c70a58147889';

if (!CORE || !KEY) {
  console.error('Set AGENTCOURT_CORE and GENLAYER_PRIVATE_KEY');
  process.exit(1);
}

const account = createAccount(KEY);
console.log('account:', account.address);
const client = createClient({
  endpoint: RPC,
  chain: { ...studionet, rpcUrls: { default: { http: [RPC] } } },
  account,
});

async function executionFailed(hash) {
  const tx = await client.getTransaction({ hash });
  const s = JSON.stringify(tx);
  return s.includes('"execution_result":"ERROR"') || s.includes('"execution_result": "ERROR"');
}

async function write(method, args, value = 0n) {
  const hash = await client.writeContract({
    address: CORE,
    functionName: method,
    args,
    value,
  });
  await client.waitForTransactionReceipt({ hash, status: 'ACCEPTED', interval: 2000, retries: 60 });
  console.log(method, '-> accepted', hash);
  return hash;
}

async function read(method, args) {
  return client.readContract({ address: CORE, functionName: method, args });
}

// 1. create a dispute (claimant = KEY account, respondent = main account)
const countBefore = Number(await read('get_dispute_count', []));
await write('create_dispute', [
  RESPONDENT,
  '0x' + 'ab'.repeat(32),
  0,
  'Staking smoke test: escrow deposit and hold check.',
  1000000,
  1790000000,
]);
const countAfter = Number(await read('get_dispute_count', []));
if (countAfter !== countBefore + 1) {
  console.error('dispute count did not increase');
  process.exit(1);
}
const did = countAfter;
console.log('dispute id:', did);

// 2. deposit the claimant bond (payable, 1_000_000 wei of GEN)
await write('deposit_stake', [did], BigInt(1000000));

// 3. escrow held on-chain
const esc = await read('get_escrow', [did]);
console.log('escrow:', JSON.stringify(esc));
if (!esc || esc.claimant?.deposited !== true || Number(esc.claimant?.amount) !== 1000000) {
  console.error('escrow record wrong');
  process.exit(1);
}

// 4. settlement must be blocked before a verdict exists
const settleHash = await write('execute_settlement', [did]);
if (!(await executionFailed(settleHash))) {
  console.error('execute_settlement should have failed pre-verdict');
  process.exit(1);
}
console.log('execute_settlement pre-verdict correctly blocked (execution_result ERROR)');

console.log('LIVE STAKING SMOKE TEST PASSED');
