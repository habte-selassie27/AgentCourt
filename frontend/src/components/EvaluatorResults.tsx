import { verdictColor } from '../verdict';

interface Evaluator {
  id: string;
  verdict: string;
  confidence: number;
  reasoningHash: string;
  /** Absent when the evaluator's submission carried no evidence references. */
  evidenceIds?: string[];
  timestamp: string;
}

interface EvaluatorResultsProps {
  evaluators: Evaluator[];
}

export function EvaluatorResults({ evaluators }: EvaluatorResultsProps) {
  const verdictCounts: Record<string, number> = {};
  evaluators.forEach((e) => {
    verdictCounts[e.verdict] = (verdictCounts[e.verdict] || 0) + 1;
  });

  const majority = Object.entries(verdictCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="evaluator-results">
      <div className="section-header">
        <h2>Evaluator Results</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {evaluators.length} independent evaluators
        </span>
      </div>

      <div className="evaluator-breakdown">
        {Object.entries(verdictCounts).map(([verdict, count]) => (
          <div key={verdict} className="breakdown-item">
            <span
              className="breakdown-dot"
              style={{ background: verdictColor(verdict) }}
            />
            <span className="breakdown-label">{verdict}</span>
            <span className="breakdown-count">{count}</span>
            <span className="breakdown-pct">
              {Math.round((count / evaluators.length) * 100)}%
            </span>
          </div>
        ))}
      </div>

      <div className="evaluator-cards">
        {evaluators.map((evaluator) => (
          <div key={evaluator.id} className="evaluator-card">
            <div className="evaluator-header">
              <span className="evaluator-id">{evaluator.id}</span>
              <span
                className="evaluator-verdict"
                style={{ color: verdictColor(evaluator.verdict) }}
              >
                {evaluator.verdict}
              </span>
            </div>

            <div className="evaluator-confidence">
              <div className="confidence-label">
                <span>Confidence</span>
                <span>{evaluator.confidence}%</span>
              </div>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${evaluator.confidence}%`,
                    background: verdictColor(evaluator.verdict),
                  }}
                />
              </div>
            </div>

            <div className="evaluator-meta">
              <div className="meta-row">
                <span className="meta-label">Reasoning</span>
                <span className="meta-value mono">{evaluator.reasoningHash}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Evidence</span>
                <span className="meta-value">
                  {evaluator.evidenceIds ? `${evaluator.evidenceIds.length} items` : 'Not recorded'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Time</span>
                <span className="meta-value">{evaluator.timestamp}</span>
              </div>
            </div>

            {evaluator.verdict === (majority?.[0] ?? '') && (
              <div className="evaluator-badge majority">Majority</div>
            )}
          </div>
        ))}
      </div>

      {evaluators.length >= 2 && (
        <div className="evaluator-summary">
          <div className="summary-row">
            <span>Majority verdict</span>
            <strong style={{ color: verdictColor(majority?.[0] ?? '') }}>
              {majority?.[0]} ({majority?.[1]}/{evaluators.length})
            </strong>
          </div>
          <div className="summary-row">
            <span>Agreement ratio</span>
            <strong>
              {Math.round(((majority?.[1] ?? 0) / evaluators.length) * 100)}%
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
