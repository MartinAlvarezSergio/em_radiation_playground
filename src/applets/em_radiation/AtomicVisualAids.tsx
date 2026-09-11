import { useId } from "react";
import { hydrogenLevelEnergyEv, photonEnergyEv, type SpectralLine } from "./atomicLines";
import { atomicLineColor } from "./atomicColor";
import type { AtomicViewMode } from "./types";

function photonPath(x0: number, x1: number, y: number): string {
  return Array.from({ length: 65 }, (_, i) => {
    const t = i / 64;
    return `${i === 0 ? "M" : "L"}${x0 + (x1 - x0) * t},${y + 5 * Math.sin(t * Math.PI * 8)}`;
  }).join(" ");
}

export function AtomicLightPath({ view, line, compact }: { view: AtomicViewMode; line: SpectralLine; compact: boolean }): JSX.Element {
  const id = useId();
  const color = atomicLineColor(line.lambdaNm);
  const gasX = view === "emission" ? (compact ? 80 : 140) : (compact ? 190 : 350);
  const sourceX = compact ? 48 : 95;
  const observerX = compact ? 352 : 687;
  const gasHalf = compact ? 40 : 57;
  const descriptions = {
    emission: "Excited gas emits light toward the observer.",
    absorption: "Light from a hot source crosses cooler gas. The selected wavelength is absorbed along the line of sight.",
    continuum: "Light from a hot source reaches the observer without intervening gas."
  };
  return (
    <svg className="atomic-light-path" viewBox={`0 0 ${compact ? 400 : 800} 122`} role="img" aria-label={descriptions[view]}>
      <defs>
        <radialGradient id={`${id}-star`}>
          <stop stopColor="#fffbe3" /><stop offset="0.7" stopColor="#ffd88a" />
          <stop offset="1" stopColor="#e5a053" />
        </radialGradient>
        <marker id={`${id}-arrow`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7" fill="#bbc9da" />
        </marker>
      </defs>
      {view !== "emission" && <>
        <circle cx={sourceX} cy={49} r={24} fill={`url(#${id}-star)`} />
        <text x={sourceX} y={105} textAnchor="middle">Hot source</text>
        <path d={`M${sourceX + 34},49 H${view === "absorption" ? gasX - gasHalf - 9 : observerX - 36}`}
          stroke="#e6e7df" strokeWidth={8} opacity={0.28} />
        {view === "absorption" && <path d={photonPath(sourceX + 34, gasX - gasHalf - 8, 49)} stroke={color} strokeWidth={3} fill="none" />}
      </>}
      {view !== "continuum" && <>
        <rect x={gasX - gasHalf} y={19} width={gasHalf * 2} height={61} rx={20}
          fill={view === "emission" ? "#243346" : "#172431"} stroke="#7697b6" strokeDasharray="4 4" />
        {[[-30, -10], [-5, 14], [24, -13], [34, 10], [-27, 16], [0, -9]].map(([x, y], i) => (
          <circle key={i} cx={gasX + x} cy={49 + y} r={3.5} fill={view === "emission" ? "#f2dcb0" : "#90b9dc"} />
        ))}
        <text x={gasX} y={105} textAnchor="middle">{view === "emission" ? "Excited gas" : "Cooler gas"}</text>
        {view === "absorption" && <>
          <path d={`M${gasX + gasHalf + 9},49 H${observerX - 36}`} stroke="#e6e7df" strokeWidth={8} opacity={0.22} />
          <path d={`M${gasX},18 l14,-13 M${gasX},81 l14,11`} stroke={color} strokeWidth={2} />
        </>}
        {view === "emission" && <path d={photonPath(gasX + gasHalf + 10, observerX - 43, 49)} stroke={color} strokeWidth={3} fill="none" />}
      </>}
      <path d={`M${observerX - 81},67 H${observerX - 36}`} fill="none" stroke="#bbc9da" strokeWidth={1.5} markerEnd={`url(#${id}-arrow)`} />
      <g transform={`translate(${observerX - 687} 0)`} stroke="#c0d6eb" fill="#26394c" strokeWidth={2}>
        <path d="M667,31 L709,40 L705,63 L663,54 Z" />
        <path d="M687,60 v12 m0,-1 l-14,16 m14,-16 l14,16" fill="none" />
      </g>
      <text x={observerX} y={105} textAnchor="middle">Observer</text>
    </svg>
  );
}

export function AtomicTransition({ line, view }: { line: SpectralLine; view: AtomicViewMode }): JSX.Element {
  const id = useId();
  const color = atomicLineColor(line.lambdaNm);
  const hydrogen = line.lowerN != null && line.upperN != null;
  const lowerEnergy = hydrogen ? hydrogenLevelEnergyEv(line.lowerN!) : 0;
  const upperEnergy = hydrogen ? hydrogenLevelEnergyEv(line.upperN!) : photonEnergyEv(line.lambdaNm);
  const energyScale = hydrogen ? 60 : 38;
  const lowerY = hydrogen ? 235 : 170;
  const upperY = lowerY - (upperEnergy - lowerEnergy) * energyScale;
  const ionizationY = lowerY + lowerEnergy * energyScale;
  const emission = view === "emission";
  const startY = emission ? upperY + 7 : lowerY - 7;
  const endY = emission ? lowerY - 9 : upperY + 9;
  const midpoint = (upperY + lowerY) / 2;
  const lowerLabel = hydrogen ? `n = ${line.lowerN}` : "Lower level";
  const upperLabel = hydrogen ? `n = ${line.upperN}` : "Upper level";
  const direction = view === "continuum" ? "No transition" : emission
    ? `${upperLabel} to ${lowerLabel}; photon emitted` : `${lowerLabel} to ${upperLabel}; photon absorbed`;
  return (
    <div className="atomic-transition">
      <div className="atomic-reference-heading">
        <strong>{hydrogen ? "Hydrogen levels" : "Energy gap"}</strong>
        <span>{view === "continuum" ? "Reference" : emission ? "Emission ↓" : "Absorption ↑"}</span>
      </div>
      <svg viewBox={`0 0 264 ${hydrogen ? 253 : 192}`} role="img" aria-label={`${direction}. Energy gap approximately ${photonEnergyEv(line.lambdaNm).toFixed(2)} electron volts.`}>
        <defs>
          <marker id={`${id}-arrow`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7" fill="#fff1bf" />
          </marker>
        </defs>
        {hydrogen && <>
          <line x1={14} x2={250} y1={ionizationY} y2={ionizationY} stroke="#526171" strokeDasharray="3 4" />
          <text x={14} y={ionizationY - 11} className="atomic-svg-muted">Ionization</text>
          <text x={250} y={ionizationY - 11} textAnchor="end" className="atomic-svg-muted">0 eV</text>
        </>}
        {[[upperY, upperLabel, upperEnergy], [lowerY, lowerLabel, lowerEnergy]].map(([y, label, energy]) => (
          <g key={label}>
            <line x1={14} x2={250} y1={Number(y)} y2={Number(y)} stroke="#acc7df" strokeWidth={2} />
            <text x={14} y={Number(y) - 10}>{label}</text>
            {hydrogen && <text x={250} y={Number(y) - 10} textAnchor="end" className="atomic-svg-muted">{Number(energy).toFixed(2)} eV</text>}
          </g>
        ))}
        {view !== "continuum" && <>
          <line x1={103} x2={103} y1={startY} y2={endY} stroke="#fff1bf" strokeWidth={2.5} markerEnd={`url(#${id}-arrow)`} />
          <path d={photonPath(125, 238, midpoint)} stroke={color} strokeWidth={3} fill="none" />
          <path d={emission ? `M235,${midpoint - 5} l6,5 l-6,5` : `M130,${midpoint - 5} l-6,5 l6,5`}
            stroke={color} strokeWidth={2} fill="none" />
        </>}
      </svg>
      <p className="atomic-energy" aria-live="polite">ΔE ≈ hc/λ = <strong>{photonEnergyEv(line.lambdaNm).toFixed(2)} eV</strong></p>
    </div>
  );
}
