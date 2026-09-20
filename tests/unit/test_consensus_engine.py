"""
Tests for the consensus_engine intelligent contract.
"""

import pytest
from intelligent_contracts.consensus.consensus_engine import (
    build_consensus,
    count_verdicts,
    compute_agreement_ratio,
    detect_disagreement,
    should_require_review,
    EvaluatorResult,
    Verdict,
)


def make_evaluator(eid: str, verdict: str, confidence: float) -> EvaluatorResult:
    return EvaluatorResult(
        evaluator_id=eid,
        verdict=Verdict(verdict),
        confidence=confidence,
        reasoning_hash="0xabc",
    )


class TestVerdictCounting:
    def test_count_single(self):
        results = [make_evaluator("A", "TRUE", 0.9)]
        counts = count_verdicts(results)
        assert counts["TRUE"] == 1

    def test_count_multiple(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "TRUE", 0.85),
            make_evaluator("C", "FALSE", 0.7),
        ]
        counts = count_verdicts(results)
        assert counts["TRUE"] == 2
        assert counts["FALSE"] == 1


class TestAgreementRatio:
    def test_unanimous(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "TRUE", 0.85),
            make_evaluator("C", "TRUE", 0.8),
        ]
        ratio = compute_agreement_ratio(results)
        assert ratio == 1.0

    def test_majority(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "TRUE", 0.85),
            make_evaluator("C", "FALSE", 0.7),
        ]
        ratio = compute_agreement_ratio(results)
        assert abs(ratio - 2 / 3) < 0.01

    def test_empty(self):
        ratio = compute_agreement_ratio([])
        assert ratio == 0.0


class TestDisagreementDetection:
    def test_no_disagreement(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "TRUE", 0.85),
        ]
        has_disagreement, details = detect_disagreement(results)
        assert has_disagreement is False
        assert len(details) == 0

    def test_disagreement(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "FALSE", 0.85),
        ]
        has_disagreement, details = detect_disagreement(results)
        assert has_disagreement is True
        assert len(details) > 0


class TestReviewRequirement:
    def test_review_needed_low_agreement(self):
        assert should_require_review(0.4, 0.8, False) is True

    def test_review_needed_low_confidence(self):
        assert should_require_review(0.8, 0.3, False) is True

    def test_review_needed_has_review(self):
        assert should_require_review(0.9, 0.8, True) is True

    def test_no_review_needed(self):
        assert should_require_review(0.8, 0.7, False) is False


class TestBuildConsensus:
    def test_unanimous_true(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "TRUE", 0.85),
            make_evaluator("C", "TRUE", 0.8),
            make_evaluator("D", "TRUE", 0.75),
        ]
        output = build_consensus(results)

        assert output.final_verdict == Verdict.TRUE
        assert output.agreement_ratio == 1.0
        assert output.evaluator_count == 4
        assert output.disagreement_detected is False
        assert output.requires_review is False

    def test_mixed_verdicts(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "TRUE", 0.85),
            make_evaluator("C", "FALSE", 0.7),
            make_evaluator("D", "REVIEW", 0.6),
        ]
        output = build_consensus(results)

        assert output.disagreement_detected is True
        assert "TRUE" in output.breakdown
        assert "FALSE" in output.breakdown

    def test_empty_results(self):
        output = build_consensus([])
        assert output.final_verdict == Verdict.REVIEW
        assert output.requires_review is True

    def test_adversarial_adjustment(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "TRUE", 0.85),
        ]
        output_normal = build_consensus(results, adversarial_confidence_adjustment=0.0)
        output_adjusted = build_consensus(results, adversarial_confidence_adjustment=-0.3)

        assert output_adjusted.final_confidence < output_normal.final_confidence

    def test_review_from_evaluator(self):
        results = [
            make_evaluator("A", "TRUE", 0.9),
            make_evaluator("B", "REVIEW", 0.5),
        ]
        output = build_consensus(results)
        assert output.requires_review is True
