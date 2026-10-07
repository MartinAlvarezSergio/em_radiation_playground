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
