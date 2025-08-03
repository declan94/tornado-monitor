#!/bin/bash

# Tornado Monitor PM2 Deployment Script
# Usage: ./deploy-pm2.sh [environment]
# Environment: production (default) or development

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="tornado-monitor"
LOG_DIR="./logs"
BACKUP_DIR="./backups"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js version 18+ required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check if PM2 is installed globally
    if ! command -v pm2 &> /dev/null; then
        log_warning "PM2 is not installed globally. Installing PM2..."
        npm install -g pm2
        log_success "PM2 installed successfully"
    fi
    
    log_success "Prerequisites check completed"
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKUP_DIR"
    
    log_success "Directories created"
}

# Backup existing configuration
backup_config() {
    if [ -f "config.json" ]; then
        log_info "Backing up existing configuration..."
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        cp config.json "$BACKUP_DIR/config_$TIMESTAMP.json"
        log_success "Configuration backed up to $BACKUP_DIR/config_$TIMESTAMP.json"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [ "$ENVIRONMENT" == "production" ]; then
        npm ci --only=production
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Build the project
build_project() {
    log_info "Building project..."
    npm run build
    log_success "Project built successfully"
}

# Validate configuration
validate_config() {
    log_info "Validating configuration..."
    
    # Check if config file exists or environment variables are set
    if [ ! -f "config.json" ] && [ -z "$TELEGRAM_BOT_TOKEN" ]; then
        log_warning "No config.json found and TELEGRAM_BOT_TOKEN not set"
        log_info "Creating example config file..."
        cp config.example.json config.json
        log_warning "Please edit config.json with your actual configuration"
        return 1
    fi
    
    # Test the configuration
    log_info "Testing configuration..."
    if npm run test:alert > /dev/null 2>&1; then
        log_success "Configuration test passed"
    else
        log_warning "Configuration test failed - alerts may not work properly"
        log_info "Continue with deployment? [y/N]"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            log_error "Deployment cancelled"
            exit 1
        fi
    fi
}

# Deploy with PM2
deploy_pm2() {
    log_info "Deploying with PM2..."
    
    # Stop existing process if running
    if pm2 list | grep -q "$APP_NAME"; then
        log_info "Stopping existing $APP_NAME process..."
        pm2 stop "$APP_NAME" || true
        pm2 delete "$APP_NAME" || true
    fi
    
    # Start the application
    log_info "Starting $APP_NAME with PM2..."
    pm2 start ecosystem.config.js --env "$ENVIRONMENT"
    
    # Save PM2 configuration
    pm2 save
    
    # Setup PM2 startup script (requires sudo on first run)
    if ! pm2 startup | grep -q "PM2 startup"; then
        log_info "Setting up PM2 startup script..."
        log_warning "You may need to run the following command with sudo:"
        pm2 startup | tail -1
    fi
    
    log_success "PM2 deployment completed"
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo "===================="
    
    # PM2 status
    pm2 status "$APP_NAME"
    
    echo ""
    log_info "Recent logs:"
    pm2 logs "$APP_NAME" --lines 10 --nostream || true
    
    echo ""
    log_info "Useful PM2 commands:"
    echo "  pm2 status                    - Show all processes"
    echo "  pm2 logs $APP_NAME           - Show logs"
    echo "  pm2 monit                     - Show monitoring dashboard"
    echo "  pm2 restart $APP_NAME        - Restart application"
    echo "  pm2 stop $APP_NAME           - Stop application"
    echo "  pm2 reload $APP_NAME         - Reload application (zero downtime)"
}

# Handle script interruption
cleanup() {
    log_warning "Deployment interrupted"
    exit 1
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Main deployment flow
main() {
    log_info "🚀 Starting Tornado Monitor PM2 Deployment"
    log_info "Environment: $ENVIRONMENT"
    echo "============================================"
    
    check_prerequisites
    setup_directories
    backup_config
    install_dependencies
    build_project
    
    if validate_config; then
        deploy_pm2
        show_status
        
        echo ""
        log_success "🎉 Deployment completed successfully!"
        log_info "Monitor is now running with PM2"
        log_info "Check logs with: pm2 logs $APP_NAME"
    else
        log_error "Configuration validation failed"
        log_info "Please fix configuration issues and try again"
        exit 1
    fi
}

# Run main function
main "$@"