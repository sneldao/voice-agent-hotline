# Hetzner VPS Deployment Guide

## Overview

Deploy Voice Agent Hotline to Hetzner VPS for production-grade reliability with **zero cold starts**, **unlimited timeouts**, and **full WebSocket support**.

### Why Hetzner?

| Aspect | Vercel Serverless | Hetzner VPS |
|--------|------------------|-------------|
| Cold Starts | 2-5 seconds | **None** (always on) |
| Timeout Limits | 10s-300s | **Unlimited** |
| WebSocket Support | Limited | **Full support** |
| WebRTC Signaling | Stateless | **Persistent connections** |
| Cost | $20/month (Pro) | **~€5/month** |
| Control | Limited | **Full root access** |

---

## Prerequisites

### Server Requirements
- **OS:** Ubuntu 20.04+ or Debian 11+
- **RAM:** 2GB minimum (4GB recommended)
- **CPU:** 2 vCPU minimum
- **Storage:** 20GB minimum
- **Network:** Public IP address

### Recommended Hetzner Plan
- **Cloud CPX11:** €4.51/month
  - 2 vCPU AMD
  - 2GB RAM
  - 40GB NVMe
  - 20TB traffic

---

## Quick Start (30 minutes)

### Step 1: Server Setup (SSH)

```bash
# SSH into your Hetzner server
ssh root@your-server-ip

# Update system packages
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should be v18.x or higher
npm --version   # Should be v9.x or higher

# Install PM2 globally
npm install -g pm2

# Install Redis (for local caching)
apt install -y redis-server
systemctl enable redis
systemctl start redis

# Install Nginx
apt install -y nginx

# Install Git
apt install -y git

# Create application user (security best practice)
useradd -m -s /bin/bash voiceapp
```

---

### Step 2: Clone Repository

```bash
# Create application directory
mkdir -p /opt/voice-hotline-celo
cd /opt/voice-hotline-celo

# Clone repository
git clone https://github.com/sneldao/voice-agent-hotline.git .

# Set ownership
chown -R voiceapp:voiceapp /opt/voice-hotline-celo
```

---

### Step 3: Configure Environment

```bash
# Copy environment template
cp .env.hetzner.example .env.hetzner

# Edit configuration
nano .env.hetzner
```

**Required Variables:**
```bash
# Server
NODE_ENV=production
PORT=3000

# Celo
CELO_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_CELO_CHAIN_ID=42220

# Thirdweb
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=your_client_id
THIRDWEB_SECRET_KEY=your_secret_key

# WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# Redis (local)
REDIS_URL=redis://localhost:6379

# ElevenLabs
ELEVENLABS_API_KEY=your_api_key

# Payments are user-settled — no server-side keys needed
# Optional: Yellow Network state channels
NEXT_PUBLIC_YELLOW_SANDBOX_WS_URL=wss://clearnet-sandbox.yellow.com/ws
```

---

### Step 4: Install Dependencies & Build

```bash
# Switch to app user
su - voiceapp

# Navigate to app directory
cd /opt/voice-hotline-celo

# Install production dependencies
npm install --production

# Build application
npm run build

# Verify build
ls -la .next/standalone
```

---

### Step 5: Start with PM2

```bash
# Start application
pm2 start ecosystem.config.js

# Save PM2 configuration (auto-restart on reboot)
pm2 save

# Setup PM2 startup script
pm2 startup

# Copy the generated command and run it with sudo
# Example: sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u voiceapp --hp /home/voiceapp
```

**Verify Application:**
```bash
# Check status
pm2 status

# View logs
pm2 logs voice-hotline-celo

# Monitor in real-time
pm2 monit
```

---

### Step 6: Configure Nginx (Reverse Proxy)

```bash
# Copy Nginx configuration
cp /opt/voice-hotline-celo/scripts/nginx-voice-hotline.conf /etc/nginx/sites-available/voice-hotline

# Edit configuration (update your domain)
nano /etc/nginx/sites-available/voice-hotline

# Enable site
ln -s /etc/nginx/sites-available/voice-hotline /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

### Step 7: Setup SSL (Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is configured automatically
# Test renewal
certbot renew --dry-run
```

---

### Step 8: Firewall Configuration

```bash
# Install UFW (if not installed)
apt install -y ufw

# Allow SSH
ufw allow ssh

# Allow HTTP
ufw allow http

# Allow HTTPS
ufw allow https

# Enable firewall
ufw enable

# Check status
ufw status
```

---

## Deployment Automation

### Using Deploy Script

```bash
# From your local machine
cd voice-agent-hotline

# Run deployment script
./scripts/deploy-hetzner.sh your-server-ip root

# Example
./scripts/deploy-hetzner.sh 157.90.123.45 root
```

### Manual Update (Git Pull)

```bash
# SSH into server
ssh root@your-server-ip

# Navigate to app directory
cd /opt/voice-hotline-celo

# Pull latest changes
git pull origin main

# Install dependencies
npm install --production

# Rebuild
npm run build

# Restart application
pm2 restart voice-hotline-celo

# Verify
pm2 logs voice-hotline-celo --lines 50
```

---

## Monitoring & Maintenance

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs voice-hotline-celo

# Real-time monitoring
pm2 monit

# Restart application
pm2 restart voice-hotline-celo

# Stop application
pm2 stop voice-hotline-celo

