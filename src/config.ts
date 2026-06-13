import { createConfig } from 'wagmi';
import { http } from 'viem';
import { createPublicClient } from 'viem';
import { base } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';
import { Attribution } from 'ox/erc8021';

export const BUILDER_CODE = 'bc_0rsqulv5';
export const BASESCAN = 'https://basescan.org';

// ERC-8021 attribution suffix for bc_0rsqulv5
// Generates: 0x62635f30727371756c76350b0080218021802180218021802180218021
export const DATA_SUFFIX = Attribution.toDataSuffix({
  codes: [BUILDER_CODE],
});

// Wagmi config — dataSuffix automatically appends builder code to ALL transactions
// (useSendTransaction, useWriteContract, useSendCalls). App is Base mainnet only.
export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "Shadow Monarch's Match" }),
  ],
  transports: { [base.id]: http() },
  dataSuffix: DATA_SUFFIX,
});

// Viem public client for receipt polling
export const publicClient = createPublicClient({
  chain: base,
  transport: http('https://mainnet.base.org'),
});
