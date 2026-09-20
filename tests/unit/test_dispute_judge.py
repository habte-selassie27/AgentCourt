"""
Tests for the dispute_judge intelligent contract.
"""

import pytest
from intelligent_contracts.disputes.dispute_judge import (
    judge_dispute,
    parse_agreement,
    parse_claim,
    extract_obligations,
    evaluate_evidence_against_obligation,
    Verdict,
    ConfidenceLevel,
)


class TestAgreementParsing:
    def test_parse_basic_agreement(self):
        agreement = parse_agreement({
            "service": "dataset_delivery",
            "requirements": {
                "minimumRecords": 10000,
                "minimumCompleteness": 0.95,
                "format": "json",
            },
            "deadline": 1790000000,
        })

        assert agreement.service_type == "dataset_delivery"
        assert len(agreement.requirements) == 3
        assert agreement.deadline == 1790000000

    def test_parse_empty_agreement(self):
        agreement = parse_agreement({})
        assert agreement.service_type == "unknown"
        assert agreement.requirements == {}


class TestClaimParsing:
    def test_parse_delivery_claim(self):
        claim = parse_claim({
            "claim_type": "DELIVERY_FAILURE",
            "description": "Seller delivered late",
            "expected": {"delivery_before": "2026-09-15"},
            "observed": {"delivery_timestamp": "2026-09-16"},
        })

        assert claim.claim_type == "DELIVERY_FAILURE"
        assert claim.expected["delivery_before"] == "2026-09-15"

    def test_parse_custom_claim(self):
        claim = parse_claim({"description": "Something went wrong"})
        assert claim.claim_type == "CUSTOM"


class TestObligationExtraction:
    def test_extract_numeric_obligations(self):
        agreement = parse_agreement({
            "requirements": {
                "minimumRecords": 10000,
                "minimumCompleteness": 0.95,
            }
        })
        obligations = extract_obligations(agreement)

        assert len(obligations) == 2
        types = [o["obligation_type"] for o in obligations]
        assert "NUMERIC_THRESHOLD" in types

    def test_extract_format_obligations(self):
        agreement = parse_agreement({
            "requirements": {"format": "json"}
        })
        obligations = extract_obligations(agreement)

        assert len(obligations) == 1
        assert obligations[0]["obligation_type"] == "FORMAT"

    def test_extract_deadline_obligations(self):
        agreement = parse_agreement({
            "requirements": {"deadline": 1790000000}
        })
        obligations = extract_obligations(agreement)

        assert len(obligations) == 1
        assert obligations[0]["obligation_type"] == "DEADLINE"


class TestEvidenceEvaluation:
    def test_evidence_supports_obligation(self):
        obligation = {"field": "minimumRecords", "required_value": 10000, "obligation_type": "NUMERIC_THRESHOLD"}
        evidence = {
            "id": "EVID-001",
            "type": "CONTENT_HASH",
            "source": "validation",
            "reference": "0xabc",
            "content_hash": "0x123",
            "timestamp": 1790000000,
            "description": "Dataset meets minimumRecords requirement",
        }

        result, supporting, contradicting = evaluate_evidence_against_obligation(obligation, [evidence])
        assert result is True
        assert "EVID-001" in supporting

    def test_evidence_contradicts_obligation(self):
        obligation = {"field": "minimumRecords", "required_value": 10000, "obligation_type": "NUMERIC_THRESHOLD"}
        evidence = {
            "id": "EVID-002",
            "type": "CONTENT_HASH",
            "source": "validation",
            "reference": "0xabc",
            "content_hash": "0x123",
            "timestamp": 1790000000,
            "description": "Dataset below minimumRecords requirement, insufficient records",
        }

        result, supporting, contradicting = evaluate_evidence_against_obligation(obligation, [evidence])
        assert result is False
        assert "EVID-002" in contradicting

    def test_no_relevant_evidence(self):
        obligation = {"field": "minimumRecords", "required_value": 10000, "obligation_type": "NUMERIC_THRESHOLD"}
        evidence = {
            "id": "EVID-003",
            "type": "ONCHAIN_TRANSACTION",
            "source": "chain",
            "reference": "0xabc",
            "content_hash": "0x123",
            "timestamp": 1790000000,
            "description": "Payment transaction confirmed",
        }

        result, supporting, contradicting = evaluate_evidence_against_obligation(obligation, [evidence])
        assert result is None
        assert len(supporting) == 0
        assert len(contradicting) == 0


class TestJudgeDispute:
    def test_judge_with_strong_supporting_evidence(self):
        result = judge_dispute(
            agreement_data={
                "service": "dataset",
                "requirements": {"minimumRecords": 10000},
                "deadline": 1790000000,
            },
            claim_data={
                "claim_type": "DATA_QUALITY",
                "description": "Dataset quality issue",
            },
            evidence_data=[
                {
                    "id": "EVID-001",
                    "type": "CONTENT_HASH",
                    "source": "validation",
                    "reference": "0xabc",
                    "content_hash": "0x123",
                    "timestamp": 1790000000,
                    "description": "Dataset meets minimumRecords requirement",
                },
            ],
        )

        assert result.verdict in (Verdict.TRUE, Verdict.FALSE)
        assert result.confidence > 0

    def test_judge_with_no_obligations(self):
        result = judge_dispute(
            agreement_data={"service": "unknown"},
            claim_data={"claim_type": "CUSTOM", "description": "Something"},
            evidence_data=[],
        )

        assert result.verdict == Verdict.REVIEW
        assert result.confidence < 0.5

    def test_judge_with_mixed_evidence(self):
        result = judge_dispute(
            agreement_data={
                "service": "dataset",
                "requirements": {"minimumRecords": 10000},
                "deadline": 1790000000,
            },
            claim_data={
                "claim_type": "DATA_QUALITY",
                "description": "Dataset quality issue",
            },
            evidence_data=[
                {
                    "id": "EVID-001",
                    "type": "CONTENT_HASH",
                    "source": "validation",
                    "reference": "0xabc",
                    "content_hash": "0x123",
                    "timestamp": 1790000000,
                    "description": "Dataset meets minimumRecords requirement",
                },
                {
                    "id": "EVID-002",
                    "type": "CONTENT_HASH",
                    "source": "validation2",
                    "reference": "0xdef",
                    "content_hash": "0x456",
                    "timestamp": 1790000001,
                    "description": "Dataset below minimumRecords, insufficient records",
                },
            ],
        )

        assert result.verdict == Verdict.REVIEW
