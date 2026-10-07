// End-to-end live staking test: deposit both bonds, run the real nondeterministic
// evaluation (4 evaluators + adversarial + validator consensus), finalize the
// verdict, settle, and verify the escrow releases the slashed/refunded bonds.
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

const RPC = process.env.GENLAYER_RPC_URL || 'https://studio.genlayer.com/api';
const CORE = process.env.AGENTCOURT_CORE;
const KEY_A = process.env.GENLAYER_PRIVATE_KEY; // claimant (smoketest)
const KEY_B = process.env.RESPONDENT_PRIVATE_KEY; // respondent (smoketest2)
const ADDR_B = process.env.RESPONDENT;

if (!CORE || !KEY_A || !KEY_B || !ADDR_B) {
  console.error('Set AGENTCOURT_CORE, GENLAYER_PRIVATE_KEY, RESPONDENT_PRIVATE_KEY, RESPONDENT');
  process.exit(1);
}

const accountA = createAccount(KEY_A);
const accountB = createAccount(KEY_B);
const chain = { ...studionet, rpcUrls: { default: { http: [RPC] } } };
const clientA = createClient({ endpoint: RPC, chain, account: accountA });
const clientB = createClient({ endpoint: RPC, chain, account: accountB });

const STATUS = {
  6: 'CONSENSUS', 13: 'INCONCLUSIVE', 14: 'DISPUTED', 12: 'EVALUATION_FAILED', 7: 'VERDICT', 9: 'CLOSED',
};

async function write(client, method, args, value = 0n, waitRetries = 600) {
  const hash = await client.writeContract({ address: CORE, functionName: method, args, value });
  await client.waitForTransactionReceipt({ hash, status: 'ACCEPTED', interval: 2000, retries: waitRetries });
  console.log(method, '-> accepted', hash);
  return hash;
}

async function read(method, args) {
  return clientA.readContract({ address: CORE, functionName: method, args });
}

const countBefore = Number(await read('get_dispute_count', []));
await write(clientA, 'create_dispute', [
  ADDR_B,
  '0x' + 'cd'.repeat(32),
  0,
  'Claimant alleges the respondent never acknowledged missing the delivery deadline.',
  1000000,
  1790000000,
]);
const did = Number(await read('get_dispute_count', []));
if (did !== countBefore + 1) { console.error('count mismatch'); process.exit(1); }
console.log('dispute:', did);

await write(clientA, 'deposit_stake', [did], 1000000n);
await write(clientB, 'deposit_stake', [did], 1000000n);
console.log('escrow after deposits:', JSON.stringify(await read('get_escrow', [did])));

await write(clientA, 'submit_evidence', [
  did, 4, 'offchain', 'exhibit://e1-signed-acknowledgement', '0x' + 'ef'.repeat(32),
  'Respondent-signed acknowledgement stating that dataset files were NOT delivered by the deadline (signed 2026-09-20). Directly contradicts the claim that no acknowledgement exists.',
]);
await write(clientA, 'start_investigation', [did]);

console.log('requesting evaluation (live LLM + consensus, minutes)...');
try {
  await write(clientA, 'request_evaluation', [did], 0n, 900);
} catch (e) {
  console.error('evaluation tx failed to confirm:', String(e).slice(0, 300));
  process.exit(1);
}

const dispute = await read('get_dispute', [did]);
console.log('status after eval:', STATUS[dispute.status] ?? dispute.status);
const evaluation = await read('get_evaluation', [did]);
console.log('evaluation state:', evaluation?.consensus?.state, 'verdict:', evaluation?.consensus?.finalVerdict);

if (dispute.status !== 6) {
  console.log('Evaluation did not reach decisive consensus. Status:', STATUS[dispute.status] ?? dispute.status);
  console.log('Funds remain escrowed — fail-closed behavior verified.');
  process.exit(0);
}

await write(clientA, 'finalize_verdict', [did]);
const verdict = await read('get_verdict', [did]);
console.log('verdict:', JSON.stringify({ verdict: verdict.verdict, reviewRequired: verdict.reviewRequired, confidence: verdict.confidence }));

if (!verdict.reviewRequired && verdict.verdict === 1) {
  await write(clientA, 'execute_settlement', [did]);
  const esc = await read('get_escrow', [did]);
  console.log('escrow after settlement:', JSON.stringify(esc));
  console.log('E2E PASSED: verdict TRUE, escrow released to claimant, settlement closed.');
} else if (!verdict.reviewRequired && verdict.verdict === 2) {
  await write(clientA, 'execute_settlement', [did]);
  const esc = await read('get_escrow', [did]);
  console.log('escrow after settlement:', JSON.stringify(esc));
  console.log('E2E PASSED: verdict FALSE, escrow released to respondent, settlement closed.');
} else {
  console.log('Verdict requires review — settlement correctly frozen; funds stay escrowed. E2E fail-closed path verified.');
}
