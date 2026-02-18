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
#   ./scripts/deploy-hetzner.sh [server-ip] [user]
#
# Example:
#   ./scripts/deploy-hetzner.sh 157.90.123.45 root
# ================================================

set -e  # Exit on error

# Configuration
SERVER_IP=${1:-""}
SERVER_USER=${2:-"root"}
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
    
    if [ -z "$SERVER_IP" ]; then
        log_error "Server IP is required"
        echo "Usage: $0 [server-ip] [user]"
        echo "Example: $0 157.90.123.45 root"
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
    
    log_info "Prerequisites check passed"
}

# Build the application
build_application() {
    log_info "Building application..."
    
    # Install dependencies
    npm ci --only=production
    
    # Build Next.js with standalone output
    npm run build
    
    log_info "Build completed successfully"
}

# Create deployment package
create_package() {
    log_info "Creating deployment package..."
    
    # Create deployment tarball
    tar -czf deploy.tar.gz \
        .next/standalone \
        .next/static \
        public \
        package.json \
        package-lock.json \
        ecosystem.config.js \
        next.config.js \
        --exclude='node_modules'
    
    log_info "Deployment package created: deploy.tar.gz"
}

# Deploy to server
deploy_to_server() {
    log_info "Deploying to $SERVER_USER@$SERVER_IP:$REMOTE_DIR..."
    
    # Create remote directory if it doesn't exist
    ssh $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_DIR"
    
    # Copy deployment package
    scp deploy.tar.gz $SERVER_USER@$SERVER_IP:/tmp/deploy.tar.gz
    
    # Extract and setup on server
    ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
        set -e
        cd $REMOTE_DIR
        
        # Backup current deployment
        if [ -d "current" ]; then
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
            echo "Please configure .env.hetzner manually"
        fi
        
        # Restart application with PM2
        pm2 restart $APP_NAME || pm2 start ecosystem.config.js
        pm2 save
        
        # Cleanup
        rm /tmp/deploy.tar.gz
        
        echo "Deployment completed successfully"
ENDSSH
    
    log_info "Deployment completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
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
    echo "Server: $SERVER_USER@$SERVER_IP"
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
    echo "  1. SSH into server: ssh $SERVER_USER@$SERVER_IP"
    echo "  2. Check logs: pm2 logs $APP_NAME"
    echo "  3. Monitor: pm2 monit"
    echo "  4. View app: http://$SERVER_IP:3000"
}

# Run main function
main
