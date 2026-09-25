"""
Acceptance tests for caller isolation, nondeterministic evaluation path,
validator consensus over the substantive verdict, and fail-closed outcomes.
"""

from __future__ import annotations

import inspect
import json

import pytest

from tests.genlayer_stub import (
    Address,
    _Message,
    _Return,
    _UserError,
    contract_writes,
    register_contract_view,
    reset_contract_registry,
)

from core.agentcourt_core import (  # type: ignore
    AGREEMENT_CONSENSUS_THRESHOLD,
    EVALUATOR_ROLES,
    MIN_VALID_EVALUATORS,
    REFUTED,
    STATE_CONSENSUS,
    STATE_DISPUTED,
    STATE_EVALUATION_FAILED,
    STATE_INCONCLUSIVE,
    SUPPORTED,
    AgentCourtCore,
    INCONCLUSIVE_LABEL,
    VERDICT_FALSE,
    VERDICT_NONE,
    VERDICT_REVIEW,
    VERDICT_TRUE,
    VERDICT_UNVERIFIABLE,
    build_consensus,
    build_evaluation_prompt,
    classify_evaluation,
    consensus_consistent,
    normalize_evaluator,
    resolution_for_verdict,
    tally_evaluators,
)
from registry.resolution_manager import ResolutionManager  # type: ignore

import core.agentcourt_core as core_mod  # type: ignore


RESET_SENDER = Address("0x00000000000000000000000000000000000000aa")
PARTY_A = Address("0x00000000000000000000000000000000000000a1")
PARTY_B = Address("0x00000000000000000000000000000000000000b2")
STRANGER = Address("0x00000000000000000000000000000000000000ff")


@pytest.fixture(autouse=True)
def _sender():
    def _set(addr: Address):
        _Message.sender_address = addr

    yield _set
    _set(RESET_SENDER)


@pytest.fixture(autouse=True)
def _registry():
    reset_contract_registry()
    yield
    reset_contract_registry()


def make_resolution_manager() -> ResolutionManager:
    _Message.sender_address = RESET_SENDER
    return ResolutionManager()


def make_core(manager_addr: str = "0x00000000000000000000000000000000000000m1") -> AgentCourtCore:
    _Message.sender_address = RESET_SENDER
    return AgentCourtCore(manager_addr)


def open_dispute(core: AgentCourtCore, sender: Address = PARTY_A) -> int:
    _Message.sender_address = sender
    return core.create_dispute(
        PARTY_B,
        "0x" + "ab" * 32,
        0,
        "Seller delivered 8200 of 10000 required records.",
        1_000_000,
        1_790_000_000,
    )


def sample_evaluators(verdicts):
    return [
        normalize_evaluator(
            {"verdict": v, "confidence": 80, "reasoning": f"r-{v}", "evidence_used": ["EVID-1"]},
            role,
        )
        for role, v in zip(EVALUATOR_ROLES, verdicts)
    ]


def stub_nondet(monkeypatch, evaluator_verdicts, adversarial=None):
    """Stub gl.nondet so real leader_fn + validator_fn agree under run_nondet."""
    if adversarial is None:
        adversarial = {
            "challenges": [],
            "verdict_upheld": True,
            "reasoning": "holds",
            "confidence_adjustment": -5,
        }
    by_role = dict(zip(EVALUATOR_ROLES, evaluator_verdicts))

    def fake_exec_prompt(prompt, **kwargs):
        if "DISPROVE the emerging evaluator consensus" in prompt:
            return adversarial
        for role, v in by_role.items():
            if f"Role perspective: {role}" in prompt:
                return {
                    "verdict": v,
                    "confidence": 80,
                    "reasoning": f"r-{v}",
                    "evidence_used": ["EVID-1"],
                }
        return {"verdict": INCONCLUSIVE_LABEL, "confidence": 0, "reasoning": "", "evidence_used": []}

    def fake_render(url, **kwargs):
        return "status page content"

    class _Resp:
        def __init__(self, text: str):
            self.body = text.encode("utf-8")

    def fake_get(url, **kwargs):
        return _Resp("status page content")

    monkeypatch.setattr(core_mod.gl.nondet, "exec_prompt", fake_exec_prompt)
    monkeypatch.setattr(core_mod.gl.nondet.web, "get", fake_get)
    monkeypatch.setattr(core_mod.gl.nondet.web, "render", fake_render)


