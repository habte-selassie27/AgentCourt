# Deployment Guide

## Prerequisites

- GenLayer Studio account
- GEN tokens for gas
- Node.js 20+ for frontend

## Deploying Intelligent Contracts

### Step 1: Deploy DisputeRegistry
1. Open `intelligent-contracts/registry/dispute_registry.py` in GenLayer Studio
2. Click "Deploy new instance"
3. Copy the contract address

### Step 2: Deploy ResolutionManager
1. Open `intelligent-contracts/registry/resolution_manager.py`
2. Click "Deploy new instance"
3. Copy the contract address

### Step 3: Deploy AgentCourtCore
1. Open `intelligent-contracts/core/agentcourt_core.py`
2. Enter constructor inputs:
   - `dispute_registry`: Address from Step 1
   - `resolution_manager`: Address from Step 2
3. Click "Deploy"

## Deploying Frontend

### Vercel Deployment
```bash
npm run build
vercel --prod
```

### Environment Variables
Set these in Vercel dashboard:
- `VITE_AGENTCOURT_CORE`
- `VITE_DISPUTE_REGISTRY`
- `VITE_RESOLUTION_MANAGER`
- `VITE_RPC_URL`
- `VITE_CHAIN_ID`
