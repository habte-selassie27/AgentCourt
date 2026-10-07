"""Staking/escrow flow tests: deposit, hold, release on settlement."""

from __future__ import annotations

import pytest

from tests.genlayer_stub import (
    Address,
    _Message,
    _UserError,
    contract_writes,
    native_balance_of,
    register_contract_view,
    reset_contract_registry,
)
from tests.unit.test_genlayer_workflow import (
    PARTY_A,
    PARTY_B,
    RESET_SENDER,
    STRANGER,
    make_core,
    open_dispute,
    stub_nondet,
)

from core.agentcourt_core import (
    SUPPORTED,
    REFUTED,
    INCONCLUSIVE_LABEL,
)

STAKE = 1_000_000


@pytest.fixture(autouse=True)
def _registry():
    reset_contract_registry()
    yield
    reset_contract_registry()


@pytest.fixture(autouse=True)
def _value():
    _Message.value = 0
    yield
    _Message.value = 0


def deposit(core, did, party, amount):
    _Message.sender_address = party
    _Message.value = amount
    try:
        return core.deposit_stake(did)
    finally:
        _Message.value = 0


def drive_to_verdict(core, monkeypatch, verdicts, deposits=None):
    """Open dispute, optionally escrow bonds, evaluate, finalize verdict."""
    did = open_dispute(core)
    if deposits:
        for party, amount in deposits:
            deposit(core, did, party, amount)
    register_contract_view(
        core.resolution_manager, "get_dispute_appeals", lambda _did: []
    )
    _Message.sender_address = PARTY_A
    core.start_investigation(did)
    stub_nondet(monkeypatch, verdicts)
    core.request_evaluation(did)
    core.finalize_verdict(did)
    _Message.sender_address = PARTY_A
    return did


class TestDepositStake:
    def test_both_parties_deposit_held_in_contract(self):
        core = make_core()
        did = open_dispute(core)
        deposit(core, did, PARTY_A, STAKE)
        deposit(core, did, PARTY_B, STAKE)
        assert core.balance == STAKE * 2
        esc = core.get_escrow(did)
        assert esc["claimant"]["deposited"] is True
        assert esc["claimant"]["amount"] == STAKE
        assert esc["respondent"]["deposited"] is True
        assert esc["released"] is False

    def test_stranger_cannot_deposit(self):
        core = make_core()
        did = open_dispute(core)
        with pytest.raises(_UserError):
            deposit(core, did, STRANGER, STAKE)

    def test_insufficient_stake_rejected(self):
        core = make_core()
        did = open_dispute(core)
        with pytest.raises(_UserError):
            deposit(core, did, PARTY_A, STAKE - 1)

    def test_zero_value_rejected(self):
        core = make_core()
        did = open_dispute(core)
        with pytest.raises(_UserError):
            deposit(core, did, PARTY_A, 0)

    def test_double_deposit_same_party_rejected(self):
        core = make_core()
        did = open_dispute(core)
        deposit(core, did, PARTY_A, STAKE)
        with pytest.raises(_UserError):
            deposit(core, did, PARTY_A, STAKE)

    def test_deposit_rejected_after_investigation_starts(self):
        core = make_core()
        did = open_dispute(core)
        _Message.sender_address = PARTY_A
        core.start_investigation(did)
        with pytest.raises(_UserError):
            deposit(core, did, PARTY_A, STAKE)

    def test_party_match_is_case_insensitive(self):
        core = make_core()
        _Message.sender_address = PARTY_A
        did = core.create_dispute(
            str(PARTY_B).upper().replace("0X", "0x"),
            "0x" + "ab" * 32,
            0,
            "case test",
            STAKE,
            1_790_000_000,
        )
        _Message.sender_address = PARTY_B
        _Message.value = STAKE
        core.deposit_stake(did)
        esc = core.get_escrow(did)
        assert esc["respondent"]["deposited"] is True


class TestEscrowRelease:
    def test_true_verdict_pays_claimant_and_refunds_both_bonds(self, monkeypatch):
        core = make_core()
        did = drive_to_verdict(
            core,
            monkeypatch,
            [SUPPORTED, SUPPORTED, SUPPORTED, REFUTED],
            deposits=[(PARTY_A, STAKE), (PARTY_B, STAKE)],
        )
        _Message.sender_address = PARTY_A
        core.execute_settlement(did)
        assert core.balance == 0
        assert native_balance_of(PARTY_A) == STAKE * 2
        assert native_balance_of(PARTY_B) == 0
        esc = core.get_escrow(did)
        assert esc["released"] is True
        assert esc["payouts"] == [{"to": str(PARTY_A), "amount": STAKE * 2}]
        assert core.get_dispute(did)["status"] == 9  # CLOSED

    def test_false_verdict_pays_respondent(self, monkeypatch):
        core = make_core()
        did = drive_to_verdict(
            core,
            monkeypatch,
            [REFUTED, REFUTED, REFUTED, SUPPORTED],
            deposits=[(PARTY_A, STAKE), (PARTY_B, STAKE)],
        )
        _Message.sender_address = PARTY_A
        core.execute_settlement(did)
        assert core.balance == 0
        assert native_balance_of(PARTY_B) == STAKE * 2
        assert native_balance_of(PARTY_A) == 0
        esc = core.get_escrow(did)
        assert esc["payouts"] == [{"to": str(PARTY_B), "amount": STAKE * 2}]

    def test_review_required_verdict_blocks_release(self, monkeypatch):
        core = make_core()
        did = drive_to_verdict(
            core,
            monkeypatch,
            [INCONCLUSIVE_LABEL] * 4,
            deposits=[(PARTY_A, STAKE), (PARTY_B, STAKE)],
        )
        _Message.sender_address = PARTY_A
        with pytest.raises(_UserError):
            core.execute_settlement(did)
        assert core.balance == STAKE * 2  # funds stay escrowed
        esc = core.get_escrow(did)
        assert esc["released"] is False

    def test_settlement_without_deposits_transfers_nothing(self, monkeypatch):
        core = make_core()
        did = drive_to_verdict(
            core,
            monkeypatch,
            [SUPPORTED, SUPPORTED, SUPPORTED, REFUTED],
        )
        _Message.sender_address = PARTY_A
        core.execute_settlement(did)
        assert core.get_dispute(did)["status"] == 9
        esc = core.get_escrow(did)
        assert esc["released"] is True
        assert esc["payouts"] == []
        assert native_balance_of(PARTY_A) == 0

    def test_single_party_deposit_released_to_winner(self, monkeypatch):
        core = make_core()
        did = drive_to_verdict(
            core,
            monkeypatch,
            [SUPPORTED, SUPPORTED, SUPPORTED, REFUTED],
            deposits=[(PARTY_B, STAKE)],
        )
        _Message.sender_address = PARTY_A
        core.execute_settlement(did)
        assert core.balance == 0
        assert native_balance_of(PARTY_A) == STAKE

    def test_no_double_release(self, monkeypatch):
        core = make_core()
        did = drive_to_verdict(
            core,
            monkeypatch,
            [SUPPORTED, SUPPORTED, SUPPORTED, REFUTED],
            deposits=[(PARTY_A, STAKE), (PARTY_B, STAKE)],
        )
        _Message.sender_address = PARTY_A
        core.execute_settlement(did)
        with pytest.raises(_UserError):
            core.execute_settlement(did)
        assert native_balance_of(PARTY_A) == STAKE * 2
