# Facilitator Wallet Setup Guide

## Overview

We've created a dedicated **facilitator wallet** for gas fees. This is a "hot wallet" with limited funds that:
- Pays gas for `transferWithAuthorization` transactions
- Earns platform fees to cover gas costs
- Keeps main revenue separate in a cold wallet

## Wallet Details

```
Facilitator Address: 0x54351049081A5A64Ea93c56b666830ED5076b960
Network: Celo Mainnet
Purpose: Gas fees only
```

## Step 1: Fund the Facilitator Wallet

### Get CELO for Gas

You need **0.1 - 0.5 CELO** (~$0.05 - $0.25) for gas fees.

**Option A: Buy CELO on an exchange**
1. Buy CELO on Binance, Coinbase, or OKX
2. Withdraw to: `0x54351049081A5A64Ea93c56b666830ED5076b960`
3. Use Celo network (not ERC-20)

**Option B: Bridge from Ethereum**
1. Use [Optics Bridge](https://optics.app) or [AllBridge](https://allbridge.io)
2. Bridge USDC/ETH from Ethereum to Celo
3. Swap some to CELO on [Ubeswap](https://ubeswap.org)

**Option C: On-ramp directly**
- Use [Moonpay](https://moonpay.com) or [Ramp](https://ramp.network)
- Buy CELO directly to the facilitator address

## Step 2: Set Your Cold Wallet (Revenue)

**IMPORTANT:** Update `PAYMENT_RECEIVER` to your secure cold wallet:

```bash
# Local development
# Edit .env.local:
PAYMENT_RECEIVER=0xYourColdWalletAddressHere

# Production server
ssh snel-bot
nano /opt/voice-hotline-celo/.env.hetzner
# Change: PAYMENT_RECEIVER=0xYourColdWalletAddressHere
pm2 restart voice-hotline-celo --update-env
```

## Step 3: Verify Setup

### Check Facilitator Balance
```bash
# Using cast (foundry)
cast balance 0x54351049081A5A64Ea93c56b666830ED5076b960 --rpc-url https://forno.celo.org

# Or using curl
curl -X POST https://forno.celo.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": ["0x54351049081A5A64Ea93c56b666830ED5076b960", "latest"],
    "id": 1
  }'
```

### Test Payment Settlement
```bash
# Health check
curl https://voisss.celo.famile.xyz/api/sdk/health

# Check settlement config
curl https://voisss.celo.famile.xyz/api/sdk/config
```

## Economics

### Gas Costs vs Revenue

| Metric | Value |
|--------|-------|
| Gas per settlement | ~100,000 gas |
| CELO price | ~$0.50 |
| Gas price | ~25 gwei |
| **Cost per call** | **~$0.001** |

### Break-Even Analysis

| Agent Rate | 1-Min Call Revenue | Platform Fee (10%) | Gas Cost | Profit |
|------------|-------------------|-------------------|----------|--------|
| $0.10/min | $0.10 | $0.01 | $0.001 | **$0.009** |
| $0.50/min | $0.50 | $0.05 | $0.001 | **$0.049** |
| $1.00/min | $1.00 | $0.10 | $0.001 | **$0.099** |

**You need ~100 calls to break even on 0.1 CELO funding.**

## Security Best Practices

### 1. Keep Funds Minimal
- **Maximum:** 0.5 CELO (~$0.25)
- **Recommended:** 0.1 CELO (~$0.05)
- **Refill when:** Below 0.05 CELO

### 2. Monitor Regularly
```bash
# Set up a cron job to check balance daily
0 9 * * * /usr/local/bin/cast balance 0x54351049081A5A64Ea93c56b666830ED5076b960 --rpc-url https://forno.celo.org | mail -s "Facilitator Balance" your@email.com
```

### 3. Set Up Alerts
Use a service like [Tenderly](https://tenderly.co) or [OpenZeppelin Defender](https://defender.openzeppelin.com) to:
- Alert on low balance
- Alert on unusual activity
- Monitor transaction success rates

### 4. Key Rotation Plan
If the server is compromised:
1. Generate new facilitator wallet
2. Update `.env.hetzner` on server
3. Restart PM2: `pm2 restart voice-hotline-celo --update-env`
4. Drain old wallet if possible
5. Fund new wallet

## Monitoring Commands

```bash
# Check facilitator balance
cast balance 0x54351049081A5A64Ea93c56b666830ED5076b960 --rpc-url https://forno.celo.org

# Check cUSD balance
cast call 0x765DE816845861e75A25fCA122bb6898B8B1282a \
  "balanceOf(address)(uint256)" \
  0x54351049081A5A64Ea93c56b666830ED5076b960 \
  --rpc-url https://forno.celo.org

# View recent transactions
cast tx 0x... --rpc-url https://forno.celo.org
```

## Troubleshooting

### "Insufficient funds for gas"
- Fund the facilitator wallet with more CELO
- Check balance: `cast balance 0x54351049081A5A64Ea93c56b666830ED5076b960`

### "Settlement failed"
- Check server logs: `pm2 logs voice-hotline-celo`
- Verify `FACILITATOR_PRIVATE_KEY` is set correctly
- Ensure facilitator has CELO for gas

### "Invalid private key"
- Verify key format: `0x` + 64 hex characters
- Check no extra whitespace in `.env.hetzner`
- Restart PM2 with `--update-env`

## Next Steps

1. **Fund the wallet** with 0.1-0.5 CELO
2. **Set your cold wallet** as `PAYMENT_RECEIVER`
3. **Test a call** to verify settlement works
4. **Set up monitoring** for low balance alerts
5. **Document your key rotation** procedure

## Emergency Contacts

If you need to rotate keys urgently:
```bash
# Generate new wallet
node -e "const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts'); const pk = generatePrivateKey(); console.log('New key:', pk); console.log('Address:', privateKeyToAccount(pk).address);"

# Update server
ssh snel-bot
nano /opt/voice-hotline-celo/.env.hetzner
pm2 restart voice-hotline-celo --update-env
```
