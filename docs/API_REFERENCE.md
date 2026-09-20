# API Reference

## AgentCourtCore

### Write Methods

#### createDispute
```python
create_dispute(
    respondent: Address,
    agreement_hash: bytes32,
    claim_type: uint8,
    description: string,
    stake: uint256,
    deadline: uint256
) -> uint256
```

#### submitEvidence
```python
submit_evidence(
    dispute_id: uint256,
    evidence_type: uint8,
    source: string,
    ref_uri: string,
    content_hash: bytes32,
    description: string
) -> uint256
```

### Read Methods

#### getDispute
```python
get_dispute(dispute_id: uint256) -> Dispute
```

#### getVerdict
```python
get_verdict(dispute_id: uint256) -> Verdict
```

## DisputeRegistry

### Write Methods

#### createDispute
Registers a new dispute in the registry.

#### addEvidence
Adds evidence to a dispute.

### Read Methods

#### getDispute
Returns dispute details.

#### getEvidence
Returns evidence details.

## ResolutionManager

### Write Methods

#### openAppeal
Opens an appeal for a dispute.

#### executeSettlement
Executes settlement for a finalized dispute.

### Read Methods

#### isSettled
Checks if a dispute has been settled.

#### getAppeal
Returns appeal details.
