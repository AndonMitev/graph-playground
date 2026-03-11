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
// @ts-expect-error - no types
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), { ssr: false });

const GROUP_COLORS = PROTOCOL_GROUPS.map((g) => g.color);

// Pre-compute RGB values for all group colors (avoid per-frame parsing)
const GROUP_RGBS = GROUP_COLORS.map((hex) => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255,
}));

// Shared geometries — created once, reused across all nodes
let sharedGeometries: {
  protocol: THREE.SphereGeometry;
  protocolGlow: THREE.SphereGeometry;
  protocolRing: THREE.RingGeometry;
  whale: THREE.SphereGeometry;
  whaleGlow: THREE.SphereGeometry;
  wallet: THREE.SphereGeometry;
} | null = null;

function getSharedGeometries() {
  if (!sharedGeometries) {
    sharedGeometries = {
      protocol: new THREE.SphereGeometry(6, 16, 12),
      protocolGlow: new THREE.SphereGeometry(6 * 1.3, 16, 12),
      protocolRing: new THREE.RingGeometry(6 * 1.3, 6 * 1.5, 32),
      whale: new THREE.SphereGeometry(3.5, 16, 12),
      whaleGlow: new THREE.SphereGeometry(3.5 * 1.3, 12, 8),
      wallet: new THREE.SphereGeometry(1.5, 8, 6),
    };
  }
  return sharedGeometries;
}

// Store references to node materials so we can update them in-place
interface NodeRefs {
  coreMat: THREE.MeshPhongMaterial;
  glowMat?: THREE.MeshBasicMaterial;
  glowMesh?: THREE.Mesh;
  ringMat?: THREE.MeshBasicMaterial;
  labelDiv?: HTMLDivElement;
  isProtocol: boolean;
  isWhale: boolean;
  groupIdx: number;
}