# ---------------------------------------------------------------------------
# 1. No caller-supplied verdict on write paths
# ---------------------------------------------------------------------------

class TestNoCallerVerdict:
    def test_finalize_verdict_signature_has_no_verdict_param(self):
        sig = inspect.signature(AgentCourtCore.finalize_verdict)
        params = [p for p in sig.parameters if p != "self"]
        assert params == ["dispute_id"]

    def test_execute_settlement_signature_has_no_verdict_or_action(self):
        sig = inspect.signature(AgentCourtCore.execute_settlement)
        params = [p for p in sig.parameters if p != "self"]
        assert params == ["dispute_id"]

    def test_resolution_manager_settlement_signature(self):
        sig = inspect.signature(ResolutionManager.execute_settlement)
        params = [p for p in sig.parameters if p != "self"]
        assert params == ["dispute_id"]

    def test_resolution_manager_resolve_appeal_has_no_superseding_verdict(self):
        sig = inspect.signature(ResolutionManager.resolve_appeal)
        params = [p for p in sig.parameters if p != "self"]
        assert params == ["appeal_id"]

    def test_create_dispute_does_not_accept_verdict(self):
        sig = inspect.signature(AgentCourtCore.create_dispute)
        params = [p for p in sig.parameters if p != "self"]
        assert "verdict" not in params


# ---------------------------------------------------------------------------
# 2. Caller cannot force a verdict
# ---------------------------------------------------------------------------

class TestCallerCannotForceVerdict:
    def test_finalize_before_evaluation_raises(self):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        with pytest.raises(_UserError):
            core.finalize_verdict(did)

    def test_stranger_cannot_request_evaluation(self):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.start_investigation(did)
        _Message.sender_address = STRANGER
        with pytest.raises(_UserError):
            core.request_evaluation(did)

    def test_resolution_manager_only_core_may_settle(self):
        manager = make_resolution_manager()
        _Message.sender_address = PARTY_A
        with pytest.raises(_UserError):
            manager.execute_settlement(1)

    def test_resolution_manager_only_core_may_open_appeal(self):
        manager = make_resolution_manager()
        _Message.sender_address = PARTY_A
        with pytest.raises(_UserError):
            manager.open_appeal(1, PARTY_A, "nope")


# ---------------------------------------------------------------------------
# 3. Evaluation path exists (nondeterministic API surface)
# ---------------------------------------------------------------------------

class TestEvaluationPathExists:
    def test_request_evaluation_present(self):
        assert hasattr(AgentCourtCore, "request_evaluation")

    def test_source_uses_run_nondet_and_exec_prompt_and_web(self):
        source = inspect.getsource(AgentCourtCore.request_evaluation)
        assert "run_nondet" in source
        assert "exec_prompt" in source
        # Web fetching is shared with the validator, so it lives in fetch_evidence.
        assert "fetch_evidence" in source

    def test_module_source_references_nondeterministic_apis(self):
        src = inspect.getsource(core_mod)
        assert "gl.vm.run_nondet" in src
        assert "gl.nondet.exec_prompt" in src
        assert "gl.nondet.web.get" in src
        # The unsandboxed variant is deliberately not used: a validator error
        # must degrade to disagreement, not a VM-level crash.
        assert "run_nondet_unsafe" not in src

    def test_no_deterministic_keyword_judge_path(self):
        # The fake deterministic judge modules must stay deleted.
        import os
        base = os.path.join(os.path.dirname(__file__), "..", "..", "intelligent-contracts")
        assert not os.path.exists(os.path.join(base, "disputes", "dispute_judge.py"))
        assert not os.path.exists(os.path.join(base, "registry", "dispute_registry.py"))


# ---------------------------------------------------------------------------
# 4. Evidence determines evaluation content
# ---------------------------------------------------------------------------

