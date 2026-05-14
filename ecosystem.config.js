/**
 * PM2 Ecosystem Configuration
 * Voice Agent Hotline — Hetzner Production
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

require('dotenv').config({ path: '.env.hetzner' });

module.exports = {
  apps: [
    {
      name: 'voice-hotline-celo',
      script: '.next/standalone/server.js',
      cwd: '/opt/voice-hotline-celo',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3042,
        HOSTNAME: '0.0.0.0',
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