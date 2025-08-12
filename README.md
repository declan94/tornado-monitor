# Tornado Monitor

A comprehensive TypeScript-based monitoring service for Tornado Cash infrastructure. Monitors API endpoint health across multiple networks and tracks StakeBurned events on the blockchain.

## Features

### Health Monitoring
- 🌐 **Multi-network monitoring** - Supports Ethereum, BSC, Polygon and custom Tornado APIs
- ⚡ **Real-time health checks** - Configurable intervals with timeout handling
- 🤖 **Telegram alerts** - Rich formatted notifications with emoji indicators
- 🛡️ **Smart validation** - Validates API structure, health status, and queue levels
- 🚫 **Alert throttling** - Prevents spam with configurable cooldown periods
- 📊 **Detailed logging** - Comprehensive status reporting with response times

### StakeBurned Event Monitoring
- 🔥 **Real-time blockchain monitoring** - Listen for StakeBurned events
- 🗄️ **Database storage** - Persistent MySQL storage for events
- 📈 **Historical sync** - Fetch and store past events automatically
- 🎯 **Relayer filtering** - Monitor specific relayers or all relayers
- 🔍 **Duplicate prevention** - Automatic handling of duplicate events
- 💰 **Price integration** - Automatically fetches TORN price for each event
- 📊 **Database queries** - View stored events through database queries

### TORN Price Monitoring
- 💰 **Real-time price tracking** - Monitor TORN token price in ETH
- 📊 **Price change alerts** - Configurable percentage change thresholds with smart alert tracking
- 🚨 **Price threshold alerts** - Alerts for high/low price levels
- 🤖 **Telegram notifications** - Rich formatted price alerts
- 📈 **Historical price data** - Stores price data with StakeBurned events
- 🔄 **Dynamic config reloading** - Update thresholds without restart
- 🎯 **Smart alert management** - Prevents spam by tracking last alert price for percentage changes

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm
- MySQL database (for StakeBurned monitoring)
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

### New Configuration Structure

The monitor now supports three services in a single configuration file with clear separation:

```json
{
  "global": {
    "logLevel": "info"
  },
  "healthMonitoring": {
    "enabled": true,
    "networks": [...],
    "defaults": {...},
    "enableHealthSummary": true,
    "healthSummaryInterval": 300000
  },
  "stakeBurnedListener": {
    "enabled": true,
    "rpcUrl": "...",
    "contractAddress": "...",
    "relayerAddresses": [...],
    "historicalBlocks": 1000,
    "database": {...}
  },
  "tornPriceMonitor": {
    "enabled": true,
    "interval": 300,
    "priceChangeThreshold": 5,
    "priceThresholds": {
      "high": 0.01,
      "low": 0.005
    },
    "telegram": {...}
  }
}
```

### Service Configuration

#### Health Monitoring Service

```json
{
  "healthMonitoring": {
    "enabled": true,
    "networks": [
      {
        "apiUrl": "https://tornado.bitah.link/v1/status",
        "name": "Ethereum",
        "interval": 30,
        "timeout": 10,
        "maxQueue": 5,
        "maxConsecutiveFailures": 3,
        "telegram": {
          "botToken": "YOUR_BOT_TOKEN",
          "chatId": "YOUR_CHAT_ID",
          "enabled": true
        }
      }
    ],
    "defaults": {
      "interval": 30,
      "timeout": 10,
      "maxQueue": 3,
      "maxConsecutiveFailures": 3
    },
    "enableHealthSummary": true,
    "healthSummaryInterval": 300
  }
}
```

#### StakeBurned Event Monitoring

