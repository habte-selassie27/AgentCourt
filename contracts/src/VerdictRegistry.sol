// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DisputeTypes} from "./Interfaces.sol";

contract VerdictRegistry {
    mapping(uint256 => DisputeTypes.VerdictResult) private verdicts;
    mapping(uint256 => bool) private verdictExists;
    mapping(uint256 => DisputeTypes.ConsensusRecord[]) private consensusRecords;

    event ConsensusSubmitted(
        uint256 indexed disputeId,
        address indexed evaluator,
        DisputeTypes.Verdict verdict,
        uint256 confidence
    );

    event VerdictFinalized(
        uint256 indexed disputeId,
        DisputeTypes.Verdict verdict,
        uint256 confidence,
        DisputeTypes.SettlementAction resolution
    );

    function submitConsensus(
        uint256 disputeId,
        address evaluator,
        DisputeTypes.Verdict verdict,
        uint256 confidence,
        bytes32 reasoningHash
    ) external {
        require(confidence <= 10000, "Confidence out of range"); // 10000 = 100.00%

        consensusRecords[disputeId].push(DisputeTypes.ConsensusRecord({
            disputeId: disputeId,
            evaluator: evaluator,
            verdict: verdict,
            confidence: confidence,
            reasoningHash: reasoningHash,
            timestamp: block.timestamp
        }));

        emit ConsensusSubmitted(disputeId, evaluator, verdict, confidence);
    }

    function finalizeVerdict(
        uint256 disputeId,
        DisputeTypes.Verdict verdict,
        uint256 confidence,
        bytes32 reasoningHash,
        uint256[] calldata evidenceIds,
        DisputeTypes.SettlementAction resolution,
        bool reviewRequired
    ) external {
        require(!verdictExists[disputeId], "Verdict already finalized");

        verdicts[disputeId] = DisputeTypes.VerdictResult({
            disputeId: disputeId,
            verdict: verdict,
            confidence: confidence,
            reasoningHash: reasoningHash,
            evidenceIds: evidenceIds,
            resolution: resolution,
            reviewRequired: reviewRequired,
            finalizedAt: block.timestamp
        });

        verdictExists[disputeId] = true;

        emit VerdictFinalized(disputeId, verdict, confidence, resolution);
    }

    function getVerdict(uint256 disputeId)
        external
        view
        returns (DisputeTypes.VerdictResult memory)
    {
        require(verdictExists[disputeId], "Verdict does not exist");
        return verdicts[disputeId];
    }

    function getConsensusRecords(uint256 disputeId)
        external
        view
        returns (DisputeTypes.ConsensusRecord[] memory)
    {
        return consensusRecords[disputeId];
    }

    function getConsensusCount(uint256 disputeId) external view returns (uint256) {
        return consensusRecords[disputeId].length;
    }

    function hasVerdict(uint256 disputeId) external view returns (bool) {
        return verdictExists[disputeId];
    }
}
