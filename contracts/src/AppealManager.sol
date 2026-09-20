// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {DisputeTypes} from "./Interfaces.sol";

contract AppealManager {
    struct AppealRecord {
        DisputeTypes.Appeal appeal;
        bool exists;
    }

    uint256 public nextAppealId = 1;

    uint256 public appealBond = 0.01 ether;
    uint256 public maxRounds = 3;
    uint256 public appealWindow = 7 days;

    mapping(uint256 => AppealRecord) private appeals;
    mapping(uint256 => uint256[]) private disputeAppeals;

    event AppealOpened(
        uint256 indexed appealId,
        uint256 indexed disputeId,
        address indexed appellant,
        uint256 bond
    );

    event AppealResolved(
        uint256 indexed appealId,
        bool accepted,
        DisputeTypes.Verdict supersedingVerdict
    );

    function setAppealBond(uint256 newBond) external {
        appealBond = newBond;
    }

    function setMaxRounds(uint256 newMax) external {
        maxRounds = newMax;
    }

    function setAppealWindow(uint256 newWindow) external {
        appealWindow = newWindow;
    }

    function openAppeal(
        uint256 disputeId,
        address appellant,
        string calldata reason
    ) external payable returns (uint256 appealId) {
        require(msg.value >= appealBond, "Insufficient appeal bond");
        require(
            disputeAppeals[disputeId].length < maxRounds,
            "Maximum appeal rounds reached"
        );

        appealId = nextAppealId++;

        appeals[appealId] = AppealRecord({
            appeal: DisputeTypes.Appeal({
                id: appealId,
                disputeId: disputeId,
                appellant: appellant,
                reason: reason,
                bond: msg.value,
                createdAt: block.timestamp,
                resolved: false,
                supersedingVerdict: DisputeTypes.Verdict.NONE
            }),
            exists: true
        });

        disputeAppeals[disputeId].push(appealId);

        emit AppealOpened(appealId, disputeId, appellant, msg.value);
    }

    function resolveAppeal(
        uint256 appealId,
        bool accepted,
        DisputeTypes.Verdict supersedingVerdict
    ) external {
        require(appeals[appealId].exists, "Appeal does not exist");
        require(!appeals[appealId].appeal.resolved, "Appeal already resolved");

        appeals[appealId].appeal.resolved = true;
        appeals[appealId].appeal.supersedingVerdict = supersedingVerdict;

        if (!accepted) {
            uint256 bond = appeals[appealId].appeal.bond;
            payable(appeals[appealId].appeal.appellant).transfer(bond);
        }

        emit AppealResolved(appealId, accepted, supersedingVerdict);
    }

    function getAppeal(uint256 appealId)
        external
        view
        returns (DisputeTypes.Appeal memory)
    {
        require(appeals[appealId].exists, "Appeal does not exist");
        return appeals[appealId].appeal;
    }

    function getDisputeAppeals(uint256 disputeId)
        external
        view
        returns (uint256[] memory)
    {
        return disputeAppeals[disputeId];
    }

    function getAppealCount(uint256 disputeId) external view returns (uint256) {
        return disputeAppeals[disputeId].length;
    }

    receive() external payable {}
}