```json
{
  "stakeBurnedListener": {
    "enabled": true,
    "rpcUrl": "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
    "contractAddress": "0x5Ef8B60fE7cF3eE5F3F12c20E27FFfCdcE14C0D5",
    "relayerAddresses": [
      "0x742d35Cc619C4b8fE28262b67F0b16f2f2C1E2b6",
      "0x03893a7c7463AE47D46bc7f091665f1893656003"
    ],
    "historicalBlocks": 1000,
    "database": {
      "host": "localhost",
      "port": 3306,
      "user": "tornado_monitor",
      "password": "YOUR_DB_PASSWORD",
      "database": "tornado_events"
    }
  }
}
```

#### TORN Price Monitor

```json
{
  "tornPriceMonitor": {
    "enabled": true,
    "interval": 300,
    "priceChangeThreshold": 5,
    "priceThresholds": {
      "high": 0.01,
      "low": 0.005
    },
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN",
      "chatId": "YOUR_CHAT_ID",
      "enabled": true
    }
  }
}
```

### Service Control

All three services can be enabled independently:

- **Health Monitoring Only**: Include only `healthMonitoring` section
- **StakeBurned Monitoring Only**: Include only `stakeBurnedListener` section  
- **TORN Price Monitoring Only**: Include only `tornPriceMonitor` section
- **Multiple Services**: Include any combination of sections in the same config file
- **Disable Services**: Set `enabled: false` in any service section, or omit the section entirely

### Configuration Files

The monitor uses JSON configuration files for easy customization. It automatically searches for config files in this order:

1. `./config.json`
2. `./config/networks.json` 
3. `./configs/tornado.json`
4. Path specified by `TORNADO_CONFIG_PATH` environment variable

If no config file is found, it uses built-in defaults for health monitoring only.

### Dynamic Configuration Reloading

The monitor automatically watches the configuration file for changes and reloads settings without requiring a restart:

- **🔄 Auto-reload**: Configuration file is monitored for changes every 1 second
- **⚡ Live updates**: TORN price monitoring settings update immediately
- **🛡️ Error handling**: Invalid configurations are rejected, keeping current settings
- **📊 Debouncing**: Rapid file changes are debounced to prevent excessive reloads

**Supported Dynamic Updates:**
- ✅ TORN price monitoring thresholds and intervals
- ✅ Telegram configuration for price alerts
- ✅ Enable/disable price monitoring service
- ℹ️ Health monitoring changes require restart
- ℹ️ StakeBurned listener changes require restart

**Usage:**
Simply edit your config file while the service is running. You'll see reload messages in the logs:
```
📝 Config file changed, reloading...
🔄 Updating TORN price monitor configuration...
📊 Price check interval updated: 300s → 60s
✅ Configuration reloaded successfully
📱 Config update notification sent to Telegram
```

**Telegram Notifications:**
When you update the config file, you'll automatically receive Telegram notifications showing exactly what changed:

```
🔄 *TORN Price Monitor Config Updated*
*Time:* 2024-01-15 10:30:45 UTC
*Monitoring interval:* 300s → 60s
*Price change alert:* 5% → 10%
*High price alert:* 0.01 ETH → 0.015 ETH
```

Service start/stop notifications are also sent when enabling/disabling via config:
```
✅ *TORN Price Monitor Started*
*Time:* 2024-01-15T10:30:45.123Z
*Current Price:* `0.003456 ETH`
*Monitor Interval:* 60s
*Price Change Alert:* ±10%
*High Threshold:* 0.015 ETH
*Low Threshold:* 0.005 ETH
```

**Price Alert Notifications:**
When price thresholds are crossed or significant price changes occur:

```
📈 *TORN Price Alert*
*Time:* 2024-01-15T10:30:45.123Z
*Current Price:* `0.003456 ETH`
*Previous Price:* `0.003200 ETH`
*Change:* `+8.00%`
#PriceChange
```

The price change alerts use smart tracking - percentage changes are calculated against the last price that triggered an alert, not the previous price check. This prevents alert spam during continued price movements in the same direction.

```
🔺 *TORN Price Threshold Alert*
*Time:* 2024-01-15T10:30:45.123Z
Price crossed above threshold!
*Current Price:* `0.004100 ETH`
*Threshold:* `0.004000 ETH`
#PriceAlert
```

