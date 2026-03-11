import { GraphData } from "../types";

// Blockchain transaction flow - mempool, validators, protocols
export function generateNetworkTraffic(): GraphData {
  const nodes = [];
  const links = [];

  // Validator nodes (core routers)
  const validators = ["validator-1", "validator-2", "validator-3"];
  for (let i = 0; i < validators.length; i++) {
    nodes.push({
      id: validators[i],
      name: `Validator ${i + 1}`,
      type: "router", // validator = router shape
      val: 10,
      group: 0,
    });
    if (i > 0) {
      links.push({
        source: validators[i],
        target: validators[i - 1],
        traffic: 3 + Math.floor(Math.random() * 3),
        bandwidth: 10,
        value: 3,
      });
    }
  }
  links.push({ source: validators[2], target: validators[0], traffic: 3, bandwidth: 10, value: 3 });

  // RPC / Relay nodes (switches)
  const relayNames = ["Infura", "Alchemy", "QuickNode", "Ankr", "Chainstack",
    "BlastAPI", "Tenderly", "Moralis", "GetBlock"];
  let relayIdx = 0;
  for (const validator of validators) {
    for (let s = 0; s < 3; s++) {
      const relayId = `relay-${relayIdx}`;
      nodes.push({
        id: relayId,
        name: relayNames[relayIdx] || `Relay ${relayIdx + 1}`,
        type: "switch",
        val: 6,
        group: 1,
      });
      links.push({
        source: validator,
        target: relayId,
        traffic: 2 + Math.floor(Math.random() * 3),
        bandwidth: 5,
        value: 2,
      });

      // Protocols per relay (servers)
      const protocols = ["Uniswap", "Aave", "Lido", "Curve", "OpenSea", "Blur", "1inch", "Compound"];
      for (let sv = 0; sv < 4; sv++) {
        const protocolId = `protocol-${relayIdx * 4 + sv}`;
        nodes.push({
          id: protocolId,
          name: protocols[(relayIdx * 4 + sv) % protocols.length],
          type: "server",
          val: 4,
          group: 2,
        });
        links.push({
          source: relayId,
          target: protocolId,
          traffic: 1 + Math.floor(Math.random() * 3),
          bandwidth: 3,
          value: 1,
        });
      }

      // Wallet endpoints
      for (let e = 0; e < 2; e++) {
        const walletId = `wallet-${relayIdx * 2 + e}`;
        const hex = (relayIdx * 2 + e + 0xa1).toString(16);
        nodes.push({
          id: walletId,
          name: `0x${hex}...${hex}`,
          type: "endpoint",
          val: 3,
          group: 3,
        });
        links.push({
          source: relayId,
          target: walletId,
          traffic: 1 + Math.floor(Math.random() * 2),
          bandwidth: 2,
          value: 1,
        });
      }

      relayIdx++;
    }
  }

  return { nodes, links };
}
