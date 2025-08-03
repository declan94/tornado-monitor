#!/bin/bash

# Tornado Monitor PM2 Deployment Script
# Usage: ./deploy-pm2.sh [environment]
# Environment: production (default) or development

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${1:-production}
DRY_RUN=false
APP_NAME="tornado-monitor"
LOG_DIR="./logs"
BACKUP_DIR="./backups"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            ENVIRONMENT="--help"
            shift
            ;;
        production|development)
            ENVIRONMENT=$1
            shift
            ;;
        *)
            # Ignore unknown arguments
            shift
            ;;
    esac
done

# Set default environment if not specified
if [[ "$ENVIRONMENT" != "production" && "$ENVIRONMENT" != "development" && "$ENVIRONMENT" != "--help" ]]; then
    ENVIRONMENT="production"
fi

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
        sudo npm install -g pm2
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
    
    # Always install all dependencies for building
    npm ci
    
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
    
    # Check if config file exists
    if [ ! -f "config.json" ]; then
        log_warning "No config.json found"
        log_info "Creating example config file..."
        cp config.example.json config.json
        log_warning "Please edit config.json with your actual Telegram configuration"
        return 1
    fi
    
    # Test Telegram connection only
    log_info "Testing Telegram connection..."
    if node -e "
        import('./dist/config.js').then(({ ConfigLoader }) => {
            const config = ConfigLoader.loadConfig();
            const networkWithTelegram = config.networks.find(n => n.telegram && n.telegram.enabled);
            if (!networkWithTelegram) {
                console.log('No Telegram configuration found');
                process.exit(1);
            }
            import('./dist/telegram.js').then(({ TelegramAlertSender }) => {
                const sender = new TelegramAlertSender(networkWithTelegram.telegram);
                sender.testConnection().then(result => {
                    process.exit(result ? 0 : 1);
                }).catch(() => process.exit(1));
            });
        }).catch(() => process.exit(1));
    " > /dev/null 2>&1; then
        log_success "Telegram connection test passed"
    else
        log_warning "Telegram connection test failed - alerts may not work"
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
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would deploy with PM2..."
        log_info "[DRY RUN] Would stop existing $APP_NAME process if running"
        log_info "[DRY RUN] Would start $APP_NAME with: pm2 start ecosystem.config.cjs --env $ENVIRONMENT"
        log_info "[DRY RUN] Would save PM2 configuration"
        log_info "[DRY RUN] Would set up PM2 startup script"
        log_success "[DRY RUN] PM2 deployment simulation completed"
        return
    fi
    
    log_info "Deploying with PM2..."
    
    # Stop existing process if running
    if pm2 list | grep -q "$APP_NAME"; then
        log_info "Stopping existing $APP_NAME process..."
        pm2 stop "$APP_NAME" || true
        pm2 delete "$APP_NAME" || true
    fi
    
    # Start the application
    log_info "Starting $APP_NAME with PM2..."
    pm2 start ecosystem.config.cjs --env "$ENVIRONMENT"
    
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

# Show usage
show_usage() {
    echo "Tornado Monitor PM2 Deployment Script"
    echo ""
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments:"
    echo "  production    Deploy in production mode (default)"
    echo "  development   Deploy in development mode"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo "  --dry-run     Simulate deployment without making changes"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy in production mode"
    echo "  $0 production        # Deploy in production mode"
    echo "  $0 development       # Deploy in development mode"
    echo "  $0 --dry-run         # Simulate deployment"
    echo "  $0 production --dry-run  # Simulate production deployment"
    echo ""
    echo "The script will:"
    echo "  - Check prerequisites and install PM2 if needed"
    echo "  - Build the project"
    echo "  - Validate configuration"
    echo "  - Deploy with PM2"
    echo "  - Set up auto-start on system boot"
}

# Main deployment flow
main() {
    # Check for help flag
    if [[ "$ENVIRONMENT" == "--help" || "$ENVIRONMENT" == "-h" ]]; then
        show_usage
        exit 0
    fi
    
    log_info "🚀 Starting Tornado Monitor PM2 Deployment"
    log_info "Environment: $ENVIRONMENT"
    if [ "$DRY_RUN" = true ]; then
        log_warning "DRY RUN MODE - No actual changes will be made"
    fi
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