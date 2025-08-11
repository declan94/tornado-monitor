import { TelegramClient } from "../notifications/telegramClient.js";
import { TelegramConfig } from "../../types.js";

export interface PriceAlert {
  type: "startup" | "price_change" | "price_threshold" | "config_update" | "service_status";
  currentPrice?: string;
  previousPrice?: string;
  changePercent?: number;
  threshold?: number;
  interval?: number;
  priceChangeThreshold?: number;
  priceThresholds?: {
    high?: number;
    low?: number;
  };
  timestamp: Date;
  
  // For config update and service status alerts
  customMessage?: string;
}

/**
 * Service for sending price-related alerts via Telegram
 * Handles formatting and basic throttling for price alerts
 */
export class PriceAlertService {
  private telegramClient?: TelegramClient;
  private lastAlertTime: Map<string, number> = new Map();
  private readonly MIN_ALERT_INTERVAL = 60 * 1000; // 1 minute for price alerts

  constructor(telegramConfig?: TelegramConfig) {
    if (telegramConfig?.enabled) {
      this.telegramClient = new TelegramClient(telegramConfig);
    }
  }

  async sendAlert(alert: PriceAlert): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    // Simple throttling for duplicate alerts (except startup, config_update, service_status)
    if (!["startup", "config_update", "service_status"].includes(alert.type)) {
      const alertKey = `${alert.type}:${alert.currentPrice}`;
      const now = Date.now();
      const lastAlert = this.lastAlertTime.get(alertKey);

      if (lastAlert && now - lastAlert < this.MIN_ALERT_INTERVAL) {
        console.log("Skipping duplicate price alert (throttled)");
        return false;
      }

      this.lastAlertTime.set(alertKey, now);
    }

    const message = this.formatAlert(alert);
    const success = await this.telegramClient!.sendMessage(message);

    if (success) {
      console.log(`✅ Price alert sent: ${alert.type}`);
    }

    return success;
  }

  private formatAlert(alert: PriceAlert): string {
    switch (alert.type) {
      case "startup":
        return this.formatStartupAlert(alert);
      case "price_change":
        return this.formatPriceChangeAlert(alert);
      case "price_threshold":
        return this.formatThresholdAlert(alert);
      case "config_update":
      case "service_status":
        return alert.customMessage || `💰 TORN Monitor: ${alert.type}`;
      default:
        return `💰 TORN Price Update: ${alert.currentPrice} ETH`;
    }
  }

  private formatStartupAlert(alert: PriceAlert): string {
    let message =
      `💰 *TORN Price Monitor Started*\n` +
      `*Time:* ${alert.timestamp.toISOString()}\n` +
      `*Current Price:* \`${alert.currentPrice} ETH\`\n` +
      `*Monitor Interval:* ${alert.interval}s\n`;

    if (alert.priceChangeThreshold) {
      message += `*Price Change Alert:* ±${alert.priceChangeThreshold}%\n`;
    }

    if (alert.priceThresholds) {
      if (alert.priceThresholds.high) {
        message += `*High Threshold:* ${alert.priceThresholds.high} ETH\n`;
      }
      if (alert.priceThresholds.low) {
        message += `*Low Threshold:* ${alert.priceThresholds.low} ETH\n`;
      }
    }

    return message;
  }

  private formatPriceChangeAlert(alert: PriceAlert): string {
    const direction = alert.changePercent! > 0 ? "📈" : "📉";
    const changeStr = alert.changePercent!.toFixed(2);
    const changeSign = alert.changePercent! > 0 ? "+" : "";

    return (
      `${direction} *TORN Price Alert*\n` +
      `*Time:* ${alert.timestamp.toISOString()}\n` +
      `*Current Price:* \`${alert.currentPrice} ETH\`\n` +
      `*Previous Price:* \`${alert.previousPrice} ETH\`\n` +
      `*Change:* \`${changeSign}${changeStr}%\`\n` + 
      `#PriceChange`
    );
  }

  private formatThresholdAlert(alert: PriceAlert): string {
    const direction = parseFloat(alert.currentPrice!) >= alert.threshold! ? "🔺" : "🔻";
    const crossed = parseFloat(alert.currentPrice!) >= alert.threshold! ? "above" : "below";

    return (
      `${direction} *TORN Price Threshold Alert*\n` +
      `*Time:* ${alert.timestamp.toISOString()}\n` +
      `Price crossed ${crossed} threshold!\n` +
      `*Current Price:* \`${alert.currentPrice!} ETH\`\n` +
      `*Threshold:* \`${alert.threshold} ETH\`\n` +
      `#PriceAlert`
    );
  }

  async testConnection(): Promise<boolean> {
    return this.telegramClient?.testConnection() ?? false;
  }

  isEnabled(): boolean {
    return this.telegramClient?.isEnabled() ?? false;
  }
}
