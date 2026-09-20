/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_AGENTCOURT_CORE?: string;
  readonly VITE_DISPUTE_REGISTRY?: string;
  readonly VITE_RESOLUTION_MANAGER?: string;
  readonly VITE_DISPUTE_JUDGE?: string;
  readonly VITE_EVIDENCE_VERIFIER?: string;
  readonly VITE_ADVERSARIAL_REVIEWER?: string;
  readonly VITE_CONSENSUS_ENGINE?: string;
  readonly VITE_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
