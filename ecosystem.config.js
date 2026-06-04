/**
 * PM2 Ecosystem Configuration
 * Voice Agent Hotline — Hetzner Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

/**
 * PM2 Ecosystem Configuration
 * Voice Agent Hotline — Hetzner Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 *
 * Env vars are written by deploy.sh into .env.hetzner.
 * After deploy.sh runs, reload with: pm2 reload voice-hotline
 */

const path = require('path');

// Load .env.hetzner if dotenv is available (fallback for local dev).
// On the server, node_modules is deleted after build so we read
// the file manually to avoid a hard dep on dotenv at runtime.
function loadEnv(envPath) {
  const fs = require('fs');
  if (!fs.existsSync(envPath)) return {};
  const vars = {};
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !m[1].startsWith('#')) vars[m[1]] = m[2];
    });
  return vars;
}

const env = loadEnv('/opt/voice-hotline/.env.hetzner');

module.exports = {
  apps: [
    {
      name: 'voice-hotline',
      script: '/opt/voice-hotline/.next/standalone/server.js',
      cwd: '/opt/voice-hotline',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: env.NODE_ENV || 'production',
        PORT: env.PORT || '3042',
        HOSTNAME: env.HOSTNAME || '0.0.0.0',
        UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL || '',
        UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN || '',
        UPSTASH_REDIS_URL: env.UPSTASH_REDIS_URL || '',
        UPSTASH_REDIS_TOKEN: env.UPSTASH_REDIS_TOKEN || '',
        ARBITRUM_RPC_URL: env.ARBITRUM_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
      kill_timeout: 3000,
      restart_delay: 4000,
      min_instances: 1,
      max_restarts: 10,
      source_map_support: true,
    },
  ],
};