class TestEvidenceDeterminesEvaluation:
    def test_prompt_includes_evidence_and_description(self):
        case = {
            "id": 7,
            "claimant": PARTY_A,
            "respondent": PARTY_B,
            "agreementHash": "0xdead",
            "claimType": 0,
            "description": "Records incomplete",
            "evidence": [
                {
                    "id": 1,
                    "evidenceType": 1,
                    "source": "web",
                    "refUri": "https://example.com/report",
                    "description": "Validation report",
                }
            ],
        }
        prompt = build_evaluation_prompt(case, [], "neutral")
        assert "Records incomplete" in prompt
        assert "https://example.com/report" in prompt
        assert "Validation report" in prompt
        assert "untrusted DATA" in prompt

    def test_different_evaluator_outputs_change_tally(self):
        a = tally_evaluators(sample_evaluators([SUPPORTED, SUPPORTED, SUPPORTED, SUPPORTED]))
        b = tally_evaluators(sample_evaluators([SUPPORTED, REFUTED, SUPPORTED, REFUTED]))
        assert a["majority"] == SUPPORTED
        assert a["agreementRatio"] == 1.0
        assert b["distinctVerdicts"] == 2
        assert b["agreementRatio"] < 1.0


# ---------------------------------------------------------------------------
# 5. Validator disagreement → DISPUTED / INCONCLUSIVE
# ---------------------------------------------------------------------------

class TestValidatorDisagreement:
    def test_low_agreement_with_split_is_disputed(self):
        tally = tally_evaluators(sample_evaluators([SUPPORTED, REFUTED, SUPPORTED, REFUTED]))
        # 50/50 split → agreement 0.5 < 0.6 and distinct >= 2
        assert tally["agreementRatio"] == 0.5
        adv = {"challenges": [], "verdictUpheld": True, "reasoning": "", "confidenceAdjustment": 0}
        state, verdict, conf, review = classify_evaluation(tally, adv)
        assert state == STATE_DISPUTED
        assert verdict == VERDICT_REVIEW
        assert review is True

    def test_majority_inconclusive_is_inconclusive(self):
        tally = tally_evaluators(
            sample_evaluators([INCONCLUSIVE_LABEL, INCONCLUSIVE_LABEL, SUPPORTED, INCONCLUSIVE_LABEL])
        )
        adv = {"challenges": [], "verdictUpheld": True, "reasoning": "", "confidenceAdjustment": 0}
        state, verdict, conf, review = classify_evaluation(tally, adv)
        assert state == STATE_INCONCLUSIVE
        assert verdict == VERDICT_UNVERIFIABLE
        assert review is True

    def test_too_few_valid_evaluators_is_inconclusive(self):
        evaluators = [
            normalize_evaluator({"verdict": "SUPPORTED", "confidence": 90}, "neutral"),
            normalize_evaluator(None, "claimant_advocate"),
            normalize_evaluator(None, "respondent_advocate"),
            normalize_evaluator(None, "auditor"),
        ]
        # normalize(None) returns None → dropped by tally
        tally = tally_evaluators([e for e in evaluators if e])
        # only 1 valid → below MIN_VALID_EVALUATORS when combined with empties
        tally["validCount"] = 1
        adv = {"challenges": [], "verdictUpheld": True, "reasoning": "", "confidenceAdjustment": 0}
        state, verdict, conf, review = classify_evaluation(tally, adv)
        assert state == STATE_INCONCLUSIVE
        assert review is True


# ---------------------------------------------------------------------------
# 6. Consensus majority works
# ---------------------------------------------------------------------------

class TestConsensusMajority:
    def test_clear_support_majority_is_consensus_true(self):
        tally = tally_evaluators(sample_evaluators([SUPPORTED, SUPPORTED, SUPPORTED, REFUTED]))
        assert tally["majority"] == SUPPORTED
        assert tally["agreementRatio"] >= AGREEMENT_CONSENSUS_THRESHOLD
        adv = {"challenges": [], "verdictUpheld": True, "reasoning": "", "confidenceAdjustment": 0}
        state, verdict, conf, review = classify_evaluation(tally, adv)
        assert state == STATE_CONSENSUS
        assert verdict == VERDICT_TRUE
        assert review is False
        assert conf > 0

    def test_clear_refute_majority_is_consensus_false(self):
        tally = tally_evaluators(sample_evaluators([REFUTED, REFUTED, REFUTED, SUPPORTED]))
        adv = {"challenges": [], "verdictUpheld": True, "reasoning": "", "confidenceAdjustment": 0}
        state, verdict, conf, review = classify_evaluation(tally, adv)
        assert state == STATE_CONSENSUS
        assert verdict == VERDICT_FALSE

    def test_resolution_mapping_deterministic(self):
        assert resolution_for_verdict(VERDICT_TRUE) == 0  # RELEASE_TO_CLAIMANT
        assert resolution_for_verdict(VERDICT_FALSE) == 1  # RELEASE_TO_RESPONDENT
        assert resolution_for_verdict(VERDICT_UNVERIFIABLE) == 3  # FREEZE
        assert resolution_for_verdict(VERDICT_REVIEW) == 3  # FREEZE


