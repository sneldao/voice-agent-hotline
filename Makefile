.PHONY: deploy logs status restart

# Deploy to Hetzner.
# Requires UPSTASH_REDIS_REST_TOKEN in your shell env:
#   export UPSTASH_REDIS_REST_TOKEN=your_token
#   make deploy
# (never commit a real token to git)
deploy:
	ssh snel-bot "cd /opt/voice-hotline-celo && \
		UPSTASH_REDIS_REST_URL=https://game-corgi-122374.upstash.io \
		UPSTASH_REDIS_REST_TOKEN=$$UPSTASH_REDIS_REST_TOKEN \
		bash scripts/deploy.sh"

# Tail PM2 logs
logs:
	ssh snel-bot "pm2 logs voice-hotline-celo --nostream --lines 50"

# Check process status
status:
	ssh snel-bot "pm2 status voice-hotline-celo"

# Restart without rebuilding
restart:
	ssh snel-bot "pm2 restart voice-hotline-celo"