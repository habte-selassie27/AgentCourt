// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IAgentCourtCore, DisputeTypes} from "./Interfaces.sol";
import {DisputeRegistry} from "./DisputeRegistry.sol";
import {EvidenceRegistry} from "./EvidenceRegistry.sol";
import {VerdictRegistry} from "./VerdictRegistry.sol";
import {AppealManager} from "./AppealManager.sol";
import {SettlementAdapter} from "./SettlementAdapter.sol";

contract AgentCourtCore is IAgentCourtCore {
    DisputeRegistry public immutable disputeRegistry;
    EvidenceRegistry public immutable evidenceRegistry;
    VerdictRegistry public immutable verdictRegistry;
    AppealManager public immutable appealManager;
    SettlementAdapter public immutable settlementAdapter;

    address public owner;
    bool public paused;

    mapping(address => bool) public authorizedAgents;

    event DisputeCreated(uint256 indexed disputeId, address indexed claimant, address indexed respondent);
    event InvestigationStarted(uint256 indexed disputeId);
    event DeliberationStarted(uint256 indexed disputeId);
    event AdversarialReviewStarted(uint256 indexed disputeId);
    event ConsensusSubmitted(uint256 indexed disputeId, address indexed evaluator, DisputeTypes.Verdict verdict);
    event VerdictFinalized(uint256 indexed disputeId, DisputeTypes.Verdict verdict);
    event SettlementExecuted(uint256 indexed disputeId);
    event AgentAuthorized(address indexed agent, bool authorized);
    event Paused(bool isPaused);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedAgents[msg.sender] || msg.sender == owner, "Not authorized");
        _;
    }

    constructor(
        address _disputeRegistry,
        address _evidenceRegistry,
        address _verdictRegistry,
        address _appealManager,
        address _settlementAdapter
    ) {
        require(_disputeRegistry != address(0), "Invalid DisputeRegistry");
        require(_evidenceRegistry != address(0), "Invalid EvidenceRegistry");
        require(_verdictRegistry != address(0), "Invalid VerdictRegistry");
        require(_appealManager != address(0), "Invalid AppealManager");
        require(_settlementAdapter != address(0), "Invalid SettlementAdapter");

        disputeRegistry = DisputeRegistry(_disputeRegistry);
        evidenceRegistry = EvidenceRegistry(_evidenceRegistry);
        verdictRegistry = VerdictRegistry(_verdictRegistry);
        appealManager = AppealManager(payable(_appealManager));
        settlementAdapter = SettlementAdapter(payable(_settlementAdapter));

        owner = msg.sender;
    }

    function authorizeAgent(address agent, bool authorized) external onlyOwner {
        authorizedAgents[agent] = authorized;
        emit AgentAuthorized(agent, authorized);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused(true);
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Paused(false);
    }

    function createDispute(
        address respondent,
        bytes32 agreementHash,
        DisputeTypes.ClaimType claimType,
        string calldata description,
        uint256 stake,
        uint256 deadline
    ) external payable notPaused returns (uint256 disputeId) {
        require(msg.value >= stake, "Insufficient stake");

        disputeId = disputeRegistry.createDispute(
            msg.sender,
            respondent,
            agreementHash,
            claimType,
            stake,
            deadline,
            description
        );

        disputeRegistry.updateStatus(disputeId, DisputeTypes.Status.EVIDENCE_COLLECTION);

        emit DisputeCreated(disputeId, msg.sender, respondent);
    }

    function submitEvidence(
        uint256 disputeId,
        DisputeTypes.EvidenceType evidenceType,
        string calldata source,
        string calldata refUri,
        bytes32 contentHash,
        string calldata description
    ) external notPaused returns (uint256 evidenceId) {
        evidenceId = disputeRegistry.addEvidence(
            disputeId,
            evidenceType,
            source,
            refUri,
            contentHash,
            description,
            msg.sender
        );

        evidenceRegistry.registerEvidence(
            evidenceId,
            disputeId,
            evidenceType,
            source,
            refUri,
            contentHash,
            block.timestamp,
            msg.sender,
            description
        );
    }

    function startInvestigation(uint256 disputeId) external onlyAuthorized notPaused {
        require(
            disputeRegistry.getDispute(disputeId).status ==
            DisputeTypes.Status.EVIDENCE_COLLECTION,
            "Must be in evidence collection phase"
        );
        disputeRegistry.updateStatus(disputeId, DisputeTypes.Status.INVESTIGATION);
        emit InvestigationStarted(disputeId);
    }

    function startDeliberation(uint256 disputeId) external onlyAuthorized notPaused {
        require(
            disputeRegistry.getDispute(disputeId).status ==
            DisputeTypes.Status.INVESTIGATION,
            "Must be in investigation phase"
        );
        disputeRegistry.updateStatus(disputeId, DisputeTypes.Status.DELIBERATION);
        emit DeliberationStarted(disputeId);
    }

    function startAdversarialReview(uint256 disputeId) external onlyAuthorized notPaused {
        require(
            disputeRegistry.getDispute(disputeId).status ==
            DisputeTypes.Status.DELIBERATION,
            "Must be in deliberation phase"
        );
        disputeRegistry.updateStatus(disputeId, DisputeTypes.Status.ADVERSARIAL_REVIEW);
        emit AdversarialReviewStarted(disputeId);
    }

    function submitConsensus(
        uint256 disputeId,
        DisputeTypes.Verdict verdict,
        uint256 confidence,
        bytes32 reasoningHash
    ) external onlyAuthorized notPaused {
        require(
            disputeRegistry.getDispute(disputeId).status ==
            DisputeTypes.Status.CONSENSUS ||
            disputeRegistry.getDispute(disputeId).status ==
            DisputeTypes.Status.DELIBERATION ||
            disputeRegistry.getDispute(disputeId).status ==
            DisputeTypes.Status.ADVERSARIAL_REVIEW,
            "Invalid phase for consensus"
        );

        verdictRegistry.submitConsensus(disputeId, msg.sender, verdict, confidence, reasoningHash);
        emit ConsensusSubmitted(disputeId, msg.sender, verdict);
    }

    function finalizeVerdict(
        uint256 disputeId,
        DisputeTypes.Verdict verdict,
        uint256 confidence,
        bytes32 reasoningHash,
        DisputeTypes.SettlementAction resolution,
        bool reviewRequired
    ) external onlyOwner notPaused {
        uint256[] memory evidenceIds = disputeRegistry.getDisputeEvidenceIds(disputeId);

        verdictRegistry.finalizeVerdict(
            disputeId,
            verdict,
            confidence,
            reasoningHash,
            evidenceIds,
            resolution,
            reviewRequired
        );

        disputeRegistry.updateStatus(disputeId, DisputeTypes.Status.VERDICT);

        emit VerdictFinalized(disputeId, verdict);
    }

    function executeSettlement(uint256 disputeId) external onlyOwner notPaused {
        require(
            disputeRegistry.getDispute(disputeId).status ==
            DisputeTypes.Status.VERDICT,
            "Must have finalized verdict"
        );

        DisputeTypes.VerdictResult memory verdictResult = verdictRegistry.getVerdict(disputeId);
        require(!verdictResult.reviewRequired, "Review required, cannot auto-settle");

        disputeRegistry.updateStatus(disputeId, DisputeTypes.Status.SETTLEMENT);
        disputeRegistry.updateStatus(disputeId, DisputeTypes.Status.CLOSED);

        emit SettlementExecuted(disputeId);
    }

    function getDispute(uint256 disputeId)
        external
        view
        returns (DisputeTypes.Dispute memory)
    {
        return disputeRegistry.getDispute(disputeId);
    }

    function getEvidence(uint256 evidenceId)
        external
        view
        returns (DisputeTypes.Evidence memory)
    {
        return evidenceRegistry.getEvidence(evidenceId);
    }

    function getVerdict(uint256 disputeId)
        external
        view
        returns (DisputeTypes.VerdictResult memory)
    {
        return verdictRegistry.getVerdict(disputeId);
    }

    function getDisputeCount() external view returns (uint256) {
        return disputeRegistry.nextDisputeId() - 1;
    }

    /// @notice Evidence ids attached to a dispute, in submission order.
    function getDisputeEvidenceIds(uint256 disputeId)
        external
        view
        returns (uint256[] memory)
    {
        return disputeRegistry.getDisputeEvidenceIds(disputeId);
    }

    /// @notice Lets clients check for a verdict without provoking the revert
    ///         that VerdictRegistry.getVerdict raises for unknown disputes.
    function hasVerdict(uint256 disputeId) external view returns (bool) {
        return verdictRegistry.hasVerdict(disputeId);
    }

    /// @notice Individual evaluator submissions recorded before finalization.
    function getConsensusRecords(uint256 disputeId)
        external
        view
        returns (DisputeTypes.ConsensusRecord[] memory)
    {
        return verdictRegistry.getConsensusRecords(disputeId);
    }

    function getConsensusCount(uint256 disputeId) external view returns (uint256) {
        return verdictRegistry.getConsensusCount(disputeId);
    }

    /// @notice Verification flag for a single evidence item.
    function isEvidenceVerified(uint256 evidenceId) external view returns (bool) {
        return evidenceRegistry.isVerified(evidenceId);
    }
}