# ---------------------------------------------------------------------------
# 7. Evaluation failure is not a valid verdict
# ---------------------------------------------------------------------------

class TestEvaluationFailure:
    def test_failed_nondet_sets_evaluation_failed_status(self, monkeypatch):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.start_investigation(did)

        def boom(*a, **k):
            raise RuntimeError("llm unavailable")

        monkeypatch.setattr(core_mod.gl.vm, "run_nondet", boom)
        result_state = core.request_evaluation(did)
        assert result_state == STATE_EVALUATION_FAILED
        dispute = core.get_dispute(did)
        assert dispute["status"] == 12  # EVALUATION_FAILED

    def test_finalize_rejects_evaluation_failed(self, monkeypatch):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.start_investigation(did)

        def boom(*a, **k):
            raise RuntimeError("fail")

        monkeypatch.setattr(core_mod.gl.vm, "run_nondet", boom)
        core.request_evaluation(did)
        with pytest.raises(_UserError):
            core.finalize_verdict(did)

    def test_failed_ok_false_payload_is_not_finalizable(self, monkeypatch):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.start_investigation(did)

        bad = {
            "ok": False,
            "error": "broken",
            "evaluators": [],
            "adversarial": None,
            "fetches": [],
            "consensus": {
                "state": STATE_EVALUATION_FAILED,
                "majority": INCONCLUSIVE_LABEL,
                "counts": {},
                "agreementRatio": 0.0,
                "validCount": 0,
                "finalVerdict": VERDICT_NONE,
                "confidenceBp": 0,
                "reviewRequired": True,
            },
        }
        monkeypatch.setattr(core_mod.gl.vm, "run_nondet", lambda *a, **k: bad)
        # request_evaluation sees ok=False and stores failed status
        state = core.request_evaluation(did)
        assert state == STATE_EVALUATION_FAILED
        with pytest.raises(_UserError):
            core.finalize_verdict(did)

    def test_consensus_consistent_accepts_the_derived_block(self):
        derived = build_consensus(
            sample_evaluators([SUPPORTED, SUPPORTED, SUPPORTED, SUPPORTED]), None
        )
        assert consensus_consistent(derived, derived) is True

    def test_consensus_consistent_rejects_a_fabricated_consensus(self):
        derived = build_consensus(
            sample_evaluators([SUPPORTED, SUPPORTED, SUPPORTED, SUPPORTED]), None
        )
        assert derived["finalVerdict"] == VERDICT_TRUE

        # A leader cannot claim the opposite verdict from agreeing evaluators.
        assert consensus_consistent({**derived, "finalVerdict": VERDICT_FALSE}, derived) is False
        # Nor inflate confidence, drop evaluators, or clear the review flag.
        assert consensus_consistent({**derived, "confidenceBp": 9999}, derived) is False
        assert consensus_consistent({**derived, "validCount": 9}, derived) is False
        assert consensus_consistent({**derived, "majority": REFUTED}, derived) is False
        assert consensus_consistent({**derived, "reviewRequired": True}, derived) is False


# ---------------------------------------------------------------------------
# 8. Only evaluation + consensus finalizes; settlement derives from verdict
# ---------------------------------------------------------------------------

