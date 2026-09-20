import { useState, useEffect, useCallback } from 'react';
import { getCourt } from '../sdk';
import type { DisputeDetailData } from '../sdk';
import { EvaluatorResults } from './EvaluatorResults';
import { ConsensusView } from './ConsensusView';
import { EvidenceExplorer } from './EvidenceExplorer';
import { VerdictExplorer } from './VerdictExplorer';
import { SubmitEvidenceForm } from './SubmitEvidenceForm';
import {
  formatTime,
  formatDateTime,
  formatStake,
  shortHex,
  shortAddress,
  getStatusClass,
  disputeIdLabel,
  buildTimeline,
} from '../dispute';
import { evidenceIdLabel } from '../evidence';
import { confidencePercent, computeConsensus, buildConsensusSummary, type EvaluatorRecord } from '../verdict';

interface DisputeDetailProps {
  disputeId: bigint;
  onBack: () => void;
}

type DetailTab = 'timeline' | 'evidence' | 'evaluators' | 'adversarial' | 'consensus' | 'verdict';

export function DisputeDetail({ disputeId, onBack }: DisputeDetailProps) {
  const [data, setData] = useState<DisputeDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>('timeline');
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCourt().loadDisputeDetail(disputeId);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dispute from chain');
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    setActiveTab('timeline');
    setShowEvidenceForm(false);
    void loadData();
  }, [loadData]);

  if (loading) {
    return <div className="empty-state">Loading dispute #{disputeId.toString()} from chain...</div>;
  }

  if (error || !data) {
    return (
      <>
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={onBack}>Back</button>
            <h2>Dispute #{disputeId.toString()}</h2>
          </div>
        </div>
        <div className="stat-card">
          <h3>Unable to load dispute from chain</h3>
          <div style={{ marginTop: '0.5rem', color: 'var(--danger)' }}>
            {error ?? 'Unknown error'}
          </div>
        </div>
      </>
    );
  }

  const { dispute, evidence, verdict, consensus } = data;

  const timeline = buildTimeline({
    status: dispute.status,
    createdAt: dispute.createdAt,
    evidenceCount: evidence.length,
    latestEvidenceTime: evidence.length > 0 ? evidence[evidence.length - 1]?.timestamp : undefined,
    consensusCount: consensus.length,
    hasVerdict: verdict !== null,
    verdictLabel: verdict?.verdict,
    verdictTime: verdict?.finalizedAt,
  });

  const evidenceItems = evidence.map((item) => ({
    id: evidenceIdLabel(item.id),
    type: item.evidenceType,
    source: item.source,
    reference: item.refUri,
    hash: shortHex(item.contentHash),
    description: item.description || '(no description provided)',
    timestamp: formatTime(item.timestamp),
    submitter: shortAddress(item.submitter),
    verified: item.verified,
    relevance: '',
    crossReferences: [] as string[],
  }));

  // Consensus submissions are the only per-evaluator records the protocol
  // stores, so they drive both the Evaluators and Consensus views.
  const evaluators: EvaluatorRecord[] = consensus.map((record) => ({
    id: shortAddress(record.evaluator),
    verdict: record.verdict,
    confidence: confidencePercent(record.confidence),
    reasoningHash: shortHex(record.reasoningHash),
    timestamp: formatTime(record.timestamp),
  }));

  const consensusData = computeConsensus(evaluators);

  const tabs: { key: DetailTab; label: string; visible: boolean }[] = [
    { key: 'timeline', label: 'Timeline', visible: true },
    { key: 'evidence', label: 'Evidence', visible: true },
    { key: 'evaluators', label: 'Evaluators', visible: consensus.length > 0 },
    { key: 'adversarial', label: 'Adversarial', visible: true },
    { key: 'consensus', label: 'Consensus', visible: consensus.length > 0 },
    { key: 'verdict', label: 'Verdict', visible: verdict !== null },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  return (
    <>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <h2>{disputeIdLabel(dispute.id)}</h2>
          <span className={getStatusClass(dispute.status)}>{dispute.status.replace(/_/g, ' ')}</span>
          <span className="status-badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: 'var(--success)' }}>
            ON-CHAIN
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="stat-card"><h3>Claim Type</h3><div style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>{dispute.claimType.replace(/_/g, ' ')}</div></div>
        <div className="stat-card"><h3>Stake</h3><div className="value">{formatStake(dispute.stake)}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <h3>Claimant</h3>
          <div className="mono" style={{ marginTop: '0.5rem' }} title={dispute.claimant}>{dispute.claimant}</div>
        </div>
        <div className="stat-card">
          <h3>Respondent</h3>
          <div className="mono" style={{ marginTop: '0.5rem' }} title={dispute.respondent}>{dispute.respondent}</div>
        </div>
      </div>

      <div className="stat-card" style={{ marginBottom: '1.5rem' }}>
        <h3>Description</h3>
        <div style={{ marginTop: '0.5rem' }}>{dispute.description || '(no description provided)'}</div>
      </div>

      <div className="stat-card" style={{ marginBottom: '1.5rem' }}>
        <h3>Deadline</h3>
        <div style={{ marginTop: '0.5rem' }}>{formatDateTime(dispute.deadline)}</div>
      </div>

      {verdict && (
        <div className="verdict-display" style={{ marginBottom: '1.5rem' }}>
          <div className="verdict-label">Final Verdict</div>
          <div className={`verdict-value verdict-${verdict.verdict}`}>{verdict.verdict}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Confidence: {confidencePercent(verdict.confidence)}%</div>
          <div className="confidence-bar large">
            <div className="confidence-fill" style={{ width: `${confidencePercent(verdict.confidence)}%` }} />
          </div>
        </div>
      )}

      <div className="tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'timeline' && (
        <div className="timeline">
          {timeline.map((event, i) => (
            <div key={i} className={`timeline-item ${event.completed ? 'completed' : ''} ${event.active ? 'active' : ''}`}>
              <div className="timeline-time">{event.time}</div>
              <div className="timeline-label">{event.label}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'evidence' && (
        <>
          {showEvidenceForm ? (
            <SubmitEvidenceForm
              disputeId={disputeId}
              onSubmitted={() => {
                setShowEvidenceForm(false);
                void loadData();
              }}
              onCancel={() => setShowEvidenceForm(false)}
            />
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button className="btn btn-primary" onClick={() => setShowEvidenceForm(true)}>
                  Submit New Evidence
                </button>
              </div>
              {evidenceItems.length > 0 ? (
                <EvidenceExplorer evidence={evidenceItems} />
              ) : (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p>No evidence submitted yet. Be the first to submit evidence for this dispute.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'evaluators' && <EvaluatorResults evaluators={evaluators} />}

      {activeTab === 'adversarial' && (
        <div className="adversarial-findings">
          <div className="section-header">
            <h2>Adversarial Review</h2>
          </div>
          <div className="stat-card">
            <h3>Not recorded on-chain</h3>
            <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              The contracts store evaluator consensus submissions and the finalized verdict, but
              adversarial challenges are not persisted anywhere yet. Once a review pipeline writes
              them to a registry, they will appear here.
            </div>
          </div>
        </div>
      )}

      {activeTab === 'consensus' && (
        <ConsensusView
          evaluatorCount={consensus.length}
          agreementRatio={consensusData.agreementRatio}
          breakdown={consensusData.counts}
          disagreementDetected={consensusData.disagreementDetected}
          requiresReview={verdict?.reviewRequired ?? false}
          reasoning={buildConsensusSummary(evaluators, consensusData, verdict?.verdict, verdict ? confidencePercent(verdict.confidence) : undefined, verdict?.reviewRequired)}
        />
      )}

      {activeTab === 'verdict' && verdict && (
        <VerdictExplorer
          verdict={{
            verdict: verdict.verdict,
            confidence: confidencePercent(verdict.confidence),
            // The on-chain verdict carries a single referenced-evidence list
            // rather than a supporting/contradicting split.
            supportingEvidence: [],
            contradictingEvidence: [],
            evidenceIds: verdict.evidenceIds.map(evidenceIdLabel),
            reasoningHash: shortHex(verdict.reasoningHash),
            resolution: verdict.resolution,
            reviewRequired: verdict.reviewRequired,
            finalizedAt: formatDateTime(verdict.finalizedAt),
          }}
        />
      )}
    </>
  );
}
