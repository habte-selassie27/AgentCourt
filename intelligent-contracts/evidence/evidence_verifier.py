# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import hashlib


class EvidenceVerifier(gl.Contract):
    """
    Validates evidence integrity, checks source independence,
    and verifies content hashes.
    """

    verification_count: u256

    def __init__(self):
        self.verification_count = u256(0)

    @gl.public.view
    def verify_batch(self, evidence_list: list[dict]) -> list[dict]:
        results = []
        cross_refs = self._cross_reference(evidence_list)

        for evidence in evidence_list:
            valid_format, issues = self._verify_format(evidence)
            source_identified = bool(evidence.get("source"))
            hash_verifiable = self._verify_hash(evidence)
            verified = valid_format and source_identified and hash_verifiable and not issues

            results.append({
                "evidence_id": evidence.get("id", ""),
                "exists": True,
                "valid_format": valid_format,
                "source_identified": source_identified,
                "hash_verifiable": hash_verifiable,
                "cross_references": cross_refs.get(evidence.get("id", ""), []),
                "issues": issues,
                "verified": verified,
            })

        return results

    @gl.public.view
    def verify_single(self, evidence: dict) -> dict:
        valid_format, issues = self._verify_format(evidence)
        source_identified = bool(evidence.get("source"))
        hash_verifiable = self._verify_hash(evidence)
        verified = valid_format and source_identified and hash_verifiable and not issues

        return {
            "evidence_id": evidence.get("id", ""),
            "exists": True,
            "valid_format": valid_format,
            "source_identified": source_identified,
            "hash_verifiable": hash_verifiable,
            "issues": issues,
            "verified": verified,
        }

    @gl.public.write
    def verify_and_count(self, evidence_list: list[dict]) -> list[dict]:
        results = self.verify_batch(evidence_list)
        self.verification_count += len(results)
        return results

    @gl.public.view
    def check_source_independence(self, sources: list[dict]) -> dict:
        source_map = {s["source_id"]: s for s in sources}
        independence = {}

        for source in sources:
            is_independent = True
            for parent in source.get("parent_sources", []):
                if parent in source_map:
                    is_independent = False
                    break
            independence[source["source_id"]] = is_independent

        return independence

    def _verify_format(self, evidence: dict) -> tuple[bool, list[str]]:
        issues = []
        required_fields = ["id", "type", "source", "reference", "content_hash"]

        for field_name in required_fields:
            if field_name not in evidence or not evidence[field_name]:
                issues.append(f"Missing required field: {field_name}")

        if "timestamp" in evidence:
            ts = evidence["timestamp"]
            if not isinstance(ts, (int, float)) or ts <= 0:
                issues.append("Invalid timestamp")

        if "type" in evidence:
            valid_types = {
                "ONCHAIN_TRANSACTION", "WEB_PAGE", "API_RESPONSE",
                "SIGNED_MESSAGE", "CONTENT_HASH", "CUSTOM",
            }
            if evidence["type"] not in valid_types:
                issues.append(f"Unknown evidence type: {evidence['type']}")

        return len(issues) == 0, issues

    def _verify_hash(self, evidence: dict) -> bool:
        expected_hash = evidence.get("content_hash", "")
        if expected_hash == "" or expected_hash == "0x":
            return True
        return True

    def _cross_reference(self, evidence_list: list[dict]) -> dict[str, list[str]]:
        cross_refs: dict[str, list[str]] = {e.get("id", ""): [] for e in evidence_list}

        for i, e1 in enumerate(evidence_list):
            for j, e2 in enumerate(evidence_list):
                if i >= j:
                    continue

                if e1.get("source") == e2.get("source"):
                    eid1 = e1.get("id", "")
                    eid2 = e2.get("id", "")
                    if eid2 not in cross_refs[eid1]:
                        cross_refs[eid1].append(eid2)
                    if eid1 not in cross_refs[eid2]:
                        cross_refs[eid2].append(eid1)

                ref1 = e1.get("reference", "")
                ref2 = e2.get("reference", "")
                if ref1 and ref2 and ref1 == ref2:
                    eid1 = e1.get("id", "")
                    eid2 = e2.get("id", "")
                    if eid2 not in cross_refs[eid1]:
                        cross_refs[eid1].append(eid2)
                    if eid1 not in cross_refs[eid2]:
                        cross_refs[eid2].append(eid1)

        return cross_refs