class TestOnlyEvaluationFinalizes:
    def test_happy_path_finalize_derives_verdict_from_evaluation(self, monkeypatch):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.submit_evidence(
            did, 1, "web", "https://example.com/ok", "0x" + "11" * 32, "status page"
        )
        core.start_investigation(did)

        # Real leader_fn + validator_fn under the stub's run_nondet:
        # both re-execute the pipeline against deterministic nondet stubs.
        stub_nondet(monkeypatch, [SUPPORTED, SUPPORTED, SUPPORTED, REFUTED])

        state = core.request_evaluation(did)
        assert state == STATE_CONSENSUS

        verdict = core.finalize_verdict(did)
        assert verdict == VERDICT_TRUE

        record = core.get_verdict(did)
        assert record["verdict"] == VERDICT_TRUE
        assert record["resolution"] == resolution_for_verdict(VERDICT_TRUE)
        assert record["reviewRequired"] is False
        assert core.get_dispute(did)["status"] == 7  # VERDICT

        # Evidence appears in the stored evaluation fetches/prompts path
        evaluation = core.get_evaluation(did)
        assert evaluation is not None
        assert evaluation["ok"] is True
        assert evaluation["consensus"]["finalVerdict"] == VERDICT_TRUE
        assert any(f["status"] == "ok" for f in evaluation["fetches"])

    def test_inconclusive_finalizes_to_unverifiable_freeze(self, monkeypatch):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.start_investigation(did)

        stub_nondet(
            monkeypatch,
            [INCONCLUSIVE_LABEL, INCONCLUSIVE_LABEL, INCONCLUSIVE_LABEL, INCONCLUSIVE_LABEL],
        )

        state = core.request_evaluation(did)
        assert state == STATE_INCONCLUSIVE
        verdict = core.finalize_verdict(did)
        assert verdict == VERDICT_UNVERIFIABLE
        record = core.get_verdict(did)
        assert record["reviewRequired"] is True
        assert record["resolution"] == 3  # FREEZE

        # Settlement must fail closed when review required
        _Message.sender_address = PARTY_A
        with pytest.raises(_UserError):
            core.execute_settlement(did)

    def test_settlement_reads_core_verdict_not_caller_args(self, monkeypatch):
        manager = make_resolution_manager()
        core_addr = "0x00000000000000000000000000000000000000c1"
        _Message.sender_address = RESET_SENDER
        manager.set_core(core_addr)

        register_contract_view(
            core_addr,
            "get_verdict",
            lambda did: {
                "disputeId": did,
                "verdict": VERDICT_TRUE,
                "confidence": 8500,
                "resolution": 0,
                "reviewRequired": False,
                "version": 1,
            },
        )
        # Impersonate core as sender
        _Message.sender_address = Address(core_addr)
        nonce = manager.execute_settlement(9)
        assert nonce == 1
        assert manager.is_settled(9) is True
        settlement = manager.get_settlement(9)
        assert settlement["verdict"] == VERDICT_TRUE
        assert settlement["resolution"] == 0
        # Second settle rejected
        with pytest.raises(_UserError):
            manager.execute_settlement(9)

    def test_evidence_ids_attached_to_verdict(self, monkeypatch):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        eid = core.submit_evidence(
            did, 4, "chain", "0xabc", "0x" + "22" * 32, "hash only"
        )
        core.start_investigation(did)

        def good(leader_fn, validator_fn):
            evaluators = sample_evaluators([SUPPORTED, SUPPORTED, SUPPORTED, SUPPORTED])
            from core.agentcourt_core import classify_evaluation as _cls, tally_evaluators as _tal

            tally = _tal(evaluators)
            adv = {
                "challenges": [],
                "verdictUpheld": True,
                "reasoning": "",
                "confidenceAdjustment": 0,
            }
            state, verdict, conf, review = _cls(tally, adv)
            result = {
                "ok": True,
                "evaluators": evaluators,
                "adversarial": adv,
                "fetches": [],
                "consensus": {
                    "state": state,
                    "majority": tally["majority"],
                    "counts": tally["counts"],
                    "agreementRatio": tally["agreementRatio"],
                    "validCount": tally["validCount"],
                    "finalVerdict": verdict,
                    "confidenceBp": conf,
                    "reviewRequired": review,
                },
            }
            return result

        monkeypatch.setattr(core_mod.gl.vm, "run_nondet", good)
        core.request_evaluation(did)
        core.finalize_verdict(did)
        record = core.get_verdict(did)
        assert eid in record["evidenceIds"]

    def test_min_valid_evaluators_constant(self):
        assert MIN_VALID_EVALUATORS >= 2


# ---------------------------------------------------------------------------
# 9. Real timestamps + Keccak-256 reasoning commitments
# ---------------------------------------------------------------------------

