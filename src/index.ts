import { TornadoMultiNetworkHealthMonitor } from "./services/health/tornadoHealthMonitor.js";
import { StakeBurnedListener } from "./services/events/stakeBurnedListener.js";
import { TornPriceMonitor } from "./services/price/tornPriceMonitor.js";
import { ConfigLoader } from "./config/config.js";
import { ConfigFile } from "./types.js";

class TornadoMonitorService {
  private multiNetworkMonitor?: TornadoMultiNetworkHealthMonitor;
  private stakeBurnedListener?: StakeBurnedListener;
  private tornPriceMonitor?: TornPriceMonitor;
  private config: ConfigFile;

  constructor(configPath?: string) {
    this.config = ConfigLoader.loadConfig(configPath);
    
    // Watch for config changes
    ConfigLoader.watchConfig((newConfig) => {
      this.handleConfigReload(newConfig);
    });
  }

  private async handleConfigReload(newConfig: ConfigFile): Promise<void> {
    console.log("🔄 Handling configuration reload...");
    
    // Save old config for comparison
    const oldConfig = this.config;
    this.config = newConfig;

    // Update TORN price monitor if it exists and new config has price monitoring
    if (this.tornPriceMonitor && newConfig.tornPriceMonitor) {
      if (newConfig.tornPriceMonitor.enabled !== false) {
        this.tornPriceMonitor.updateConfig(newConfig.tornPriceMonitor);
      } else {
        console.log("💰 TORN price monitor disabled in new config, stopping...");
        
        // Send stop notification before stopping
        await this.sendServiceStatusNotification('stopped', oldConfig.tornPriceMonitor);
        
        this.tornPriceMonitor.stop();
        this.tornPriceMonitor = undefined;
      }
    }
    // Start price monitor if it doesn't exist but is enabled in new config
    else if (!this.tornPriceMonitor && newConfig.tornPriceMonitor && newConfig.tornPriceMonitor.enabled !== false) {
      console.log("💰 Starting TORN price monitor from config reload...");
      this.tornPriceMonitor = new TornPriceMonitor(newConfig.tornPriceMonitor);
      await this.tornPriceMonitor.start();
      
      // Send start notification
      await this.sendServiceStatusNotification('started', newConfig.tornPriceMonitor);
    }

    // Note: For now, we only support dynamic reloading of TORN price monitor
    // Health monitoring and StakeBurned listener would require more complex reloading logic
    if (JSON.stringify(newConfig.healthMonitoring) !== JSON.stringify(oldConfig.healthMonitoring)) {
      console.log("ℹ️  Health monitoring config changed - restart required for full effect");
    }
    
    if (JSON.stringify(newConfig.stakeBurnedListener) !== JSON.stringify(oldConfig.stakeBurnedListener)) {
      console.log("ℹ️  StakeBurned listener config changed - restart required for full effect");
    }

    console.log("✅ Configuration reload handled");
  }

