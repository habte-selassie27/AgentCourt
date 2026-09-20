# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from typing import Optional


class ConsensusEngine(gl.Contract):
    """
    Aggregates independent evaluations and produces a final consensus verdict.
    """

    latest_verdict: str
    latest_confidence: str

    def __init__(self):
        self.latest_verdict = "REVIEW"
        self.latest_confidence = "0.0"

    @gl.public.view
    def build_consensus(
        self,
        evaluator_results: list[dict],
        adversarial_adjustment,
    ) -> dict:
        if not evaluator_results:
            return {
                "final_verdict": "REVIEW",
                "final_confidence": 0.0,
                "agreement_ratio": 0.0,
                "evaluator_count": 0,
                "disagreement_detected": False,
                "requires_review": True,
                "reasoning": "No evaluator results available",
                "breakdown": {},
            }

        counts = self._count_verdicts(evaluator_results)
        agreement_ratio = self._compute_agreement_ratio(evaluator_results)
        has_disagreement, disagreement_details = self._detect_disagreement(evaluator_results)

        has_review = "REVIEW" in counts

        final_verdict, base_confidence = self._determine_verdict(evaluator_results)
        final_confidence = max(0.0, min(1.0, base_confidence + adversarial_adjustment))

        requires_review = self._should_require_review(
            agreement_ratio, final_confidence, has_review
        )

        if requires_review and final_verdict != "REVIEW":
            final_verdict = "REVIEW"
            final_confidence = min(final_confidence, 0.5)

        reasoning_parts = [
            f"Consensus from {len(evaluator_results)} evaluators",
            f"Verdict breakdown: {counts}",
            f"Agreement ratio: {agreement_ratio:.2%}",
        ]

        if has_disagreement:
            reasoning_parts.append(f"Disagreements: {', '.join(disagreement_details)}")

        if adversarial_adjustment != 0:
            reasoning_parts.append(f"Adversarial adjustment: {adversarial_adjustment:+.2f}")

        if requires_review:
            reasoning_parts.append("Result: REVIEW required")

        return {
            "final_verdict": final_verdict,
            "final_confidence": final_confidence,
            "agreement_ratio": agreement_ratio,
            "evaluator_count": len(evaluator_results),
            "disagreement_detected": has_disagreement,
            "requires_review": requires_review,
            "reasoning": "\n".join(reasoning_parts),
            "breakdown": counts,
        }

    @gl.public.write
    def build_and_store(
        self,
        evaluator_results: list[dict],
        adversarial_adjustment,
    ) -> dict:
        result = self.build_consensus(evaluator_results, adversarial_adjustment)
        self.latest_verdict = result["final_verdict"]
        self.latest_confidence = str(result["final_confidence"])
        return result

    def _count_verdicts(self, results: list[dict]):
        counts: dict[str, int] = {}
        for r in results:
            v = r.get("verdict", "REVIEW")
            counts[v] = counts.get(v, 0) + 1
        return counts

    def _compute_agreement_ratio(self, results: list[dict]):
        if not results:
            return 0.0
        counts = self._count_verdicts(results)
        if not counts:
            return 0.0
        majority_count = max(counts.values())
        return majority_count / len(results)

    def _detect_disagreement(self, results: list[dict]):
        if len(results) < 2:
            return False, []

        counts = self._count_verdicts(results)
        unique = list(counts.keys())

        if len(unique) <= 1:
            return False, []

        disagreements = []
        for i, v1 in enumerate(unique):
            for v2 in unique[i + 1:]:
                disagreements.append(f"{v1} vs {v2} ({counts[v1]} vs {counts[v2]})")

        return True, disagreements

    def _determine_verdict(self, results: list[dict]):
        if not results:
            return "REVIEW", 0.0

        counts = self._count_verdicts(results)
        if not counts:
            return "REVIEW", 0.0

        majority_verdict = max(counts, key=lambda k: counts[k])
        majority_count = counts[majority_verdict]
        total = len(results)

        base_confidence = majority_count / total
        avg_confidence = sum(r.get("confidence", 0.5) for r in results) / total
        weighted = base_confidence * 0.6 + avg_confidence * 0.4

        return majority_verdict, weighted

    def _should_require_review(
        self,
        agreement_ratio,
        confidence,
        has_review_verdict: bool,
    ):
        if has_review_verdict:
            return True
        if agreement_ratio < 0.6:
            return True
        if confidence < 0.4:
            return True
        return False
