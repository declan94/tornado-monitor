import { readFileSync, existsSync } from "fs";
import { ConfigFile, MonitorConfig } from "./types.js";

export class ConfigLoader {
  private static readonly DEFAULT_CONFIG_PATHS = [
    "./config.json",
    "./config/networks.json",
    "./configs/tornado.json",
    process.env.TORNADO_CONFIG_PATH,
  ].filter(Boolean) as string[];

  private static readonly DEFAULT_MONITOR_CONFIG: Partial<MonitorConfig> = {
    interval: 30000, // 30 seconds
    timeout: 10000, // 10 seconds
    maxQueue: 3,
    maxConsecutiveFailures: 3,
  };

  static loadConfig(configPath?: string): ConfigFile {
    const path = configPath || this.findConfigFile();

    if (!path) {
      console.log("No config file found, using default configuration");
      return this.getDefaultConfig();
    }

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
      global: {
        logLevel: "info",
        enableHealthSummary: true,
        healthSummaryInterval: 300000, // 5 minutes
      },
    };
  }

  private static validateAndMergeConfig(config: ConfigFile): ConfigFile {
    // Validate required fields
    if (!config.networks || !Array.isArray(config.networks)) {
      throw new Error("Config must have 'networks' array");
    }

    if (config.networks.length === 0) {
      throw new Error("At least one network must be configured");
    }

    // Merge defaults with each network
    const mergedConfig: ConfigFile = {
      ...config,
      networks: config.networks.map((network) => {
        const merged = {
          ...this.DEFAULT_MONITOR_CONFIG,
          ...config.defaults,
          ...network,
        } as MonitorConfig;

        // Validate required fields
        this.validateNetworkConfig(merged);

        // Apply environment variable overrides
        this.applyEnvOverrides(merged);

        return merged;
      }),
    };

    console.log(`Loaded ${mergedConfig.networks.length} network configurations`);
    return mergedConfig;
  }

  private static validateNetworkConfig(config: MonitorConfig): void {
    if (!config.apiUrl) {
      throw new Error("Network config missing required field: apiUrl");
    }

    if (!config.apiUrl.startsWith("http")) {
      throw new Error(`Invalid apiUrl: ${config.apiUrl} (must start with http/https)`);
    }

    if (config.interval < 1000) {
      throw new Error(`Interval too small: ${config.interval}ms (minimum 1000ms)`);
    }

    if (config.timeout < 1000) {
      throw new Error(`Timeout too small: ${config.timeout}ms (minimum 1000ms)`);
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

  private static applyEnvOverrides(config: MonitorConfig): void {
    // Apply Telegram config from environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId) {
      config.telegram = {
        botToken,
        chatId,
        enabled: process.env.TELEGRAM_ENABLED !== "false",
        ...config.telegram, // Preserve any existing config
      };
    }

    // Apply other environment overrides
    if (process.env.MONITOR_INTERVAL) {
      config.interval = parseInt(process.env.MONITOR_INTERVAL, 10) * 1000;
    }

    if (process.env.MONITOR_TIMEOUT) {
      config.timeout = parseInt(process.env.MONITOR_TIMEOUT, 10) * 1000;
    }

    if (process.env.MAX_QUEUE) {
      config.maxQueue = parseInt(process.env.MAX_QUEUE, 10);
    }

    if (process.env.MAX_FAILURES) {
      config.maxConsecutiveFailures = parseInt(process.env.MAX_FAILURES, 10);
    }
  }

  static createExampleConfig(): ConfigFile {
    return {
      networks: [
        {
          apiUrl: "https://tornado.bitah.link/v1/status",
          name: "Ethereum",
          interval: 30000,
          timeout: 10000,
          maxQueue: 5,
          maxConsecutiveFailures: 3,
        },
        {
          apiUrl: "https://bsc-tornado.bitah.link/v1/status",
          name: "BSC",
          interval: 45000,
          timeout: 15000,
          maxQueue: 10,
          maxConsecutiveFailures: 2,
        },
      ],
      defaults: {
        interval: 30000,
        timeout: 10000,
        maxQueue: 3,
        maxConsecutiveFailures: 3,
        telegram: {
          botToken: "YOUR_BOT_TOKEN_HERE",
          chatId: "YOUR_CHAT_ID_HERE",
          enabled: true,
        },
      },
      global: {
        logLevel: "info",
        enableHealthSummary: true,
        healthSummaryInterval: 300000,
      },
    };
  }
}
