// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DisputeTypes} from "./Interfaces.sol";

contract DisputeRegistry {
    struct DisputeRecord {
        DisputeTypes.Dispute dispute;
        uint256[] evidenceIds;
        bool exists;
    }

    uint256 public nextDisputeId = 1;
    uint256 public nextEvidenceId = 1;

    mapping(uint256 => DisputeRecord) private disputes;
    mapping(uint256 => DisputeTypes.Evidence) private evidenceItems;
    mapping(uint256 => bool) private evidenceExists;
    mapping(uint256 => uint256[]) private disputeEvidenceIds;

    event DisputeCreated(
        uint256 indexed disputeId,
        address indexed claimant,
        address indexed respondent,
        DisputeTypes.ClaimType claimType,
        uint256 stake
    );

    event EvidenceSubmitted(
        uint256 indexed disputeId,
        uint256 indexed evidenceId,
        address indexed submitter,
        DisputeTypes.EvidenceType evidenceType
    );

    event DisputeStatusChanged(
        uint256 indexed disputeId,
        DisputeTypes.Status oldStatus,
        DisputeTypes.Status newStatus
    );

    modifier onlyExistingDispute(uint256 disputeId) {
        require(disputes[disputeId].exists, "Dispute does not exist");
        _;
    }

    modifier onlyOpenStatus(uint256 disputeId, DisputeTypes.Status requiredStatus) {
        require(
            disputes[disputeId].dispute.status == requiredStatus,
            "Invalid dispute status for this action"
        );
        _;
    }

    function createDispute(
        address claimant,
        address respondent,
        bytes32 agreementHash,
        DisputeTypes.ClaimType claimType,
        uint256 stake,
        uint256 deadline,
        string calldata description
    ) external returns (uint256 disputeId) {
        require(claimant != address(0), "Invalid claimant");
        require(respondent != address(0), "Invalid respondent");
        require(claimant != respondent, "Parties must be different");
        require(deadline > block.timestamp, "Deadline must be in the future");

        disputeId = nextDisputeId++;

        disputes[disputeId] = DisputeRecord({
            dispute: DisputeTypes.Dispute({
                id: disputeId,
                claimant: claimant,
                respondent: respondent,
                agreementHash: agreementHash,
                claimType: claimType,
                stake: stake,
                createdAt: block.timestamp,
                deadline: deadline,
                status: DisputeTypes.Status.OPEN,
                description: description
            }),
            evidenceIds: new uint256[](0),
            exists: true
        });

        emit DisputeCreated(disputeId, claimant, respondent, claimType, stake);
    }

    function addEvidence(
        uint256 disputeId,
        DisputeTypes.EvidenceType evidenceType,
        string calldata source,
        string calldata refUri,
        bytes32 contentHash,
        string calldata description,
        address submitter
    ) external onlyExistingDispute(disputeId) returns (uint256 evidenceId) {
        DisputeTypes.Status status = disputes[disputeId].dispute.status;
        require(
            status == DisputeTypes.Status.OPEN ||
            status == DisputeTypes.Status.EVIDENCE_COLLECTION,
            "Evidence collection not active"
        );

        evidenceId = nextEvidenceId++;

        evidenceItems[evidenceId] = DisputeTypes.Evidence({
            id: evidenceId,
            disputeId: disputeId,
            evidenceType: evidenceType,
            source: source,
            refUri: refUri,
            contentHash: contentHash,
            timestamp: block.timestamp,
            submitter: submitter,
            description: description
        });

        evidenceExists[evidenceId] = true;
        disputes[disputeId].evidenceIds.push(evidenceId);

        emit EvidenceSubmitted(disputeId, evidenceId, submitter, evidenceType);
    }

    function updateStatus(
        uint256 disputeId,
        DisputeTypes.Status newStatus
    ) external onlyExistingDispute(disputeId) {
        DisputeTypes.Status oldStatus = disputes[disputeId].dispute.status;
        disputes[disputeId].dispute.status = newStatus;
        emit DisputeStatusChanged(disputeId, oldStatus, newStatus);
    }

    function getDispute(uint256 disputeId)
        external
        view
        onlyExistingDispute(disputeId)
        returns (DisputeTypes.Dispute memory)
    {
        return disputes[disputeId].dispute;
    }

    function getEvidence(uint256 evidenceId)
        external
        view
        returns (DisputeTypes.Evidence memory)
    {
        require(evidenceExists[evidenceId], "Evidence does not exist");
        return evidenceItems[evidenceId];
    }

    function getDisputeEvidenceIds(uint256 disputeId)
        external
        view
        onlyExistingDispute(disputeId)
        returns (uint256[] memory)
    {
        return disputes[disputeId].evidenceIds;
    }

    function exists(uint256 disputeId) external view returns (bool) {
        return disputes[disputeId].exists;
    }
}