**Health Monitoring Alerts:**
When API endpoints become unhealthy:

```
🔴 *Tornado Monitor Alert*
*Time:* 2024-01-15T10:30:45.123Z
*Network:* Ethereum
*Issue:* API endpoint is down
*Consecutive Failures:* 3
*Response Time:* 5000ms
#HealthAlert #Ethereum
```

### Quick Setup

Create a basic config file:

```bash
# Copy the example configuration
cp config.example.json config.json

# Edit with your settings
nano config.json
```

## Database Setup (for StakeBurned Monitoring)

### MySQL Setup

```sql
CREATE DATABASE tornado_events;
CREATE USER 'tornado_monitor'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON tornado_events.* TO 'tornado_monitor'@'localhost';
FLUSH PRIVILEGES;
```

The application will automatically create the required tables on first run.

### Database Schema

The `stake_burned_events` table includes:
- `id` - Auto-incrementing primary key
- `relayer` - Relayer address (indexed)
- `amount_burned` - Amount of TORN burned
- `block_number` - Block number (indexed)
- `transaction_hash` - Transaction hash (unique, indexed)
- `timestamp` - Event timestamp (indexed)
- `torn_price_eth` - TORN price in ETH at time of event
- `eth_value` - ETH value of burned TORN (amount_burned * torn_price_eth)
- `created_at` - Record creation timestamp

### Querying Events

You can query the stored events directly using SQL:

```sql
-- View recent events with price data
SELECT * FROM stake_burned_events ORDER BY block_number DESC LIMIT 10;

-- View events for a specific relayer with ETH values
SELECT relayer, amount_burned, torn_price_eth, eth_value, timestamp 
FROM stake_burned_events 
WHERE relayer = '0x742d35Cc619C4b8fE28262b67F0b16f2f2C1E2b6' 
ORDER BY block_number DESC LIMIT 20;

-- View events from a specific time period
SELECT * FROM stake_burned_events 
WHERE timestamp >= '2024-01-01' AND timestamp < '2024-02-01' 
ORDER BY timestamp DESC;

-- Aggregate data by relayer with ETH values
SELECT relayer, 
       COUNT(*) as event_count, 
       SUM(amount_burned) as total_burned_torn,
       SUM(eth_value) as total_eth_value,
       AVG(torn_price_eth) as avg_torn_price_eth
FROM stake_burned_events 
GROUP BY relayer 
ORDER BY total_eth_value DESC;

-- View price trends over time
SELECT DATE(timestamp) as date, 
       AVG(torn_price_eth) as avg_price, 
       MIN(torn_price_eth) as min_price, 
       MAX(torn_price_eth) as max_price,
       SUM(eth_value) as daily_eth_burned
FROM stake_burned_events 
GROUP BY DATE(timestamp) 
ORDER BY date DESC;
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
  "healthMonitoring": {
    "defaults": {
      "telegram": {
        "botToken": "1234567890:ABCdefGHIjklMNOpqrsTUVwxyz",
        "chatId": "-1001234567890",
        "enabled": true
      }
    }
  }
}
```

**Option 3: Per-Network Config**
```json
{
  "healthMonitoring": {
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
}
```

## Configuration Options

### Health Monitoring Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable health monitoring service |
| `apiUrl` | string | Required | Tornado API endpoint |
| `name` | string | "Unknown" | Network name for logging |
| `interval` | number | 30 | Check interval (seconds) |
| `timeout` | number | 10 | Request timeout (seconds) |
| `maxQueue` | number | 3 | Queue threshold for alerts |
| `maxConsecutiveFailures` | number | 3 | Failures before alerting |
| `enableHealthSummary` | boolean | true | Enable periodic health summaries |
| `healthSummaryInterval` | number | 300 | Health summary interval (seconds) |

