"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { generateNetworkTraffic } from "@/lib/data/networkTraffic";
import ControlPanel, { Toggle, Slider } from "@/components/ControlPanel";
import NodeDetail from "@/components/NodeDetail";
import { GraphNode } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export default function NetworkTrafficDemo({ width, height }: { width: number; height: number }) {
  const graphRef = useRef<any>(null);
  const data = useMemo(() => generateNetworkTraffic(), []);
  const [attackMode, setAttackMode] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoverNode, setHoverNode] = useState<any>(null);
  const highlightNodesRef = useRef<Set<string | number>>(new Set());
  const highlightLinksRef = useRef<Set<any>>(new Set());
  const [, forceRender] = useState(0);

  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-150);
    fg.d3Force("link")?.distance(50);
    setTimeout(() => fg.zoomToFit(400, 40), 500);
  }, []);

  // Live traffic updates
  useEffect(() => {
    const interval = setInterval(() => {
      for (const link of data.links as any[]) {
        if (attackMode) {
          link.traffic = 4 + Math.floor(Math.random() * 2);
        } else {
          link.traffic = 1 + Math.floor(Math.random() * 4);
        }
      }
      graphRef.current?.graphData(data);
    }, 2000);
    return () => clearInterval(interval);
  }, [data, attackMode]);

  const handleNodeHover = useCallback((node: any) => {
    const nodes = highlightNodesRef.current;
    const links = highlightLinksRef.current;
    nodes.clear();
    links.clear();
    if (node) {
      nodes.add(node.id);
      for (const link of data.links) {
        const srcId = typeof link.source === "object" ? (link.source as any).id : link.source;
        const tgtId = typeof link.target === "object" ? (link.target as any).id : link.target;
        if (srcId === node.id || tgtId === node.id) {
          links.add(link);
          nodes.add(srcId);
          nodes.add(tgtId);
        }
      }
    }
    setHoverNode(node || null);
    forceRender(n => n + 1);
  }, [data.links]);

  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = node.val || 4;
    const isHighlighted = highlightNodesRef.current.has(node.id);
    const dimmed = hoverNode && !isHighlighted;

    const color = attackMode && node.type === "router"
      ? "#ff2222"
      : node.type === "router"
        ? "#f59e0b"
        : node.type === "switch"
          ? "#6366f1"
          : node.type === "server"
            ? "#10b981"
            : "#64748b";

    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.globalAlpha = dimmed ? 0.15 : 1;

    if (isHighlighted) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
    }

    if (node.type === "router") {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        ctx.lineTo(size * Math.cos(angle), size * Math.sin(angle));
      }
      ctx.closePath();
    } else if (node.type === "switch") {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size, 0);
      ctx.closePath();
    } else if (node.type === "server") {
      ctx.beginPath();
      ctx.rect(-size, -size, size * 2, size * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
    }

    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (attackMode && node.type === "router") {
      ctx.beginPath();
      ctx.arc(0, 0, size + 3, 0, Math.PI * 2);
      ctx.strokeStyle = "#ff000066";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // LOD: only draw labels when zoomed in enough
    if (globalScale > 1.5) {
      ctx.font = "3px Sans-Serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffffcc";
      ctx.fillText(node.name || "", 0, size + 5);
    }

    ctx.restore();
  }, [attackMode, hoverNode]);

  return (
    <>
      <ForceGraph2D
        ref={graphRef}
        graphData={data}
        width={width}
        height={height}
        backgroundColor="#0a0a0f"
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          ctx.beginPath();
          ctx.arc(node.x, node.y, Math.max(8, (node.val || 4) + 3), 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        onNodeHover={handleNodeHover}
        onNodeClick={(node: any) => setSelectedNode(node)}
        onNodeDragEnd={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        enableNodeDrag={true}
        autoPauseRedraw={false}
        linkColor={(link: any) => {
          if (highlightLinksRef.current.has(link)) return attackMode ? "#ff444488" : "#ffffff55";
          return attackMode
            ? `rgba(255,${Math.max(0, 120 - ((link as any).traffic || 1) * 25)},0,0.4)`
            : "#ffffff15";
        }}
        linkWidth={(link: any) =>
          highlightLinksRef.current.has(link)
            ? (((link as any).traffic || 1) * 0.8 + 1)
            : (((link as any).traffic || 1) * 0.4)
        }
        linkDirectionalParticles={(link: any) => ((link as any).traffic || 1)}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleSpeed={(link: any) =>
          ((link as any).bandwidth || 3) * 0.002 * speedMult
        }
        linkDirectionalParticleColor={() => attackMode ? "#ff4444" : "#6366f1cc"}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={() => attackMode ? "#ff444444" : "#ffffff22"}
        // -- Perf --
        d3AlphaDecay={0.06}
        d3VelocityDecay={0.5}
        cooldownTime={4000}
        linkHoverPrecision={4}
        minZoom={1}
        maxZoom={12}
      />
      <ControlPanel title="Transaction Flow">
        <Toggle
          label={attackMode ? "Spam Attack" : "Normal Mode"}
          checked={attackMode}
          onChange={setAttackMode}
        />
        <Slider label="TX Speed" value={speedMult} min={0.1} max={5} step={0.1} onChange={setSpeedMult} />
      </ControlPanel>
      <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
    </>
  );
}
