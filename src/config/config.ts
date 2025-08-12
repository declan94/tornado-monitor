import { readFileSync, existsSync, watchFile } from "fs";
import { ConfigFile, MonitorConfig, HealthMonitoringConfig } from "../types.js";

export class ConfigLoader {
  private static readonly DEFAULT_CONFIG_PATHS = [
    process.env.TORNADO_CONFIG_PATH,
    "./config.json",
    "./config/networks.json",
    "./configs/tornado.json",
  ].filter(Boolean) as string[];

  private static currentConfigPath: string | null = null;
  private static watcherCallbacks: Array<(config: ConfigFile) => void> = [];

  private static readonly DEFAULT_MONITOR_CONFIG: Partial<MonitorConfig> = {
    interval: 30, // 30 seconds
    timeout: 10, // 10 seconds
    maxQueue: 3,
    maxConsecutiveFailures: 3,
  };

  static loadConfig(configPath?: string): ConfigFile {
    const path = configPath || this.findConfigFile();

    if (!path) {
      console.log("No config file found, using default configuration");
      this.currentConfigPath = null;
      return this.getDefaultConfig();
    }

    this.currentConfigPath = path;

    try {
      console.log(`Loading configuration from: ${path}`);
      const content = readFileSync(path, "utf-8");
      const config = JSON.parse(content) as ConfigFile;

      return this.validateAndMergeConfig(config);
    } catch (error) {
      console.error(`Failed to load config from ${path}:`, error);
      console.log("Falling back to default configuration");
      return this.getDefaultConfig();
    }
  }

  private static findConfigFile(): string | null {
    for (const path of this.DEFAULT_CONFIG_PATHS) {
      if (existsSync(path)) {
        return path;
      }
    }
    return null;
  }

  private static getDefaultConfig(): ConfigFile {
    return {
      global: {
        logLevel: "info",
      },
      healthMonitoring: {
        enabled: true,
        networks: [
          {
            apiUrl: "https://tornado.bitah.link/v1/status",
            name: "Ethereum",
            ...this.DEFAULT_MONITOR_CONFIG,
          } as MonitorConfig,
          {
            apiUrl: "https://bsc-tornado.bitah.link/v1/status",
            name: "BSC",
            ...this.DEFAULT_MONITOR_CONFIG,
          } as MonitorConfig,
        ],
        defaults: this.DEFAULT_MONITOR_CONFIG,
        enableHealthSummary: true,
        healthSummaryInterval: 300, // 5 minutes in seconds
      },
    };
  }

  private static validateAndMergeConfig(config: ConfigFile): ConfigFile {
    // Validate health monitoring config if present
    if (config.healthMonitoring) {
      if (!config.healthMonitoring.networks || !Array.isArray(config.healthMonitoring.networks)) {
        throw new Error("healthMonitoring must have 'networks' array");
      }

      if (config.healthMonitoring.networks.length === 0) {
        throw new Error("At least one network must be configured in healthMonitoring");
      }

      // Merge defaults with each network
      config.healthMonitoring.networks = config.healthMonitoring.networks.map((network) => {
        const merged = {
          ...this.DEFAULT_MONITOR_CONFIG,
          ...config.healthMonitoring?.defaults,
          ...network,
        } as MonitorConfig;

        // Validate required fields
        this.validateNetworkConfig(merged);

        // Convert seconds to milliseconds for internal use
        merged.interval = merged.interval * 1000;
        merged.timeout = merged.timeout * 1000;

        return merged;
      });

      console.log(`Loaded ${config.healthMonitoring.networks.length} network configurations`);

      // Convert healthSummaryInterval from seconds to milliseconds
      if (config.healthMonitoring.healthSummaryInterval) {
        config.healthMonitoring.healthSummaryInterval =
          config.healthMonitoring.healthSummaryInterval * 1000;
      }
    }

    return config;
  }

