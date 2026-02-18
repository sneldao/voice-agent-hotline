#!/bin/bash
# ================================================
# Voice Agent Hotline - Hetzner Deployment Script
# ================================================
# 
# Automates deployment to Hetzner VPS
# 
# Prerequisites:
#   - SSH access to Hetzner server
#   - PM2 installed globally on server
#   - Node.js 18+ installed on server
#
# Usage:
#   ./scripts/deploy-hetzner.sh [ssh-alias-or-ip] [user]
#
# Examples:
#   ./scripts/deploy-hetzner.sh snel-bot root       # Using SSH alias
#   ./scripts/deploy-hetzner.sh 157.90.123.45 root  # Using IP
# ================================================

set -e  # Exit on error

# Configuration
SERVER_INPUT=${1:-""}
SERVER_USER=${2:-"root"}

# Determine if input is SSH alias or IP
if [[ "$SERVER_INPUT" == *"."* ]] || [[ "$SERVER_INPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # It's an IP address
    SERVER_SSH="$SERVER_USER@$SERVER_INPUT"
else
    # It's an SSH alias (use as-is, user typically configured in ~/.ssh/config)
    SERVER_SSH="$SERVER_INPUT"
fi

APP_NAME="voice-hotline-celo"
REMOTE_DIR="/opt/$APP_NAME"
LOCAL_BUILD_DIR=".next/standalone"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if [ -z "$SERVER_INPUT" ]; then
        log_error "Server SSH alias or IP is required"
        echo "Usage: $0 [ssh-alias-or-ip] [user]"
        echo "Examples:"
        echo "  $0 snel-bot root"
        echo "  $0 157.90.123.45 root"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    if ! command -v ssh &> /dev/null; then
        log_error "ssh is not installed"
        exit 1
    fi
    
    # Test SSH connection
    log_info "Testing SSH connection to $SERVER_SSH..."
    if ! ssh "$SERVER_SSH" "echo 'SSH connection successful'" &> /dev/null; then
        log_error "Cannot connect to $SERVER_SSH via SSH"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

# Build the application
build_application() {
    log_info "Building application..."
    
    # Install dependencies
    npm install
    
    # Create deployment package WITHOUT building
    # (Server will build with proper env vars)
    log_info "Creating deployment package..."
    
    tar --exclude='node_modules' --exclude='.next' --exclude='deploy.tar.gz' -czf deploy.tar.gz \
        app/ \
        lib/ \
        components/ \
        public/ \
        scripts/ \
        docs/ \
        contracts/ \
        package.json \
        package-lock.json \
        ecosystem.config.js \
        next.config.js \
        tsconfig.json \
        tailwind.config.js \
        postcss.config.js \
        .env.hetzner.example
    
    log_info "Deployment package created: deploy.tar.gz"
    log_info "Server will build with proper environment variables"
    
    # Skip local build, server will build
    return 0
}

# Create deployment package (already done in build_application)
create_package() {
    log_info "Deployment package already created"
}

# Deploy to server
deploy_to_server() {
    log_info "Deploying to $SERVER_SSH:$REMOTE_DIR..."
    
    # Create remote directory if it doesn't exist
    ssh "$SERVER_SSH" "mkdir -p $REMOTE_DIR"
    
    # Copy deployment package
    scp deploy.tar.gz "$SERVER_SSH:/tmp/deploy.tar.gz"
    
    # Extract and setup on server
    ssh "$SERVER_SSH" << 'ENDSSH'
        set -e
        cd $REMOTE_DIR
        
        # Create current directory if it doesn't exist
        mkdir -p current
        
        # Backup current deployment
        if [ -d "current" ] && [ "$(ls -A current)" ]; then
            cp -r current backup-$(date +%Y%m%d-%H%M%S)
        fi
        
        # Extract new deployment
        rm -rf current/*
        tar -xzf /tmp/deploy.tar.gz -C current/
        
        cd current
        
        # Install production dependencies
        npm install --production
        
        # Setup environment file
        if [ ! -f .env.hetzner ]; then
            cp .env.hetzner.example .env.hetzner
            echo "⚠️  Please configure .env.hetzner manually"
        fi
        
        # Build on server (with proper env vars)
        echo "Building on server..."
        npm run build
        
        # Restart application with PM2
        pm2 restart $APP_NAME || pm2 start ecosystem.config.js
        pm2 save
        
        # Cleanup
        rm /tmp/deploy.tar.gz
        
        echo "✅ Application deployed successfully"
ENDSSH
    
    log_info "Application deployed. Now setting up Nginx..."
    
    # Setup Nginx (if not already configured)
    setup_nginx || log_warn "Nginx setup skipped. Run manually later."
    
    log_info "Deployment completed"
}

# Setup Nginx reverse proxy
setup_nginx() {
    log_info "Setting up Nginx reverse proxy..."
    
    # Check if Nginx is installed
    if ! ssh "$SERVER_SSH" "command -v nginx &> /dev/null"; then
        log_warn "Nginx not installed. Installing..."
        ssh "$SERVER_SSH" "apt update && apt install -y nginx"
    fi
    
    # Copy Nginx config
    ssh "$SERVER_SSH" << 'ENDSSH'
        # Copy config if it doesn't exist
        if [ ! -f /etc/nginx/sites-available/voice-hotline ]; then
            cp /opt/voice-hotline-celo/scripts/nginx-voice-hotline.conf /etc/nginx/sites-available/voice-hotline
            echo "Nginx config copied. Edit /etc/nginx/sites-available/voice-hotline to set your domain."
        fi
        
        # Enable site if not already enabled
        if [ ! -f /etc/nginx/sites-enabled/voice-hotline ]; then
            ln -s /etc/nginx/sites-available/voice-hotline /etc/nginx/sites-enabled/
        fi
        
        # Test and reload
        nginx -t && systemctl reload nginx
        
        echo "✅ Nginx configured"
ENDSSH
    
    # SSL setup prompt
    log_info "Setup SSL with Let's Encrypt?"
    log_info "Run: ssh $SERVER_SSH 'certbot --nginx -d voisss.celo.famile.xyz'"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    ssh "$SERVER_SSH" << 'ENDSSH'
        pm2 status $APP_NAME
        pm2 logs $APP_NAME --lines 10 --nostream
ENDSSH
    
    log_info "Deployment verification completed"
}

# Cleanup local files
cleanup() {
    log_info "Cleaning up..."
    rm -f deploy.tar.gz
    log_info "Cleanup completed"
}

# Main deployment process
main() {
    log_info "Starting deployment to Hetzner VPS..."
    echo "Server: $SERVER_SSH"
    echo "App: $APP_NAME"
    echo "Remote: $REMOTE_DIR"
    echo ""
    
    check_prerequisites
    build_application
    create_package
    deploy_to_server
    verify_deployment
    cleanup
    
    log_info "✅ Deployment completed successfully!"
    echo ""
    echo "Next steps:"
    echo "  1. SSH into server: ssh $SERVER_SSH"
    echo "  2. Check logs: pm2 logs $APP_NAME"
    echo "  3. Monitor: pm2 monit"
    echo "  4. Configure .env.hetzner on server"
    echo "  5. Rebuild: cd /opt/voice-hotline-celo && npm run build && pm2 restart"
    echo "  6. View app: http://157.180.36.156:3000"
}

# Run main function
main
