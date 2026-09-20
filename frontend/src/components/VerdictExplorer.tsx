import { verdictColor, verdictIcon } from '../verdict';
import { resolutionLabel } from '../settlement';

interface VerdictData {
  verdict: string;
  confidence: number;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  /** Evidence the verdict references, when the source has no supporting/contradicting split. */
  evidenceIds?: string[];
  reasoningHash: string;
  resolution: string;
  reviewRequired: boolean;
  finalizedAt: string;
}

interface VerdictExplorerProps {
  verdict: VerdictData;
}

export function VerdictExplorer({ verdict }: VerdictExplorerProps) {
  const hasSplit = verdict.supportingEvidence.length > 0 || verdict.contradictingEvidence.length > 0;
  const referencedEvidence = verdict.evidenceIds ?? [];

  return (
    <div className="verdict-explorer">
      <div className="section-header">
        <h2>Verdict Explorer</h2>
      </div>

      <div className="verdict-hero">
        <div className="verdict-icon" style={{ color: verdictColor(verdict.verdict) }}>
          {verdictIcon(verdict.verdict)}
        </div>
        <div className="verdict-main">
          <div className="verdict-title" style={{ color: verdictColor(verdict.verdict) }}>
            VERDICT: {verdict.verdict}
          </div>
          <div className="verdict-confidence-display">
            <span>Confidence: {verdict.confidence}%</span>
            <div className="confidence-bar large">
              <div
                className="confidence-fill"
                style={{
                  width: `${verdict.confidence}%`,
                  background: verdictColor(verdict.verdict),
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="verdict-resolution">
        <h3>Resolution</h3>
        <div className="resolution-action">
          <span className="resolution-label">
            {resolutionLabel(verdict.resolution)}
          </span>
        </div>
      </div>

      {!hasSplit && referencedEvidence.length > 0 && (
        <div className="verdict-evidence-split">
          <div className="evidence-column supporting" style={{ gridColumn: '1 / -1' }}>
            <h3>Referenced Evidence</h3>
            <ul className="evidence-list">
              {referencedEvidence.map((id) => (
                <li key={id} className="evidence-list-item supporting">
                  <span className="evidence-dot" style={{ background: 'var(--accent)' }} />
                  {id}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {hasSplit && (
        <div className="verdict-evidence-split">
          <div className="evidence-column supporting">
            <h3>Supporting Evidence</h3>
            {verdict.supportingEvidence.length === 0 ? (
              <p className="text-muted">None</p>
            ) : (
              <ul className="evidence-list">
                {verdict.supportingEvidence.map((id) => (
                  <li key={id} className="evidence-list-item supporting">
                    <span className="evidence-dot" style={{ background: 'var(--success)' }} />
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="evidence-column contradicting">
            <h3>Contradicting Evidence</h3>
            {verdict.contradictingEvidence.length === 0 ? (
              <p className="text-muted">None</p>
            ) : (
              <ul className="evidence-list">
                {verdict.contradictingEvidence.map((id) => (
                  <li key={id} className="evidence-list-item contradicting">
                    <span className="evidence-dot" style={{ background: 'var(--danger)' }} />
                    {id}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="verdict-meta">
        <div className="meta-row">
          <span className="meta-label">Reasoning Hash</span>
          <span className="meta-value mono">{verdict.reasoningHash}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Finalized</span>
          <span className="meta-value">{verdict.finalizedAt}</span>
        </div>
        <div className="meta-row">
          <span className="meta-label">Review Required</span>
          <span
            className="meta-value"
            style={{ color: verdict.reviewRequired ? 'var(--warning)' : 'var(--success)' }}
          >
            {verdict.reviewRequired ? 'YES' : 'NO'}
          </span>
        </div>
      </div>
    </div>
  );
}
