/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  readonly VITE_AGENTCOURT_CORE: string;
  readonly VITE_DISPUTE_REGISTRY: string;
  readonly VITE_EVIDENCE_REGISTRY: string;
  readonly VITE_VERDICT_REGISTRY: string;
  readonly VITE_CHAIN_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
