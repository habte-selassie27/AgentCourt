import { severityColor } from '../settlement';

interface Challenge {
  type: string;
  description: string;
  severity: number;
  evidenceIds: string[];
  affectsVerdict: boolean;
}

interface AdversarialFindingsProps {
  challenges: Challenge[];
  verdictUpheld: boolean;
  confidenceAdjustment: number;
  reasoning: string;
}

export function AdversarialFindings({
  challenges,
  verdictUpheld,
  confidenceAdjustment,
  reasoning,
}: AdversarialFindingsProps) {
  return (
    <div className="adversarial-findings">
      <div className="section-header">
        <h2>Adversarial Review</h2>
        <span
          className="status-badge"
          style={{
            background: verdictUpheld
              ? 'rgba(34, 197, 94, 0.2)'
              : 'rgba(239, 68, 68, 0.2)',
            color: verdictUpheld ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {verdictUpheld ? 'VERDICT UPHELD' : 'VERDICT CHALLENGED'}
        </span>
      </div>

      <div className="adversarial-stats">
        <div className="stat-card">
          <h3>Challenges Found</h3>
          <div className="value">{challenges.length}</div>
        </div>
        <div className="stat-card">
          <h3>Confidence Impact</h3>
          <div className="value" style={{ color: confidenceAdjustment < 0 ? 'var(--danger)' : 'var(--success)' }}>
            {confidenceAdjustment > 0 ? '+' : ''}{(confidenceAdjustment * 100).toFixed(0)}%
          </div>
        </div>
        <div className="stat-card">
          <h3>Affects Verdict</h3>
          <div className="value">
            {challenges.filter((c) => c.affectsVerdict).length}
          </div>
        </div>
      </div>

      {challenges.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <p>No challenges identified. Adversarial review found no issues.</p>
        </div>
      ) : (
        <div className="challenge-list">
          {challenges.map((challenge, i) => (
            <div
              key={i}
              className={`challenge-card ${challenge.affectsVerdict ? 'challenge-critical' : ''}`}
            >
              <div className="challenge-header">
                <span
                  className="challenge-type"
                  style={{ color: severityColor(challenge.severity) }}
                >
                  [{challenge.type.replace(/_/g, ' ')}]
                </span>
                {challenge.affectsVerdict && (
                  <span className="challenge-badge">AFFECTS VERDICT</span>
                )}
              </div>

              <div className="challenge-description">{challenge.description}</div>

              <div className="challenge-meta">
                <div className="severity-bar">
                  <span className="severity-label">
                    Severity: {(challenge.severity * 100).toFixed(0)}%
                  </span>
                  <div className="severity-track">
                    <div
                      className="severity-fill"
                      style={{
                        width: `${challenge.severity * 100}%`,
                        background: severityColor(challenge.severity),
                      }}
                    />
                  </div>
                </div>

                {challenge.evidenceIds.length > 0 && (
                  <div className="challenge-evidence">
                    <span className="meta-label">Related evidence:</span>
                    {challenge.evidenceIds.map((id) => (
                      <span key={id} className="evidence-tag">
                        {id}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reasoning && (
        <div className="adversarial-reasoning">
          <h3>Adversarial Reasoning</h3>
          <pre className="reasoning-text">{reasoning}</pre>
        </div>
      )}
    </div>
  );
}
