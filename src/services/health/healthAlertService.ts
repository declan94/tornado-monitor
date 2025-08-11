import { TelegramClient } from "../notifications/telegramClient.js";
import { TelegramConfig } from "../../types.js";

export interface HealthAlert {
  type: "failure" | "recovery" | "queue_warning" | "consecutive_failures";
  networkName: string;
  message: string;
  timestamp: Date;
  consecutiveFailures?: number;
  queueSize?: number;
  responseTime?: number;
}

/**
 * Service for sending health monitoring alerts via Telegram
 * Handles formatting and burst/throttling logic for health alerts
 */
export class HealthAlertService {
  private telegramClient?: TelegramClient;
  private lastAlertTime: Map<string, number> = new Map();
  private alertCounts: Map<string, number> = new Map();
  private MIN_ALERT_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly BURST_LIMIT = 3; // Allow 3 alerts initially
  private readonly BURST_WINDOW = 15 * 60 * 1000; // 15 minutes window

  constructor(telegramConfig?: TelegramConfig) {
    if (telegramConfig?.enabled) {
      this.telegramClient = new TelegramClient(telegramConfig);
    }
  }

  async sendAlert(alert: HealthAlert): Promise<boolean> {
    if (!this.isEnabled()) {
      return false;
    }

    // Burst throttling: allow initial burst, then throttle
    const alertKey = `${alert.networkName}:${alert.message}`;
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(alertKey);

    // Reset count if burst window has passed
    if (lastAlert && now - lastAlert > this.BURST_WINDOW) {
      this.alertCounts.set(alertKey, 0);
    }

    // Check if we should throttle
    const currentCount = this.alertCounts.get(alertKey) || 0;

    if (currentCount >= this.BURST_LIMIT) {
      // After burst limit, apply normal throttling
      if (lastAlert && now - lastAlert < this.MIN_ALERT_INTERVAL) {
        console.log(`Skipping alert (${currentCount}/${this.BURST_LIMIT} burst used, throttled)`);
        return false;
      }
    }

    const message = this.formatAlert(alert, currentCount + 1);
    const success = await this.telegramClient!.sendMessage(message);

    if (success) {
      this.lastAlertTime.set(alertKey, now);
      this.alertCounts.set(alertKey, currentCount + 1);
      console.log(`✅ Health alert sent (${currentCount + 1}/${this.BURST_LIMIT} in burst)`);
    }

    return success;
  }

  private formatAlert(alert: HealthAlert, alertCount: number = 1): string {
    const emoji = this.getAlertEmoji(alert);
    const countIndicator = alertCount > 1 ? ` (${alertCount}/${this.BURST_LIMIT})` : "";

    let message = `${emoji} *Tornado Monitor Alert*${countIndicator}\n`;
    message += `*Time:* ${alert.timestamp.toISOString()}\n`;
    message += `*Network:* ${alert.networkName}\n`;
    message += `*Issue:* ${alert.message}\n`;

    // Add additional context based on alert type
    if (alert.consecutiveFailures && alert.consecutiveFailures > 1) {
      message += `*Consecutive Failures:* ${alert.consecutiveFailures}\n`;
    }

    if (alert.queueSize !== undefined) {
      message += `*Queue Size:* ${alert.queueSize}\n`;
    }

    if (alert.responseTime !== undefined) {
      message += `*Response Time:* ${alert.responseTime}ms\n`;
    }

    message += `#HealthAlert #${alert.networkName.replace(/\s+/g, "")}`;

    return message;
  }

  private getAlertEmoji(alert: HealthAlert): string {
    switch (alert.type) {
      case "failure":
        return "🔴";
      case "recovery":
        return "✅";
      case "queue_warning":
        return "⚠️";
      case "consecutive_failures":
        return "🚨";
      default:
        if (alert.message.includes("failing") || alert.message.includes("failed")) {
          return "🔴";
        }
        if (alert.message.includes("unhealthy")) {
          return "🟡";
        }
        if (alert.message.includes("queue")) {
          return "⚠️";
        }
        return "🚨";
    }
  }

  async testConnection(): Promise<boolean> {
    return this.telegramClient?.testConnection() ?? false;
  }

  isEnabled(): boolean {
    return this.telegramClient?.isEnabled() ?? false;
  }

  setAlertInterval(minutes: number): void {
    this.MIN_ALERT_INTERVAL = minutes * 60 * 1000;
  }
}
