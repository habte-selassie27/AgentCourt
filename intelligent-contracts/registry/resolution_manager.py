# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class ResolutionManager(gl.Contract):
    """
    Consolidated manager for appeals and settlement.
    Merges: AppealManager + SettlementAdapter
    """

    owner: Address
    paused: bool

    # --- Appeal fields ---
    next_appeal_id: u256
    appeal_bond: u256
    max_rounds: u256
    appeal_window: u256
    appeals: TreeMap[str, str]
    appeal_exists: TreeMap[str, bool]
    dispute_appeals: TreeMap[str, str]

    # --- Settlement fields ---
    next_settlement_nonce: u256
    settled_disputes: TreeMap[str, bool]
    settlement_nonces: TreeMap[str, u256]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.paused = False
        self.next_appeal_id = u256(1)
        self.appeal_bond = u256(10000000000000000)
        self.max_rounds = u256(3)
        self.appeal_window = u256(604800)
        self.next_settlement_nonce = u256(1)

    # ===========================================================================
    # ACCESS CONTROL
    # ===========================================================================

    @gl.public.write
    def pause(self):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")
        self.paused = True

    @gl.public.write
    def unpause(self):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")
        self.paused = False

    # ===========================================================================
    # APPEAL METHODS
    # ===========================================================================

    @gl.public.write
    def set_appeal_bond(self, new_bond):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")
        self.appeal_bond = u256(new_bond)

    @gl.public.write
    def set_max_rounds(self, new_max):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")
        self.max_rounds = u256(new_max)

    @gl.public.write
    def set_appeal_window(self, new_window):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")
        self.appeal_window = u256(new_window)

    @gl.public.write
    def open_appeal(self, dispute_id, appellant, reason):
        if self.paused:
            raise gl.UserError("Contract is paused")

        appeal_id = self.next_appeal_id
        self.next_appeal_id = appeal_id + 1

        appeal = {
            "id": int(appeal_id),
            "disputeId": int(dispute_id),
            "appellant": str(appellant),
            "reason": str(reason),
            "bond": int(self.appeal_bond),
            "createdAt": 0,
            "resolved": False,
            "supersedingVerdict": 0,
        }

        self.appeals[str(appeal_id)] = json.dumps(appeal)
        self.appeal_exists[str(appeal_id)] = True

        # Append to dispute appeals
        existing = json.loads(self.dispute_appeals.get(str(dispute_id), "[]"))
        existing.append(int(appeal_id))
        self.dispute_appeals[str(dispute_id)] = json.dumps(existing)

        return int(appeal_id)

    @gl.public.write
    def resolve_appeal(self, appeal_id, accepted, superseding_verdict):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")

        key = str(appeal_id)
        if not self.appeal_exists.get(key, False):
            return False

        appeal = json.loads(self.appeals[key])
        if appeal["resolved"]:
            return False

        appeal["resolved"] = True
        appeal["supersedingVerdict"] = int(superseding_verdict)
        self.appeals[key] = json.dumps(appeal)

        return True

    @gl.public.view
    def get_appeal(self, appeal_id):
        data = self.appeals.get(str(appeal_id))
        if data is None:
            return None
        return json.loads(data)

    @gl.public.view
    def get_dispute_appeals(self, dispute_id):
        return json.loads(self.dispute_appeals.get(str(dispute_id), "[]"))

    @gl.public.view
    def get_appeal_count(self, dispute_id):
        return len(json.loads(self.dispute_appeals.get(str(dispute_id), "[]")))

    # ===========================================================================
    # SETTLEMENT METHODS
    # ===========================================================================

    @gl.public.write
    def execute_settlement(self, dispute_id, verdict, action):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")
        if self.paused:
            raise gl.UserError("Contract is paused")

        key = str(dispute_id)
        if self.settled_disputes.get(key, False):
            raise gl.UserError("Dispute already settled")

        self.settled_disputes[key] = True

        nonce = self.next_settlement_nonce
        self.next_settlement_nonce = nonce + 1
        self.settlement_nonces[key] = nonce

        return int(nonce)

    @gl.public.view
    def is_settled(self, dispute_id):
        return self.settled_disputes.get(str(dispute_id), False)

    @gl.public.view
    def get_settlement_nonce(self, dispute_id):
        return int(self.settlement_nonces.get(str(dispute_id), u256(0)))

    @gl.public.view
    def get_owner(self):
        return str(self.owner)
