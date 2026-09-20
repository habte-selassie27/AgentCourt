// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DisputeTypes} from "./Interfaces.sol";

contract EvidenceRegistry {
    struct EvidenceRecord {
        DisputeTypes.Evidence evidence;
        bool verified;
        uint256 verificationTimestamp;
        string[] crossReferences;
    }

    mapping(uint256 => EvidenceRecord) private evidenceRecords;
    mapping(uint256 => bool) private exists;
    mapping(uint256 => uint256[]) private disputeEvidenceIds;

    event EvidenceRegistered(
        uint256 indexed evidenceId,
        uint256 indexed disputeId,
        DisputeTypes.EvidenceType evidenceType,
        address indexed submitter
    );

    event EvidenceVerified(
        uint256 indexed evidenceId,
        bool verified,
        uint256 verificationTimestamp
    );

    event CrossReferenceAdded(
        uint256 indexed evidenceId,
        uint256 indexed crossRefId
    );

    function registerEvidence(
        uint256 evidenceId,
        uint256 disputeId,
        DisputeTypes.EvidenceType evidenceType,
        string calldata source,
        string calldata refUri,
        bytes32 contentHash,
        uint256 timestamp,
        address submitter,
        string calldata description
    ) external {
        require(!exists[evidenceId], "Evidence already registered");

        evidenceRecords[evidenceId] = EvidenceRecord({
            evidence: DisputeTypes.Evidence({
                id: evidenceId,
                disputeId: disputeId,
                evidenceType: evidenceType,
                source: source,
                refUri: refUri,
                contentHash: contentHash,
                timestamp: timestamp,
                submitter: submitter,
                description: description
            }),
            verified: false,
            verificationTimestamp: 0,
            crossReferences: new string[](0)
        });

        exists[evidenceId] = true;
        disputeEvidenceIds[disputeId].push(evidenceId);

        emit EvidenceRegistered(evidenceId, disputeId, evidenceType, submitter);
    }

    function verifyEvidence(
        uint256 evidenceId,
        bool verified
    ) external {
        require(exists[evidenceId], "Evidence does not exist");
        evidenceRecords[evidenceId].verified = verified;
        evidenceRecords[evidenceId].verificationTimestamp = block.timestamp;
        emit EvidenceVerified(evidenceId, verified, block.timestamp);
    }

    function addCrossReference(
        uint256 evidenceId,
        string calldata crossRef
    ) external {
        require(exists[evidenceId], "Evidence does not exist");
        evidenceRecords[evidenceId].crossReferences.push(crossRef);
        emit CrossReferenceAdded(evidenceId, 0);
    }

    function getEvidence(uint256 evidenceId)
        external
        view
        returns (DisputeTypes.Evidence memory)
    {
        require(exists[evidenceId], "Evidence does not exist");
        return evidenceRecords[evidenceId].evidence;
    }

    function getEvidenceRecord(uint256 evidenceId)
        external
        view
        returns (EvidenceRecord memory)
    {
        require(exists[evidenceId], "Evidence does not exist");
        return evidenceRecords[evidenceId];
    }

    function isVerified(uint256 evidenceId) external view returns (bool) {
        require(exists[evidenceId], "Evidence does not exist");
        return evidenceRecords[evidenceId].verified;
    }

    function getDisputeEvidenceIds(uint256 disputeId)
        external
        view
        returns (uint256[] memory)
    {
        return disputeEvidenceIds[disputeId];
    }

    function evidenceExists(uint256 evidenceId) external view returns (bool) {
        return exists[evidenceId];
    }
}
