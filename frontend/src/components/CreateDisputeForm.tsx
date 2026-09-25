import { useState, useMemo, useEffect, useRef } from 'react';
import { TransactionPendingError, explorerTxUrl, getCourt } from '../sdk';
import { parseEther, ZeroHash } from 'ethers';

interface CreateDisputeFormProps {
  onCreated: (id: bigint) => void;
  onCancel: () => void;
}

const DRAFT_KEY = 'agentcourt.createDispute.draft.v1';
const PENDING_KEY = 'agentcourt.createDispute.pendingId';

interface CreateDisputeDraft {
  respondent: string;
  agreementHash: string;
  claimType: string;
  description: string;
  stake: string;
  deadline: string;
  evidence: EvidenceDraft[];
}

function loadDraft(): Partial<CreateDisputeDraft> | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<CreateDisputeDraft>;
  } catch {
    return null;
  }
}

function saveDraft(draft: CreateDisputeDraft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage full / private mode — draft is best-effort
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function loadPendingId(): bigint | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const n = BigInt(raw);
    return n > 0n ? n : null;
  } catch {
    return null;
  }
}

function savePendingId(id: bigint): void {
  try {
    localStorage.setItem(PENDING_KEY, id.toString());
  } catch {
    // ignore
  }
}

function clearPendingId(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
}

function draftHasContent(draft: Partial<CreateDisputeDraft> | null): boolean {
  if (!draft) return false;
  if (draft.respondent?.trim()) return true;
  if (draft.agreementHash?.trim()) return true;
  if (draft.description?.trim()) return true;
  if (draft.stake?.trim()) return true;
  if (Array.isArray(draft.evidence)) {
    return draft.evidence.some((e) => e?.source?.trim() || e?.refUri?.trim() || e?.description?.trim() || e?.contentHash?.trim());
  }
  return false;
}

const EVIDENCE_TYPES = [
  { value: 'ONCHAIN_TRANSACTION', label: 'On-chain Transaction' },
  { value: 'WEB_PAGE', label: 'Web Page' },
  { value: 'API_RESPONSE', label: 'API Response' },
  { value: 'SIGNED_MESSAGE', label: 'Signed Message' },
  { value: 'CONTENT_HASH', label: 'Content Hash' },
  { value: 'CUSTOM', label: 'Custom' },
];

const CLAIM_TYPES = [
  { value: 'DELIVERY_FAILURE', label: 'Delivery Failure' },
  { value: 'PAYMENT_FAILURE', label: 'Payment Failure' },
  { value: 'PERFORMANCE_FAILURE', label: 'Performance Failure' },
  { value: 'DATA_QUALITY', label: 'Data Quality' },
  { value: 'MARKETPLACE_VIOLATION', label: 'Marketplace Violation' },
  { value: 'AGENT_CONTRACT_BREACH', label: 'Agent Contract Breach' },
  { value: 'ORACLE_MALFUNCTION', label: 'Oracle Malfunction' },
  { value: 'ESCROW_DISPUTE', label: 'Escrow Dispute' },
];

interface EvidenceDraft {
  evidenceType: string;
  source: string;
  refUri: string;
  contentHash: string;
  description: string;
}

function emptyEvidence(): EvidenceDraft {
  return {
    evidenceType: 'ONCHAIN_TRANSACTION',
    source: '',
    refUri: '',
    contentHash: '',
    description: '',
  };
}

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
}

const labelStyle = {
  display: 'block',
  marginBottom: '0.5rem',
  color: 'var(--text-secondary)',
  fontSize: '0.85rem',
} as const;

const fieldStyle = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
} as const;

const monoFieldStyle = { ...fieldStyle, fontFamily: 'monospace' } as const;

const errorBannerStyle = {
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  color: '#fca5a5',
  fontSize: '0.9rem',
} as const;

const successBannerStyle = {
  background: 'rgba(34,197,94,0.1)',
  border: '1px solid rgba(34,197,94,0.3)',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  color: '#86efac',
  fontSize: '0.9rem',
} as const;

