import fetch from "node-fetch";
import { TelegramConfig } from "./types.js";

export class TelegramAlertSender {
  private config: TelegramConfig;
  private lastAlertTime: Map<string, number> = new Map();
  private alertCounts: Map<string, number> = new Map();
  private MIN_ALERT_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly BURST_LIMIT = 3; // Allow 3 alerts initially
  private readonly BURST_WINDOW = 15 * 60 * 1000; // 15 minutes window

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  async sendAlert(message: string, networkName: string = "Unknown"): Promise<boolean> {
    if (!this.config.enabled) {
      console.log("Telegram alerts disabled, skipping...");
      return false;
    }

    // Burst throttling: allow initial burst, then throttle
    const alertKey = `${networkName}:${message}`;
    const now = Date.now();
    const lastAlert = this.lastAlertTime.get(alertKey);
    const alertCount = this.alertCounts.get(alertKey) || 0;

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

    try {
      const telegramMessage = this.formatMessage(message, networkName, currentCount + 1);
      const success = await this.sendToTelegram(telegramMessage);

      if (success) {
        this.lastAlertTime.set(alertKey, now);
        this.alertCounts.set(alertKey, currentCount + 1);
        console.log(`✅ Telegram alert sent (${currentCount + 1}/${this.BURST_LIMIT} in burst)`);
      }

      return success;
    } catch (error) {
      console.error("❌ Failed to send Telegram alert:", error);
      return false;
    }
  }

  private formatMessage(message: string, networkName: string, alertCount: number = 1): string {
    const timestamp = new Date().toISOString();
    const emoji = this.getAlertEmoji(message);
    const countIndicator = alertCount > 1 ? ` (${alertCount}/${this.BURST_LIMIT})` : "";

    return `${emoji} *Tornado Monitor Alert*${countIndicator}

🌐 *Network:* ${networkName}
⏰ *Time:* ${timestamp}
📋 *Issue:* ${message}

#TornadoAlert #${networkName}`;
  }

  private getAlertEmoji(message: string): string {
    if (message.includes("failing") || message.includes("failed")) {
      return "🔴";
    }
    if (message.includes("unhealthy")) {
      return "🟡";
    }
    if (message.includes("queue")) {
      return "⚠️";
    }
    return "🚨";
  }

  private async sendToTelegram(message: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: this.config.chatId,
        text: message,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorData}`);
    }

    const result = (await response.json()) as { ok: boolean };
    return result.ok === true;
  }

  async testConnection(): Promise<boolean> {
    try {
      const testMessage = "🧪 *Tornado Monitor Test*\n\nTelegram alerts are working correctly!";
      return await this.sendToTelegram(testMessage);
    } catch (error) {
      console.error("Telegram connection test failed:", error);
      return false;
    }
  }

  setAlertInterval(minutes: number): void {
    this.MIN_ALERT_INTERVAL = minutes * 60 * 1000;
  }
}
