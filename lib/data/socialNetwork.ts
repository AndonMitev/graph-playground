import { GraphData } from "../types";

const PROTOCOL_GROUPS = [
  { name: "DeFi Whales", color: "#6366f1" },
  { name: "NFT Traders", color: "#f59e0b" },
  { name: "DAO Governors", color: "#10b981" },
  { name: "MEV Bots", color: "#ef4444" },
  { name: "Bridge Users", color: "#8b5cf6" },
  { name: "Yield Farmers", color: "#06b6d4" },
  { name: "Stakers", color: "#ec4899" },
  { name: "Airdrop Hunters", color: "#84cc16" },
  { name: "Liquidators", color: "#f97316" },
  { name: "LP Providers", color: "#14b8a6" },
  { name: "Governance Voters", color: "#a855f7" },
  { name: "Flash Loan Users", color: "#e11d48" },
  { name: "NFT Minters", color: "#eab308" },
  { name: "Cross-Chain Arbers", color: "#0ea5e9" },
  { name: "Restakers", color: "#d946ef" },
];

const PROTOCOLS = [
  "Uniswap", "Aave", "Lido", "MakerDAO", "Compound",
  "OpenSea", "Blur", "Rarible", "Foundation", "SuperRare",
  "Snapshot", "Tally", "Aragon", "Nouns DAO", "ENS DAO",
  "Flashbots", "Jito", "bloXroute", "Eden Network", "MEV Blocker",
  "Wormhole", "LayerZero", "Stargate", "Across", "Hop Protocol",
  "Yearn", "Convex", "Pendle", "EigenLayer", "Renzo",
  "Rocket Pool", "Frax", "Curve", "Balancer", "SushiSwap",
  "1inch", "Paraswap", "CoW Swap", "dYdX", "GMX",
  "Synthetix", "Morpho", "Euler", "Spark", "Sky",
  "Chainlink", "The Graph", "Gelato", "Safe", "Gnosis",
  "Osmosis", "Jupiter", "Raydium", "Orca", "Marinade",
  "Aerodrome", "Velodrome", "Camelot", "Trader Joe", "Benqi",
  "Ethena", "Usual", "Resolv", "Mountain", "Ondo",
  "Kelp", "Puffer", "Swell", "Mantle LSP", "Stader",
  "Polymarket", "Azuro", "Thales", "Overtime", "PleasrDAO",
];

const CHAINS = ["Ethereum", "Arbitrum", "Optimism", "Polygon", "Base", "Solana", "Avalanche", "BSC", "zkSync", "Scroll", "Linea", "Blast"];

const WALLETS_PER_GROUP = 10;
const CROSS_GROUP_LINKS = 5;
const WHALE_HUBS_PER_GROUP = 1;

function shortAddr(seed: number): string {
  const hex = (seed * 2654435761 >>> 0).toString(16).padStart(8, "0");
  return `0x${hex.slice(0, 4)}...${hex.slice(-4)}`;
}

