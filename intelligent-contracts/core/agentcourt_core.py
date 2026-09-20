# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class AgentCourtCore(gl.Contract):
    """
    Main orchestrator for AgentCourt dispute lifecycle.
    Delegates to DisputeRegistry and ResolutionManager via cross-contract calls.
    """

    owner: Address
    paused: bool
    dispute_registry: Address
    resolution_manager: Address

    # Local dispute tracking (primary source of truth)
    next_dispute_id: u256
    next_evidence_id: u256
    disputes: TreeMap[str, str]

    def __init__(
        self,
        dispute_registry,
        resolution_manager,
    ):
        self.owner = gl.message.sender_address
        self.paused = False
        self.dispute_registry = Address(dispute_registry)
        self.resolution_manager = Address(resolution_manager)
        self.next_dispute_id = u256(1)
        self.next_evidence_id = u256(1)

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
    # DISPUTE LIFECYCLE
    # ===========================================================================

    @gl.public.write
    def create_dispute(
        self,
        respondent,
        agreement_hash,
        claim_type,
        description,
        stake,
        deadline,
    ):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Generate dispute ID locally
        dispute_id = self.next_dispute_id
        self.next_dispute_id = dispute_id + 1

        # Store dispute locally
        dispute = {
            "id": int(dispute_id),
            "claimant": str(gl.message.sender_address),
            "respondent": str(respondent),
            "agreementHash": str(agreement_hash),
            "claimType": int(claim_type),
            "stake": int(stake),
            "createdAt": 0,
            "deadline": int(deadline),
            "status": 2,  # EVIDENCE_COLLECTION
            "description": str(description),
        }
        self.disputes[str(dispute_id)] = json.dumps(dispute)

        # Cross-contract call: register in DisputeRegistry (async)
        registry = gl.get_contract_at(self.dispute_registry)
        registry.emit(on='accepted').create_dispute(
            str(gl.message.sender_address),
            str(respondent),
            str(agreement_hash),
            int(claim_type),
            int(stake),
            int(deadline),
            str(description),
        )

        return int(dispute_id)

    @gl.public.write
    def submit_evidence(
        self,
        dispute_id,
        evidence_type,
        source,
        ref_uri,
        content_hash,
        description,
    ):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Generate evidence ID locally
        evidence_id = self.next_evidence_id
        self.next_evidence_id = evidence_id + 1

        # Cross-contract call: register in DisputeRegistry (async)
        registry = gl.get_contract_at(self.dispute_registry)
        registry.emit(on='accepted').add_evidence(
            int(dispute_id),
            int(evidence_type),
            str(source),
            str(ref_uri),
            str(content_hash),
            str(description),
            str(gl.message.sender_address),
        )

        return int(evidence_id)

    @gl.public.write
    def start_investigation(self, dispute_id):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Update local status
        key = str(dispute_id)
        if key in self.disputes:
            dispute = json.loads(self.disputes[key])
            dispute["status"] = 3  # INVESTIGATION
            self.disputes[key] = json.dumps(dispute)

        # Cross-contract call: update status (async)
        registry = gl.get_contract_at(self.dispute_registry)
        registry.emit(on='accepted').update_status(int(dispute_id), 3)

    @gl.public.write
    def start_deliberation(self, dispute_id):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Update local status
        key = str(dispute_id)
        if key in self.disputes:
            dispute = json.loads(self.disputes[key])
            dispute["status"] = 4  # DELIBERATION
            self.disputes[key] = json.dumps(dispute)

        # Cross-contract call: update status (async)
        registry = gl.get_contract_at(self.dispute_registry)
        registry.emit(on='accepted').update_status(int(dispute_id), 4)

    @gl.public.write
    def start_adversarial_review(self, dispute_id):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Update local status
        key = str(dispute_id)
        if key in self.disputes:
            dispute = json.loads(self.disputes[key])
            dispute["status"] = 5  # ADVERSARIAL_REVIEW
            self.disputes[key] = json.dumps(dispute)

        # Cross-contract call: update status (async)
        registry = gl.get_contract_at(self.dispute_registry)
        registry.emit(on='accepted').update_status(int(dispute_id), 5)

    @gl.public.write
    def submit_consensus(
        self,
        dispute_id,
        verdict,
        confidence,
        reasoning_hash,
    ):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Cross-contract call: submit consensus (async)
        registry = gl.get_contract_at(self.dispute_registry)
        registry.emit(on='accepted').submit_consensus(
            int(dispute_id),
            str(gl.message.sender_address),
            int(verdict),
            int(confidence),
            str(reasoning_hash),
        )

    @gl.public.write
    def finalize_verdict(
        self,
        dispute_id,
        verdict,
        confidence,
        reasoning_hash,
        resolution,
        review_required,
    ):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Get evidence IDs from local dispute
        key = str(dispute_id)
        evidence_ids = []
        if key in self.disputes:
            dispute = json.loads(self.disputes[key])
            evidence_ids = dispute.get("evidenceIds", [])

        # Cross-contract call: finalize verdict (async)
        registry = gl.get_contract_at(self.dispute_registry)
        registry.emit(on='finalized').finalize_verdict(
            int(dispute_id),
            int(verdict),
            int(confidence),
            str(reasoning_hash),
            evidence_ids,
            int(resolution),
            bool(review_required),
        )

        # Update local status
        if key in self.disputes:
            dispute = json.loads(self.disputes[key])
            dispute["status"] = 7  # VERDICT
            self.disputes[key] = json.dumps(dispute)

        # Cross-contract call: update status (async)
        registry.emit(on='finalized').update_status(int(dispute_id), 7)

    @gl.public.write
    def execute_settlement(self, dispute_id):
        if self.paused:
            raise gl.UserError("Contract is paused")

        # Update local status
        key = str(dispute_id)
        if key in self.disputes:
            dispute = json.loads(self.disputes[key])
            dispute["status"] = 8  # SETTLEMENT
            self.disputes[key] = json.dumps(dispute)

        # Cross-contract call: execute settlement (async)
        manager = gl.get_contract_at(self.resolution_manager)
        manager.emit(on='finalized').execute_settlement(int(dispute_id), 0, 0)

        # Update local status to CLOSED
        if key in self.disputes:
            dispute = json.loads(self.disputes[key])
            dispute["status"] = 9  # CLOSED
            self.disputes[key] = json.dumps(dispute)

    # ===========================================================================
    # APPEAL METHODS (delegate to ResolutionManager)
    # ===========================================================================

    @gl.public.write
    def open_appeal(self, dispute_id, reason):
        if self.paused:
            raise gl.UserError("Contract is paused")

        manager = gl.get_contract_at(self.resolution_manager)
        return manager.emit(on='accepted').open_appeal(
            int(dispute_id),
            str(gl.message.sender_address),
            str(reason),
        )

    @gl.public.write
    def resolve_appeal(self, appeal_id, accepted, superseding_verdict):
        if gl.message.sender_address != self.owner:
            raise gl.UserError("Not owner")

        manager = gl.get_contract_at(self.resolution_manager)
        return manager.emit(on='finalized').resolve_appeal(
            int(appeal_id),
            bool(accepted),
            int(superseding_verdict),
        )

    # ===========================================================================
    # READ METHODS — delegate to registries via view()
    # ===========================================================================

    @gl.public.view
    def get_dispute(self, dispute_id):
        # Read from local storage first
        key = str(dispute_id)
        if key in self.disputes:
            return json.loads(self.disputes[key])
        # Fallback to registry
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().get_dispute(int(dispute_id))

    @gl.public.view
    def get_evidence(self, evidence_id):
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().get_evidence(int(evidence_id))

    @gl.public.view
    def get_verdict(self, dispute_id):
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().get_verdict(int(dispute_id))

    @gl.public.view
    def get_dispute_count(self):
        return int(self.next_dispute_id - 1)

    @gl.public.view
    def get_dispute_evidence_ids(self, dispute_id):
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().get_dispute_evidence_ids(int(dispute_id))

    @gl.public.view
    def has_verdict(self, dispute_id):
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().has_verdict(int(dispute_id))

    @gl.public.view
    def get_consensus_records(self, dispute_id):
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().get_consensus_records(int(dispute_id))

    @gl.public.view
    def get_consensus_count(self, dispute_id):
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().get_consensus_count(int(dispute_id))

    @gl.public.view
    def is_evidence_verified(self, evidence_id):
        registry = gl.get_contract_at(self.dispute_registry)
        return registry.view().is_verified(int(evidence_id))

    @gl.public.view
    def get_appeal(self, appeal_id):
        manager = gl.get_contract_at(self.resolution_manager)
        return manager.view().get_appeal(int(appeal_id))

    @gl.public.view
    def get_dispute_appeals(self, dispute_id):
        manager = gl.get_contract_at(self.resolution_manager)
        return manager.view().get_dispute_appeals(int(dispute_id))

    @gl.public.view
    def is_settled(self, dispute_id):
        manager = gl.get_contract_at(self.resolution_manager)
        return manager.view().is_settled(int(dispute_id))
