/**
 * PM2 Ecosystem Configuration
 * 
 * Production-grade process management for Voice Agent Hotline
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 * 
 * Monitoring:
 *   pm2 monit
 *   pm2 logs voice-hotline-celo
 *   pm2 status
 */

module.exports = {
  apps: [
    {
      // Application name
      name: 'voice-hotline-celo',
      
      // Start with standalone server (required for output: 'standalone')
      // 'next start' does not work with standalone output - must use server.js directly
      script: '.next/standalone/server.js',
      
      // Use fork mode (Next.js handles its own clustering internally)
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3042,
        HOSTNAME: '0.0.0.0',
      },
      
      // Logging configuration (ORGANIZED)
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      
      // Auto-restart on crash (RELIABLE)
      autorestart: true,
      
      // Memory limit - restart if exceeded (PERFORMANT)
      max_memory_restart: '1G',
      
      // Don't watch files in production
      watch: false,
      
      // Graceful shutdown timeout
      kill_timeout: 3000,
      
      // Wait before restarting (prevents rapid restart loops)
      restart_delay: 4000,
      
      // Min cluster instances (for cluster mode)
      min_instances: 1,
      
      // Max memory for cluster scaling
      max_restarts: 10,
      
      // Source map support for debugging
      source_map_support: true,
    },
  ],
};
