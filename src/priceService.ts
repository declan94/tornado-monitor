import fetch from "node-fetch";
import { ethers } from "ethers";

export interface TornPriceData {
  tornPriceEth: string;
}

export class TornPriceService {
  private static readonly DEFAULT_API_URLS = [
    "https://tornado.bitah.link/v1/status",
    "https://eth.master-relayer.com/v1/status",
    "https://eth.default-relayer.com/v1/status",
  ];

  private apiUrls: string[];
  private lastKnownPrice: string | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  constructor(apiUrls?: string[]) {
    this.apiUrls = apiUrls || TornPriceService.DEFAULT_API_URLS;
  }

  async getTornPriceEth(): Promise<string> {
    // Return cached price if recent
    if (this.lastKnownPrice && Date.now() - this.lastFetchTime < this.CACHE_DURATION) {
      return this.lastKnownPrice;
    }

    // Try to fetch from any available API
    for (const apiUrl of this.apiUrls) {
      try {
        const price = await this.fetchPriceFromApi(apiUrl);
        if (price) {
          this.lastKnownPrice = price;
          this.lastFetchTime = Date.now();
          return price;
        }
      } catch (error) {
        console.warn(`Failed to fetch TORN price from ${apiUrl}:`, error);
        continue;
      }
    }

    // If all APIs fail, use last known price or default
    if (this.lastKnownPrice) {
      console.warn("Using cached TORN price due to API failures");
      return this.lastKnownPrice;
    }

    throw new Error("Failed to fetch TORN price from all API endpoints");
  }

  private async fetchPriceFromApi(apiUrl: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "TornadoMonitor/1.0",
          Accept: "application/json",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      // Check if the API response contains ethPrices with TORN
      if (data.ethPrices && data.ethPrices.torn) {
        // Convert from wei to ETH
        const priceInWei = data.ethPrices.torn;
        const priceInEth = ethers.formatEther(priceInWei);
        return priceInEth;
      }

      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  // Helper method to calculate ETH value
  calculateEthValue(tornAmount: string, tornPriceEth: string): string {
    try {
      const amount = parseFloat(tornAmount);
      const price = parseFloat(tornPriceEth);
      const ethValue = amount * price;
      return ethValue.toString();
    } catch (error) {
      console.error("Error calculating ETH value:", error);
      return "0";
    }
  }
}
