import { useState, useEffect, useCallback, useRef } from 'react';
import { getCourt } from '../sdk';
import type { DisputeDetailData } from '../sdk';
import { describeError } from '../sdk/errors';
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
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState<string | null>(null);
  const [actionWarning, setActionWarning] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  /** Soft-poll after a long-running write so the UI catches up without a manual refresh. */
  const schedulePoll = useCallback(() => {
    if (pollTimerRef.current) return;
    let ticks = 0;
    pollTimerRef.current = setInterval(() => {
      ticks += 1;
      void loadData();
      if (ticks >= 40) {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }, 4_000);
  }, [loadData]);

  useEffect(() => {
    setActiveTab('timeline');
    setShowEvidenceForm(false);
    setActionError(null);
    setActionNote(null);
    setActionWarning(null);
    void loadData();
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [loadData]);

  const runAction = async (key: string, fn: () => Promise<void>, done: string) => {
    setActionBusy(key);
    setActionError(null);
    setActionNote(null);
    setActionWarning(null);
    try {
      if (!getCourt().getSigner()) {
        setActionError('Connect your wallet first.');
        return;
      }
      await fn();
      setActionNote(done);
      await loadData();
    } catch (err: unknown) {
      const friendly = describeError(err);
      if (err instanceof Error && err.name === 'TransactionPendingError') {
        setActionWarning(friendly.hint);
        schedulePoll();
        await loadData();
      } else {
        setActionError(friendly.hint ? `${friendly.title}: ${friendly.hint}` : (err instanceof Error ? err.message : 'Transaction failed'));
        if (friendly.detail && err instanceof Error && err.message !== friendly.detail) {
          setActionError((prev) => `${prev} (${friendly.detail})`);
        }
      }
    } finally {
      setActionBusy(null);
    }
  };

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

  const { dispute, evidence, verdict, consensus, evaluation } = data;
  const status = dispute.status;

  const timeline = buildTimeline({
    status: dispute.status,
    createdAt: dispute.createdAt,
    evidenceCount: evidence.length,
    latestEvidenceTime: evidence.length > 0 ? evidence[evidence.length - 1]?.timestamp : undefined,
    consensusCount: consensus.length,
    hasVerdict: verdict !== null,
    verdictLabel: verdict?.verdict,
    verdictTime: verdict?.finalizedAt,
    evaluationState: evaluation?.state ?? null,
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

  const evaluators: EvaluatorRecord[] = consensus.map((record) => ({
    id: record.reasoning ? `${record.evaluator}` : shortAddress(record.evaluator),
    verdict: record.verdict,
    confidence: confidencePercent(record.confidence),
    reasoningHash: shortHex(record.reasoningHash),
    timestamp: formatTime(record.timestamp),
    evidenceIds: record.evidenceIds,
  }));

  const consensusData = computeConsensus(evaluators);

  const canInvestigate =
    (status === 'EVIDENCE_COLLECTION' || status === 'OPEN') && Boolean(getCourt().getSigner());
  const canEvaluate =
    [
      'INVESTIGATION',
      'DELIBERATION',
      'ADVERSARIAL_REVIEW',
      'CONSENSUS',
      'EVALUATION_FAILED',
      'INCONCLUSIVE',
      'DISPUTED',
      'APPEALED',
    ].includes(status) && Boolean(getCourt().getSigner());
  const canFinalize =
    ['CONSENSUS', 'INCONCLUSIVE', 'DISPUTED'].includes(status) && Boolean(getCourt().getSigner());
  const canSettle =
    status === 'VERDICT' && verdict !== null && !verdict.reviewRequired && Boolean(getCourt().getSigner());
  const canAppeal =
    (status === 'VERDICT' || status === 'CLOSED') && Boolean(getCourt().getSigner());

  const tabs: { key: DetailTab; label: string; visible: boolean }[] = [
    { key: 'timeline', label: 'Timeline', visible: true },
    { key: 'evidence', label: 'Evidence', visible: true },
    { key: 'evaluators', label: 'Evaluators', visible: consensus.length > 0 || evaluation !== null },
    { key: 'adversarial', label: 'Adversarial', visible: evaluation !== null || true },
    { key: 'consensus', label: 'Consensus', visible: consensus.length > 0 || evaluation !== null },
    { key: 'verdict', label: 'Verdict', visible: verdict !== null },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);

  const adversarial = evaluation?.adversarial ?? null;

  return (
    <>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onBack}>Back</button>
          <h2>{disputeIdLabel(dispute.id)}</h2>
          <span className={getStatusClass(dispute.status)}>{dispute.status.replace(/_/g, ' ')}</span>
          <span className="status-badge" style={{ background: 'rgba(34, 197, 94, 0.2)', color: 'var(--success)' }}>
            ON-CHAIN
          </span>
        </div>
      </div>

      <div className="workflow-actions stat-card" style={{ marginBottom: '1.25rem' }}>
        <h3>Workflow</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.35rem 0 0.75rem' }}>
          Callers supply claim and evidence only. Evaluation and verdict are produced on-chain via
          nondeterministic LLM + validator consensus — never passed in as arguments.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            disabled={!canInvestigate || actionBusy !== null}
            onClick={() =>
              void runAction('investigate', () => getCourt().startInvestigation(disputeId), 'Investigation started.')
            }
          >
            {actionBusy === 'investigate' ? 'Starting…' : 'Start Investigation'}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canEvaluate || actionBusy !== null}
            title="Runs independent evaluators + adversarial review under GenLayer validator consensus"
            onClick={() =>
              void runAction(
                'evaluate',
                () => getCourt().requestEvaluation(disputeId),
                'Evaluation reached ACCEPTED. Consensus state is on-chain.',
              )
            }
          >
            {actionBusy === 'evaluate' ? 'Evaluating (LLM + consensus)…' : 'Request Evaluation'}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canFinalize || actionBusy !== null}
            title="Derives verdict from the stored evaluation — no verdict parameter"
            onClick={() =>
              void runAction('finalize', () => getCourt().finalizeVerdict(disputeId), 'Verdict finalized from evaluation.')
            }
          >
            {actionBusy === 'finalize' ? 'Finalizing…' : 'Finalize Verdict'}
          </button>
          <button
            className="btn btn-primary"
            disabled={!canSettle || actionBusy !== null}
            onClick={() =>
              void runAction('settle', () => getCourt().executeSettlement(disputeId), 'Settlement executed.')
            }
          >
            {actionBusy === 'settle' ? 'Settling…' : 'Execute Settlement'}
          </button>
          <button
            className="btn btn-secondary"
            disabled={!canAppeal || actionBusy !== null}
            onClick={() =>
              void runAction(
                'appeal',
                () => getCourt().openAppeal(disputeId, 'Party appeal after finalized verdict'),
                'Appeal opened. Re-run evaluation to supersede.',
              )
            }
          >
            {actionBusy === 'appeal' ? 'Opening…' : 'Open Appeal'}
          </button>
        </div>
        {actionError && (
          <div style={{ marginTop: '0.75rem', color: 'var(--danger)', fontSize: '0.9rem' }}>{actionError}</div>
        )}
        {actionWarning && (
          <div style={{ marginTop: '0.75rem', color: 'var(--warning, #f59e0b)', fontSize: '0.9rem' }}>
            {actionWarning} Auto-refreshing…
          </div>
        )}
        {actionNote && (
          <div style={{ marginTop: '0.75rem', color: 'var(--success)', fontSize: '0.9rem' }}>{actionNote}</div>
        )}
        {evaluation && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Evaluation state:{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{evaluation.state}</strong>
            {evaluation.error ? ` — ${evaluation.error}` : ''}
            {' · '}valid evaluators: {evaluation.consensus.validCount}
            {' · '}agreement: {(evaluation.consensus.agreementRatio * 100).toFixed(0)}%
          </div>
        )}
        {status === 'EVALUATION_FAILED' && (
          <div style={{ marginTop: '0.5rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
            Evaluation failed (fail-closed). No verdict was written. Fix evidence or retry evaluation.
          </div>
        )}
        {status === 'INCONCLUSIVE' && (
          <div style={{ marginTop: '0.5rem', color: 'var(--warning)', fontSize: '0.85rem' }}>
            Inconclusive — finalizing will freeze settlement (UNVERIFIABLE / REVIEW required).
          </div>
        )}
        {status === 'DISPUTED' && (
          <div style={{ marginTop: '0.5rem', color: 'var(--warning)', fontSize: '0.85rem' }}>
            Evaluators materially disagree — dispute state; finalizing freezes settlement.
          </div>
        )}
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
          <div className="verdict-label">Final Verdict (derived from evaluation)</div>
          <div className={`verdict-value verdict-${verdict.verdict}`}>{verdict.verdict}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Confidence: {confidencePercent(verdict.confidence)}% · Resolution: {verdict.resolution}
            {verdict.reviewRequired ? ' · Review required (settlement frozen)' : ''}
          </div>
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

      {activeTab === 'evaluators' && (
        evaluators.length > 0 ? (
          <EvaluatorResults evaluators={evaluators} />
        ) : (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>
              {status === 'EVALUATION_PENDING'
                ? 'Evaluation is running…'
                : 'No evaluation yet. Use Request Evaluation after investigation starts.'}
            </p>
          </div>
        )
      )}

      {activeTab === 'adversarial' && (
        <div className="adversarial-findings">
          <div className="section-header">
            <h2>Adversarial Review</h2>
            {adversarial && (
              <span
                className="status-badge"
                style={{
                  background: adversarial.verdictUpheld ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                  color: adversarial.verdictUpheld ? 'var(--success)' : 'var(--danger)',
                }}
              >
                {adversarial.verdictUpheld ? 'CONSENSUS UPHELD' : 'CONSENSUS CHALLENGED'}
              </span>
            )}
          </div>
          {adversarial ? (
            <>
              <div className="stat-card" style={{ marginBottom: '1rem' }}>
                <h3>Reviewer Reasoning</h3>
                <div style={{ marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>{adversarial.reasoning || '(empty)'}</div>
                <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Confidence adjustment: {adversarial.confidenceAdjustment} points
                </div>
              </div>
              {adversarial.challenges.length > 0 && (
                <div className="evaluator-cards">
                  {adversarial.challenges.map((c, i) => (
                    <div key={i} className="evaluator-card">
                      <div className="evaluator-header">
                        <span className="evaluator-id">{c.type}</span>
                        <span style={{ color: c.affectsVerdict ? 'var(--danger)' : 'var(--text-secondary)' }}>
                          severity {(c.severity * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>{c.description}</div>
                      {c.affectsVerdict && (
                        <div className="evaluator-badge majority" style={{ background: 'rgba(239,68,68,0.2)', color: 'var(--danger)' }}>
                          Affects verdict
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="stat-card">
              <h3>Not evaluated yet</h3>
              <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                Adversarial findings are written on-chain when Request Evaluation completes.
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'consensus' && (
        <ConsensusView
          evaluatorCount={consensus.length}
          agreementRatio={
            evaluation?.consensus.agreementRatio ?? consensusData.agreementRatio
          }
          breakdown={evaluation?.consensus.counts ?? consensusData.counts}
          disagreementDetected={
            (evaluation?.consensus.state === 'DISPUTED') || consensusData.disagreementDetected
          }
          requiresReview={verdict?.reviewRequired ?? evaluation?.consensus.reviewRequired ?? false}
          reasoning={buildConsensusSummary(
            evaluators,
            consensusData,
            verdict?.verdict,
            verdict ? confidencePercent(verdict.confidence) : undefined,
            verdict?.reviewRequired,
          )}
        />
      )}

      {activeTab === 'verdict' && verdict && (
        <VerdictExplorer
          verdict={{
            verdict: verdict.verdict,
            confidence: confidencePercent(verdict.confidence),
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
