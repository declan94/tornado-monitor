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
