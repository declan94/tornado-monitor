# Tornado Monitor

A TypeScript-based health monitoring service for Tornado Cash Relayers' API endpoints. Monitors multiple networks (Ethereum, BSC) and sends alerts via Telegram when issues are detected.

## Features

- 🌐 **Multi-network monitoring** - Supports Ethereum and BSC Tornado APIs
- ⚡ **Real-time health checks** - Configurable intervals with timeout handling
- 🤖 **Telegram alerts** - Rich formatted notifications with emoji indicators
- 🛡️ **Smart validation** - Validates API structure, health status, and queue levels
- 🚫 **Alert throttling** - Prevents spam with configurable cooldown periods
- 📊 **Detailed logging** - Comprehensive status reporting with response times
- ⚙️ **Flexible configuration** - Per-network customization of all parameters

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm
- Telegram bot token (optional, for alerts)

### Installation

```bash
git clone <repository>
cd tornado-monitor
npm install
npm run build
```

### Basic Usage

```bash
# Use default configuration (auto-discovery)
npm start

# Use specific config file
npm start config.json
npm run start:config  # shortcut for config.json

# Development mode with hot reload
npm run dev
npm run dev:config    # with config.json

# Format code
npm run format

# Check formatting
npm run lint
```

## Configuration

### Configuration Files

The monitor uses JSON configuration files for easy customization. It automatically searches for config files in this order:

1. `./config.json`
2. `./config/networks.json` 
3. `./configs/tornado.json`
4. Path specified by `TORNADO_CONFIG_PATH` environment variable

If no config file is found, it uses built-in defaults for Ethereum and BSC networks.

### Quick Setup

Create a basic config file:

```bash
# Copy the simple example
cp config.simple.json config.json

# Or copy the full featured example  
cp config.example.json config.json

# Edit with your settings
nano config.json
```

### Configuration Structure

```json
{
  "networks": [
    {
      "apiUrl": "https://tornado.bitah.link/v1/status",
      "name": "Ethereum",
      "interval": 30000,
      "timeout": 10000,
      "maxQueue": 5,
      "maxConsecutiveFailures": 3
    }
  ],
  "defaults": {
    "interval": 30000,
    "timeout": 10000,
    "maxQueue": 3,
    "maxConsecutiveFailures": 3,
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID",
      "enabled": true
    }
  },
  "global": {
    "logLevel": "info",
    "enableHealthSummary": true,
    "healthSummaryInterval": 300000
  }
}
```

### Config Merging

Settings are merged in this priority order:
1. **Built-in defaults** (lowest priority)
2. **File defaults** section
3. **Network-specific** settings
4. **Environment variables** (highest priority)

### Programmatic Configuration

You can also configure monitors programmatically:

```typescript
import { TornadoHealthMonitor, ConfigLoader } from "./dist/index.js";

// Load from custom path
const config = ConfigLoader.loadConfig("./my-config.json");

// Or create a monitor directly
const monitor = new TornadoHealthMonitor({
  apiUrl: "https://your-tornado-api.com/v1/status",
  name: "Custom Network",
  interval: 60000,
  timeout: 15000,
  maxQueue: 5,
  maxConsecutiveFailures: 2
});

await monitor.start();
```

## Telegram Setup

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Save the bot token provided

### 2. Get Your Chat ID

**For personal messages:**
1. Message your bot directly
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find the `chat.id` field in the response

**For group/channel:**
1. Add the bot to your group/channel
2. Send a message mentioning the bot
3. Visit the same URL and find the group's chat ID (usually negative)

### 3. Configure Telegram Alerts

**Option 1: Environment Variables (Recommended)**
```bash
export TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_CHAT_ID="-1001234567890"
export TELEGRAM_ENABLED="true"
```

**Option 2: Config File**
```json
{
  "networks": [...],
  "defaults": {
    "telegram": {
      "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
      "chatId": "-1001234567890",
      "enabled": true
    }
  }
}
```

**Option 3: Per-Network Config**
```json
{
  "networks": [
    {
      "apiUrl": "https://tornado.bitah.link/v1/status",
      "name": "Ethereum",
      "telegram": {
        "botToken": "your_bot_token",
        "chatId": "your_chat_id",
        "enabled": true
      }
    }
  ]
}
```

### Alert Types & Throttling

The monitor sends different alerts with appropriate emojis:

- 🔴 **API Failures** - Connection errors, HTTP errors
- 🟡 **Health Issues** - API reports unhealthy status
- ⚠️ **High Queue** - Transaction queue exceeds threshold
- 🚨 **General Alerts** - Other monitoring issues

**Burst Throttling:** Allows up to 3 alerts immediately for rapid issue detection, then applies 5-minute throttling between subsequent alerts. Burst counter resets after 15 minutes of no alerts.

### Testing Telegram Alerts

Test your Telegram configuration before deploying:

```bash
# Build the project first
npm run build

# Test alerts with your config
npm run test:alert
```

The test will:
- Load your configuration (file or environment variables)
- Test connection to Telegram
- Send sample alerts of different types
- Demonstrate burst throttling behavior
- Show helpful error messages if misconfigured

## API Validation

The monitor validates several key fields:

### Required Fields
- `health.status` - Must be "true"
- `currentQueue` - Must be ≤ `maxQueue` 
- `rewardAccount` - Valid address
- `netId` - Network ID number
- `version` - API version string
- `instances` - Token instances object

### Health Conditions

