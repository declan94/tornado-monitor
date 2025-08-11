import mysql from "mysql2/promise";
import { DatabaseConfig, StakeBurnedEvent } from "../types.js";

export class Database {
  private connection: mysql.Connection | null = null;

  constructor(private config: DatabaseConfig) {}

  async connect(): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
      });
      console.log("✅ Connected to MySQL database");
      await this.createTables();
    } catch (error) {
      console.error("❌ Failed to connect to MySQL:", error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.connection) throw new Error("Not connected to database");

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS stake_burned_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        relayer VARCHAR(42) NOT NULL,
        amount_burned DECIMAL(30,18) NOT NULL,
        block_number BIGINT NOT NULL,
        transaction_hash VARCHAR(66) NOT NULL UNIQUE,
        timestamp DATETIME NOT NULL,
        torn_price_eth DECIMAL(20,18) NOT NULL,
        eth_value DECIMAL(30,18) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_relayer (relayer),
        INDEX idx_block_number (block_number),
        INDEX idx_timestamp (timestamp),
        INDEX idx_tx_hash (transaction_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    try {
      await this.connection.execute(createTableQuery);
      console.log("✅ Database tables initialized");
    } catch (error) {
      console.error("❌ Failed to create tables:", error);
      throw error;
    }
  }

  async saveStakeBurnedEvent(event: StakeBurnedEvent): Promise<void> {
    if (!this.connection) throw new Error("Not connected to database");

    const query = `
      INSERT IGNORE INTO stake_burned_events 
      (relayer, amount_burned, block_number, transaction_hash, timestamp, torn_price_eth, eth_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const [result] = await this.connection.execute(query, [
        event.relayer,
        event.amountBurned,
        event.blockNumber,
        event.transactionHash,
        event.timestamp,
        event.tornPriceEth,
        event.ethValue,
      ]);

      const insertResult = result as mysql.ResultSetHeader;
      if (insertResult.affectedRows > 0) {
        console.log(`💾 Saved StakeBurned event: ${event.transactionHash}`);
      }
    } catch (error) {
      console.error("❌ Failed to save event:", error);
      throw error;
    }
  }

  async getRecentEvents(relayerAddress?: string, limit: number = 100): Promise<StakeBurnedEvent[]> {
    if (!this.connection) throw new Error("Not connected to database");

    let query = `
      SELECT id, relayer, amount_burned, block_number, transaction_hash, timestamp, torn_price_eth, eth_value, created_at
      FROM stake_burned_events
    `;
    const params: any[] = [];

    if (relayerAddress) {
      query += " WHERE relayer = ?";
      params.push(relayerAddress);
    }

    query += " ORDER BY block_number DESC LIMIT ?";
    params.push(limit);

    try {
      const [rows] = await this.connection.execute(query, params);
      const events = rows as any[];

      return events.map((row) => ({
        id: row.id,
        relayer: row.relayer,
        amountBurned: row.amount_burned.toString(),
        blockNumber: row.block_number,
        transactionHash: row.transaction_hash,
        timestamp: new Date(row.timestamp),
        tornPriceEth: row.torn_price_eth.toString(),
        ethValue: row.eth_value.toString(),
        createdAt: new Date(row.created_at),
      }));
    } catch (error) {
      console.error("❌ Failed to fetch events:", error);
      throw error;
    }
  }

  async getLatestBlockNumber(): Promise<number | null> {
    if (!this.connection) throw new Error("Not connected to database");

    try {
      const [rows] = await this.connection.execute(
        "SELECT MAX(block_number) as latest_block FROM stake_burned_events"
      );
      const result = rows as any[];
      return result[0].latest_block || null;
    } catch (error) {
      console.error("❌ Failed to get latest block number:", error);
      throw error;
    }
  }

  async hasEventsInRange(fromBlock: number, toBlock: number): Promise<boolean> {
    if (!this.connection) throw new Error("Not connected to database");

    try {
      const [rows] = await this.connection.execute(
        "SELECT COUNT(*) as count FROM stake_burned_events WHERE block_number BETWEEN ? AND ?",
        [fromBlock, toBlock]
      );
      const result = rows as any[];
      return result[0].count > 0;
    } catch (error) {
      console.error("❌ Failed to check events in range:", error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      console.log("🔌 Database connection closed");
    }
  }
}
