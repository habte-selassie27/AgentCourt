"""
GenVM integration tests for AgentCourtCore's nondeterministic evaluation.

Unlike ``tests/unit/`` (which runs the contracts against the lightweight stub in
``tests/genlayer_stub.py``), these tests deploy the real contract source into a
real genlayer SDK runtime via `gltest` direct mode, with web + LLM mocked.

Direct mode runs the leader but *skips consensus*, so the validator is exercised
explicitly through ``vm.run_validator()``.

Run with:

    AGENTCOURT_REAL_GENLAYER=1 gltest tests/integration -s -v

Requires Python 3.12+ and ``genlayer-test``; skipped automatically otherwise.
"""

from __future__ import annotations

import importlib.util
import json

import pytest

# gltest imports the real SDK, which needs collections.abc.Buffer (Python 3.12+).
pytest.importorskip("gltest", reason="genvm integration tests need gltest on Python 3.12+")

CORE = "intelligent-contracts/core/agentcourt_core.py"

RESPONDENT = "0x" + "22" * 20
AGREEMENT = "0x" + "ab" * 32


def _evaluator(verdict: str) -> str:
    return json.dumps(
        {
            "verdict": verdict,
            "confidence": 80,
            "reasoning": "mock reasoning citing EVID-1",
            "evidence_used": ["EVID-1"],
            "contradictions": [],
            "missing_information": [],
        }
    )


def _adversarial(upheld: bool = True) -> str:
    return json.dumps(
        {
            "challenges": [],
            "verdict_upheld": upheld,
            "reasoning": "mock adversarial review",
            "confidence_adjustment": -5,
        }
    )


def _mock_unanimous(vm, verdict: str = "SUPPORTED") -> None:
    """All four evaluator roles agree; the adversarial reviewer upholds it."""
    vm.mock_web(r".*", {"status": 200, "body": "mock web body"})
    vm.mock_llm(r"DISPROVE the emerging evaluator consensus", _adversarial())
    for role in ("neutral", "claimant_advocate", "respondent_advocate", "auditor"):
        vm.mock_llm(rf"Role perspective: {role}", _evaluator(verdict))


def _open_dispute(core) -> int:
    dispute_id = core.create_dispute(
        RESPONDENT,
        AGREEMENT,
        3,  # DATA_QUALITY
        "Delivered 90 of the 100 records the agreement requires.",
        100,
        1790888340,
    )
    core.submit_evidence(
        dispute_id,
        2,  # API_RESPONSE
        "https://example.com/report",
        "https://example.com/report",
        "0x" + "cc" * 32,
        "delivery report",
    )
    core.start_investigation(dispute_id)
    return dispute_id


def test_evaluation_commits_only_from_consensus(direct_vm, direct_deploy):
    """The leader pipeline must produce a stored CONSENSUS, never a caller verdict."""
    # Production cloudpickles the run_nondet closures across the WASM boundary.
    # gltest can only verify that when cloudpickle is importable.
    if importlib.util.find_spec("cloudpickle") is not None:
        direct_vm.check_pickling = True
    core = direct_deploy(CORE, "0x" + "11" * 20)
    dispute_id = _open_dispute(core)
    _mock_unanimous(direct_vm)

    state = core.request_evaluation(dispute_id)

    assert state == "CONSENSUS"
    assert core.get_dispute(dispute_id)["status"] == 6  # STATUS_CONSENSUS
    assert core.get_dispute(dispute_id)["evaluationVersion"] == 1

    evaluation = core.get_evaluation(dispute_id)
    assert evaluation is not None
    consensus = evaluation["consensus"]
    assert consensus["state"] == "CONSENSUS"
    assert consensus["validCount"] == 4
    assert consensus["finalVerdict"] == 1  # VERDICT_TRUE
    assert consensus["reviewRequired"] is False

    # Verdict is derived on-chain from those four evaluator outputs.
    verdict = core.finalize_verdict(dispute_id)
    assert verdict == 1  # VERDICT_TRUE
    settled = core.get_verdict(dispute_id)
    assert settled["resolution"] == 0  # RESOLUTION_RELEASE_TO_CLAIMANT
    assert settled["reviewRequired"] is False


def test_validator_checks_the_substantive_verdict(direct_vm, direct_deploy):
    """Validators must accept an identical re-run and reject a changed one."""
    core = direct_deploy(CORE, "0x" + "11" * 20)
    dispute_id = _open_dispute(core)
    _mock_unanimous(direct_vm)
    core.request_evaluation(dispute_id)

    assert direct_vm.run_validator() is True

    # Same computation, different evidence -> the verdict must not survive.
    direct_vm.clear_mocks()
    _mock_unanimous(direct_vm, verdict="REFUTED")
    assert direct_vm.run_validator() is False


def test_split_evaluators_fail_closed(direct_vm, direct_deploy):
    """A 2-2 split must not produce a verdict — it escalates to REVIEW."""
    core = direct_deploy(CORE, "0x" + "11" * 20)
    dispute_id = _open_dispute(core)

    direct_vm.mock_web(r".*", {"status": 200, "body": "mock web body"})
    direct_vm.mock_llm(r"DISPROVE the emerging evaluator consensus", _adversarial())
    direct_vm.mock_llm(r"Role perspective: neutral", _evaluator("SUPPORTED"))
    direct_vm.mock_llm(r"Role perspective: claimant_advocate", _evaluator("SUPPORTED"))
    direct_vm.mock_llm(r"Role perspective: respondent_advocate", _evaluator("REFUTED"))
    direct_vm.mock_llm(r"Role perspective: auditor", _evaluator("REFUTED"))

    state = core.request_evaluation(dispute_id)
    assert state == "DISPUTED"
    assert core.get_evaluation(dispute_id)["consensus"]["reviewRequired"] is True

    verdict = core.finalize_verdict(dispute_id)
    assert verdict == 5  # VERDICT_REVIEW
    assert core.get_verdict(dispute_id)["reviewRequired"] is True

    # Fail-closed: a review-required verdict must never settle.
    with direct_vm.expect_revert("Review required"):
        core.execute_settlement(dispute_id)
