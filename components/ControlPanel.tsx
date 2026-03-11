"use client";

import { ReactNode } from "react";

interface ControlPanelProps {
  title: string;
  children: ReactNode;
}

export default function ControlPanel({ title, children }: ControlPanelProps) {
  return (
    <div className="absolute top-3 right-3 w-60 bg-glass-bg border border-glass-border rounded-xl backdrop-blur-xl p-3.5 z-20">
      <h3 className="text-xs font-bold uppercase tracking-wide text-white/55 m-0 mb-3">{title}</h3>
      {children}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-stretch mb-2 gap-1">
      <label className="text-xs text-white/65 whitespace-nowrap">
        {label}: <span className="text-accent font-mono text-[11px]">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-0.5 accent-accent h-1"
      />
    </div>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex justify-between items-center mb-2 gap-2">
      <label className="text-xs text-white/65">{label}</label>
      <button
        className={`px-2.5 py-0.5 rounded border text-[11px] cursor-pointer transition-all duration-150 ${
          checked
            ? "bg-accent text-white border-accent"
            : "bg-transparent text-white/40 border-glass-border"
        }`}
        onClick={() => onChange(!checked)}
      >
        {checked ? "ON" : "OFF"}
      </button>
    </div>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex justify-between items-center mb-2 gap-2">
      <label className="text-xs text-white/65">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/5 border border-glass-border text-white/80 px-2 py-1 rounded text-xs flex-1 max-w-[130px] [&_option]:bg-[#1a1a2e] [&_option]:text-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Button({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "success";
}) {
  const variantClasses =
    variant === "danger"
      ? "border-red-500/30 text-red-500 hover:bg-red-500/10"
      : variant === "success"
        ? "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
        : "border-glass-border text-white/80 hover:bg-white/10";

  return (
    <button
      className={`px-3 py-1.5 rounded-md bg-white/5 cursor-pointer text-xs transition-all duration-150 flex-1 border ${variantClasses}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