export default function SocialNetworkDemo({ width, height }: { width: number; height: number }) {
  const graphRef = useRef<any>(null);
  const data = useMemo(() => generateSocialNetwork(), []);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [linkOpacity, setLinkOpacity] = useState(0.15);

  // CSS2D renderer for labels (immune to bloom)
  const [cssRenderer] = useState(() => {
    if (typeof window === "undefined") return null;
    const r = new CSS2DRenderer();
    r.domElement.style.position = "absolute";
    r.domElement.style.top = "0";
    r.domElement.style.left = "0";
    r.domElement.style.pointerEvents = "none";
    return r;
  });

  // Selection tracking via ref (no re-render needed)
  const selectedNodeRef = useRef<string | number | null>(null);

  // Hover tracking via refs (no React state — no re-renders on hover)
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const highlightNodes = useRef(new Set<string | number>());
  const highlightLinks = useRef(new Set<GraphLink>());
  const nodeRefsMap = useRef(new Map<string | number, NodeRefs>());

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

  // Update highlight sets + mutate materials in-place (no React re-render)
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
      hoveredNodeRef.current = node;

      // Mutate all node materials in-place — O(n) material updates, zero allocations
      const hasHover = node !== null;
      const selId = selectedNodeRef.current;
      nodeRefsMap.current.forEach((refs, nodeId) => {
        const isSelected = nodeId === selId;
        // Skip selected node — keep its selection styling
        if (isSelected) return;

        const isHighlighted = highlightNodes.current.has(nodeId);
        const dimmed = hasHover && !isHighlighted;
        const { r, g, b } = GROUP_RGBS[refs.groupIdx];

        // Core sphere
        refs.coreMat.emissive.setRGB(r * 0.5, g * 0.5, b * 0.5);
        refs.coreMat.emissiveIntensity = isHighlighted ? 2.5 : dimmed ? 0.1 : 0.8;
        refs.coreMat.opacity = dimmed ? 0.15 : isHighlighted ? 1 : 0.9;

        // Glow shell
        if (refs.glowMat && refs.glowMesh) {
          if (dimmed) {
            refs.glowMesh.visible = false;
          } else if (refs.isProtocol || refs.isWhale || isHighlighted) {
            refs.glowMesh.visible = true;
            refs.glowMat.opacity = isHighlighted ? 0.15 : 0.04;
          }
        }

        // Protocol ring
        if (refs.ringMat) {
          refs.ringMat.opacity = isHighlighted ? 0.6 : dimmed ? 0.05 : 0.25;
        }

      });

      // No refresh() needed — Three.js picks up material mutations on next frame
    },
    [neighborMap, linksByNode]
  );

  // FPS counter
  const [fps, setFps] = useState(0);
  const fpsFrames = useRef(0);
  const fpsLastTime = useRef(performance.now());
  useEffect(() => {
    let raf: number;
    const tick = () => {
      fpsFrames.current++;
      const now = performance.now();
      if (now - fpsLastTime.current >= 1000) {
        setFps(fpsFrames.current);
        fpsFrames.current = 0;
        fpsLastTime.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Track whether bloom has been applied
  const bloomApplied = useRef(false);

  // Setup forces
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-120);
    fg.d3Force("link")?.distance(40);
    setTimeout(() => fg.zoomToFit(800, 80), 1500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bloom - poll until composer is ready
  useEffect(() => {
    if (!bloomEnabled) {
      bloomApplied.current = false;
      return;
    }
    const interval = setInterval(() => {
      const fg = graphRef.current;
      if (!fg || bloomApplied.current) {
        if (bloomApplied.current) clearInterval(interval);
        return;
      }
      try {
        const composer = fg.postProcessingComposer();
        if (composer) {
          const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(width, height),
            1.2,
            0.4,
            0.2
          );
          composer.addPass(bloomPass);
          bloomApplied.current = true;
          clearInterval(interval);
        }
      } catch {
        // not ready yet
      }
    }, 100);
    return () => clearInterval(interval);
  }, [bloomEnabled, width, height]);

  // Apply/remove selection styling on a node's material + label
  const applySelection = useCallback((nodeId: string | number | null, selected: boolean) => {
    if (nodeId == null) return;
    const refs = nodeRefsMap.current.get(nodeId);
    if (!refs) return;
    const { r, g, b } = GROUP_RGBS[refs.groupIdx];
    if (selected) {
      // Brighten group color + boost emissive (keeps identity, just brighter)
      refs.coreMat.emissive.setRGB(r * 0.8, g * 0.8, b * 0.8);
      refs.coreMat.emissiveIntensity = 2;
      refs.coreMat.opacity = 1;
      // Style label with cyan border + text for clear selection indicator
      if (refs.labelDiv) {
        refs.labelDiv.style.color = "#00ffff";
        refs.labelDiv.style.borderColor = "#00ffff";
        refs.labelDiv.style.borderWidth = "2px";
        refs.labelDiv.style.background = "rgba(0,255,255,0.15)";
      }
    } else {
      // Restore defaults
      refs.coreMat.emissive.setRGB(r * 0.5, g * 0.5, b * 0.5);
      refs.coreMat.emissiveIntensity = 0.8;
      refs.coreMat.opacity = 0.9;
      // Restore label style
      if (refs.labelDiv) {
        const color = GROUP_COLORS[refs.groupIdx];
        refs.labelDiv.style.color = "white";
        refs.labelDiv.style.borderColor = `${color}50`;
        refs.labelDiv.style.borderWidth = "1px";
        refs.labelDiv.style.background = "rgba(0,0,0,0.75)";
      }
    }
  }, []);

  // Click handler: zoom to node
  const handleNodeClick = useCallback(
    (node: any) => {
      // Deselect previous
      applySelection(selectedNodeRef.current, false);
      // Select new
      selectedNodeRef.current = node.id;
      applySelection(node.id, true);
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

  // Create node objects ONCE — no dependency on hover state
  const nodeThreeObject = useCallback(
    (node: any) => {
      const geoms = getSharedGeometries();
      const isProtocol = !!node.isProtocol;
      const isWhale = !!node.id?.toString().startsWith("whale-");
      const groupIdx = (node.group ?? 0) % GROUP_COLORS.length;
      const color = GROUP_COLORS[groupIdx];
      const { r, g, b } = GROUP_RGBS[groupIdx];

      const group = new THREE.Group();

      // Core sphere — shared geometry, unique material
      const coreGeom = isProtocol ? geoms.protocol : isWhale ? geoms.whale : geoms.wallet;
      const coreColor = new THREE.Color(r, g, b);
      const coreMat = new THREE.MeshPhongMaterial({
        color: coreColor,
        emissive: new THREE.Color(r * 0.5, g * 0.5, b * 0.5),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9,
        shininess: 80,
      });
      group.add(new THREE.Mesh(coreGeom, coreMat));

      // Glow shell for protocols + whales
      let glowMat: THREE.MeshBasicMaterial | undefined;
      let glowMesh: THREE.Mesh | undefined;
      if (isProtocol || isWhale) {
        const glowGeom = isProtocol ? geoms.protocolGlow : geoms.whaleGlow;
        glowMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(r, g, b),
          transparent: true,
          opacity: 0.04,
          side: THREE.BackSide,
        });
        glowMesh = new THREE.Mesh(glowGeom, glowMat);
        group.add(glowMesh);
      }

      // Ring for protocols
      let ringMat: THREE.MeshBasicMaterial | undefined;
      if (isProtocol) {
        ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(r, g, b),
          transparent: true,
          opacity: 0.25,
          side: THREE.DoubleSide,
        });
        const ring = new THREE.Mesh(geoms.protocolRing, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
      }

      // CSS2D label for protocols — rendered as HTML overlay, immune to bloom
      let labelDiv: HTMLDivElement | undefined;
      if (isProtocol) {
        labelDiv = document.createElement("div");
        labelDiv.textContent = node.name || String(node.id);
        labelDiv.style.cssText = `
          font: bold 13px -apple-system, BlinkMacSystemFont, sans-serif;
          color: white;
          background: rgba(0,0,0,0.75);
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid ${color}50;
          white-space: nowrap;
          pointer-events: none;
        `;
        const label = new CSS2DObject(labelDiv);
        label.position.set(0, 10, 0);
        group.add(label);
      }

      // Store material refs for in-place updates
      nodeRefsMap.current.set(node.id, {
        coreMat,
        glowMat,
        glowMesh,
        ringMat,
        labelDiv,
        isProtocol,
        isWhale,
        groupIdx,
      });

      return group;
    },
    [] // No dependencies — objects created once
  );

  // Pre-compute link colors on data
  useMemo(() => {
    for (const link of data.links as any[]) {
      const sid = typeof link.source === "object" ? (link.source as GraphNode).id : link.source;
      const srcNode = (data.nodes as any[]).find((n: any) => n.id === sid);
      link._color = srcNode ? GROUP_COLORS[(srcNode.group ?? 0) % GROUP_COLORS.length] : "#6366f1";
    }
  }, [data]);

  // Link accessors use refs, not state — stable callbacks
  const linkColorFn = useCallback(
    (link: any) => {
      if (highlightLinks.current.has(link)) {
        return link._color || "#6366f1";
      }
      if (hoveredNodeRef.current) return `rgba(255,255,255,0.02)`;
      return `rgba(255,255,255,${linkOpacity})`;
    },
    [linkOpacity]
  );

  const linkWidthFn = useCallback(
    (link: any) => {
      if (highlightLinks.current.has(link)) return 2;
      if (hoveredNodeRef.current) return 0.1;
      return (link.value || 1) * 0.3;
    },
    []
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
        extraRenderers={cssRenderer ? [cssRenderer] : []}
        // Node config
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={(node: any) => node.name || String(node.id)}
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
          const s = typeof link.source === "object" ? link.source : null;
          const t = typeof link.target === "object" ? link.target : null;
          if (s && t && s.group !== t.group) return 0.15;
          return 0;
        }}
        linkResolution={6}
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
        <Slider label="Link Glow" value={linkOpacity} min={0.02} max={0.4} step={0.01} onChange={setLinkOpacity} />
        <Toggle label="Bloom" checked={bloomEnabled} onChange={setBloomEnabled} />
        <p className="text-[10px] text-white/25 mt-2 leading-snug">
          {data.nodes.length.toLocaleString()} nodes &middot; {data.links.length.toLocaleString()} links
        </p>
        <p className="text-[9px] text-white/15 mt-1 leading-snug">
          Drag nodes to pin &middot; Click to inspect &middot; Scroll to zoom
        </p>
      </ControlPanel>

      <NodeDetail node={selectedNode} onClose={() => {
        applySelection(selectedNodeRef.current, false);
        selectedNodeRef.current = null;
        setSelectedNode(null);
      }} />

      {/* FPS */}
      <div className="absolute bottom-3 right-3 bg-glass-bg border border-glass-border rounded-lg backdrop-blur-xl px-2.5 py-1.5 z-20 font-mono text-[11px]">
        <span className={fps >= 50 ? "text-emerald-400" : fps >= 30 ? "text-yellow-400" : "text-red-400"}>
          {fps}
        </span>
        <span className="text-white/30"> fps</span>
      </div>
    </>
  );
}
