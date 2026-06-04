#!/bin/bash
# ================================================
# Backend-Only Deployment Script
# For Hetzner VPS / API Server
# ================================================
# The frontend is deployed separately on Vercel.
# This script only deploys the API backend.
#
# Usage:
#   ./scripts/deploy-backend.sh [ssh-alias-or-ip] [user]
# ================================================

set -e

SERVER_INPUT=${1:-""}
SERVER_USER=${2:-"root"}

if [[ "$SERVER_INPUT" == *"."* ]] || [[ "$SERVER_INPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    SERVER_SSH="$SERVER_USER@$SERVER_INPUT"
else
    SERVER_SSH="$SERVER_INPUT"
fi

APP_NAME="voice-hotline"
REMOTE_DIR="/opt/$APP_NAME"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

if [ -z "$SERVER_INPUT" ]; then
    log_error "Server SSH alias or IP is required"
    echo "Usage: $0 [ssh-alias-or-ip] [user]"
    exit 1
fi

log_info "Deploying backend to $SERVER_SSH..."

# Deploy via SSH
ssh "$SERVER_SSH" << ENDSSH
    set -e
    
    # Create directory if needed
    mkdir -p $REMOTE_DIR
    cd $REMOTE_DIR
    
    # Clone/pull from git if not already
    if [ ! -d .git ]; then
        log_info "Cloning repository..."
        git clone https://github.com/sneldao/voice-agent-hotline.git .
    else
        log_info "Pulling latest changes..."
        git fetch origin
        git reset --hard origin/main
    fi
    
    # Setup environment file if not exists
    if [ ! -f .env.local ]; then
        if [ -f .env.backend ]; then
            cp .env.backend .env.local
            log_warn "Please configure .env.local with your actual values"
        fi
    fi
    
    # Install only production dependencies
    log_info "Installing dependencies..."
    npm ci --production=false
    
    # Build the application
    log_info "Building..."
    npm run build
    
    # Restart PM2
    log_info "Restarting PM2..."
    pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js
    pm2 save
    
    # Clean up old logs (keep last 7 days)
    find ./logs -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    log_info "Backend deployment complete!"
ENDSSH

log_info "✅ Backend deployed successfully!"
echo ""
echo "Check status: ssh $SERVER_SSH 'pm2 logs $APP_NAME'"