function randomDate(startYear: number, endYear: number): string {
  const y = startYear + Math.floor(Math.random() * (endYear - startYear));
  const m = String(Math.floor(Math.random() * 12) + 1).padStart(2, "0");
  const d = String(Math.floor(Math.random() * 28) + 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function generateSocialNetwork(): GraphData {
  const nodes: any[] = [];
  const links: any[] = [];
  const groupCount = PROTOCOL_GROUPS.length;

  // --- Protocol hub nodes ---
  for (let g = 0; g < groupCount; g++) {
    const hubId = `protocol-${g}`;
    nodes.push({
      id: hubId,
      name: PROTOCOLS[g * (PROTOCOLS.length / groupCount | 0)] || PROTOCOLS[g] || `Protocol ${g}`,
      group: g,
      val: 16,
      isProtocol: true,
      balanceEth: 50000 + Math.floor(Math.random() * 950000),
      txCount: 500000 + Math.floor(Math.random() * 4500000),
      chain: "Ethereum",
      firstSeen: randomDate(2017, 2020),
      lastActive: randomDate(2025, 2026),
    });
  }

  // --- Wallet nodes per group ---
  for (let g = 0; g < groupCount; g++) {
    const hubId = `protocol-${g}`;
    const whaleIds: string[] = [];

    // Whale sub-hubs (high-value wallets that act as local hubs)
    for (let w = 0; w < WHALE_HUBS_PER_GROUP; w++) {
      const whaleId = `whale-${g}-${w}`;
      whaleIds.push(whaleId);
      const txCount = 2000 + Math.floor(Math.random() * 8000);
      nodes.push({
        id: whaleId,
        name: shortAddr(g * 10000 + w * 777),
        group: g,
        val: 8 + Math.floor(Math.random() * 4),
        isProtocol: false,
        balanceEth: +(500 + Math.random() * 9500).toFixed(1),
        txCount,
        chain: CHAINS[Math.floor(Math.random() * 3)], // Whales on top chains
        firstSeen: randomDate(2018, 2021),
        lastActive: randomDate(2025, 2026),
      });
      // Whale connects to protocol
      links.push({ source: whaleId, target: hubId, value: 3 });
      // Whales connect to each other within group
      if (w > 0) {
        links.push({ source: whaleId, target: whaleIds[w - 1], value: 2 });
      }
    }

    // Regular wallets
    for (let i = 0; i < WALLETS_PER_GROUP; i++) {
      const nodeId = `wallet-${g}-${i}`;
      const txCount = 1 + Math.floor(Math.random() * 800);
      nodes.push({
        id: nodeId,
        name: shortAddr(g * 10000 + i * 37 + 0xa1b2),
        group: g,
        val: 2 + Math.floor(txCount / 200),
        isProtocol: false,
        balanceEth: +(Math.random() * 50).toFixed(2),
        txCount,
        chain: CHAINS[Math.floor(Math.random() * CHAINS.length)],
        firstSeen: randomDate(2020, 2025),
        lastActive: randomDate(2025, 2026),
      });

      // Connect to a whale sub-hub or the protocol
      if (Math.random() < 0.7) {
        const targetWhale = whaleIds[Math.floor(Math.random() * whaleIds.length)];
        links.push({ source: nodeId, target: targetWhale, value: 1 });
      } else {
        links.push({ source: nodeId, target: hubId, value: 1 });
      }

      // Intra-group wallet-to-wallet (dense mesh)
      const intraLinks = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < intraLinks; k++) {
        if (i > 0) {
          const target = `wallet-${g}-${Math.floor(Math.random() * i)}`;
          links.push({ source: nodeId, target, value: 1 });
        }
      }
    }
  }

  // --- Cross-group connections (heavy) ---
  for (let g = 0; g < groupCount; g++) {
    // Protocol-to-protocol links
    for (let g2 = g + 1; g2 < groupCount; g2++) {
      if (Math.random() < 0.6) {
        links.push({ source: `protocol-${g}`, target: `protocol-${g2}`, value: 2 });
      }
    }

    // Cross-group wallet links
    for (let k = 0; k < CROSS_GROUP_LINKS; k++) {
      const srcIdx = Math.floor(Math.random() * WALLETS_PER_GROUP);
      const tgtGroup = (g + 1 + Math.floor(Math.random() * (groupCount - 1))) % groupCount;
      const tgtIdx = Math.floor(Math.random() * WALLETS_PER_GROUP);
      links.push({
        source: `wallet-${g}-${srcIdx}`,
        target: `wallet-${tgtGroup}-${tgtIdx}`,
        value: 1,
      });
    }

    // Whales bridge across groups
    for (let w = 0; w < WHALE_HUBS_PER_GROUP; w++) {
      const tgtGroup = (g + 1 + Math.floor(Math.random() * (groupCount - 1))) % groupCount;
      const tgtWhale = Math.floor(Math.random() * WHALE_HUBS_PER_GROUP);
      links.push({
        source: `whale-${g}-${w}`,
        target: `whale-${tgtGroup}-${tgtWhale}`,
        value: 2,
      });
      // Whales also touch other protocols
      if (Math.random() < 0.5) {
        links.push({
          source: `whale-${g}-${w}`,
          target: `protocol-${tgtGroup}`,
          value: 2,
        });
      }
    }
  }

  return { nodes, links };
}

export { PROTOCOL_GROUPS };
