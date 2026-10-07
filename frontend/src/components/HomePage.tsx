import { GENLAYER_EXPLORER_URL } from '../sdk';

interface HomePageProps {
  onGoToDashboard: () => void;
  onCreateDispute: () => void;
}

const features = [
  {
    icon: '📎',
    title: 'Evidence first',
    body: 'Structured evidence records with source, timestamp, content hash, and provenance — conclusions must reference evidence, not rhetoric.',
  },
  {
    icon: '🧭',
    title: 'Independent reasoning',
    body: 'Four evaluator roles reason separately over the same normalized evidence so correlated mistakes are surfaced instead of averaged away.',
  },
  {
    icon: '⚔️',
    title: 'Adversarial review',
    body: 'A dedicated challenger tries to break the emerging majority: unsupported assumptions, manipulated sources, misread agreements.',
  },
  {
    icon: '🤝',
    title: 'Consensus on-chain',
    body: 'Validators re-derive the consensus exactly and independently re-check decisive verdicts — the outcome is derived, never supplied by a caller.',
  },
  {
    icon: '🔒',
    title: 'Staking escrow',
    body: 'Both parties bond their stake via deposit_stake; funds are held by the core contract and released or slashed strictly per the final verdict.',
  },
  {
    icon: '🚫',
    title: 'Fail-closed verdicts',
    body: 'Uncertainty is a valid outcome: reviewRequired verdicts freeze settlement and keep funds escrowed instead of guessing.',
  },
];

const lifecycle = [
  { step: '01', label: 'Claim', body: 'Parties file a structured claim against a machine-readable agreement' },
  { step: '02', label: 'Evidence', body: 'Both sides submit verifiable evidence references' },
  { step: '03', label: 'Investigation', body: 'External sources are fetched inside the nondeterministic block' },
  { step: '04', label: 'Deliberation', body: 'Independent evaluators reason over the same evidence' },
  { step: '05', label: 'Adversarial review', body: 'The emerging conclusion is challenged' },
  { step: '06', label: 'Consensus', body: 'Validators reconcile evaluations into one result' },
  { step: '07', label: 'Verdict', body: 'TRUE / FALSE / MISLEADING / UNVERIFIABLE / REVIEW with confidence' },
  { step: '08', label: 'Settlement', body: 'Escrow releases or freezes funds per predefined rules' },
];

const contracts = [
  { name: 'AgentCourtCore', env: import.meta.env.VITE_AGENTCOURT_CORE, note: 'Disputes, evidence, evaluation, escrow' },
  { name: 'ResolutionManager', env: import.meta.env.VITE_RESOLUTION_MANAGER, note: 'Settlement + appeals' },
];

function explorerAddressUrl(address: string): string {
  return `${GENLAYER_EXPLORER_URL}/address/${address}`;
}

export function HomePage({ onGoToDashboard, onCreateDispute }: HomePageProps) {
  return (
    <>
      <section className="hero home-hero">
        <div className="hero-eyebrow">Autonomous arbitration · GenLayer Studionet · Chain 61999</div>
        <h2>When agents disagree, let the evidence speak</h2>
        <p>
          AgentCourt turns machine-to-machine disputes into an executable investigation:
          verifiable evidence, independent reasoning, adversarial review, and consensus —
          resolved into a machine-readable verdict that escrow contracts settle deterministically.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={onCreateDispute}>
            + File a Dispute
          </button>
          <button className="btn btn-secondary" onClick={onGoToDashboard}>
            Browse Disputes
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-header">
          <h2>Why AgentCourt</h2>
        </div>
        <div className="feature-grid">
          {features.map((f) => (
            <article className="feature-card" key={f.title}>
              <span className="feature-icon" role="img" aria-hidden="true">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-section">
        <div className="section-header">
          <h2>Dispute lifecycle</h2>
        </div>
        <ol className="lifecycle">
          {lifecycle.map((s) => (
            <li className="lifecycle-step" key={s.step}>
              <span className="lifecycle-num">{s.step}</span>
              <div>
                <h3>{s.label}</h3>
                <p>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-section">
        <div className="section-header">
          <h2>Deployed contracts</h2>
          <span className="section-meta">GenLayer Studionet · 61999</span>
        </div>
        <div className="contract-grid">
          {contracts.map((c) => (
            <article className="contract-card" key={c.name}>
              <h3>{c.name}</h3>
              <p className="contract-note">{c.note}</p>
              {c.env ? (
                <a
                  className="contract-address"
                  href={explorerAddressUrl(c.env)}
                  target="_blank"
                  rel="noreferrer"
                  title={c.env}
                >
                  {c.env}
                </a>
              ) : (
                <span className="contract-address unset">not configured (VITE_ env var)</span>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="home-section home-cta">
        <div className="cta-card">
          <div>
            <h2>Ready to open a case?</h2>
            <p>Define the agreement, attach evidence, and let the protocol investigate.</p>
          </div>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onCreateDispute}>
              Create Dispute
            </button>
            <button className="btn btn-secondary" onClick={onGoToDashboard}>
              View Dashboard
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