export function CreateDisputeForm({ onCreated, onCancel }: CreateDisputeFormProps) {
  const defaultDeadline = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    return toDatetimeLocal(d.getTime());
  }, []);

  const restoredDraft = useMemo(() => loadDraft(), []);
  const hadDraft = useRef(draftHasContent(restoredDraft));

  const [respondent, setRespondent] = useState(restoredDraft?.respondent ?? '');
  const [agreementHash, setAgreementHash] = useState(restoredDraft?.agreementHash ?? '');
  const [claimType, setClaimType] = useState(restoredDraft?.claimType ?? 'DELIVERY_FAILURE');
  const [description, setDescription] = useState(restoredDraft?.description ?? '');
  const [stake, setStake] = useState(restoredDraft?.stake ?? '');
  const [deadline, setDeadline] = useState(
    restoredDraft?.deadline && !Number.isNaN(new Date(restoredDraft.deadline).getTime())
      ? restoredDraft.deadline
      : defaultDeadline,
  );
  const [evidence, setEvidence] = useState<EvidenceDraft[]>(
    Array.isArray(restoredDraft?.evidence) && restoredDraft.evidence.length > 0
      ? restoredDraft.evidence.map((item) => ({ ...emptyEvidence(), ...item }))
      : [emptyEvidence()],
  );
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [errorTxUrl, setErrorTxUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [createdId, setCreatedId] = useState<bigint | null>(() => loadPendingId());
  const [navigating, setNavigating] = useState(false);
  const [draftRestored, setDraftRestored] = useState(hadDraft.current);

  const descriptionLength = description.length;
  const respondentValid = respondent.trim() === '' || isValidAddress(respondent);

  const updateEvidence = (index: number, patch: Partial<EvidenceDraft>) => {
    setEvidence((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  // Persist draft on every field change so a reload / failed submit keeps values.
  useEffect(() => {
    if (createdId !== null || navigating) return;
    saveDraft({ respondent, agreementHash, claimType, description, stake, deadline, evidence });
  }, [respondent, agreementHash, claimType, description, stake, deadline, evidence, createdId, navigating]);

  function dismissDraftNotice() {
    setDraftRestored(false);
  }

  function discardDraft() {
    clearDraft();
    clearPendingId();
    setRespondent('');
    setAgreementHash('');
    setClaimType('DELIVERY_FAILURE');
    setDescription('');
    setStake('');
    setDeadline(defaultDeadline);
    setEvidence([emptyEvidence()]);
    setDraftRestored(false);
    setCreatedId(null);
    setError('');
    setSuccess('');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || createdId !== null) return;
    setError('');
    setErrorTxUrl(null);
    setSuccess('');
    setCreatedId(null);
    setSubmitting(true);
    setProgress('');
    let didNavigate = false;

    try {
      const court = getCourt();
      if (!court.getSigner()) {
        setError('Please connect your wallet first.');
        return;
      }

      if (!respondent.trim()) {
        setError('Respondent address is required.');
        return;
      }

      if (!isValidAddress(respondent)) {
        setError('Respondent must be a valid Ethereum address (0x followed by 40 hex characters).');
        return;
      }

      if (!description.trim()) {
        setError('Description is required.');
        return;
      }

      const prepared: EvidenceDraft[] = [];
      for (const [i, item] of evidence.entries()) {
        const source = item.source.trim();
        const refUri = item.refUri.trim();
        if (!source || !refUri) {
          setError(`Evidence #${i + 1} needs both a source and a reference.`);
          return;
        }

        const rawHash = item.contentHash.trim();
        if (rawHash) {
          const hex = rawHash.replace(/^0x/i, '');
          if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
            setError(
              `Evidence #${i + 1}: content hash must be 32 bytes of hex (0x optional, 64 hex characters).`,
            );
            return;
          }
        }

        prepared.push({
          evidenceType: item.evidenceType,
          source,
          refUri,
          contentHash: rawHash ? toBytes32(rawHash, () => ZeroHash) : ZeroHash,
          description: item.description.trim(),
        });
      }

      if (!deadline) {
        setError('Deadline is required.');
        return;
      }

      const deadlineTs = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
      if (deadlineTs <= BigInt(Math.floor(Date.now() / 1000))) {
        setError('Deadline must be in the future.');
        return;
      }

      const stakeNum = parseFloat(stake || '0.001');
      if (isNaN(stakeNum) || stakeNum <= 0) {
        setError('Stake must be a positive number.');
        return;
      }

      const stakeWei = parseEther(stake || '0.001');
      let agreementHashBytes: string;
      try {
        agreementHashBytes = toBytes32(agreementHash, generateHash);
      } catch (err: any) {
        setError(err.message || 'Agreement hash is invalid.');
        return;
      }

      setProgress('Creating dispute...');

      const disputeId = await court.createDispute({
        respondent: respondent.trim() as `0x${string}`,
        agreementHash: agreementHashBytes as `0x${string}`,
        claimType,
        description: description.trim(),
        stake: stakeWei,
        deadline: deadlineTs,
      });

      // Persist immediately — a mid-flight reload must not offer a second create.
      setCreatedId(disputeId);
      savePendingId(disputeId);

      let submitted = 0;
      const failures: string[] = [];

      if (prepared.length > 0) {
        setProgress(
          prepared.length > 1
            ? `Submitting ${prepared.length} evidence items…`
            : 'Submitting evidence 1 of 1...',
        );
        try {
          // Back-to-back submits (no per-item consensus wait), then one poll.
          await court.submitEvidenceBatch(
            prepared.map((item) => ({
              disputeId,
              evidenceType: item.evidenceType,
              source: item.source,
              refUri: item.refUri,
              contentHash: item.contentHash,
              description: item.description,
            })),
          );
          submitted = prepared.length;
        } catch (err: any) {
          failures.push(err?.shortMessage || err?.message || 'transaction failed');
        }
      }

      if (failures.length > 0) {
        setCreatedId(disputeId);
        savePendingId(disputeId);
        setError(
          `Dispute #${disputeId} was created, but evidence upload hit a snag: ` +
            `${failures.join('; ')} — open the dispute to add evidence from the Evidence tab.`,
        );
        setErrorTxUrl(court.getTxLinks(disputeId, 'create_dispute')[0]?.url ?? null);
        return;
      }

      setCreatedId(disputeId);
      setSuccess(`Dispute #${disputeId} created successfully with all ${submitted} evidence items.`);
      // Dispute exists on-chain — drop the draft so a later Create isn't prefilled with a duplicate.
      clearDraft();
      clearPendingId();
      setDraftRestored(false);
      // Leave the create form — don't leave the submit button looking clickable again.
      didNavigate = true;
      setNavigating(true);
      onCreated(disputeId);
      return;
    } catch (err: any) {
      console.error('Create dispute failed:', err);
      if (err instanceof TransactionPendingError) {
        setErrorTxUrl(explorerTxUrl(err.hash));
      }
      // Keep the draft (effect already saved fields); surface the failure.
      setError(err.message || 'Transaction failed. Check console for details.');
    } finally {
      setSubmitting(false);
      // Keep progress visible if we are navigating away so the button doesn't flip to "Create Dispute".
      if (!didNavigate) setProgress('');
    }
  };

  function generateHash(): string {
    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }

  /** Normalize any pasted hash to 0x + exactly 64 hex chars (no double prefix). */
  function toBytes32(input: string, fallback: () => string): string {
    const trimmed = input.trim();
    if (!trimmed) return '0x' + fallback().replace(/^0x/i, '').padStart(64, '0').slice(0, 64);
    const hex = trimmed.replace(/^0x/i, '');
    if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length > 64) {
      throw new Error('Hash must be hex (0x optional) and at most 32 bytes.');
    }
    return '0x' + hex.padStart(64, '0');
  }

  function dismissError() {
    setError('');
    setErrorTxUrl(null);
  }

  function dismissSuccess() {
    setSuccess('');
  }

  return (
    <div className="create-form">
      <div className="section-header">
        <div>
          <div className="hero-eyebrow">New claim · Studionet 61999</div>
          <h2>Create Dispute</h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            File a structured claim. Evidence is submitted on-chain right after creation.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => {
          // Navigating away keeps the draft in localStorage for next time.
          onCancel();
        }}>
          Cancel
        </button>
      </div>

      <div className="form-card">

      {draftRestored && !navigating && createdId === null && (
        <div
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            color: '#93c5fd',
            fontSize: '0.9rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              Restored your previous draft so you can finish after a failed submit or reload.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button
                type="button"
                onClick={dismissDraftNotice}
                style={{
                  background: 'none',
                  border: '1px solid rgba(59,130,246,0.4)',
                  borderRadius: '6px',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.6rem',
                }}
              >
                Keep draft
              </button>
              <button
                type="button"
                onClick={discardDraft}
                style={{
                  background: 'none',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: '6px',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '0.25rem 0.6rem',
                }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div style={errorBannerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>{error}</div>
            <button
              type="button"
              onClick={dismissError}
              style={{
                background: 'none',
                border: 'none',
                color: '#fca5a5',
                cursor: 'pointer',
                fontSize: '1.1rem',
                padding: '0 0 0 0.5rem',
                lineHeight: 1,
              }}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
          {errorTxUrl && (
            <div style={{ marginTop: '0.5rem' }}>
              <a href={errorTxUrl} target="_blank" rel="noreferrer" style={{ color: '#fca5a5' }}>
                View transaction on Explorer ↗
              </a>
            </div>
          )}
        </div>
      )}

      {success && (
        <div style={successBannerStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>{success}</div>
            <button
              type="button"
              onClick={dismissSuccess}
              style={{
                background: 'none',
                border: 'none',
                color: '#86efac',
                cursor: 'pointer',
                fontSize: '1.1rem',
                padding: '0 0 0 0.5rem',
                lineHeight: 1,
              }}
              aria-label="Dismiss success"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {createdId !== null && !navigating && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onCreated(createdId)}
          >
            View dispute #{createdId.toString()}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            Back to Dashboard
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clearPendingId();
              clearDraft();
              setCreatedId(null);
              setDraftRestored(false);
              setError('');
              setSuccess('');
            }}
            title="This dispute already exists on-chain. Clear only if you are sure you need a new one."
          >
            Start a different dispute
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>
            Respondent Address <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            type="text"
            value={respondent}
            onChange={(e) => setRespondent(e.target.value)}
            placeholder="0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38"
            required
            style={{
              ...monoFieldStyle,
              borderColor: respondent && !respondentValid ? 'var(--danger)' : 'var(--border)',
            }}
          />
          {respondent && !respondentValid && (
            <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              Must be a valid 0x-prefixed 40-character hex address.
            </p>
          )}
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>
            Agreement Hash <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>(optional — auto-generated if empty)</span>
          </label>
          <input
            type="text"
            value={agreementHash}
            onChange={(e) => setAgreementHash(e.target.value)}
            placeholder="0x..."
            style={monoFieldStyle}
          />
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>
            Claim Type <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <select
            value={claimType}
            onChange={(e) => setClaimType(e.target.value)}
            style={fieldStyle}
          >
            {CLAIM_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <label style={labelStyle}>
            Description <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the dispute — what was agreed, what happened, and why you are filing a claim..."
            required
            rows={4}
            style={{
              ...fieldStyle,
              resize: 'vertical',
              borderColor: description.trim() === '' && description !== '' ? 'var(--danger)' : 'var(--border)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
              Explain the agreement and the breach.
            </span>
            <span style={{
              color: descriptionLength > 500 ? 'var(--warning)' : 'var(--text-secondary)',
              fontSize: '0.75rem',
            }}>
              {descriptionLength}/500
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              Evidence ({evidence.length})
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEvidence((prev) => [...prev, emptyEvidence()])}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              + Add Evidence
            </button>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
            Each item is submitted on-chain separately and stays unverified until an authorized
            agent verifies it.
          </p>

          {evidence.map((item, index) => (
            <div
              key={index}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '0.75rem',
                background: 'var(--bg-secondary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Evidence #{index + 1}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEvidence((prev) => prev.filter((_, i) => i !== index))}
                  disabled={evidence.length === 1}
                  title={
                    evidence.length === 1
                      ? 'At least one evidence item is required'
                      : 'Remove this evidence item'
                  }
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                >
                  Remove
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select
                    value={item.evidenceType}
                    onChange={(e) => updateEvidence(index, { evidenceType: e.target.value })}
                    style={fieldStyle}
                  >
                    {EVIDENCE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>
                    Source <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={item.source}
                    onChange={(e) => updateEvidence(index, { source: e.target.value })}
                    placeholder="chain, https://..."
                    style={fieldStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>
                  Reference <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={item.refUri}
                  onChange={(e) => updateEvidence(index, { refUri: e.target.value })}
                  placeholder="0x transaction hash, URL, or record id"
                  style={monoFieldStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Description (optional)</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateEvidence(index, { description: e.target.value })}
                    placeholder="What this evidence shows"
                    style={fieldStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Content Hash (optional)</label>
                  <input
                    type="text"
                    value={item.contentHash}
                    onChange={(e) => updateEvidence(index, { contentHash: e.target.value })}
                    placeholder="0x... (left empty, stores 0x0)"
                    style={monoFieldStyle}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={labelStyle}>
              Stake (GEN) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="0.001"
              required
              style={fieldStyle}
            />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
              Minimum: 0.001 GEN
            </span>
          </div>
          <div>
            <label style={labelStyle}>
              Deadline <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              style={{
                ...fieldStyle,
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || createdId !== null || navigating}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: submitting || createdId !== null || navigating ? 0.8 : 1,
          }}
        >
          {(submitting || navigating) && (
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          {navigating
            ? 'Opening dispute...'
            : submitting
              ? progress || 'Creating Dispute...'
              : createdId !== null
                ? 'Dispute created'
                : 'Create Dispute'}
        </button>
      </form>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