  private async sendServiceStatusNotification(status: 'started' | 'stopped', config?: any): Promise<void> {
    if (!config?.telegram?.enabled) {
      return; // Skip if telegram is disabled
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const emoji = status === 'started' ? '✅' : '🛑';
    const action = status === 'started' ? 'Started' : 'Stopped';
    
    let message = `${emoji} **TORN Price Monitor ${action}**\n\n`;
    
    if (status === 'started' && config) {
      message += `📊 Monitoring interval: ${config.interval}s\n`;
      if (config.priceChangeThreshold) {
        message += `📈 Price change alert: ${config.priceChangeThreshold}%\n`;
      }
      if (config.priceThresholds?.high) {
        message += `🚨 High price alert: ${config.priceThresholds.high} ETH\n`;
      }
      if (config.priceThresholds?.low) {
        message += `⬇️ Low price alert: ${config.priceThresholds.low} ETH\n`;
      }
      message += `\n*Service auto-${status} via config reload*`;
    } else {
      message += `*Service ${status} via config reload*`;
    }
    
    message += `\n\n*${timestamp} UTC*`;

    try {
      // Import and create a temporary alert service to send the notification
      const { PriceAlertService } = await import('./services/price/priceAlertService.js');
      const alertService = new PriceAlertService(config.telegram);
      
      const alert = {
        type: "service_status" as const,
        customMessage: message,
        timestamp: new Date()
      };
      
      await alertService.sendAlert(alert);
      console.log(`📱 Service ${status} notification sent to Telegram`);
    } catch (error) {
      console.error(`❌ Failed to send service ${status} notification:`, error);
    }
  }

  async start(): Promise<void> {
    console.log("🚀 Starting Tornado Monitor Service...");

    // Start health monitoring if configured
    if (this.config.healthMonitoring && this.config.healthMonitoring.enabled !== false) {
      console.log("📡 Initializing health monitoring service...");
      this.multiNetworkMonitor = new TornadoMultiNetworkHealthMonitor(this.config.healthMonitoring);
      await this.multiNetworkMonitor.start();
    }

    // Start stake burned listener if configured and enabled
    if (this.config.stakeBurnedListener && this.config.stakeBurnedListener.enabled !== false) {
      console.log("🔥 Initializing StakeBurned event listener...");
      this.stakeBurnedListener = new StakeBurnedListener(this.config.stakeBurnedListener);
      await this.stakeBurnedListener.initialize();

      // Get historical events first, then start listening for new ones
      await this.stakeBurnedListener.getHistoricalEvents();
      await this.stakeBurnedListener.startListening();
    }

    // Start TORN price monitor if configured and enabled
    if (this.config.tornPriceMonitor && this.config.tornPriceMonitor.enabled !== false) {
      console.log("💰 Initializing TORN price monitor...");
      this.tornPriceMonitor = new TornPriceMonitor(this.config.tornPriceMonitor);
      await this.tornPriceMonitor.start();
    }

    console.log("✅ All services started successfully");
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping Tornado Monitor Service...");

    // Stop config watching
    ConfigLoader.stopWatching();

    if (this.multiNetworkMonitor) {
      console.log("Stopping health monitoring service...");
      this.multiNetworkMonitor.stop();
    }

    if (this.stakeBurnedListener) {
      console.log("Stopping StakeBurned event listener...");
      await this.stakeBurnedListener.stop();
    }

    if (this.tornPriceMonitor) {
      console.log("Stopping TORN price monitor...");
      this.tornPriceMonitor.stop();
    }

    console.log("✅ All services stopped");
  }

  getStatus() {
    return {
      healthMonitor: this.multiNetworkMonitor?.getStatus(),
      stakeBurnedListener: this.stakeBurnedListener ? "running" : "not configured",
      tornPriceMonitor: this.tornPriceMonitor?.getStatus() || "not configured",
    };
  }
}

// Start the services if running directly or via PM2
// Check if this is the main module being executed
const isMainModule =
  process.argv[1] &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].includes("ProcessContainerFork.js") ||
    process.argv[0].includes("node"));

if (isMainModule) {
  // Check for config path argument
  const configPath = process.argv[2];

  const tornadoService = new TornadoMonitorService(configPath);

  // Start the services with proper error handling
  (async () => {
    try {
      await tornadoService.start();
      console.log("🎯 Tornado Monitor Service is running...");
    } catch (error) {
      console.error("❌ Failed to start services:", error);
      process.exit(1);
    }
  })();

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🔄 Received SIGINT, shutting down gracefully...");
    tornadoService
      .stop()
      .then(() => {
        console.log("👋 Goodbye!");
        process.exit(0);
      })
      .catch((error) => {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      });
  });

  process.on("SIGTERM", () => {
    console.log("\n🔄 Received SIGTERM, shutting down gracefully...");
    tornadoService
      .stop()
      .then(() => {
        console.log("👋 Goodbye!");
        process.exit(0);
      })
      .catch((error) => {
        console.error("❌ Error during shutdown:", error);
        process.exit(1);
      });
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled Promise Rejection:", reason);
    console.error("Promise:", promise);
    // Don't exit on unhandled rejections, just log them
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    tornadoService
      .stop()
      .then(() => {
        process.exit(1);
      })
      .catch(() => {
        process.exit(1);
      });
  });
}

export { TornadoMonitorService };
export default TornadoMonitorService;
