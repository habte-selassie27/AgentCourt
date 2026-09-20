// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/DisputeRegistry.sol";
import "../src/EvidenceRegistry.sol";
import "../src/VerdictRegistry.sol";
import "../src/AppealManager.sol";
import "../src/SettlementAdapter.sol";
import "../src/AgentCourtCore.sol";

contract AgentCourtCoreTest is Test {
    DisputeRegistry disputeRegistry;
    EvidenceRegistry evidenceRegistry;
    VerdictRegistry verdictRegistry;
    AppealManager appealManager;
    SettlementAdapter settlementAdapter;
    AgentCourtCore core;

    address claimant = address(0x1);
    address respondent = address(0x2);
    address agent = address(0x3);

    function setUp() public {
        disputeRegistry = new DisputeRegistry();
        evidenceRegistry = new EvidenceRegistry();
        verdictRegistry = new VerdictRegistry();
        appealManager = new AppealManager();
        settlementAdapter = new SettlementAdapter();

        core = new AgentCourtCore(
            address(disputeRegistry),
            address(evidenceRegistry),
            address(verdictRegistry),
            address(appealManager),
            address(settlementAdapter)
        );

        core.authorizeAgent(agent, true);
    }

    function testCreateDispute() public {
        vm.deal(claimant, 1 ether);

        vm.prank(claimant);
        uint256 disputeId = core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        assertEq(disputeId, 1);

        DisputeTypes.Dispute memory dispute = core.getDispute(disputeId);
        assertEq(dispute.claimant, claimant);
        assertEq(dispute.respondent, respondent);
        assertEq(uint8(dispute.status), uint8(DisputeTypes.Status.EVIDENCE_COLLECTION));
    }

    function testSubmitEvidence() public {
        vm.deal(claimant, 1 ether);

        vm.prank(claimant);
        uint256 disputeId = core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        uint256 evidenceId = core.submitEvidence(
            disputeId,
            DisputeTypes.EvidenceType.ONCHAIN_TRANSACTION,
            "Arc Blockchain",
            "0xabc123",
            keccak256(abi.encodePacked("hash")),
            "Payment transaction"
        );

        assertEq(evidenceId, 1);

        DisputeTypes.Evidence memory evidence = core.getEvidence(evidenceId);
        assertEq(evidence.source, "Arc Blockchain");
        assertEq(evidence.submitter, address(this));
    }

    function testEvidenceIdsAndVerification() public {
        vm.deal(claimant, 1 ether);

        vm.prank(claimant);
        uint256 disputeId = core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        // No evidence yet.
        assertEq(core.getDisputeEvidenceIds(disputeId).length, 0);

        uint256 first = core.submitEvidence(
            disputeId,
            DisputeTypes.EvidenceType.ONCHAIN_TRANSACTION,
            "Arc Blockchain",
            "0xabc123",
            keccak256(abi.encodePacked("hash")),
            "Payment transaction"
        );

        uint256 second = core.submitEvidence(
            disputeId,
            DisputeTypes.EvidenceType.CONTENT_HASH,
            "IPFS",
            "QmXoyp",
            keccak256(abi.encodePacked("hash2")),
            "Dataset hash"
        );

        uint256[] memory ids = core.getDisputeEvidenceIds(disputeId);
        assertEq(ids.length, 2);
        assertEq(ids[0], first);
        assertEq(ids[1], second);

        // Evidence starts unverified and only flips once the registry says so.
        assertFalse(core.isEvidenceVerified(first));
        evidenceRegistry.verifyEvidence(first, true);
        assertTrue(core.isEvidenceVerified(first));
        assertFalse(core.isEvidenceVerified(second));
    }

    function testHasVerdictTracksFinalization() public {
        vm.deal(claimant, 1 ether);

        vm.prank(claimant);
        uint256 disputeId = core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        assertFalse(core.hasVerdict(disputeId));

        core.startInvestigation(disputeId);
        core.startDeliberation(disputeId);
        core.startAdversarialReview(disputeId);
        core.finalizeVerdict(
            disputeId,
            DisputeTypes.Verdict.FALSE_CLAIM,
            7100,
            keccak256(abi.encodePacked("reasoning")),
            DisputeTypes.SettlementAction.RELEASE_TO_RESPONDENT,
            false
        );

        assertTrue(core.hasVerdict(disputeId));

        // The verdict carries the dispute's evidence ids for client rendering.
        DisputeTypes.VerdictResult memory verdict = core.getVerdict(disputeId);
        assertEq(verdict.confidence, 7100);
        assertEq(verdict.evidenceIds.length, core.getDisputeEvidenceIds(disputeId).length);
    }

    function testConsensusRecordsExposed() public {
        vm.deal(claimant, 1 ether);

        vm.prank(claimant);
        uint256 disputeId = core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        core.startInvestigation(disputeId);
        core.startDeliberation(disputeId);

        assertEq(core.getConsensusCount(disputeId), 0);
        assertEq(core.getConsensusRecords(disputeId).length, 0);

        core.submitConsensus(
            disputeId,
            DisputeTypes.Verdict.TRUE_CLAIM,
            9100,
            keccak256(abi.encodePacked("reasoning-a"))
        );

        vm.prank(agent);
        core.submitConsensus(
            disputeId,
            DisputeTypes.Verdict.FALSE_CLAIM,
            7800,
            keccak256(abi.encodePacked("reasoning-b"))
        );

        assertEq(core.getConsensusCount(disputeId), 2);

        DisputeTypes.ConsensusRecord[] memory records = core.getConsensusRecords(disputeId);
        assertEq(records.length, 2);
        assertEq(uint8(records[0].verdict), uint8(DisputeTypes.Verdict.TRUE_CLAIM));
        assertEq(records[0].confidence, 9100);
        assertEq(uint8(records[1].verdict), uint8(DisputeTypes.Verdict.FALSE_CLAIM));
        assertEq(records[1].evaluator, agent);
    }

    function testFullLifecycle() public {
        vm.deal(claimant, 1 ether);

        vm.prank(claimant);
        uint256 disputeId = core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        core.submitEvidence(
            disputeId,
            DisputeTypes.EvidenceType.ONCHAIN_TRANSACTION,
            "Arc Blockchain",
            "0xabc123",
            keccak256(abi.encodePacked("hash")),
            "Payment transaction"
        );

        core.startInvestigation(disputeId);
        assertEq(uint8(core.getDispute(disputeId).status), uint8(DisputeTypes.Status.INVESTIGATION));

        core.startDeliberation(disputeId);
        assertEq(uint8(core.getDispute(disputeId).status), uint8(DisputeTypes.Status.DELIBERATION));

        core.startAdversarialReview(disputeId);
        assertEq(uint8(core.getDispute(disputeId).status), uint8(DisputeTypes.Status.ADVERSARIAL_REVIEW));

        core.submitConsensus(
            disputeId,
            DisputeTypes.Verdict.TRUE_CLAIM,
            9100,
            keccak256(abi.encodePacked("reasoning"))
        );

        core.finalizeVerdict(
            disputeId,
            DisputeTypes.Verdict.TRUE_CLAIM,
            9100,
            keccak256(abi.encodePacked("reasoning")),
            DisputeTypes.SettlementAction.RELEASE_TO_CLAIMANT,
            false
        );

        assertEq(uint8(core.getDispute(disputeId).status), uint8(DisputeTypes.Status.VERDICT));

        core.executeSettlement(disputeId);
        assertEq(uint8(core.getDispute(disputeId).status), uint8(DisputeTypes.Status.CLOSED));

        DisputeTypes.VerdictResult memory verdict = core.getVerdict(disputeId);
        assertEq(uint8(verdict.verdict), uint8(DisputeTypes.Verdict.TRUE_CLAIM));
        assertFalse(verdict.reviewRequired);
    }

    function testPause() public {
        core.pause();
        assertTrue(core.paused());

        vm.deal(claimant, 1 ether);
        vm.prank(claimant);
        vm.expectRevert("Contract is paused");
        core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        core.unpause();
        assertFalse(core.paused());
    }

    function testUnauthorizedAgent() public {
        vm.deal(claimant, 1 ether);

        vm.prank(claimant);
        uint256 disputeId = core.createDispute{value: 0.01 ether}(
            respondent,
            keccak256(abi.encodePacked("agreement")),
            DisputeTypes.ClaimType.DELIVERY_FAILURE,
            "Test dispute",
            0.01 ether,
            block.timestamp + 7 days
        );

        vm.prank(claimant);
        vm.expectRevert("Not authorized");
        core.startInvestigation(disputeId);
    }

    function testAppeal() public {
        uint256 appealId = appealManager.openAppeal{value: 0.01 ether}(
            1,
            claimant,
            "New evidence found"
        );

        assertEq(appealId, 1);

        DisputeTypes.Appeal memory appeal = appealManager.getAppeal(appealId);
        assertEq(appeal.appellant, claimant);
        assertEq(appeal.bond, 0.01 ether);
        assertFalse(appeal.resolved);
    }

    function testSettlementAdapter() public {
        settlementAdapter.pause();
        assertTrue(settlementAdapter.paused());

        vm.expectRevert("Settlement adapter is paused");
        settlementAdapter.executeSettlement(
            1,
            DisputeTypes.Verdict.TRUE_CLAIM,
            DisputeTypes.SettlementAction.RELEASE_TO_CLAIMANT,
            address(0),
            ""
        );

        settlementAdapter.unpause();
    }
}
