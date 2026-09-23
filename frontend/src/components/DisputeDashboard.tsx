import { useState, useEffect, useCallback } from 'react';
import { getCourt } from '../sdk';
import type { DisputeRecord } from '../sdk';
import { describeError } from '../sdk/errors';
import { formatStake, formatDateTime, shortAddress, getStatusClass, disputeIdLabel, isActive, isResolved } from '../dispute';

interface DisputeDashboardProps {
  onViewDispute: (id: bigint) => void;
}

type TabFilter = 'all' | 'open' | 'active' | 'resolved';

const filterTabs: { key: TabFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'active', label: 'In Progress' },
  { key: 'resolved', label: 'Resolved' },
];

function matchesFilter(d: DisputeRecord, f: TabFilter): boolean {
  if (f === 'all') return true;
  if (f === 'open') return d.status === 'OPEN';
  if (f === 'active') return isActive(d.status);
  if (f === 'resolved') return isResolved(d.status);
  return true;
}

export function DisputeDashboard({ onViewDispute }: DisputeDashboardProps) {
  const [filter, setFilter] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const friendly = describeError(error);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const onChain = await getCourt().listDisputes();
      // Newest first, matching how disputes are normally scanned.
      setDisputes(onChain.slice().sort((a, b) => Number(b.id - a.id)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load disputes from chain');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = disputes.filter((d) => {
    if (!matchesFilter(d, filter)) return false;
    if (search) {
      const q = search.toLowerCase();
        return (
        d.description.toLowerCase().includes(q) ||
        d.claimType.toLowerCase().includes(q) ||
        disputeIdLabel(d.id).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openCount = disputes.filter((d) => d.status === 'OPEN').length;
  const activeCount = disputes.filter((d) => isActive(d.status)).length;
  const resolvedCount = disputes.filter((d) => isResolved(d.status)).length;

  return (
    <>
      <div className="dashboard">
        <div className="stat-card"><h3>Total Disputes</h3><div className="value">{disputes.length}</div></div>
        <div className="stat-card"><h3>Open</h3><div className="value">{openCount}</div></div>
        <div className="stat-card"><h3>In Progress</h3><div className="value">{activeCount}</div></div>
        <div className="stat-card"><h3>Resolved</h3><div className="value">{resolvedCount}</div></div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search disputes by ID, type, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as TabFilter)}>
          {filterTabs.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="section-header">
        <h2>Disputes</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          {loading ? 'Loading from chain...' : `${filtered.length} of ${disputes.length}`}
        </span>
      </div>

      {error && (
        <div className="error-panel" role="alert">
          <div className="error-panel-icon">⚠️</div>
          <div className="error-panel-body">
            <h3>{friendly.title}</h3>
            <p>{friendly.hint}</p>
            {friendly.detail && (
              <details className="error-panel-details">
                <summary>Technical details</summary>
                <code>{friendly.detail}</code>
              </details>
            )}
            <div className="error-panel-actions">
              <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
                {loading ? 'Retrying…' : 'Try again'}
              </button>
              <a
                className="btn btn-secondary"
                href="https://explorer-studio.genlayer.com"
                target="_blank"
                rel="noreferrer"
              >
                Open Explorer
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="dispute-list">
        {!error && filtered.length === 0 ? (
          <div className="empty-state">
            <h2>{disputes.length === 0 ? 'No disputes on chain yet' : 'No disputes found'}</h2>
            <p>
              {disputes.length === 0
                ? 'Create a dispute to get started.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          filtered.map((d) => (
            <div key={d.id.toString()} className="dispute-card dispute-card-live" onClick={() => onViewDispute(d.id)}>
              <div className="dispute-header">
                <span className="dispute-id">{disputeIdLabel(d.id)}</span>
                <span className={getStatusClass(d.status)}>{d.status.replace(/_/g, ' ')}</span>
              </div>
              <div className="dispute-meta">
                <span>{d.claimType.replace(/_/g, ' ')}</span>
                <span>{formatStake(d.stake)}</span>
                <span>{shortAddress(d.claimant)} vs {shortAddress(d.respondent)}</span>
                <span>{formatDateTime(d.createdAt)}</span>
              </div>
              <div className="dispute-description">{d.description || '(no description provided)'}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
