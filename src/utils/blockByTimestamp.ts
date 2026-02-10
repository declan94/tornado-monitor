import { ethers } from "ethers";

/**
 * Binary search to find the block number closest to (at or after) a target Unix timestamp.
 */
export async function getBlockByTimestamp(
  provider: ethers.Provider,
  targetTimestamp: number
): Promise<number> {
  const latestBlock = await provider.getBlock("latest");
  if (!latestBlock) {
    throw new Error("Failed to fetch latest block");
  }

  if (targetTimestamp >= latestBlock.timestamp) {
    return latestBlock.number;
  }

  const genesisBlock = await provider.getBlock(1);
  if (!genesisBlock) {
    throw new Error("Failed to fetch genesis block");
  }

  if (targetTimestamp <= genesisBlock.timestamp) {
    return 1;
  }

  let low = 1;
  let high = latestBlock.number;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    if (!block) {
      throw new Error(`Failed to fetch block ${mid}`);
    }

    if (block.timestamp < targetTimestamp) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}
