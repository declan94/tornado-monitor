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

## Environment Variables

Override any configuration setting with environment variables:

```bash
# Telegram Configuration
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id" 
export TELEGRAM_ENABLED="true"

# Monitor Settings (applied to all networks)
export MONITOR_INTERVAL="60"          # seconds
export MONITOR_TIMEOUT="15"           # seconds  
export MAX_QUEUE="5"                  # queue threshold
export MAX_FAILURES="2"               # consecutive failures

# Config File Path
export TORNADO_CONFIG_PATH="/path/to/config.json"
```

Environment variables have the highest priority and will override config file settings.

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

### Environment Variables

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"
```

### Docker Example

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ ./dist/
CMD ["npm", "start"]
```

### Process Management

Use PM2 or similar for production:

```bash
npm install -g pm2
pm2 start dist/index.js --name tornado-monitor
pm2 startup
pm2 save
```

## Troubleshooting

### Common Issues

**Configuration not loading:**
1. Check config file exists and has valid JSON syntax
2. Verify file permissions are readable
3. Check console for config loading messages
4. Use `TORNADO_CONFIG_PATH` env var for custom paths

**Telegram alerts not working:**
1. Verify bot token and chat ID are correct
2. Check environment variables vs config file priority
3. Ensure bot has permission to send messages  
4. Look for "Telegram connection: ✅ OK" on startup

**API validation failing:**
1. Check API endpoints are accessible
2. Verify network connectivity and DNS
3. Review API response structure changes
4. Check timeout settings for slow responses

**Environment variables not working:**
1. Restart application after setting env vars
2. Verify variable names match exactly (case-sensitive)
3. Check if config file values are overriding env vars

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