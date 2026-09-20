# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class DisputeRegistry(gl.Contract):
    """
    Consolidated registry for disputes, evidence, and verdicts.
    Merges: DisputeRegistry + EvidenceRegistry + VerdictRegistry
    """

    # --- Dispute fields ---
    next_dispute_id: u256
    disputes: TreeMap[str, str]
    dispute_evidence_ids: TreeMap[str, str]

    # --- Evidence fields ---
    next_evidence_id: u256
    evidence_records: TreeMap[str, str]
    evidence_exists: TreeMap[str, bool]

    # --- Verdict fields ---
    verdicts: TreeMap[str, str]
    verdict_exists: TreeMap[str, bool]
    consensus_records: TreeMap[str, str]

    def __init__(self):
        self.next_dispute_id = u256(1)
        self.next_evidence_id = u256(1)

    # ===========================================================================
    # DISPUTE METHODS
    # ===========================================================================

    @gl.public.write
    def create_dispute(
        self,
        claimant,
        respondent,
        agreement_hash,
        claim_type,
        stake,
        deadline,
        description,
    ):
        dispute_id = self.next_dispute_id
        self.next_dispute_id = dispute_id + 1

        dispute = {
            "id": int(dispute_id),
            "claimant": str(claimant),
            "respondent": str(respondent),
            "agreementHash": str(agreement_hash),
            "claimType": int(claim_type),
            "stake": int(stake),
            "createdAt": 0,
            "deadline": int(deadline),
            "status": 1,
            "description": str(description),
        }

        self.disputes[str(dispute_id)] = json.dumps(dispute)
        self.dispute_evidence_ids[str(dispute_id)] = json.dumps([])

        return int(dispute_id)

    @gl.public.write
    def update_status(self, dispute_id, new_status):
        key = str(dispute_id)
        dispute = json.loads(self.disputes[key])
        dispute["status"] = int(new_status)
        self.disputes[key] = json.dumps(dispute)

    @gl.public.view
    def get_dispute(self, dispute_id):
        data = self.disputes.get(str(dispute_id))
        if data is None:
            return None
        return json.loads(data)

    @gl.public.view
    def exists(self, dispute_id):
        return str(dispute_id) in self.disputes

    @gl.public.view
    def get_dispute_count(self):
        return int(self.next_dispute_id - 1)

    @gl.public.view
    def get_next_dispute_id(self):
        return int(self.next_dispute_id)

    # ===========================================================================
    # EVIDENCE METHODS
    # ===========================================================================

    @gl.public.write
    def add_evidence(
        self,
        dispute_id,
        evidence_type,
        source,
        ref_uri,
        content_hash,
        description,
        submitter,
    ):
        evidence_id = self.next_evidence_id
        self.next_evidence_id = evidence_id + 1

        evidence = {
            "id": int(evidence_id),
            "disputeId": int(dispute_id),
            "evidenceType": int(evidence_type),
            "source": str(source),
            "refUri": str(ref_uri),
            "contentHash": str(content_hash),
            "timestamp": 0,
            "submitter": str(submitter),
            "description": str(description),
        }

        self.evidence_records[str(evidence_id)] = json.dumps({
            "evidence": evidence,
            "verified": False,
            "verificationTimestamp": 0,
            "crossReferences": [],
        })
        self.evidence_exists[str(evidence_id)] = True

        # Append evidence ID to dispute
        existing = json.loads(self.dispute_evidence_ids.get(str(dispute_id), "[]"))
        existing.append(int(evidence_id))
        self.dispute_evidence_ids[str(dispute_id)] = json.dumps(existing)

        return int(evidence_id)

    @gl.public.write
    def verify_evidence(self, evidence_id, verified):
        key = str(evidence_id)
        if not self.evidence_exists.get(key, False):
            return False

        record = json.loads(self.evidence_records[key])
        record["verified"] = bool(verified)
        record["verificationTimestamp"] = 0
        self.evidence_records[key] = json.dumps(record)
        return True

    @gl.public.write
    def add_cross_reference(self, evidence_id, cross_ref):
        key = str(evidence_id)
        if not self.evidence_exists.get(key, False):
            return False

        record = json.loads(self.evidence_records[key])
        record["crossReferences"].append(str(cross_ref))
        self.evidence_records[key] = json.dumps(record)
        return True

    @gl.public.view
    def get_evidence(self, evidence_id):
        data = self.evidence_records.get(str(evidence_id))
        if data is None:
            return None
        record = json.loads(data)
        return record["evidence"]

    @gl.public.view
    def get_evidence_record(self, evidence_id):
        data = self.evidence_records.get(str(evidence_id))
        if data is None:
            return None
        return json.loads(data)

    @gl.public.view
    def is_verified(self, evidence_id):
        data = self.evidence_records.get(str(evidence_id))
        if data is None:
            return False
        return json.loads(data).get("verified", False)

    @gl.public.view
    def get_dispute_evidence_ids(self, dispute_id):
        return json.loads(self.dispute_evidence_ids.get(str(dispute_id), "[]"))

    @gl.public.view
    def evidence_exists_check(self, evidence_id):
        return self.evidence_exists.get(str(evidence_id), False)

    # ===========================================================================
    # VERDICT METHODS
    # ===========================================================================

    @gl.public.write
    def submit_consensus(
        self,
        dispute_id,
        evaluator,
        verdict,
        confidence,
        reasoning_hash,
    ):
        key = str(dispute_id)
        record = {
            "disputeId": int(dispute_id),
            "evaluator": str(evaluator),
            "verdict": int(verdict),
            "confidence": int(confidence),
            "reasoningHash": str(reasoning_hash),
            "timestamp": 0,
        }

        existing = json.loads(self.consensus_records.get(key, "[]"))
        existing.append(record)
        self.consensus_records[key] = json.dumps(existing)

        return True

    @gl.public.write
    def finalize_verdict(
        self,
        dispute_id,
        verdict,
        confidence,
        reasoning_hash,
        evidence_ids,
        resolution,
        review_required,
    ):
        key = str(dispute_id)
        if self.verdict_exists.get(key, False):
            return False

        verdict_result = {
            "disputeId": int(dispute_id),
            "verdict": int(verdict),
            "confidence": int(confidence),
            "reasoningHash": str(reasoning_hash),
            "evidenceIds": evidence_ids,
            "resolution": int(resolution),
            "reviewRequired": bool(review_required),
            "finalizedAt": 0,
        }

        self.verdicts[key] = json.dumps(verdict_result)
        self.verdict_exists[key] = True

        return True

    @gl.public.view
    def get_verdict(self, dispute_id):
        data = self.verdicts.get(str(dispute_id))
        if data is None:
            return None
        return json.loads(data)

    @gl.public.view
    def get_consensus_records(self, dispute_id):
        return json.loads(self.consensus_records.get(str(dispute_id), "[]"))

    @gl.public.view
    def get_consensus_count(self, dispute_id):
        return len(json.loads(self.consensus_records.get(str(dispute_id), "[]")))

    @gl.public.view
    def has_verdict(self, dispute_id):
        return self.verdict_exists.get(str(dispute_id), False)
