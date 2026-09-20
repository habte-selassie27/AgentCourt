// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/DisputeRegistry.sol";
import "../src/EvidenceRegistry.sol";
import "../src/VerdictRegistry.sol";
import "../src/AppealManager.sol";
import "../src/SettlementAdapter.sol";
import "../src/AgentCourtCore.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        DisputeRegistry disputeRegistry = new DisputeRegistry();
        EvidenceRegistry evidenceRegistry = new EvidenceRegistry();
        VerdictRegistry verdictRegistry = new VerdictRegistry();
        AppealManager appealManager = new AppealManager();
        SettlementAdapter settlementAdapter = new SettlementAdapter();

        AgentCourtCore core = new AgentCourtCore(
            address(disputeRegistry),
            address(evidenceRegistry),
            address(verdictRegistry),
            address(appealManager),
            address(settlementAdapter)
        );

        vm.stopBroadcast();

        console.log("DisputeRegistry:", address(disputeRegistry));
        console.log("EvidenceRegistry:", address(evidenceRegistry));
        console.log("VerdictRegistry:", address(verdictRegistry));
        console.log("AppealManager:", address(appealManager));
        console.log("SettlementAdapter:", address(settlementAdapter));
        console.log("AgentCourtCore:", address(core));
    }
}
