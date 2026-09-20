import { evidenceTypeColor, type EvidenceItem } from '../evidence';

interface EvidenceExplorerProps {
  evidence: EvidenceItem[];
}

export function EvidenceExplorer({ evidence }: EvidenceExplorerProps) {
  const verifiedCount = evidence.filter((e) => e.verified).length;

  return (
    <div className="evidence-explorer">
      <div className="section-header">
        <h2>Evidence Explorer</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {verifiedCount}/{evidence.length} verified
        </span>
      </div>

      <div className="evidence-table-container">
        <table className="evidence-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Source</th>
              <th>Description</th>
              <th>Hash</th>
              <th>Status</th>
              <th>Cross-refs</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="evidence-id">{item.id}</span>
                </td>
                <td>
                  <span
                    className="evidence-type-badge"
                    style={{
                      color: evidenceTypeColor(item.type),
                      borderColor: evidenceTypeColor(item.type),
                    }}
                  >
                    {item.type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  <span className="evidence-source">{item.source}</span>
                </td>
                <td>
                  <span className="evidence-desc">{item.description}</span>
                </td>
                <td>
                  <span className="mono evidence-hash">{item.hash}</span>
                </td>
                <td>
                  <span className={`status-pill ${item.verified ? 'verified' : 'unverified'}`}>
                    {item.verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                <td>
                  {item.crossReferences.length > 0 ? (
                    <div className="cross-refs">
                      {item.crossReferences.map((ref) => (
                        <span key={ref} className="cross-ref-tag">
                          {ref}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="evidence-stats">
        <div className="stat-card">
          <h3>Total Evidence</h3>
          <div className="value">{evidence.length}</div>
        </div>
        <div className="stat-card">
          <h3>Verified</h3>
          <div className="value" style={{ color: 'var(--success)' }}>{verifiedCount}</div>
        </div>
        <div className="stat-card">
          <h3>Unique Sources</h3>
          <div className="value">
            {new Set(evidence.map((e) => e.source)).size}
          </div>
        </div>
        <div className="stat-card">
          <h3>Cross-referenced</h3>
          <div className="value">
            {evidence.filter((e) => e.crossReferences.length > 0).length}
          </div>
        </div>
      </div>
    </div>
  );
}
