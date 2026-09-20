import { useState } from 'react';
import { getCourt } from '../sdk';
import { parseEther, isHexString, ZeroHash } from 'ethers';

interface CreateDisputeFormProps {
  onCreated: (id: bigint) => void;
  onCancel: () => void;
}

const EVIDENCE_TYPES = [
  { value: 'ONCHAIN_TRANSACTION', label: 'On-chain Transaction' },
  { value: 'WEB_PAGE', label: 'Web Page' },
  { value: 'API_RESPONSE', label: 'API Response' },
  { value: 'SIGNED_MESSAGE', label: 'Signed Message' },
  { value: 'CONTENT_HASH', label: 'Content Hash' },
  { value: 'CUSTOM', label: 'Custom' },
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

export function CreateDisputeForm({ onCreated, onCancel }: CreateDisputeFormProps) {
  const [respondent, setRespondent] = useState('');
  const [agreementHash, setAgreementHash] = useState('');
  const [claimType, setClaimType] = useState('DELIVERY_FAILURE');
  const [description, setDescription] = useState('');
  const [stake, setStake] = useState('');
  const [deadline, setDeadline] = useState('');
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([emptyEvidence()]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  // Set when the dispute exists on-chain but one or more evidence items failed,
  // so the id is not lost behind an error message.
  const [createdId, setCreatedId] = useState<bigint | null>(null);

  const updateEvidence = (index: number, patch: Partial<EvidenceDraft>) => {
    setEvidence((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreatedId(null);
    setSubmitting(true);
    setProgress('');

    try {
      const court = getCourt();
      if (!court.getSigner()) {
        setError('Please connect your wallet first');
        return;
      }

      // Validate every evidence item before spending a transaction on the
      // dispute, so a typo cannot create a dispute whose evidence never lands.
      const prepared: EvidenceDraft[] = [];
      for (const [i, item] of evidence.entries()) {
        const source = item.source.trim();
        const refUri = item.refUri.trim();
        if (!source || !refUri) {
          setError(`Evidence #${i + 1} needs both a source and a reference.`);
          return;
        }

        const rawHash = item.contentHash.trim();
        if (rawHash && !isHexString(rawHash, 32)) {
          setError(
            `Evidence #${i + 1}: content hash must be 32 bytes of hex (0x followed by 64 characters).`,
          );
          return;
        }

        prepared.push({
          evidenceType: item.evidenceType,
          source,
          refUri,
          contentHash: rawHash || ZeroHash,
          description: item.description.trim(),
        });
      }

      const deadlineTs = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
      const stakeWei = parseEther(stake || '0.001');
      const agreementHashBytes = '0x' + (agreementHash || generateHash()).padStart(64, '0');

      const disputeId = await court.createDispute({
        respondent: respondent as `0x${string}`,
        agreementHash: agreementHashBytes as `0x${string}`,
        claimType,
        description,
        stake: stakeWei,
        deadline: deadlineTs,
      });

      // Attach the evidence immediately; the dispute opens in
      // EVIDENCE_COLLECTION, so a dispute created without it would be empty.
      let submitted = 0;
      const failures: string[] = [];

      for (const [i, item] of prepared.entries()) {
        setProgress(`Submitting evidence ${i + 1} of ${prepared.length}...`);
        try {
          await court.submitEvidence({
            disputeId,
            evidenceType: item.evidenceType,
            source: item.source,
            refUri: item.refUri,
            contentHash: item.contentHash,
            description: item.description,
          });
          submitted += 1;
        } catch (err: any) {
          failures.push(`#${i + 1}: ${err?.shortMessage || err?.message || 'transaction failed'}`);
        }
      }

      if (failures.length > 0) {
        setCreatedId(disputeId);
        setError(
          `Dispute #${disputeId} was created with ${submitted} of ${prepared.length} evidence items. ` +
            `Failed — ${failures.join('; ')}`,
        );
        return;
      }

      onCreated(disputeId);
    } catch (err: any) {
      console.error('Create dispute failed:', err);
      setError(err.message || 'Transaction failed. Check console for details.');
    } finally {
      setSubmitting(false);
      setProgress('');
    }
  };

  function generateHash(): string {
    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }

  return (
    <div className="create-form">
      <div className="section-header">
        <h2>Create Dispute</h2>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>

      {error && (
        <div style={{
          background: '#3d0000',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          color: '#fca5a5',
          fontSize: '0.9rem',
        }}>
          {error}
        </div>
      )}

      {createdId !== null && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onCreated(createdId)}
          style={{ marginBottom: '1rem' }}
        >
          View dispute #{createdId.toString()}
        </button>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>
            Respondent Address
          </label>
          <input
            type="text"
            value={respondent}
            onChange={(e) => setRespondent(e.target.value)}
            placeholder="0x..."
            required
            style={monoFieldStyle}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>
            Agreement Hash (optional — auto-generated if empty)
          </label>
          <input
            type="text"
            value={agreementHash}
            onChange={(e) => setAgreementHash(e.target.value)}
            placeholder="0x..."
            style={monoFieldStyle}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>
            Claim Type
          </label>
          <select
            value={claimType}
            onChange={(e) => setClaimType(e.target.value)}
            style={fieldStyle}
          >
            <option value="DELIVERY_FAILURE">Delivery Failure</option>
            <option value="PAYMENT_FAILURE">Payment Failure</option>
            <option value="PERFORMANCE_FAILURE">Performance Failure</option>
            <option value="DATA_QUALITY">Data Quality</option>
            <option value="MARKETPLACE_VIOLATION">Marketplace Violation</option>
            <option value="AGENT_CONTRACT_BREACH">Agent Contract Breach</option>
            <option value="ORACLE_MALFUNCTION">Oracle Malfunction</option>
            <option value="ESCROW_DISPUTE">Escrow Dispute</option>
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the dispute..."
            required
            rows={4}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
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
              Add Evidence
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
                  <label style={labelStyle}>Source</label>
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
                <label style={labelStyle}>Reference</label>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>
              Stake (GEN)
            </label>
            <input
              type="number"
              step="0.001"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder="0.001"
              required
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              style={fieldStyle}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
        >
          {progress || (submitting ? 'Creating Dispute...' : 'Create Dispute')}
        </button>
      </form>
    </div>
  );
}
