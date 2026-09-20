# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass, field
from typing import Optional


class DisputeJudge(gl.Contract):
    """
    Evaluates structured disputes by analyzing agreements, claims, and evidence.
    """

    latest_result: str

    def __init__(self):
        self.latest_result = ""

    @gl.public.view
    def judge(
        self,
        agreement: dict,
        claim: dict,
        evidence: list[dict],
    ) -> dict:
        obligations = self._extract_obligations(agreement)

        if not obligations:
            result = {
                "verdict": "REVIEW",
                "confidence": 0.3,
                "reasoning": "No measurable obligations found in agreement. Manual review required.",
                "supporting_evidence": [],
                "contradicting_evidence": [],
                "gaps": ["Agreement lacks measurable requirements"],
            }
            return result

        all_supporting: list[str] = []
        all_contradicting: list[str] = []
        gaps: list[str] = []
        uncertain: list[str] = []

        for obligation in obligations:
            satisfied, supporting, contradicting = self._evaluate_evidence(
                obligation, evidence
            )
            all_supporting.extend(supporting)
            all_contradicting.extend(contradicting)

            if satisfied is None:
                uncertain.append(obligation["field"])
                gaps.append(f"No clear evidence for obligation: {obligation['field']}")

        if gaps and not all_supporting:
            return {
                "verdict": "UNVERIFIABLE",
                "confidence": 0.2,
                "reasoning": f"Insufficient evidence to evaluate. Gaps: {'; '.join(gaps)}",
                "supporting_evidence": all_supporting,
                "contradicting_evidence": all_contradicting,
                "gaps": gaps,
            }

        if len(all_contradicting) > len(all_supporting):
            confidence = min(0.95, 0.5 + (len(all_contradicting) - len(all_supporting)) * 0.1)
            return {
                "verdict": "TRUE",
                "confidence": confidence,
                "reasoning": f"Evidence supports claim. {len(all_supporting)} supporting vs {len(all_contradicting)} contradicting items.",
                "supporting_evidence": all_supporting,
                "contradicting_evidence": all_contradicting,
                "gaps": gaps,
            }

        if len(all_supporting) > len(all_contradicting):
            confidence = min(0.95, 0.5 + (len(all_supporting) - len(all_contradicting)) * 0.1)
            return {
                "verdict": "FALSE",
                "confidence": confidence,
                "reasoning": f"Evidence contradicts claim. {len(all_supporting)} supporting vs {len(all_contradicting)} contradicting items.",
                "supporting_evidence": all_supporting,
                "contradicting_evidence": all_contradicting,
                "gaps": gaps,
            }

        return {
            "verdict": "REVIEW",
            "confidence": 0.4,
            "reasoning": f"Mixed evidence. {len(all_supporting)} supporting vs {len(all_contradicting)} contradicting. {len(uncertain)} uncertain obligations.",
            "supporting_evidence": all_supporting,
            "contradicting_evidence": all_contradicting,
            "gaps": gaps,
        }

    @gl.public.write
    def judge_and_store(
        self,
        agreement: dict,
        claim: dict,
        evidence: list[dict],
    ) -> dict:
        result = self.judge(agreement, claim, evidence)
        self.latest_result = str(result)
        return result

    def _extract_obligations(self, agreement: dict) -> list[dict]:
        obligations = []
        requirements = agreement.get("requirements", {})
        for key, value in requirements.items():
            obligations.append({
                "field": key,
                "required_value": value,
                "obligation_type": self._classify_obligation(key),
            })
        return obligations

    def _classify_obligation(self, field_name: str) -> str:
        numeric_fields = {
            "minimumRecords", "minimumCompleteness", "minimumValidity",
            "maxResponseTime", "minUptime",
        }
        deadline_fields = {"deadline", "deliveryDeadline", "responseDeadline"}
        format_fields = {"format", "schema", "encoding"}

        if field_name in numeric_fields:
            return "NUMERIC_THRESHOLD"
        elif field_name in deadline_fields:
            return "DEADLINE"
        elif field_name in format_fields:
            return "FORMAT"
        return "GENERIC"

    def _evaluate_evidence(
        self,
        obligation: dict,
        evidence: list[dict],
    ) -> tuple[Optional[bool], list[str], list[str]]:
        supporting: list[str] = []
        contradicting: list[str] = []

        for item in evidence:
            desc = item.get("description", "")
            eid = item.get("id", "")
            if self._evidence_supports(obligation, desc):
                supporting.append(eid)
            elif self._evidence_contradicts(obligation, desc):
                contradicting.append(eid)

        if not supporting and not contradicting:
            return None, [], []
        if len(contradicting) > len(supporting):
            return False, supporting, contradicting
        if len(supporting) > len(contradicting):
            return True, supporting, contradicting
        return None, supporting, contradicting

    def _evidence_supports(self, obligation: dict, desc: str) -> bool:
        desc_lower = desc.lower()
        field_lower = obligation["field"].lower()
        otype = obligation["obligation_type"]

        if otype == "NUMERIC_THRESHOLD":
            return field_lower in desc_lower and "meets" in desc_lower
        elif otype == "DEADLINE":
            return "before" in desc_lower or "on time" in desc_lower or "met deadline" in desc_lower
        elif otype == "FORMAT":
            return "correct format" in desc_lower or "valid" in desc_lower
        return False

    def _evidence_contradicts(self, obligation: dict, desc: str) -> bool:
        desc_lower = desc.lower()
        field_lower = obligation["field"].lower()
        otype = obligation["obligation_type"]

        if otype == "NUMERIC_THRESHOLD":
            return field_lower in desc_lower and ("below" in desc_lower or "insufficient" in desc_lower)
        elif otype == "DEADLINE":
            return "late" in desc_lower or "missed" in desc_lower or "after deadline" in desc_lower
        elif otype == "FORMAT":
            return "wrong format" in desc_lower or "invalid" in desc_lower
        return False