# View detailed info
pm2 show voice-hotline-celo

# Scale instances (if needed)
pm2 scale voice-hotline-celo 4
```

### Log Files

```bash
# PM2 logs
tail -f /opt/voice-hotline-celo/logs/pm2-combined.log

# Nginx access logs
tail -f /var/log/nginx/voice-hotline-access.log

# Nginx error logs
tail -f /var/log/nginx/voice-hotline-error.log

# System logs
journalctl -u voice-hotline-celo -f
```

### Performance Monitoring

```bash
# Check memory usage
pm2 monit

# Check Redis memory
redis-cli INFO memory

# Check disk usage
df -h

# Check CPU usage
htop
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs voice-hotline-celo --err

# Check environment variables
cat .env.hetzner

# Test build
npm run build

# Check Node.js version
node --version
```

### Redis Connection Issues

```bash
# Check Redis status
systemctl status redis

# Test Redis connection
redis-cli ping  # Should return "PONG"

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

### Nginx Issues

```bash
# Test configuration
nginx -t

# Check Nginx status
systemctl status nginx

# View Nginx error logs
tail -f /var/log/nginx/error.log
```

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill process if needed
kill -9 <PID>

# Or change port in .env.hetzner
PORT=3001
```

---

## Backup & Recovery

### Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/voice-hotline"
DATE=$(date +%Y%m%d-%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup environment
cp .env.hetzner $BACKUP_DIR/env-$DATE.hetzner

# Backup PM2 configuration
pm2 save > $BACKUP_DIR/pm2-$DATE.dump

# Backup Redis data (if using local Redis)
redis-cli SAVE
cp /var/lib/redis/dump.rdb $BACKUP_DIR/redis-$DATE.rdb

# Create tarball
tar -czf $BACKUP_DIR/backup-$DATE.tar.gz \
    .next/standalone \
    public \
    package.json

# Keep only last 7 backups
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/backup-$DATE.tar.gz"
```

### Recovery

```bash
# Stop application
pm2 stop voice-hotline-celo

# Restore from backup
tar -xzf backup-20240101-120000.tar.gz -C /opt/voice-hotline-celo/

# Restore environment
cp env-20240101-120000.hetzner .env.hetzner

# Restart
pm2 start voice-hotline-celo
```

---

## Security Hardening

### 1. Firewall Rules

```bash
# Only allow necessary ports
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 2. SSH Hardening

```bash
# Edit SSH config
nano /etc/ssh/sshd_config

# Recommended settings:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3

# Restart SSH
systemctl restart sshd
```

### 3. Automatic Security Updates

```bash
# Install unattended-upgrades
apt install -y unattended-upgrades

# Enable automatic updates
dpkg-reconfigure -plow unattended-upgrades
```

### 4. Fail2Ban (Brute Force Protection)

```bash
# Install Fail2Ban
apt install -y fail2ban

# Create jail for Nginx
cat > /etc/fail2ban/jail.local << EOF
[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
EOF

# Start Fail2Ban
systemctl enable fail2ban
systemctl start fail2ban
```

---

## Performance Optimization

### 1. Redis Optimization

```bash
# Edit Redis config
nano /etc/redis/redis.conf

# Recommended settings:
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

### 2. Node.js Optimization

```bash
# Set NODE_OPTIONS for production
export NODE_OPTIONS="--max-old-space-size=1024 --optimize-for-size"

# Add to /etc/environment for persistence
echo 'NODE_OPTIONS="--max-old-space-size=1024"' >> /etc/environment
```

### 3. Nginx Optimization

```nginx
# Add to nginx.conf http block:
worker_processes auto;
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Buffer optimization
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
}
```

---

## Scaling

### Vertical Scaling (Upgrade Server)

1. Upgrade Hetzner plan in control panel
2. Reboot server
3. Increase PM2 instances: `pm2 scale voice-hotline-celo 4`
4. Increase Redis memory limit

### Horizontal Scaling (Multiple Servers)

```bash
# Load balancer configuration (Nginx)
upstream voice_hotline {
    least_conn;
    server server1-ip:3000;
    server server2-ip:3000;
    server server3-ip:3000;
}
```

---

## Cost Breakdown

| Resource | Monthly Cost |
|----------|-------------|
| Hetzner CPX11 | €4.51 |
| Domain (optional) | €1.00 |
| **Total** | **€5.51/month** |

**vs Vercel Pro: $20/month = Save ~€14/month**

---

## Support & Resources

- **Next.js Standalone Docs:** https://nextjs.org/docs/advanced-features/output-file-tracing
- **PM2 Documentation:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **Nginx Documentation:** https://nginx.org/en/docs/
- **Redis Documentation:** https://redis.io/documentation
- **Project Issues:** https://github.com/sneldao/voice-agent-hotline/issues

---

## Checklist

- [ ] Server provisioned on Hetzner
- [ ] Node.js 18+ installed
- [ ] PM2 installed globally
- [ ] Redis installed and running
- [ ] Nginx installed and configured
- [ ] SSL certificate obtained
- [ ] Firewall configured
- [ ] Application deployed and running
- [ ] Monitoring setup
- [ ] Backup script configured
- [ ] Security hardening completed

---

**Deployment Time:** 30-60 minutes  
**Difficulty:** Intermediate  
**Maintenance:** Low (automated updates, PM2 auto-restart)
