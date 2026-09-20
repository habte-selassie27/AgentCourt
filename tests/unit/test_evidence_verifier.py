"""
Tests for the evidence_verifier intelligent contract.
"""

import pytest
from intelligent_contracts.evidence.evidence_verifier import (
    verify_evidence_format,
    verify_content_hash,
    compute_content_hash,
    check_source_independence,
    detect_source_clusters,
    cross_reference_evidence,
    verify_evidence_batch,
    SourceInfo,
)


class TestEvidenceFormat:
    def test_valid_evidence(self):
        evidence = {
            "id": "EVID-001",
            "type": "ONCHAIN_TRANSACTION",
            "source": "Arc",
            "reference": "0xabc",
            "content_hash": "0x123",
            "timestamp": 1790000000,
        }
        valid, issues = verify_evidence_format(evidence)
        assert valid is True
        assert len(issues) == 0

    def test_missing_id(self):
        evidence = {
            "type": "ONCHAIN_TRANSACTION",
            "source": "Arc",
            "reference": "0xabc",
            "content_hash": "0x123",
        }
        valid, issues = verify_evidence_format(evidence)
        assert valid is False
        assert any("id" in i for i in issues)

    def test_invalid_timestamp(self):
        evidence = {
            "id": "EVID-001",
            "type": "ONCHAIN_TRANSACTION",
            "source": "Arc",
            "reference": "0xabc",
            "content_hash": "0x123",
            "timestamp": -1,
        }
        valid, issues = verify_evidence_format(evidence)
        assert valid is False
        assert any("timestamp" in i for i in issues)

    def test_unknown_type(self):
        evidence = {
            "id": "EVID-001",
            "type": "UNKNOWN_TYPE",
            "source": "Arc",
            "reference": "0xabc",
            "content_hash": "0x123",
        }
        valid, issues = verify_evidence_format(evidence)
        assert valid is False
        assert any("type" in i.lower() for i in issues)


class TestContentHash:
    def test_compute_hash(self):
        h = compute_content_hash("test content")
        assert len(h) == 64

    def test_verify_matching_hash(self):
        content = "test content"
        h = compute_content_hash(content)
        evidence = {"content_hash": h}
        assert verify_content_hash(evidence, content) is True

    def test_verify_empty_hash(self):
        evidence = {"content_hash": ""}
        assert verify_content_hash(evidence, "anything") is True


class TestSourceIndependence:
    def test_independent_sources(self):
        sources = [
            SourceInfo(source_id="A"),
            SourceInfo(source_id="B"),
            SourceInfo(source_id="C"),
        ]
        result = check_source_independence(sources)
        assert all(result.values())

    def test_dependent_sources(self):
        sources = [
            SourceInfo(source_id="A", parent_sources=["B"]),
            SourceInfo(source_id="B"),
        ]
        result = check_source_independence(sources)
        assert result["A"] is False
        assert result["B"] is True

    def test_detect_cluster(self):
        sources = [
            SourceInfo(source_id="A", parent_sources=["B"]),
            SourceInfo(source_id="B"),
            SourceInfo(source_id="C"),
        ]
        clusters = detect_source_clusters(sources)
        assert len(clusters) == 1
        assert "A" in clusters[0]
        assert "B" in clusters[0]


class TestCrossReferences:
    def test_same_source(self):
        evidence = [
            {"id": "E1", "source": "API_A"},
            {"id": "E2", "source": "API_A"},
        ]
        refs = cross_reference_evidence(evidence)
        assert "E2" in refs["E1"]
        assert "E1" in refs["E2"]

    def test_different_sources(self):
        evidence = [
            {"id": "E1", "source": "API_A"},
            {"id": "E2", "source": "API_B"},
        ]
        refs = cross_reference_evidence(evidence)
        assert len(refs["E1"]) == 0
        assert len(refs["E2"]) == 0


class TestBatchVerification:
    def test_batch_all_valid(self):
        evidence = [
            {
                "id": "E1",
                "type": "ONCHAIN_TRANSACTION",
                "source": "chain",
                "reference": "0xabc",
                "content_hash": "0x123",
                "timestamp": 1790000000,
            },
            {
                "id": "E2",
                "type": "WEB_PAGE",
                "source": "web",
                "reference": "https://example.com",
                "content_hash": "0x456",
                "timestamp": 1790000001,
            },
        ]
        results = verify_evidence_batch(evidence)
        assert len(results) == 2
        assert all(r.verified for r in results)

    def test_batch_with_invalid(self):
        evidence = [
            {
                "id": "E1",
                "type": "ONCHAIN_TRANSACTION",
                "source": "chain",
                "reference": "0xabc",
                "content_hash": "0x123",
                "timestamp": 1790000000,
            },
            {
                "id": "E2",
                "source": "",
                "reference": "",
                "content_hash": "",
            },
        ]
        results = verify_evidence_batch(evidence)
        assert len(results) == 2
        e1_result = next(r for r in results if r.evidence_id == "E1")
        e2_result = next(r for r in results if r.evidence_id == "E2")
        assert e1_result.verified is True
        assert e2_result.verified is False