A network is considered **healthy** when:
1. ✅ API responds within timeout
2. ✅ Response structure is valid
3. ✅ `health.status === "true"`
4. ✅ `currentQueue <= maxQueue`

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | string | Required | Tornado API endpoint |
| `name` | string | "Unknown" | Network name for logging |
| `interval` | number | 30000 | Check interval (ms) |
| `timeout` | number | 10000 | Request timeout (ms) |
| `maxQueue` | number | 3 | Queue threshold for alerts |
| `maxConsecutiveFailures` | number | 3 | Failures before alerting |
| `telegram.botToken` | string | - | Telegram bot token |
| `telegram.chatId` | string | - | Telegram chat/group ID |
| `telegram.enabled` | boolean | false | Enable Telegram alerts |

## Configuration File Priority

The monitor loads configuration in this order:

1. Path specified by `TORNADO_CONFIG_PATH` environment variable (highest priority)
2. `./config.json`
3. `./config/networks.json`
4. `./configs/tornado.json`  
5. Built-in defaults (fallback)

Settings are merged: **defaults** → **file defaults** → **network-specific** settings.

## Development

### Project Structure

```
src/
├── index.ts      # Main monitor classes
├── types.ts      # TypeScript interfaces 
├── telegram.ts   # Telegram alert sender
└── ...

dist/             # Compiled JavaScript
package.json      # Dependencies and scripts
tsconfig.json     # TypeScript configuration
.prettierrc       # Code formatting rules
```

### Available Scripts

```bash
# Development
npm run dev              # Development with tsx hot reload
npm run dev:config       # Development with config.json

# Production
npm run build            # Compile TypeScript to dist/
npm start                # Run with auto-discovered config
npm start config.json    # Run with specific config file  
npm run start:config     # Run with config.json

# Testing
npm run test:alert       # Test Telegram alerts with config

# Code Quality
npm run format           # Auto-format code with Prettier
npm run lint             # Check code formatting

# Configuration
npm run config:create    # Generate example config.json
```

### Building

```bash
npm run build
```

Compiles TypeScript to the `dist/` directory with source maps and declarations.

## Error Handling

The monitor includes comprehensive error handling:

- **Network Errors** - Connection timeouts, DNS failures
- **HTTP Errors** - 4xx/5xx status codes
- **JSON Parsing** - Invalid response format
- **Validation Errors** - Missing or invalid API fields
- **Telegram Errors** - Alert delivery failures

All errors are logged with timestamps and response times.

## Alert Throttling

To prevent alert spam:

- **Cooldown Period**: 5 minutes between identical alerts
- **Per-Network**: Separate throttling for each monitored network
- **Message-Based**: Same alert message won't repeat within cooldown
- **Configurable**: Adjust cooldown via `setAlertInterval(minutes)`

## Production Deployment

### PM2 Process Manager (Recommended)

The easiest way to deploy Tornado Monitor in production is using PM2 with the included deployment script.

#### Quick Deployment

```bash
# 1. Clone and build
git clone <your-repo>
cd tornado-monitor
npm install
npm run build

# 2. Configure monitoring
cp config.example.json config.json
# Edit config.json with your Telegram bot token and chat ID

# 3. Deploy with PM2
./deploy-pm2.sh production
```

#### What the deployment script does:

- ✅ Installs PM2 if not present
- ✅ Validates configuration and tests alerts
- ✅ Sets up logging and auto-restart
- ✅ Configures system startup
- ✅ Provides status monitoring

#### PM2 Management Commands

```bash
# Check status
pm2 status tornado-monitor

# View logs
pm2 logs tornado-monitor

# Restart application
pm2 restart tornado-monitor

# Stop application
pm2 stop tornado-monitor

# Monitor dashboard
pm2 monit

# Reload with zero downtime
pm2 reload tornado-monitor
```

#### Configuration File

All configuration is done through the `config.json` file. Copy and edit the example:

```bash
cp config.example.json config.json
# Edit config.json with your settings
```

#### Server Requirements

- **Node.js 18+**
- **npm** or **yarn**
- **PM2** (installed automatically by deploy script)
- **Git** (for deployment)

#### Deployment Features

- **Auto-restart** on failures or crashes
- **Memory monitoring** with automatic restart at 1GB
- **Log rotation** with timestamped entries
- **Health checks** and monitoring
- **Graceful shutdown** handling
- **System startup** integration
- **Daily restart** scheduling (3 AM)
- **Configuration backup** before deployment

## Troubleshooting

### Common Issues

**Configuration not loading:**
1. Check config file exists and has valid JSON syntax
2. Verify file permissions are readable
3. Check console for config loading messages
4. Use `TORNADO_CONFIG_PATH` env var for custom paths

**Telegram alerts not working:**
1. Run `npm run test:alert` to diagnose issues
2. Verify bot token and chat ID are correct
3. Check environment variables vs config file priority
4. Ensure bot has permission to send messages  
5. Look for "Telegram connection: ✅ OK" on startup
6. Send a message to your bot first to initialize the chat

**API validation failing:**
1. Check API endpoints are accessible
2. Verify network connectivity and DNS
3. Review API response structure changes
4. Check timeout settings for slow responses

**Configuration not working:**
1. Verify config.json syntax is valid JSON
2. Check file path and permissions
3. Use absolute paths for custom config locations
4. Verify all required fields are present

### Debug Mode

Enable verbose logging by modifying the console.log statements or adding a debug flag.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run format` and `npm run lint`
5. Submit a pull request

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the configuration examples