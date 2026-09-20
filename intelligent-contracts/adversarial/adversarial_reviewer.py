# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from typing import Optional


class AdversarialReviewer(gl.Contract):
    """
    Challenges initial conclusions by finding the strongest evidence
    against the current verdict.
    """

    review_count: u256

    def __init__(self):
        self.review_count = u256(0)

    @gl.public.view
    def review(
        self,
        initial_verdict: str,
        initial_confidence,
        agreement: dict,
        claim: dict,
        evidence: list[dict],
        supporting_ids: list[str],
        contradicting_ids: list[str],
    ) -> dict:
        all_challenges: list[dict] = []

        obligations = []
        for key, value in agreement.get("requirements", {}).items():
            obligations.append({"field": key, "required_value": value})

        all_challenges.extend(self._find_evidence_gaps(obligations, evidence))
        all_challenges.extend(self._check_logic_flaws(
            initial_verdict, initial_confidence,
            len(supporting_ids), len(contradicting_ids),
        ))
        all_challenges.extend(self._check_agreement_interpretation(agreement, claim))

        deadline = agreement.get("deadline", 0)
        if deadline:
            all_challenges.extend(self._check_timing_issues(evidence, deadline))

        all_challenges.sort(key=lambda c: c.get("severity", 0), reverse=True)

        strongest = all_challenges[0] if all_challenges else None
        verdict_upheld = True
        confidence_adj = 0.0

        if strongest and strongest.get("affects_verdict", False):
            verdict_upheld = False
            confidence_adj = -0.2
        elif all_challenges:
            confidence_adj = -0.1 * len(all_challenges)

        reasoning_parts = []
        for ch in all_challenges:
            reasoning_parts.append(
                f"[{ch.get('type', 'UNKNOWN')}] {ch.get('description', '')} "
                f"(severity: {ch.get('severity', 0)})"
            )

        return {
            "challenges": all_challenges,
            "strongest_challenge": strongest,
            "verdict_upheld": verdict_upheld,
            "confidence_adjustment": confidence_adj,
            "reasoning": "\n".join(reasoning_parts) if reasoning_parts else "No challenges found",
        }

    @gl.public.write
    def review_and_count(
        self,
        initial_verdict: str,
        initial_confidence,
        agreement: dict,
        claim: dict,
        evidence: list[dict],
        supporting_ids: list[str],
        contradicting_ids: list[str],
    ) -> dict:
        result = self.review(
            initial_verdict, initial_confidence,
            agreement, claim, evidence,
            supporting_ids, contradicting_ids,
        )
        self.review_count += 1
        return result

    def _find_evidence_gaps(self, obligations: list[dict], evidence: list[dict]):
        challenges = []
        evidence_descs = [e.get("description", "").lower() for e in evidence]

        for obligation in obligations:
            field_lower = obligation["field"].lower()
            found = any(field_lower in desc for desc in evidence_descs)
            if not found:
                challenges.append({
                    "type": "EVIDENCE_GAPS",
                    "description": f"No evidence found for obligation: {obligation['field']}",
                    "severity": 0.7,
                    "evidence_ids": [],
                    "affects_verdict": True,
                })

        return challenges

    def _check_logic_flaws(
        self,
        verdict: str,
        confidence,
        supporting_count,
        contradicting_count,
    ):
        challenges = []

        if verdict == "TRUE" and contradicting_count > 0:
            challenges.append({
                "type": "LOGIC_FLAW",
                "description": f"Verdict is TRUE but {contradicting_count} contradicting evidence items exist",
                "severity": 0.5,
                "evidence_ids": [],
                "affects_verdict": contradicting_count > supporting_count,
            })

        if verdict == "FALSE" and supporting_count > 0:
            challenges.append({
                "type": "LOGIC_FLAW",
                "description": f"Verdict is FALSE but {supporting_count} supporting evidence items exist",
                "severity": 0.5,
                "evidence_ids": [],
                "affects_verdict": supporting_count > contradicting_count,
            })

        if confidence > 0.9 and (contradicting_count > 0 or supporting_count <= 1):
            challenges.append({
                "type": "LOGIC_FLAW",
                "description": f"High confidence ({confidence}) with weak evidence base",
                "severity": 0.4,
                "evidence_ids": [],
                "affects_verdict": False,
            })

        return challenges

    def _check_agreement_interpretation(self, agreement: dict, claim: dict):
        challenges = []
        requirements = agreement.get("requirements", {})
        expected = claim.get("expected", {})

        for key in expected:
            if key not in requirements:
                challenges.append({
                    "type": "AGREEMENT_MISINTERPRETATION",
                    "description": f"Claim references '{key}' but agreement does not specify this requirement",
                    "severity": 0.6,
                    "evidence_ids": [],
                    "affects_verdict": True,
                })

        return challenges

    def _check_timing_issues(self, evidence: list[dict], deadline):
        challenges = []
        timestamps = [e.get("timestamp", 0) for e in evidence if e.get("timestamp")]

        if timestamps and deadline > 0:
            latest = max(timestamps)
            if latest > deadline:
                late_ids = [
                    e["id"] for e in evidence
                    if e.get("timestamp", 0) > deadline
                ]
                challenges.append({
                    "type": "TIMING_ISSUE",
                    "description": f"Evidence submitted after deadline: {late_ids}",
                    "severity": 0.7,
                    "evidence_ids": late_ids,
                    "affects_verdict": True,
                })

        return challenges
