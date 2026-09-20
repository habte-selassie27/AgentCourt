# Use Cases

## 1. Autonomous Data Marketplace

### Scenario
Agent A purchases dataset from Agent B.

### Agreement
```json
{
  "service": "dataset_delivery",
  "format": "json",
  "minimumRecords": 10000,
  "minimumCompleteness": 0.95,
  "deadline": 1790000000
}
```

### Dispute
- **Claim**: Dataset incomplete
- **Evidence**: Download URL, validation report, record count
- **Verdict**: TRUE (seller failed completeness)
- **Resolution**: Refund buyer

## 2. Agent-to-Agent Service

### Scenario
ResearchAgent hires DataAgent for analysis.

### Agreement
```json
{
  "service": "data_analysis",
  "input": "dataset_001",
  "output_format": "pdf",
  "deadline": 1790000000
}
```

### Dispute
- **Claim**: Analysis not delivered
- **Evidence**: Transaction hash, service logs, delivery timestamp
- **Verdict**: FALSE (analysis was delivered)
- **Resolution**: Release payment to seller

## 3. Compute Marketplace

### Scenario
User purchases GPU hours from provider.

### Agreement
```json
{
  "service": "gpu_compute",
  "hours": 10,
  "gpu_type": "A100",
  "uptime_guarantee": 0.99
}
```

### Dispute
- **Claim**: Insufficient uptime
- **Evidence**: API logs, monitoring data, provider metrics
- **Verdict**: TRUE (uptime below threshold)
- **Resolution**: Partial refund

## 4. Oracle Dispute

### Scenario
Protocol disputes oracle price feed.

### Agreement
```json
{
  "service": "price_feed",
  "asset": "BTC/USD",
  "source": "chainlink",
  "staleness_threshold": 300
}
```

### Dispute
- **Claim**: Oracle reported stale price
- **Evidence**: Oracle timestamp, block number, price history
- **Verdict**: UNVERIFIABLE (insufficient evidence)
- **Resolution**: Freeze settlement

## 5. Escrow Service

### Scenario
Buyer uses escrow for marketplace purchase.

### Agreement
```json
{
  "service": "escrow",
  "buyer": "0xBUYER",
  "seller": "0xSELLER",
  "amount": "1000 USDC",
  "condition": "delivery_confirmed"
}
```

### Dispute
- **Claim**: Delivery not confirmed
- **Evidence**: Delivery receipt, tracking info, photos
- **Verdict**: TRUE (delivery confirmed)
- **Resolution**: Release funds to seller
