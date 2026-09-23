import { useState } from 'react';
import { getCourt } from '../sdk';
import { EVIDENCE_TYPES } from '../evidence';

interface SubmitEvidenceFormProps {
  disputeId: bigint;
  onSubmitted: () => void;
  onCancel: () => void;
}

const typeLabels: Record<string, string> = {
  ONCHAIN_TRANSACTION: 'On-Chain Transaction',
  WEB_PAGE: 'Web Page',
  API_RESPONSE: 'API Response',
  SIGNED_MESSAGE: 'Signed Message',
  CONTENT_HASH: 'Content Hash',
  CUSTOM: 'Custom',
};

export function SubmitEvidenceForm({ disputeId, onSubmitted, onCancel }: SubmitEvidenceFormProps) {
  const [evidenceType, setEvidenceType] = useState('ONCHAIN_TRANSACTION');
  const [source, setSource] = useState('');
  const [refUri, setRefUri] = useState('');
  const [contentHash, setContentHash] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const court = getCourt();
      if (!court.getSigner()) {
        setError('Please connect your wallet first');
        setSubmitting(false);
        return;
      }

      let hash = contentHash.trim();
      if (hash) {
        const hex = hash.replace(/^0x/i, '');
        if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
          setError('Content hash must be 32 bytes of hex (0x optional, 64 hex chars).');
          setSubmitting(false);
          return;
        }
        hash = '0x' + hex;
      } else {
        hash = '0x' + crypto.randomUUID().replace(/-/g, '').slice(0, 64).padEnd(64, '0');
      }

      await court.submitEvidence({
        disputeId,
        evidenceType,
        source,
        refUri: refUri || 'none',
        contentHash: hash,
        description,
      });

      setTxHash('submitted');
      onSubmitted();
    } catch (err: any) {
      console.error('Submit evidence failed:', err);
      setError(err.message || 'Transaction failed. Check console for details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-form">
      <div className="section-header">
        <h2>Submit Evidence</h2>
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

      {txHash && (
        <div style={{
          background: '#003d00',
          border: '1px solid #22c55e',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          color: '#86efac',
          fontSize: '0.9rem',
        }}>
          Evidence submitted successfully for dispute #{disputeId.toString()}.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Evidence Type
          </label>
          <select
            value={evidenceType}
            onChange={(e) => setEvidenceType(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
          >
            {EVIDENCE_TYPES.map((t) => (
              <option key={t} value={t}>{typeLabels[t] ?? t}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Source
          </label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="e.g. blockchain, API endpoint, website"
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Reference URI (optional)
          </label>
          <input
            type="text"
            value={refUri}
            onChange={(e) => setRefUri(e.target.value)}
            placeholder="https://... or tx hash or 0x..."
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Content Hash (optional - auto-generated if empty)
          </label>
          <input
            type="text"
            value={contentHash}
            onChange={(e) => setContentHash(e.target.value)}
            placeholder="0x..."
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe this evidence..."
            required
            rows={4}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.9rem', resize: 'vertical' }}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting}
          style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
        >
          {submitting ? 'Submitting Evidence...' : 'Submit Evidence'}
        </button>
      </form>
    </div>
  );
}
