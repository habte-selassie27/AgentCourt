import { verdictColor } from '../verdict';

interface ConsensusProps {
  evaluatorCount: number;
  agreementRatio: number;
  breakdown: Record<string, number>;
  disagreementDetected: boolean;
  requiresReview: boolean;
  reasoning: string;
}

export function ConsensusView({
  evaluatorCount,
  agreementRatio,
  breakdown,
  disagreementDetected,
  requiresReview,
  reasoning,
}: ConsensusProps) {
  const maxCount = Math.max(...Object.values(breakdown), 1);
  const majority = Object.entries(breakdown).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="consensus-view">
      <div className="section-header">
        <h2>Consensus</h2>
        {disagreementDetected && (
          <span className="status-badge" style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}>
            DISAGREEMENT DETECTED
          </span>
        )}
      </div>

      <div className="consensus-chart">
        {Object.entries(breakdown).map(([verdict, count]) => (
          <div key={verdict} className="chart-row">
            <span className="chart-label">{verdict}</span>
            <div className="chart-bar-container">
              <div
                className="chart-bar"
                style={{
                  width: `${(count / maxCount) * 100}%`,
                  background: verdictColor(verdict),
                }}
              />
              <span className="chart-count">{count}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="consensus-details">
        <div className="detail-row">
          <span>Evaluators</span>
          <span>{evaluatorCount}</span>
        </div>
        <div className="detail-row">
          <span>Agreement ratio</span>
          <span>{(agreementRatio * 100).toFixed(1)}%</span>
        </div>
        <div className="detail-row">
          <span>Majority</span>
          <span style={{ color: verdictColor(majority?.[0] ?? '') }}>
            {majority?.[0]} ({majority?.[1]} votes)
          </span>
        </div>
        <div className="detail-row">
          <span>Review required</span>
          <span style={{ color: requiresReview ? 'var(--warning)' : 'var(--success)' }}>
            {requiresReview ? 'YES' : 'NO'}
          </span>
        </div>
      </div>

      {disagreementDetected && (
        <div className="consensus-warning">
          <div className="warning-icon">!</div>
          <div>
            <strong>Material disagreement detected</strong>
            <p>
              Evaluators produced {Object.keys(breakdown).length} different verdicts.
              Consensus was reached with reduced confidence.
            </p>
          </div>
        </div>
      )}

      {reasoning && (
        <div className="consensus-reasoning">
          <h3>Consensus Reasoning</h3>
          <pre className="reasoning-text">{reasoning}</pre>
        </div>
      )}
    </div>
  );
}
