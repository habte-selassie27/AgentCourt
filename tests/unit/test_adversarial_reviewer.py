"""
Tests for the adversarial_reviewer intelligent contract.
"""

import pytest
from intelligent_contracts.adversarial.adversarial_reviewer import (
    run_adversarial_review,
    find_evidence_gaps,
    check_source_manipulation,
    check_logic_flaws,
    check_agreement_interpretation,
    ChallengeType,
)


class TestEvidenceGaps:
    def test_no_gaps(self):
        obligations = [{"field": "records", "required_value": 10000}]
        evidence = [{"description": "records requirement met"}]
        gaps = find_evidence_gaps(obligations, evidence)
        assert len(gaps) == 0

    def test_gap_found(self):
        obligations = [{"field": "records", "required_value": 10000}]
        evidence = [{"description": "format is correct"}]
        gaps = find_evidence_gaps(obligations, evidence)
        assert len(gaps) == 1
        assert gaps[0].challenge_type == ChallengeType.EVIDENCE_GAPS


class TestSourceManipulation:
    def test_large_cluster(self):
        evidence = [{"id": f"E{i}", "source": "API_A"} for i in range(5)]
        clusters = [["E0", "E1", "E2", "E3", "E4"]]
        challenges = check_source_manipulation(evidence, clusters)
        assert len(challenges) >= 1
        assert any(c.challenge_type == ChallengeType.SOURCE_MANIPULATION for c in challenges)

    def test_dominant_source(self):
        evidence = [
            {"id": "E1", "source": "API_A"},
            {"id": "E2", "source": "API_A"},
            {"id": "E3", "source": "API_A"},
            {"id": "E4", "source": "API_B"},
        ]
        challenges = check_source_manipulation(evidence, [])
        assert any("API_A" in c.description for c in challenges)


class TestLogicFlaws:
    def test_true_with_contradictions(self):
        challenges = check_logic_flaws("TRUE", 0.9, 2, 3)
        assert len(challenges) >= 1
        assert any(c.affects_verdict for c in challenges)

    def test_high_confidence_weak_evidence(self):
        challenges = check_logic_flaws("TRUE", 0.95, 1, 0)
        assert any(c.challenge_type == ChallengeType.LOGIC_FLAW for c in challenges)


class TestAgreementInterpretation:
    def test_claim_references_nonexistent_field(self):
        agreement = {"requirements": {"records": 10000}}
        claim = {"expected": {"nonexistent_field": "value"}}
        challenges = check_agreement_interpretation(agreement, claim)
        assert len(challenges) == 1
        assert challenges[0].challenge_type == ChallengeType.AGREEMENT_MISINTERPRETATION

    def test_all_fields_in_agreement(self):
        agreement = {"requirements": {"records": 10000, "format": "json"}}
        claim = {"expected": {"records": 10000, "format": "json"}}
        challenges = check_agreement_interpretation(agreement, claim)
        assert len(challenges) == 0


class TestAdversarialReview:
    def test_no_challenges(self):
        result = run_adversarial_review(
            initial_verdict="TRUE",
            initial_confidence=0.9,
            agreement={"requirements": {"records": 10000}},
            claim={"expected": {"records": 10000}},
            evidence=[{"id": "E1", "description": "records requirement met", "source": "A"}],
            supporting_ids=["E1"],
            contradicting_ids=[],
        )
        assert result.verdict_upheld is True
        assert result.confidence_adjustment >= 0

    def test_with_gaps(self):
        result = run_adversarial_review(
            initial_verdict="TRUE",
            initial_confidence=0.9,
            agreement={"requirements": {"records": 10000}},
            claim={"expected": {"records": 10000}},
            evidence=[],
            supporting_ids=[],
            contradicting_ids=[],
        )
        assert len(result.challenges) > 0

    def test_strongest_challenge_is_severe(self):
        result = run_adversarial_review(
            initial_verdict="TRUE",
            initial_confidence=0.9,
            agreement={"requirements": {"records": 10000}},
            claim={"expected": {"records": 10000}},
            evidence=[
                {"id": "E1", "description": "records below requirement", "source": "A"},
                {"id": "E2", "description": "records below requirement", "source": "A"},
                {"id": "E3", "description": "records below requirement", "source": "A"},
            ],
            source_clusters=[["E1", "E2", "E3"]],
            supporting_ids=[],
            contradicting_ids=["E1", "E2", "E3"],
        )
        assert result.strongest_challenge is not None
        assert result.strongest_challenge.severity > 0.5
