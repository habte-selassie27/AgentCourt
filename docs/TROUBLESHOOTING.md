# Troubleshooting

## Common Issues

### Contract Deployment Fails

**Symptom**: `AssertionError: Is right the same storage type?`

**Solution**: Remove `TreeMap()` from `__init__`. GenLayer auto-initializes TreeMaps.

### Wrong Sender Address

**Symptom**: `'MessageType' object has no attribute 'sender_account'`

**Solution**: Use `gl.message.sender_address` instead of `gl.message.sender_account`.

### Schema Loading Error

**Symptom**: `Could not load contract schema`

**Solution**: Check for typos in type annotations (e.g., `u257` should be `u256`).

### Frontend Can't Load Disputes

**Symptom**: `No contract deployed at 0x...`

**Solution**: Update `.env` with correct contract addresses from GenLayer Studio.

### Cross-Contract Call Fails

**Symptom**: `gl.exec.cross_call` not found

**Solution**: Use `gl.get_contract_at(address).view()` for reads, `.emit()` for writes.

## Debug Mode

Enable verbose logging:
```bash
DEBUG=agentcourt:* npm run dev
```

## Support

- GitHub Issues: https://github.com/habte-selassie27/AgentCourt/issues
- GenLayer Docs: https://docs.genlayer.com
