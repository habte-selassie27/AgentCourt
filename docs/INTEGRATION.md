# Integration Guide

## For Escrow Systems

```solidity
interface IAgentCourtCore {
    function getVerdict(uint256 disputeId) view returns (Verdict);
}

contract Escrow {
    IAgentCourtCore public court;
    
    function releaseFunds(uint256 disputeId) external {
        Verdict memory v = court.getVerdict(disputeId);
        if (v.resolution == Resolution.RELEASE_TO_CLAIMANT) {
            payClaimant(disputeId);
        } else if (v.resolution == Resolution.RELEASE_TO_RESPONDENT) {
            payRespondent(disputeId);
        }
    }
}
```

## For Marketplaces

```python
# Python integration
from agentcourt import AgentCourt

court = AgentCourt(config)

# Auto-create dispute on buyer complaint
def handle_complaint(buyer, seller, order_id):
    dispute_id = court.create_dispute(
        respondent=seller,
        agreement_hash=hash_order(order_id),
        claim_type="DELIVERY_FAILURE",
        description=f"Order {order_id} not delivered",
        stake=order_value,
        deadline=deadline,
    )
    return dispute_id
```

## For Autonomous Agents

```typescript
// Agent-to-agent dispute resolution
async function resolveAgentDispute(agentA, agentB, agreement) {
  const disputeId = await court.createDispute({
    respondent: agentB.address,
    agreementHash: hashAgreement(agreement),
    claimType: 'AGENT_CONTRACT_BREACH',
    description: 'Agent B violated service agreement',
    stake: agreement.stake,
    deadline: agreement.deadline,
  });
  
  return court.waitForVerdict(disputeId);
}
```