  private static validateNetworkConfig(config: MonitorConfig): void {
    if (!config.apiUrl) {
      throw new Error("Network config missing required field: apiUrl");
    }

    if (!config.apiUrl.startsWith("http")) {
      throw new Error(`Invalid apiUrl: ${config.apiUrl} (must start with http/https)`);
    }

    if (config.interval < 1) {
      throw new Error(`Interval too small: ${config.interval}s (minimum 1s)`);
    }

    if (config.timeout < 1) {
      throw new Error(`Timeout too small: ${config.timeout}s (minimum 1s)`);
    }

    if (config.maxQueue < 0) {
      throw new Error(`Invalid maxQueue: ${config.maxQueue} (must be >= 0)`);
    }

    if (config.maxConsecutiveFailures < 1) {
      throw new Error(
        `Invalid maxConsecutiveFailures: ${config.maxConsecutiveFailures} (must be >= 1)`
      );
    }
  }

  static createExampleConfig(): ConfigFile {
    return {
      global: {
        logLevel: "info",
      },
      healthMonitoring: {
        enabled: true,
        networks: [
          {
            apiUrl: "https://tornado.bitah.link/v1/status",
            name: "Ethereum",
            interval: 30,
            timeout: 10,
            maxQueue: 5,
            maxConsecutiveFailures: 3,
          },
          {
            apiUrl: "https://bsc-tornado.bitah.link/v1/status",
            name: "BSC",
            interval: 45,
            timeout: 15,
            maxQueue: 10,
            maxConsecutiveFailures: 2,
          },
        ],
        defaults: {
          interval: 30,
          timeout: 10,
          maxQueue: 3,
          maxConsecutiveFailures: 3,
        },
        enableHealthSummary: true,
        healthSummaryInterval: 300,
      },
      stakeBurnedListener: {
        enabled: true,
        rpcUrl: "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
        contractAddress: "0x5Ef8B60fE7cF3eE5F3F12c20E27FFfCdcE14C0D5",
        relayerAddresses: ["0x742d35Cc619C4b8fE28262b67F0b16f2f2C1E2b6"],
        historicalBlocks: 1000,
        database: {
          host: "localhost",
          port: 3306,
          user: "tornado_monitor",
          password: "your_password",
          database: "tornado_events",
        },
      },
    };
  }

  static watchConfig(callback: (config: ConfigFile) => void): void {
    if (!this.currentConfigPath) {
      console.warn("No config file to watch - using default configuration");
      return;
    }

    this.watcherCallbacks.push(callback);

    // Only start watching if this is the first callback
    if (this.watcherCallbacks.length === 1) {
      console.log(`🔍 Watching config file for changes: ${this.currentConfigPath}`);

      let reloadTimeout: NodeJS.Timeout | null = null;

      watchFile(this.currentConfigPath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
          // Debounce rapid changes
          if (reloadTimeout) {
            clearTimeout(reloadTimeout);
          }

          reloadTimeout = setTimeout(() => {
            console.log("📝 Config file changed, reloading...");
            this.reloadConfig();
          }, 500);
        }
      });
    }
  }

  private static reloadConfig(): void {
    if (!this.currentConfigPath) {
      return;
    }

    try {
      const content = readFileSync(this.currentConfigPath, "utf-8");
      const config = JSON.parse(content) as ConfigFile;
      const validatedConfig = this.validateAndMergeConfig(config);

      console.log("✅ Configuration reloaded successfully");

      // Notify all watchers
      this.watcherCallbacks.forEach((callback) => {
        try {
          callback(validatedConfig);
        } catch (error) {
          console.error("Error in config watcher callback:", error);
        }
      });
    } catch (error) {
      console.error("❌ Failed to reload configuration:", error);
    }
  }

  static stopWatching(): void {
    if (this.currentConfigPath) {
      // Note: Node.js doesn't provide unwatchFile, so we clear callbacks instead
      this.watcherCallbacks = [];
      console.log("🛑 Stopped watching config file");
    }
  }
}
