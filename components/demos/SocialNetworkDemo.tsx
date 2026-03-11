"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { generateSocialNetwork, PROTOCOL_GROUPS } from "@/lib/data/socialNetwork";
import ControlPanel, { Slider, Toggle, Button } from "@/components/ControlPanel";
import NodeDetail from "@/components/NodeDetail";
import { GraphNode, GraphLink } from "@/lib/types";
import * as THREE from "three";
// @ts-expect-error - no types for postprocessing
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const GROUP_COLORS = PROTOCOL_GROUPS.map((g) => g.color);

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

export default function SocialNetworkDemo({ width, height }: { width: number; height: number }) {
  const graphRef = useRef<any>(null);
  const data = useMemo(() => generateSocialNetwork(), []);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [speedMult, setSpeedMult] = useState(1);
  const [showParticles, setShowParticles] = useState(true);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [linkOpacity, setLinkOpacity] = useState(0.15);

  // Track hover state
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const highlightNodes = useRef(new Set<string | number>());
  const highlightLinks = useRef(new Set<GraphLink>());

  // Build adjacency maps once
  const { neighborMap, linksByNode } = useMemo(() => {
    const nMap = new Map<string | number, Set<string | number>>();
    const lMap = new Map<string | number, Set<GraphLink>>();
    for (const link of data.links as GraphLink[]) {
      const sid = typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
      const tid = typeof link.target === "object" ? (link.target as GraphNode).id : link.target;
      if (!nMap.has(sid)) nMap.set(sid, new Set());
      if (!nMap.has(tid)) nMap.set(tid, new Set());
      nMap.get(sid)!.add(tid);
      nMap.get(tid)!.add(sid);
      if (!lMap.has(sid)) lMap.set(sid, new Set());
      if (!lMap.has(tid)) lMap.set(tid, new Set());
      lMap.get(sid)!.add(link);
      lMap.get(tid)!.add(link);
    }
    return { neighborMap: nMap, linksByNode: lMap };
  }, [data]);

  const updateHighlight = useCallback(
    (node: GraphNode | null) => {
      highlightNodes.current.clear();
      highlightLinks.current.clear();
      if (node) {
        highlightNodes.current.add(node.id);
        const neighbors = neighborMap.get(node.id);
        if (neighbors) neighbors.forEach((n) => highlightNodes.current.add(n));
        const links = linksByNode.get(node.id);
        if (links) links.forEach((l) => highlightLinks.current.add(l));
      }
      setHoveredNode(node);
    },
    [neighborMap, linksByNode]
  );

  // Setup forces + bloom
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;

    fg.d3Force("charge")?.strength(-120);
    fg.d3Force("link")?.distance(40);

    // Add bloom post-processing
    if (bloomEnabled) {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        1.5, // strength
        0.4, // radius
        0.1 // threshold
      );
      fg.postProcessingComposer().addPass(bloomPass);
    }

    setTimeout(() => fg.zoomToFit(800, 80), 1500);
  }, [bloomEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live traffic updates
  useEffect(() => {
    const interval = setInterval(() => {
      for (const link of data.links as any[]) {
        link.traffic = 1 + Math.floor(Math.random() * 3);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [data]);

  // Click handler: zoom to node
  const handleNodeClick = useCallback(
    (node: any) => {
      setSelectedNode(node);
      const fg = graphRef.current;
      if (!fg) return;
      const distance = node.isProtocol ? 120 : 80;
      const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      fg.cameraPosition(
        {
          x: (node.x || 0) * distRatio,
          y: (node.y || 0) * distRatio,
          z: (node.z || 0) * distRatio,
        },
        { x: node.x, y: node.y, z: node.z },
        1200
      );
    },
    []
  );

  // Custom 3D node objects
  const nodeThreeObject = useCallback(
    (node: any) => {
      const isProtocol = node.isProtocol;
      const isWhale = node.id?.toString().startsWith("whale-");
      const groupIdx = (node.group ?? 0) % GROUP_COLORS.length;
      const color = GROUP_COLORS[groupIdx];
      const { r, g, b } = hexToRgb(color);

      const isHighlighted = highlightNodes.current.has(node.id);
      const hasHover = hoveredNode !== null;
      const dimmed = hasHover && !isHighlighted;

      // Size
      let radius: number;
      if (isProtocol) radius = 6;
      else if (isWhale) radius = 3.5;
      else radius = 1.2 + (node.val || 2) * 0.25;

      const group = new THREE.Group();

      // Inner sphere (solid core)
      const coreGeom = new THREE.SphereGeometry(radius, 24, 16);
      const coreMat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(r, g, b),
        emissive: new THREE.Color(r * 0.4, g * 0.4, b * 0.4),
        emissiveIntensity: isHighlighted ? 2.5 : dimmed ? 0.1 : 0.6,
        transparent: true,
        opacity: dimmed ? 0.15 : isHighlighted ? 1 : 0.85,
        shininess: 80,
      });
      const core = new THREE.Mesh(coreGeom, coreMat);
      group.add(core);

      // Outer glow shell
      if ((isProtocol || isWhale || isHighlighted) && !dimmed) {
        const glowRadius = radius * (isHighlighted ? 2.0 : 1.6);
        const glowGeom = new THREE.SphereGeometry(glowRadius, 16, 12);
        const glowMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(r, g, b),
          transparent: true,
          opacity: isHighlighted ? 0.2 : 0.08,
          side: THREE.BackSide,
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        group.add(glow);
      }

      // Ring for protocols
      if (isProtocol) {
        const ringGeom = new THREE.RingGeometry(radius * 1.3, radius * 1.5, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(r, g, b),
          transparent: true,
          opacity: isHighlighted ? 0.6 : 0.25,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(ringGeom, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      }

      // Text sprite for protocols and whales
      if (isProtocol || (isWhale && isHighlighted)) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        const text = node.name || String(node.id);
        const fontSize = isProtocol ? 48 : 36;
        canvas.width = 512;
        canvas.height = 128;
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillText(text, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          opacity: dimmed ? 0.1 : isHighlighted ? 1 : 0.8,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        const labelScale = isProtocol ? 28 : 20;
        sprite.scale.set(labelScale, labelScale * 0.25, 1);
        sprite.position.y = radius + (isProtocol ? 5 : 3);
        group.add(sprite);
      }

      return group;
    },
    [hoveredNode] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Link color based on hover
  const linkColorFn = useCallback(
    (link: any) => {
      if (highlightLinks.current.has(link)) {
        const srcNode = typeof link.source === "object" ? link.source : null;
        if (srcNode) {
          const c = GROUP_COLORS[(srcNode.group ?? 0) % GROUP_COLORS.length];
          return c;
        }
        return "#6366f1";
      }
      if (hoveredNode) return `rgba(255,255,255,0.02)`;
      return `rgba(255,255,255,${linkOpacity})`;
    },
    [hoveredNode, linkOpacity]
  );

  const linkWidthFn = useCallback(
    (link: any) => {
      if (highlightLinks.current.has(link)) return 2;
      if (hoveredNode) return 0.1;
      return (link.value || 1) * 0.3;
    },
    [hoveredNode]
  );

  const particleWidthFn = useCallback(
    (link: any) => {
      if (highlightLinks.current.has(link)) return 3;
      return 1;
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <>
      <ForceGraph3D
        ref={graphRef}
        graphData={data}
        width={width}
        height={height}
        backgroundColor="#030308"
        showNavInfo={false}
        // Node config
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={() => ""}
        onNodeClick={handleNodeClick}
        onNodeHover={(node: any) => updateHighlight(node || null)}
        onNodeDragEnd={(node: any) => {
          node.fx = node.x;
          node.fy = node.y;
          node.fz = node.z;
        }}
        enableNodeDrag={true}
        // Link config
        linkColor={linkColorFn}
        linkWidth={linkWidthFn}
        linkOpacity={0.6}
        linkCurvature={(link: any) => {
          // Slight curvature for cross-group links
          const s = typeof link.source === "object" ? link.source : null;
          const t = typeof link.target === "object" ? link.target : null;
          if (s && t && s.group !== t.group) return 0.15;
          return 0;
        }}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={0.85}
        linkDirectionalArrowColor={linkColorFn}
        linkDirectionalParticles={showParticles ? 2 : 0}
        linkDirectionalParticleWidth={particleWidthFn}
        linkDirectionalParticleSpeed={(link: any) =>
          ((link as any).traffic || 1) * 0.003 * speedMult
        }
        linkDirectionalParticleColor={(link: any) => {
          const srcNode = typeof link.source === "object" ? link.source : null;
          return srcNode
            ? GROUP_COLORS[(srcNode.group ?? 0) % GROUP_COLORS.length]
            : "#6366f1";
        }}
        // Force engine
        warmupTicks={80}
        cooldownTime={5000}
        d3AlphaDecay={0.03}
        d3VelocityDecay={0.4}
      />

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-glass-bg border border-glass-border rounded-xl backdrop-blur-xl p-3 z-20 max-h-[50vh] overflow-y-auto">
        <h4 className="text-[10px] font-bold uppercase tracking-wide text-white/40 m-0 mb-2">
          Protocol Groups
        </h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {PROTOCOL_GROUPS.map((g, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: g.color, boxShadow: `0 0 6px ${g.color}60` }}
              />
              <span className="text-[10px] text-white/50 whitespace-nowrap">{g.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <ControlPanel title="Wallet Network">
        <div className="flex gap-1.5 mb-2">
          <Button label="Fit View" onClick={() => graphRef.current?.zoomToFit(600, 60)} />
          <Button
            label="Reset Pins"
            onClick={() => {
              for (const node of data.nodes as any[]) {
                node.fx = undefined;
                node.fy = undefined;
                node.fz = undefined;
              }
              graphRef.current?.d3ReheatSimulation();
            }}
          />
        </div>
        <Slider label="TX Speed" value={speedMult} min={0.1} max={5} step={0.1} onChange={setSpeedMult} />
        <Slider label="Link Glow" value={linkOpacity} min={0.02} max={0.4} step={0.01} onChange={setLinkOpacity} />
        <Toggle label="Particles" checked={showParticles} onChange={setShowParticles} />
        <Toggle label="Bloom" checked={bloomEnabled} onChange={setBloomEnabled} />
        <p className="text-[10px] text-white/25 mt-2 leading-snug">
          {data.nodes.length.toLocaleString()} nodes &middot; {data.links.length.toLocaleString()} links
        </p>
        <p className="text-[9px] text-white/15 mt-1 leading-snug">
          Drag nodes to pin &middot; Click to inspect &middot; Scroll to zoom
        </p>
      </ControlPanel>

      <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
    </>
  );
}
