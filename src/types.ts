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
  instances: Record<
    string,
    {
      instanceAddress: Record<string, string>;
      symbol: string;
      decimals: number;
      tokenAddress?: string;
    }
  >;
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

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface StakeBurnedConfig {
  enabled?: boolean;
  rpcUrl: string;
  contractAddress: string;
  relayerAddresses: string[];
  historicalBlocks: number;
  database: DatabaseConfig;
}

export interface HealthMonitoringConfig {
  enabled?: boolean;
  networks: MonitorConfig[];
  defaults?: Partial<MonitorConfig>;
  enableHealthSummary?: boolean;
  healthSummaryInterval?: number;
}

export interface PriceMonitorConfig {
  enabled?: boolean;
  interval: number; // in seconds
  priceChangeThreshold?: number;
  priceThresholds?: {
    high?: number;
    low?: number;
  };
  telegram?: TelegramConfig;
}

export interface ConfigFile {
  global?: {
    logLevel?: "debug" | "info" | "warn" | "error";
  };
  healthMonitoring?: HealthMonitoringConfig;
  stakeBurnedListener?: StakeBurnedConfig;
  tornPriceMonitor?: PriceMonitorConfig;
}

export interface StakeBurnedEvent {
  id?: number;
  relayer: string;
  amountBurned: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: Date;
  tornPriceEth: string;
  ethValue: string;
  createdAt?: Date;
}
