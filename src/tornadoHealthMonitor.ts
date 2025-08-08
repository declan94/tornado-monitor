import fetch from "node-fetch";
import {
  TornadoApiResponse,
  HealthCheckResult,
  MonitorConfig,
  HealthMonitoringConfig,
} from "./types.js";
import { TelegramAlertSender } from "./telegram.js";

class TornadoHealthMonitor {
  public config: MonitorConfig;
  private isRunning: boolean = false;
  private consecutiveFailures: number = 0;
  private lastSuccessfulCheck: string | null = null;
  private intervalId?: NodeJS.Timeout;
  private telegramSender?: TelegramAlertSender;

  constructor(config: MonitorConfig) {
    this.config = config;

    // Initialize Telegram sender if configured
    if (this.config.telegram && this.config.telegram.enabled) {
      this.telegramSender = new TelegramAlertSender(this.config.telegram);
    }
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    try {
      console.log(`[${timestamp}] Checking Tornado API health...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(this.config.apiUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "TornadoHealthMonitor/1.0",
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as TornadoApiResponse;

      let result: HealthCheckResult = {
        timestamp,
        isHealthy: false,
        responseTime,
        data,
      };
      if (this.validateResponse(data)) {
        if (data.health.status != "true") {
          result.error = data.health.error;
          this.onUnhealthy(result, "Error in health: " + data.health.error);
        } else if (data.currentQueue > this.config.maxQueue) {
          result.error = "High queue: " + data.currentQueue;
          this.onUnhealthy(result, "High queue: " + data.currentQueue);
        } else {
          result.isHealthy = true;
          this.onHealthy(result);
        }
      } else {
        this.onUnhealthy(result, "Invalid response structure");
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result: HealthCheckResult = {
        timestamp,
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      this.onError(result);
      return result;
    }
  }

  private validateResponse(data: any): data is TornadoApiResponse {
    return (
      data &&
      typeof data === "object" &&
      typeof data.health === "object" &&
      typeof data.health.status === "string" &&
      typeof data.rewardAccount === "string" &&
      typeof data.netId === "number" &&
      typeof data.version === "string" &&
      typeof data.currentQueue === "number" &&
      typeof data.instances === "object"
    );
  }

  private onHealthy(result: HealthCheckResult): void {
    this.consecutiveFailures = 0;
    this.lastSuccessfulCheck = result.timestamp;

    const data = result.data!;
    const networkName = this.config.name || "Unknown";
    console.log(
      `[${result.timestamp}] ✅ ${networkName} API is healthy (${result.responseTime}ms)`
    );
    console.log(`  Status: ${data.health.status}`);
    console.log(`  Queue: ${data.currentQueue}`);
    console.log(`  Version: ${data.version}`);
    console.log(`  Network ID: ${data.netId}`);
    console.log(`  Service Fee: ${data.tornadoServiceFee}`);
    console.log(`  Supported tokens: ${Object.keys(data.instances).length}`);

    if (data.errorLog && data.errorLog.length > 0) {
      console.log(`  Recent errors: ${data.errorLog.length}`);
    }
    if (data.health.errorsLog && data.health.errorsLog.length > 0) {
      console.log(`  Health errors: ${data.health.errorsLog.length}`);
    }
  }

  private onUnhealthy(result: HealthCheckResult, reason: string): void {
    this.consecutiveFailures++;
    console.error(
      `[${result.timestamp}] ❌ API is unhealthy: ${reason} (${result.responseTime}ms)`
    );

    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.sendAlert(`API has been unhealthy for ${this.consecutiveFailures} consecutive checks`);
    }
  }

  private onError(result: HealthCheckResult): void {
    this.consecutiveFailures++;
    console.error(
      `[${result.timestamp}] ❌ Health check failed: ${result.error} (${result.responseTime}ms)`
    );

    if (this.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      this.sendAlert(`API health checks failing: ${result.error}`);
    }
  }

  private async sendAlert(message: string): Promise<void> {
    const networkName = this.config.name || "Unknown";
    console.error(`🚨 ALERT: ${message}`);
    console.error(`  Last successful check: ${this.lastSuccessfulCheck || "Never"}`);
    console.error(`  Consecutive failures: ${this.consecutiveFailures}`);

    // Send Telegram alert if configured
    if (this.telegramSender) {
      try {
        await this.telegramSender.sendAlert(message, networkName);
      } catch (error) {
        console.error("Failed to send Telegram alert:", error);
      }
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Monitor is already running");
      return;
    }

    this.isRunning = true;
    console.log(`Starting Tornado API health monitor`);
    console.log(`  URL: ${this.config.apiUrl}`);
    console.log(`  Interval: ${this.config.interval / 1000}s`);
    console.log(`  Timeout: ${this.config.timeout / 1000}s`);
    console.log(`  Max failures: ${this.config.maxConsecutiveFailures}`);

    // do not test here to avoid duplicated messages for multiple networks and also restarting
    // if (this.telegramSender) {
    //   console.log(`  Telegram alerts: Enabled`);
    //   // Test connection on startup
    //   const testResult = await this.telegramSender.testConnection();
    //   if (testResult) {
    //     console.log(`  Telegram connection: ✅ OK`);
    //   } else {
    //     console.log(`  Telegram connection: ❌ Failed`);
    //   }
    // }

    // Initial check
    this.checkHealth();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.checkHealth();
    }, this.config.interval);
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("Monitor is not running");
      return;
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    console.log("Health monitor stopped");
  }

  getStatus(): {
    isRunning: boolean;
    consecutiveFailures: number;
    lastSuccessfulCheck: string | null;
  } {
    return {
      isRunning: this.isRunning,
      consecutiveFailures: this.consecutiveFailures,
      lastSuccessfulCheck: this.lastSuccessfulCheck,
    };
  }
}

class TornadoMultiNetworkHealthMonitor {
  private monitors: TornadoHealthMonitor[] = [];
  private isRunning: boolean = false;
  private config: HealthMonitoringConfig;

  constructor(config: HealthMonitoringConfig) {
    this.config = config;
    this.monitors = this.config.networks.map(
      (networkConfig) => new TornadoHealthMonitor(networkConfig)
    );
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Multi-network monitor is already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting multi-network Tornado API health monitor");
    console.log(`Monitoring ${this.monitors.length} networks:`);

    // Start all monitors
    for (const monitor of this.monitors) {
      console.log(`Starting monitor for network: ${monitor.config?.name || "Unknown"}`);
      try {
        await monitor.start();
        console.log(`✅ Monitor started for ${monitor.config?.name || "Unknown"}`);
      } catch (error) {
        console.error(
          `❌ Failed to start monitor for ${monitor.config?.name || "Unknown"}:`,
          error
        );
      }
    }

    console.log("🎯 All monitors initialization completed");
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("Multi-network monitor is not running");
      return;
    }

    this.isRunning = false;
    console.log("Stopping multi-network monitor...");

    this.monitors.forEach((monitor) => {
      monitor.stop();
    });
  }

  getStatus() {
    return this.monitors.map((monitor) => monitor.getStatus());
  }
}

export { TornadoHealthMonitor, TornadoMultiNetworkHealthMonitor };
