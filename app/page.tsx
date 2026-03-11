"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const SocialNetworkDemo = dynamic(() => import("@/components/demos/SocialNetworkDemo"), { ssr: false });
const NetworkTrafficDemo = dynamic(() => import("@/components/demos/NetworkTrafficDemo"), { ssr: false });

const TABS = [
  { id: "social", label: "Wallet Network" },
  { id: "traffic", label: "TX Flow" },
];

export default function Home() {
  const [activeDemo, setActiveDemo] = useState("social");
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: Math.floor(entry.contentRect.width),
          height: Math.floor(entry.contentRect.height),
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const renderDemo = useCallback(() => {
    const { width, height } = dimensions;
    switch (activeDemo) {
      case "social":
        return <SocialNetworkDemo width={width} height={height} />;
      case "traffic":
        return <NetworkTrafficDemo width={width} height={height} />;
      default:
        return null;
    }
  }, [activeDemo, dimensions]);

  return (
    <div className="relative w-screen h-screen overflow-hidden" ref={containerRef}>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-0.5 bg-glass-bg border border-glass-border rounded-xl backdrop-blur-xl p-[3px] z-20">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-1.5 border-none bg-transparent text-white/40 cursor-pointer rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap hover:text-white/80 hover:bg-white/5 ${
              activeDemo === tab.id ? "!bg-indigo-500/20 !text-white" : ""
            }`}
            onClick={() => setActiveDemo(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {renderDemo()}
    </div>
  );
}
