// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DisputeTypes} from "./Interfaces.sol";

interface ISettlementTarget {
    function onSettlement(
        uint256 disputeId,
        DisputeTypes.Verdict verdict,
        DisputeTypes.SettlementAction action
    ) external;
}

contract SettlementAdapter {
    address public owner;
    bool public paused;

    uint256 public nextSettlementNonce = 1;
    mapping(uint256 => bool) private settledDisputes;
    mapping(uint256 => uint256) private settlementNonces;

    event SettlementExecuted(
        uint256 indexed disputeId,
        DisputeTypes.Verdict verdict,
        DisputeTypes.SettlementAction action,
        uint256 nonce
    );

    event SettlementFrozen(uint256 indexed disputeId);
    event Paused(bool isPaused);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Settlement adapter is paused");
        _;
    }

    modifier notAlreadySettled(uint256 disputeId) {
        require(!settledDisputes[disputeId], "Dispute already settled");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Paused(false);
    }

    function executeSettlement(
        uint256 disputeId,
        DisputeTypes.Verdict verdict,
        DisputeTypes.SettlementAction action,
        address target,
        bytes calldata data
    )
        external
        onlyOwner
        notPaused
        notAlreadySettled(disputeId)
    {
        settledDisputes[disputeId] = true;

        uint256 nonce = nextSettlementNonce++;
        settlementNonces[disputeId] = nonce;

        if (target != address(0)) {
            ISettlementTarget(target).onSettlement(disputeId, verdict, action);
        }

        if (data.length > 0) {
            (bool success, ) = target.call{value: 0}(data);
            require(success, "Settlement call failed");
        }

        emit SettlementExecuted(disputeId, verdict, action, nonce);
    }

    function isSettled(uint256 disputeId) external view returns (bool) {
        return settledDisputes[disputeId];
    }

    function getSettlementNonce(uint256 disputeId) external view returns (uint256) {
        return settlementNonces[disputeId];
    }

    receive() external payable {}
}
