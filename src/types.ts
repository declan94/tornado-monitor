export interface TornadoApiResponse {
  rewardAccount: string;
  netId: number;
  tornadoServiceFee: number;
  miningServiceFee?: number;
  version: string;
  health: {
    status: string;
    error: string;
    errorsLog?: any[];
  };
  currentQueue: number;
  instances: Record<string, {
    instanceAddress: Record<string, string>;
    symbol: string;
    decimals: number;
    tokenAddress?: string;
  }>;
  ethPrices?: Record<string, string>;
  errorLog?: Array<{
    error: string;
    timestamp: string;
  }>;
}

export interface HealthCheckResult {
  timestamp: string;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  data?: TornadoApiResponse;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface MonitorConfig {
  apiUrl: string;
  interval: number;
  timeout: number;
  maxQueue: number;
  maxConsecutiveFailures: number;
  name?: string; // Network name for logging
  telegram?: TelegramConfig;
}

export interface ConfigFile {
  networks: MonitorConfig[];
  defaults?: Partial<MonitorConfig>;
  global?: {
    logLevel?: "debug" | "info" | "warn" | "error";
    enableHealthSummary?: boolean;
    healthSummaryInterval?: number;
  };
}
