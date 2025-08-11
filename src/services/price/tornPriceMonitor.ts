import { TornPriceService } from "./priceService.js";
import { PriceAlertService } from "./priceAlertService.js";
import { TelegramConfig } from "../../types.js";

export interface PriceMonitorConfig {
  enabled?: boolean;
  interval: number; // in seconds
  priceChangeThreshold?: number; // percentage (e.g., 5 for 5%)
  priceThresholds?: {
    high?: number; // alert when price goes above this (in ETH)
    low?: number; // alert when price goes below this (in ETH)
  };
  telegram?: TelegramConfig;
}

export class TornPriceMonitor {
  private priceService: TornPriceService;
  private alertService: PriceAlertService;
  private config: PriceMonitorConfig;
  private intervalId?: NodeJS.Timeout;
  private lastPrice: string | null = null;
  private isRunning = false;

  constructor(config: PriceMonitorConfig) {
    this.config = config;
    this.priceService = new TornPriceService();
    this.alertService = new PriceAlertService(config.telegram);
  }

  updateConfig(newConfig: PriceMonitorConfig): void {
    console.log("🔄 Updating TORN price monitor configuration...");
    
    const wasRunning = this.isRunning;
    const oldConfig = { ...this.config };
    
    // Update config
    this.config = newConfig;
    
    // Update alert service with new telegram config
    this.alertService = new PriceAlertService(newConfig.telegram);
    
    // Build notification message for config changes
    this.sendConfigUpdateNotification(oldConfig, newConfig);
    
    // If interval changed and monitor is running, restart with new interval
    if (wasRunning && oldConfig.interval !== newConfig.interval) {
      console.log(`📊 Price check interval updated: ${oldConfig.interval}s → ${newConfig.interval}s`);
      this.stop();
      this.start();
    }
    
    console.log("✅ TORN price monitor configuration updated");
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("🔄 TORN price monitor is already running");
      return;
    }

    console.log("💰 Starting TORN price monitoring...");

    // Get initial price
    try {
      this.lastPrice = await this.priceService.getTornPriceEth();
      console.log(`💰 Initial TORN price: ${this.lastPrice} ETH`);

      // Send initial price alert
      if (this.lastPrice) {
        await this.alertService.sendAlert({
          type: "startup",
          currentPrice: this.lastPrice,
          interval: this.config.interval,
          priceChangeThreshold: this.config.priceChangeThreshold,
          priceThresholds: this.config.priceThresholds,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      console.error("❌ Failed to get initial TORN price:", error);
    }

    // Start monitoring interval (convert seconds to milliseconds)
    this.intervalId = setInterval(() => {
      this.checkPrice().catch((error) => {
        console.error("❌ Error during price check:", error);
      });
    }, this.config.interval * 1000);

    this.isRunning = true;
    console.log(`✅ TORN price monitor started (interval: ${this.config.interval}s)`);
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("⏸️ TORN price monitor is not running");
      return;
    }

    console.log("🛑 Stopping TORN price monitoring...");

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;
    console.log("✅ TORN price monitor stopped");
  }

  async checkPrice(): Promise<void> {
    try {
      const currentPrice = await this.priceService.getTornPriceEth();
      const currentPriceNum = parseFloat(currentPrice);
      const timestamp = new Date();

      // Check for alerts only if we have a previous price
      if (this.lastPrice) {
        const lastPriceNum = parseFloat(this.lastPrice);
        const changePercent = ((currentPriceNum - lastPriceNum) / lastPriceNum) * 100;

        // Check price change threshold
        if (
          this.config.priceChangeThreshold &&
          Math.abs(changePercent) >= this.config.priceChangeThreshold
        ) {
          await this.alertService.sendAlert({
            type: "price_change",
            currentPrice,
            previousPrice: this.lastPrice,
            changePercent,
            timestamp,
          });
        }

        // Check price thresholds
        if (this.config.priceThresholds) {
          const { high, low } = this.config.priceThresholds;

          if (high && currentPriceNum >= high && lastPriceNum < high) {
            await this.alertService.sendAlert({
              type: "price_threshold",
              currentPrice,
              threshold: high,
              timestamp,
            });
          }

          if (low && currentPriceNum <= low && lastPriceNum > low) {
            await this.alertService.sendAlert({
              type: "price_threshold",
              currentPrice,
              threshold: low,
              timestamp,
            });
          }
        }
      }

      this.lastPrice = currentPrice;
      console.log(`💰 TORN Price: ${currentPrice} ETH`);
    } catch (error) {
      console.error("❌ Failed to check TORN price:", error);
    }
  }

  getCurrentPrice(): string | null {
    return this.lastPrice;
  }

  private async sendConfigUpdateNotification(oldConfig: PriceMonitorConfig, newConfig: PriceMonitorConfig): Promise<void> {
    if (!newConfig.telegram?.enabled) {
      return; // Skip if telegram is disabled
    }

    const changes: string[] = [];
    
    // Check for interval changes
    if (oldConfig.interval !== newConfig.interval) {
      changes.push(`*Monitoring interval:* ${oldConfig.interval}s → ${newConfig.interval}s`);
    }
    
    // Check for price change threshold changes
    if (oldConfig.priceChangeThreshold !== newConfig.priceChangeThreshold) {
      changes.push(`*Price change alert:* ${oldConfig.priceChangeThreshold || 'none'}% → ${newConfig.priceChangeThreshold || 'none'}%`);
    }
    
    // Check for high threshold changes
    if (oldConfig.priceThresholds?.high !== newConfig.priceThresholds?.high) {
      const oldHigh = oldConfig.priceThresholds?.high ? `${oldConfig.priceThresholds.high} ETH` : 'none';
      const newHigh = newConfig.priceThresholds?.high ? `${newConfig.priceThresholds.high} ETH` : 'none';
      changes.push(`*High price alert:* ${oldHigh} → ${newHigh}`);
    }
    
    // Check for low threshold changes
    if (oldConfig.priceThresholds?.low !== newConfig.priceThresholds?.low) {
      const oldLow = oldConfig.priceThresholds?.low ? `${oldConfig.priceThresholds.low} ETH` : 'none';
      const newLow = newConfig.priceThresholds?.low ? `${newConfig.priceThresholds.low} ETH` : 'none';
      changes.push(`*Low price alert:* ${oldLow} → ${newLow}`);
    }

    // Only send notification if there are actual changes
    if (changes.length > 0) {
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const message = `🔄 *TORN Price Monitor Config Updated*\n*Time:* ${timestamp} UTC\n${changes.join('\n')}\n`;
      
      try {
        const alert = {
          type: "config_update" as const,
          customMessage: message,
          timestamp: new Date()
        };
        await this.alertService.sendAlert(alert);
        console.log("📱 Config update notification sent to Telegram");
      } catch (error) {
        console.error("❌ Failed to send config update notification:", error);
      }
    }
  }

  getStatus(): any {
    return {
      running: this.isRunning,
      interval: this.config.interval,
      lastPrice: this.lastPrice,
      priceChangeThreshold: this.config.priceChangeThreshold,
      priceThresholds: this.config.priceThresholds,
      telegramEnabled: this.config.telegram?.enabled || false
    };
  }
}
