import { ethers } from "ethers";
import { ConfigLoader } from "../config/config.js";
import { StakeBurnedListener } from "../services/events/stakeBurnedListener.js";
import { getBlockByTimestamp } from "../utils/blockByTimestamp.js";

function parseArgs(): { relayer: string; from: string; to: string } {
  const args = process.argv.slice(2);
  let relayer = "";
  let from = "";
  let to = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--relayer" && args[i + 1]) {
      relayer = args[++i];
    } else if (args[i] === "--from" && args[i + 1]) {
      from = args[++i];
    } else if (args[i] === "--to" && args[i + 1]) {
      to = args[++i];
    }
  }

  if (!relayer || !from || !to) {
    console.error("Usage: npm run backfill -- --relayer 0x... --from 2024-01-01 --to 2024-06-01");
    process.exit(1);
  }

  return { relayer, from, to };
}

function parseDate(dateStr: string): number {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.error(`Invalid date: ${dateStr}`);
    process.exit(1);
  }
  return Math.floor(date.getTime() / 1000);
}

async function main() {
  const { relayer, from, to } = parseArgs();

  const fromTimestamp = parseDate(from);
  const toTimestamp = parseDate(to);

  if (fromTimestamp >= toTimestamp) {
    console.error("--from date must be before --to date");
    process.exit(1);
  }

  console.log(`Relayer: ${relayer}`);
  console.log(`From: ${new Date(fromTimestamp * 1000).toISOString()}`);
  console.log(`To:   ${new Date(toTimestamp * 1000).toISOString()}`);

  const config = ConfigLoader.loadConfig();

  if (!config.stakeBurnedListener) {
    console.error(
      "No stakeBurnedListener config found. Ensure config.json has rpcUrl and contractAddress."
    );
    process.exit(1);
  }

  const { rpcUrl, contractAddress } = config.stakeBurnedListener;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  console.log("\nResolving block numbers...");

  const fromBlock = await getBlockByTimestamp(provider, fromTimestamp);
  const toBlock = await getBlockByTimestamp(provider, toTimestamp);

  console.log(`From block: ${fromBlock}`);
  console.log(`To block:   ${toBlock}`);

  const listener = new StakeBurnedListener({
    rpcUrl,
    contractAddress,
    relayerAddresses: [],
    historicalBlocks: 0,
    database: config.stakeBurnedListener.database,
  });

  await listener.backfillEvents(relayer, fromBlock, toBlock);

  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
