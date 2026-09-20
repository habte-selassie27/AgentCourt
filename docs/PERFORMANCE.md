# Performance Considerations

## Gas Optimization

### Storage Patterns
- Use TreeMap for dynamic data
- Avoid frequent storage updates
- Batch operations when possible

### Cross-Contract Calls
- Minimize cross-contract reads
- Use local caching in AgentCourtCore
- Batch emit() calls

## Latency

### Direct Tests
- ~30ms per test
- No server required
- In-memory execution

### Integration Tests
- Seconds to minutes
- Full consensus validation
- Real network conditions

### Production
- Evidence submission: ~5s
- Investigation: ~30s
- Deliberation: ~60s
- Verdict: ~30s
- Settlement: ~10s

## Scalability

### Current Limits
- 32 pending transactions per sender
- Per-contract caps apply
- Rate limits: 60 req/min

### Future Improvements
- Parallel evidence verification
- Sharded dispute processing
- Layer 2 integration
