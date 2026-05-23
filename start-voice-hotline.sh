#!/bin/bash
export NODE_ENV=production
export PORT=3042
export HOSTNAME=0.0.0.0

# Upstash Redis
export UPSTASH_REDIS_REST_URL="https://us1-small-reindeer-45942.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="ABApIkNBRDEzODU5MTA0NThlYzc4ZjM4ZjEzZTBkMTVjZDE1ODMyOXwxODU1Nzk3MzIwNDU3Njk3Njc3"
export UPSTASH_REDIS_URL="${UPSTASH_REDIS_REST_URL}"
export UPSTASH_REDIS_TOKEN="${UPSTASH_REDIS_REST_TOKEN}"

# Celo RPC
export CELO_RPC_URL="https://forno.celo.org"

cd /opt/voice-hotline-celo/.next/standalone && exec node server.js