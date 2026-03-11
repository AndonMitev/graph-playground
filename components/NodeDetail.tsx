"use client";

import { GraphNode } from "@/lib/types";

interface NodeDetailProps {
  node: GraphNode | null;
  onClose: () => void;
}

const GROUP_LABELS: Record<number, string> = {
  0: "DeFi Whales",
  1: "NFT Traders",
  2: "DAO Governors",
  3: "MEV Bots",
  4: "Bridge Users",
  5: "Yield Farmers",
  6: "Stakers",
  7: "Airdrop Hunters",
  8: "Liquidators",
  9: "LP Providers",
  10: "Governance Voters",
  11: "Flash Loan Users",
  12: "NFT Minters",
  13: "Cross-Chain Arbers",
  14: "Restakers",
};

function DetailRow({ label, value, color }: { label: string; value?: string | number; color?: string }) {
  if (value === undefined) return null;
  return (
    <div className="flex justify-between items-center py-1 text-xs">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80 font-mono text-[11px]" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

export default function NodeDetail({ node, onClose }: NodeDetailProps) {
  if (!node) return null;

  const isWallet = node.id?.toString().startsWith("wallet-") || node.id?.toString().startsWith("protocol-");

  return (
    <div className="absolute top-3 left-3 w-[220px] bg-glass-bg border border-glass-border rounded-xl backdrop-blur-xl z-20 animate-[slideIn_0.2s_ease]">
      <div className="flex justify-between items-center px-3.5 py-3 border-b border-glass-border">
        <h3 className="m-0 text-[13px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
          {node.name || String(node.id)}
        </h3>
        <button
          onClick={onClose}
          className="bg-none border-none text-white/40 cursor-pointer text-lg leading-none px-0.5 hover:text-white"
        >
          &times;
        </button>
      </div>
      <div className="px-3.5 pt-2.5 pb-3.5">
        {node.isProtocol !== undefined && (
          <DetailRow
            label="Type"
            value={node.isProtocol ? "Protocol" : "Wallet"}
            color={node.isProtocol ? "#10b981" : "#6366f1"}
          />
        )}
        {node.chain && <DetailRow label="Chain" value={node.chain} />}
        {node.balanceEth !== undefined && (
          <DetailRow label={node.isProtocol ? "TVL" : "Balance"} value={`${node.balanceEth.toLocaleString()} ETH`} />
        )}
        {node.txCount !== undefined && <DetailRow label="Transactions" value={node.txCount.toLocaleString()} />}
        {isWallet && node.group !== undefined && (
          <DetailRow label="Cluster" value={GROUP_LABELS[node.group] || `Group ${node.group}`} />
        )}
        {node.firstSeen && <DetailRow label="First Seen" value={node.firstSeen} />}
        {node.lastActive && <DetailRow label="Last Active" value={node.lastActive} />}
        {!isWallet && node.type && <DetailRow label="Type" value={node.type} />}
        {!isWallet && node.group !== undefined && <DetailRow label="Group" value={node.group} />}
        {node.val !== undefined && <DetailRow label="Weight" value={node.val} />}
        {node.color && (
          <div className="flex justify-between items-center py-1 text-xs">
            <span className="text-white/40">Color</span>
            <span className="w-3.5 h-3.5 rounded-sm border border-white/10" style={{ backgroundColor: node.color }} />
          </div>
        )}
      </div>
    </div>
  );
}
