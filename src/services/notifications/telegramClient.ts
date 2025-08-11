import fetch from "node-fetch";
import { TelegramConfig } from "../../types.js";

/**
 * Basic Telegram client for sending messages
 * No throttling or formatting - just raw message sending
 */
export class TelegramClient {
  private config: TelegramConfig;

  constructor(config: TelegramConfig) {
    this.config = config;
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
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
    } catch (error) {
      console.error("❌ Telegram API error:", error);
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const testMessage = "🧪 *Connection Test*\nTelegram is working correctly!";
      return await this.sendMessage(testMessage);
    } catch (error) {
      console.error("Telegram connection test failed:", error);
      return false;
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}