### StakeBurned Monitoring Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable StakeBurned monitoring service |
| `rpcUrl` | string | Required | Ethereum RPC endpoint |
| `contractAddress` | string | Required | StakeBurned contract address |
| `relayerAddresses` | string[] | [] | Specific relayers to monitor (empty = all) |
| `historicalBlocks` | number | 1000 | How many blocks back to sync initially |
| `database.host` | string | Required | MySQL host |
| `database.port` | number | 3306 | MySQL port |
| `database.user` | string | Required | MySQL username |
| `database.password` | string | Required | MySQL password |
| `database.database` | string | Required | MySQL database name |

### TORN Price Monitor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | true | Enable TORN price monitoring service |
| `interval` | number | 300 | Price check interval in seconds |
| `priceChangeThreshold` | number | 5 | Price change percentage threshold for alerts |
| `priceThresholds.high` | number | Required | High price threshold (ETH) |
| `priceThresholds.low` | number | Required | Low price threshold (ETH) |
| `telegram.botToken` | string | Required | Telegram bot token |
| `telegram.chatId` | string | Required | Telegram chat ID |
| `telegram.enabled` | boolean | true | Enable Telegram alerts |

### Global Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `logLevel` | string | "info" | Log level (debug, info, warn, error) |

## API Validation (Health Monitoring)

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

## Development

### Project Structure

```
src/
├── index.ts                           # Main service orchestrator
├── types.ts                          # Global TypeScript interfaces
├── config/
│   └── config.ts                     # Configuration management
├── database/
│   └── database.ts                   # Database operations
└── services/
    ├── health/                       # Health monitoring services
    │   ├── tornadoHealthMonitor.ts   # Multi-network health monitor
    │   └── healthAlertService.ts     # Health-specific alerts
    ├── events/                       # Event monitoring services
    │   └── stakeBurnedListener.ts    # StakeBurned event listener
    ├── price/                        # Price monitoring services
    │   ├── tornPriceMonitor.ts       # TORN price monitor
    │   ├── priceService.ts           # Price fetching utilities
    │   └── priceAlertService.ts      # Price-specific alerts
    └── notifications/                # Notification services
        └── telegramClient.ts         # Telegram client

dist/                                 # Compiled JavaScript
config.example.json                   # Example configuration
package.json                          # Dependencies and scripts
tsconfig.json                        # TypeScript configuration
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

```

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
# Edit config.json with your settings

# 3. Set up database (if using StakeBurned monitoring)
# Create MySQL database and user as shown above

# 4. Deploy with PM2
./deploy-pm2.sh production
```

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
```

## Error Handling

The monitor includes comprehensive error handling:

- **Network Errors** - Connection timeouts, DNS failures
- **HTTP Errors** - 4xx/5xx status codes
- **JSON Parsing** - Invalid response format
- **Validation Errors** - Missing or invalid API fields
- **Database Errors** - Connection failures, query errors
- **Blockchain Errors** - RPC failures, contract call errors
- **Telegram Errors** - Alert delivery failures

All errors are logged with timestamps and response times.

## Troubleshooting

### Common Issues

**Configuration not loading:**
1. Check config file exists and has valid JSON syntax
2. Verify file permissions are readable
3. Check console for config loading messages
4. Use `TORNADO_CONFIG_PATH` env var for custom paths

**Database connection failing:**
1. Verify MySQL is running and accessible
2. Check database credentials and permissions
3. Ensure the database exists or can be created
4. Test connection with mysql client

**Telegram alerts not working:**
1. Run `npm run test:alert` to diagnose issues
2. Verify bot token and chat ID are correct
3. Check environment variables vs config file priority
4. Ensure bot has permission to send messages  
5. Send a message to your bot first to initialize the chat

**StakeBurned events not appearing:**
1. Check RPC endpoint is responding
2. Verify contract address is correct
3. Ensure relayer addresses are properly formatted (if filtering)
4. Check database permissions and connection
5. Review historical block range settings

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