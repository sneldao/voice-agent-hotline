.PHONY: deploy logs status restart

# Deploy to Hetzner — local build, atomic rsync.
# Builds locally with pnpm, rsyncs standalone bundle
# to a new release directory, swaps the `current` symlink.
# No build happens on the server.
deploy:
	bash scripts/deploy-hetzner.sh

# Tail PM2 logs
logs:
	ssh snel-bot "pm2 logs voice-hotline --nostream --lines 50"

# Check process status
status:
	ssh snel-bot "pm2 status voice-hotline"

# Restart without rebuilding
restart:
	ssh snel-bot "pm2 restart voice-hotline"
