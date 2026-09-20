# Evidence Verification

## Verification Stages

### 1. Existence Check
Does the evidence exist?
```python
def verify_existence(evidence):
    if evidence.type == "ONCHAIN_TRANSACTION":
        return check_transaction_exists(evidence.ref_uri)
    elif evidence.type == "WEB_PAGE":
        return fetch_url(evidence.ref_uri) is not None
    elif evidence.type == "API_RESPONSE":
        return call_api(evidence.ref_uri) is not None
    return False
```

### 2. Integrity Check
Has the evidence been tampered with?
```python
def verify_integrity(evidence):
    content = fetch_content(evidence.ref_uri)
    calculated_hash = hash_content(content)
    return calculated_hash == evidence.content_hash
```

### 3. Relevance Check
Is the evidence related to the dispute?
```python
def verify_relevance(evidence, claim):
    keywords = extract_keywords(claim)
    matches = count_keyword_matches(evidence, keywords)
    return matches >= THRESHOLD
```

### 4. Timestamp Check
Is the evidence from the relevant time period?
```python
def verify_timestamp(evidence, dispute):
    evidence_time = evidence.timestamp
    dispute_time = dispute.created_at
    deadline = dispute.deadline
    return dispute_time <= evidence_time <= deadline
```

### 5. Independence Check
Are sources independent?
```python
def verify_independence(evidences):
    sources = [e.source for e in evidences]
    dependencies = detect_dependencies(sources)
    return len(dependencies) == 0
```

## Verification Results

### Verified
All checks passed:
```python
VerificationResult(
    status="VERIFIED",
    checks=["existence", "integrity", "relevance", "timestamp", "independence"],
    confidence=0.95
)
```

### Partially Verified
Some checks failed:
```python
VerificationResult(
    status="PARTIALLY_VERIFIED",
    failed_checks=["independence"],
    confidence=0.7
)
```

### Failed
Critical check failed:
```python
VerificationResult(
    status="FAILED",
    failed_checks=["integrity"],
    confidence=0.0
)
```

### Unverifiable
Cannot verify:
```python
VerificationResult(
    status="UNVERIFIABLE",
    reason="Source unavailable",
    confidence=0.0
)
```

## Source Relationships

### Detecting Dependencies
```python
def detect_dependencies(sources):
    # Check if sources share common backend
    # Check if sources reference each other
    # Check if sources use same API
    return dependencies
```

### Independence Score
```python
def calculate_independence_score(evidences):
    total = len(evidences)
    independent = count_independent_sources(evidences)
    return independent / total
```
