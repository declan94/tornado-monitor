import { ethers } from "ethers";
import { Database } from "../../database/database.js";
import { StakeBurnedConfig, StakeBurnedEvent } from "../../types.js";
import { TornPriceService } from "../price/priceService.js";

const ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, internalType: "address", name: "relayer", type: "address" },
      { indexed: false, internalType: "uint256", name: "amountBurned", type: "uint256" },
    ],
    name: "StakeBurned",
    type: "event",
  },
];

export class StakeBurnedListener {
  private provider: ethers.Provider;
  private contract: ethers.Contract;
  private database: Database;
  private relayerAddresses: Set<string>;
  private priceService: TornPriceService;

  constructor(private config: StakeBurnedConfig) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.contract = new ethers.Contract(config.contractAddress, ABI, this.provider);
    this.database = new Database(config.database);
    this.relayerAddresses = new Set(config.relayerAddresses.map((addr) => addr.toLowerCase()));
    this.priceService = new TornPriceService();
  }

  async initialize(): Promise<void> {
    await this.database.connect();
  }

  private shouldProcessRelayer(relayer: string): boolean {
    if (this.relayerAddresses.size === 0) return true;
    return this.relayerAddresses.has(relayer.toLowerCase());
  }

  private async processStakeBurnedEvent(
    relayer: string,
    amountBurned: bigint,
    blockNumber: number,
    transactionHash: string,
    timestamp?: Date
  ): Promise<boolean> {
    try {
      const amountBurnedEth = ethers.formatEther(amountBurned);
      const eventTimestamp = timestamp || new Date();

      // Fetch TORN price in ETH
      console.log("📊 Fetching TORN price...");
      const tornPriceEth = await this.priceService.getTornPriceEth();
      const ethValue = this.priceService.calculateEthValue(amountBurnedEth, tornPriceEth);

      console.log(`TORN Price: ${tornPriceEth} ETH`);
      console.log(`ETH Value: ${ethValue} ETH`);

      await this.database.saveStakeBurnedEvent({
        relayer,
        amountBurned: amountBurnedEth,
        blockNumber,
        transactionHash,
        timestamp: eventTimestamp,
        tornPriceEth,
        ethValue,
      });

      console.log("✅ Event saved to database");
      return true;
    } catch (error) {
      console.error(`❌ Failed to process event ${transactionHash}:`, error);
      return false;
    }
  }

  async startListening() {
    const relayerFilter =
      this.relayerAddresses.size > 0
        ? `(filtering: ${Array.from(this.relayerAddresses).join(", ")})`
        : "(all relayers)";

    console.log(
      `Starting to listen for StakeBurned events on contract: ${this.config.contractAddress} ${relayerFilter}`
    );

    this.contract.on("StakeBurned", async (relayer: string, amountBurned: bigint, event: any) => {
      if (!this.shouldProcessRelayer(relayer)) {
        return;
      }

      const blockNumber = event.log.blockNumber;
      const transactionHash = event.log.transactionHash;
      const amountBurnedEth = ethers.formatEther(amountBurned);
      const timestamp = new Date();

      console.log("\n🔥 STAKE BURNED EVENT DETECTED:");
      console.log(`Relayer: ${relayer}`);
      console.log(`Amount Burned: ${amountBurnedEth} TORN`);
      console.log(`Block: ${blockNumber}`);
      console.log(`TX Hash: ${transactionHash}`);
      console.log(`Timestamp: ${timestamp.toISOString()}`);

      await this.processStakeBurnedEvent(
        relayer,
        amountBurned,
        blockNumber,
        transactionHash,
        timestamp
      );
      console.log("---");
    });

    this.provider.on("error", (error) => {
      console.error("Provider error:", error);
    });

    console.log("✅ Event listener started successfully");
  }

  async getHistoricalEvents() {
    console.log("🔍 Checking database for existing events...");

    try {
      // Get current block number
      const currentBlock = await this.provider.getBlockNumber();
      const fromBlock = currentBlock - this.config.historicalBlocks;

      console.log(`Current block: ${currentBlock}, checking from block: ${fromBlock}`);

      console.log(
        `📡 Fetching historical StakeBurned events from blocks ${fromBlock} to ${currentBlock}...`
      );

      const filter = this.contract.filters.StakeBurned();
      const events = await this.contract.queryFilter(filter, fromBlock, "latest");

      let processedCount = 0;
      let savedCount = 0;

      console.log(`Found ${events.length} historical StakeBurned events`);

      for (const event of events) {
        if (!("args" in event)) continue;
        const [relayer, amountBurned] = event.args!;

        if (!this.shouldProcessRelayer(relayer)) {
          continue;
        }

        processedCount++;
        const amountBurnedEth = ethers.formatEther(amountBurned);

        console.log(`\n📋 Processing Event ${processedCount}:`);
        console.log(`Relayer: ${relayer}`);
        console.log(`Amount Burned: ${amountBurnedEth} TORN`);
        console.log(`Block: ${event.blockNumber}`);
        console.log(`TX Hash: ${event.transactionHash}`);

        try {
          const block = await this.provider.getBlock(event.blockNumber);
          const timestamp = new Date(block!.timestamp * 1000);

          const success = await this.processStakeBurnedEvent(
            relayer,
            amountBurned,
            event.blockNumber,
            event.transactionHash,
            timestamp
          );

          if (success) {
            savedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to process historical event ${event.transactionHash}:`, error);
        }
      }

      console.log(
        `\n✅ Historical sync complete: ${processedCount} events processed, ${savedCount} saved to database`
      );
    } catch (error) {
      console.error("❌ Error fetching historical events:", error);
    }
  }

  async stop() {
    this.contract.removeAllListeners("StakeBurned");
    await this.database.close();
    console.log("Stopped listening for StakeBurned events and closed database connection");
  }

  async getRecentEventsFromDatabase(
    relayerAddress?: string,
    limit: number = 100
  ): Promise<StakeBurnedEvent[]> {
    return this.database.getRecentEvents(relayerAddress, limit);
  }
}
