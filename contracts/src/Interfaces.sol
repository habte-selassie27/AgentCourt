// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library DisputeTypes {
    enum Status {
        NONE,
        OPEN,
        EVIDENCE_COLLECTION,
        INVESTIGATION,
        DELIBERATION,
        ADVERSARIAL_REVIEW,
        CONSENSUS,
        VERDICT,
        SETTLEMENT,
        CLOSED,
        APPEALED
    }

    enum Verdict {
        NONE,
        TRUE_CLAIM,
        FALSE_CLAIM,
        MISLEADING,
        UNVERIFIABLE,
        REVIEW
    }

    enum ClaimType {
        DELIVERY_FAILURE,
        PAYMENT_FAILURE,
        PERFORMANCE_FAILURE,
        DATA_QUALITY,
        MARKETPLACE_VIOLATION,
        AGENT_CONTRACT_BREACH,
        ORACLE_MALFUNCTION,
        ESCROW_DISPUTE,
        CUSTOM
    }

    enum EvidenceType {
        ONCHAIN_TRANSACTION,
        WEB_PAGE,
        API_RESPONSE,
        SIGNED_MESSAGE,
        CONTENT_HASH,
        CUSTOM
    }

    enum SettlementAction {
        RELEASE_TO_CLAIMANT,
        RELEASE_TO_RESPONDENT,
        SPLIT,
        FREEZE,
        SLASH,
        REVIEW
    }

    struct Dispute {
        uint256 id;
        address claimant;
        address respondent;
        bytes32 agreementHash;
        ClaimType claimType;
        uint256 stake;
        uint256 createdAt;
        uint256 deadline;
        Status status;
        string description;
    }

    struct Evidence {
        uint256 id;
        uint256 disputeId;
        EvidenceType evidenceType;
        string source;
        string refUri;
        bytes32 contentHash;
        uint256 timestamp;
        address submitter;
        string description;
    }

    struct VerdictResult {
        uint256 disputeId;
        Verdict verdict;
        uint256 confidence;
        bytes32 reasoningHash;
        uint256[] evidenceIds;
        SettlementAction resolution;
        bool reviewRequired;
        uint256 finalizedAt;
    }

    struct ConsensusRecord {
        uint256 disputeId;
        address evaluator;
        Verdict verdict;
        uint256 confidence;
        bytes32 reasoningHash;
        uint256 timestamp;
    }

    struct Appeal {
        uint256 id;
        uint256 disputeId;
        address appellant;
        string reason;
        uint256 bond;
        uint256 createdAt;
        bool resolved;
        Verdict supersedingVerdict;
    }
}

interface IAgentCourtCore {
    function createDispute(
        address respondent,
        bytes32 agreementHash,
        DisputeTypes.ClaimType claimType,
        string calldata description,
        uint256 stake,
        uint256 deadline
    ) external payable returns (uint256 disputeId);

    function submitEvidence(
        uint256 disputeId,
        DisputeTypes.EvidenceType evidenceType,
        string calldata source,
        string calldata refUri,
        bytes32 contentHash,
        string calldata description
    ) external returns (uint256 evidenceId);

    // solhint-disable-next-line no-empty-blocks
    function startInvestigation(uint256 disputeId) external;

    function startDeliberation(uint256 disputeId) external;

    function startAdversarialReview(uint256 disputeId) external;

    function submitConsensus(
        uint256 disputeId,
        DisputeTypes.Verdict verdict,
        uint256 confidence,
        bytes32 reasoningHash
    ) external;

    function finalizeVerdict(
        uint256 disputeId,
        DisputeTypes.Verdict verdict,
        uint256 confidence,
        bytes32 reasoningHash,
        DisputeTypes.SettlementAction resolution,
        bool reviewRequired
    ) external;

    function executeSettlement(uint256 disputeId) external;

    function getDispute(uint256 disputeId) external view returns (DisputeTypes.Dispute memory);
    function getEvidence(uint256 evidenceId) external view returns (DisputeTypes.Evidence memory);
    function getVerdict(uint256 disputeId) external view returns (DisputeTypes.VerdictResult memory);
    function getDisputeCount() external view returns (uint256);

    // Read-only helpers so clients can reconstruct dispute state without
    // guessing ids or relying on event replay.
    function getDisputeEvidenceIds(uint256 disputeId) external view returns (uint256[] memory);

    function hasVerdict(uint256 disputeId) external view returns (bool);

    function getConsensusRecords(uint256 disputeId)
        external
        view
        returns (DisputeTypes.ConsensusRecord[] memory);

    function getConsensusCount(uint256 disputeId) external view returns (uint256);

    function isEvidenceVerified(uint256 evidenceId) external view returns (bool);
}