class TestTimestampsAndDigest:
    # Stub gl.message_raw['datetime'] = "2026-09-23T12:00:00+00:00"
    STUB_UNIX = 1790164800

    def test_now_unix_parses_message_datetime(self):
        assert core_mod._now_unix() == self.STUB_UNIX

    def test_days_from_civil_epoch(self):
        assert core_mod._days_from_civil(1970, 1, 1) == 0

    def test_now_unix_zero_when_datetime_missing(self, monkeypatch):
        monkeypatch.setattr(core_mod.gl, "message_raw", {}, raising=False)
        assert core_mod._now_unix() == 0

    def test_now_unix_zero_on_garbage(self, monkeypatch):
        monkeypatch.setattr(core_mod.gl, "message_raw", {"datetime": "not-a-date"}, raising=False)
        assert core_mod._now_unix() == 0

    def test_create_dispute_records_timestamp(self):
        core = make_core()
        did = open_dispute(core)
        dispute = core.get_dispute(did)
        assert dispute["createdAt"] == self.STUB_UNIX

    def test_submit_evidence_records_timestamp(self):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        eid = core.submit_evidence(did, 1, "web", "https://x.test", "0x" + "33" * 32, "page")
        record = core.get_evidence(eid)
        assert record["timestamp"] == self.STUB_UNIX

    def test_finalize_records_timestamp_and_keccak_hash(self, monkeypatch):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.start_investigation(did)
        stub_nondet(monkeypatch, [SUPPORTED, SUPPORTED, SUPPORTED, SUPPORTED])
        core.request_evaluation(did)
        core.finalize_verdict(did)

        record = core.get_verdict(did)
        assert record["finalizedAt"] == self.STUB_UNIX
        h = record["reasoningHash"]
        assert h.startswith("0x")
        assert len(h) == 66
        int(h, 16)  # valid 32-byte hex
        # Distinct from the old toy polynomial hash.
        assert h != "0x" + format(0x123456789, "064x")

    def test_digest_is_deterministic_and_collision_resistant_enough(self):
        a = core_mod._digest("same input")
        b = core_mod._digest("same input")
        c = core_mod._digest("same input!")
        assert a == b
        assert a != c
        assert len(a) == 66

    def test_appeal_records_timestamp(self):
        manager = make_resolution_manager()
        core_addr = "0x00000000000000000000000000000000000000c1"
        _Message.sender_address = RESET_SENDER
        manager.set_core(core_addr)
        register_contract_view(
            core_addr,
            "get_verdict",
            lambda did: {"disputeId": did, "verdict": VERDICT_TRUE, "version": 1},
        )
        _Message.sender_address = Address(core_addr)
        aid = manager.open_appeal(3, PARTY_A, "new evidence")
        appeal = manager.get_appeal(aid)
        assert appeal["createdAt"] == self.STUB_UNIX


# ---------------------------------------------------------------------------
# 10. Studio Constructor Inputs may decimal-cast addresses to int
# ---------------------------------------------------------------------------


class TestAddressCoercion:
    MANAGER_HEX = "0x3bFE289c35d056c2202dAEC650174966523FE7Da"
    MANAGER_INT = int(MANAGER_HEX, 16)

    def test_to_address_passes_address_through(self):
        a = Address(self.MANAGER_HEX)
        assert core_mod._to_address(a) is a

    def test_to_address_accepts_hex_string(self):
        assert str(core_mod._to_address(self.MANAGER_HEX)).lower() == self.MANAGER_HEX.lower()

    def test_to_address_accepts_studio_decimal_int(self):
        out = core_mod._to_address(self.MANAGER_INT)
        assert str(out).lower() == self.MANAGER_HEX.lower()

    def test_core_constructor_accepts_int_manager(self):
        _Message.sender_address = RESET_SENDER
        core = AgentCourtCore(self.MANAGER_INT)
        assert str(core.resolution_manager).lower() == self.MANAGER_HEX.lower()

    def test_set_core_accepts_int_core_address(self):
        manager = make_resolution_manager()
        core_int = int("0x00000000000000000000000000000000000000c1", 16)
        _Message.sender_address = RESET_SENDER
        manager.set_core(core_int)
        assert str(manager.core) == "0x00000000000000000000000000000000000000c1"

    def test_address_int_out_of_range_rejected(self):
        with pytest.raises(_UserError):
            core_mod._to_address((1 << 160))
