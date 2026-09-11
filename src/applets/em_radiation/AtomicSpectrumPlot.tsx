import { useId, useMemo } from "react";
import {
  ATOMIC_LINE_SIGMA_NM, buildAtomicSpectrum,
  type AtomicSpecies, type SpectralLine, type SpectralWindow
} from "./atomicLines";
import { atomicLineColor } from "./atomicColor";
import type { AtomicViewMode } from "./types";

type Props = {
  width: number;
  species: AtomicSpecies;
  view: AtomicViewMode;
  window: SpectralWindow;
  selected: SpectralLine;
  onSelect: (line: SpectralLine) => void;
};

const STRIP_Y = 46;
const STRIP_H = 62;
const BASE_Y = 340;
const PLOT_H = 182;

export function AtomicSpectrumPlot({ width, species, view, window, selected, onSelect }: Props): JSX.Element {
  const id = useId();
  const LEFT = width < 440 ? 44 : 64;
  const WIDTH = width - LEFT - 24;
  const { minNm, maxNm } = window;
  const span = maxNm - minNm;
  const xAt = (lambdaNm: number): number => LEFT + ((lambdaNm - minNm) / span) * WIDTH;
  const yAt = (value: number): number => BASE_Y - value * PLOT_H;
  const samples = useMemo(() => buildAtomicSpectrum(species.id, view, { minNm, maxNm }),
    [species.id, view, minNm, maxNm]);
  const path = samples.map((sample, i) =>
    `${i === 0 ? "M" : "L"}${xAt(sample.lambdaNm).toFixed(3)},${yAt(sample.value).toFixed(3)}`
  ).join(" ");
  const visibleLines = species.lines.filter((line) => line.lambdaNm >= minNm && line.lambdaNm <= maxNm);
  const tickStep = span < 20 ? (width < 440 ? 2 : 1) : (width < 440 ? 100 : 50);
  const ticks: number[] = [];
  for (let tick = Math.ceil(minNm / tickStep) * tickStep; tick <= maxNm; tick += tickStep) ticks.push(tick);
  const colorAt = atomicLineColor;
  const label = view[0].toUpperCase() + view.slice(1);

  return (
    <div className="atomic-plot-scroll">
      <svg className="atomic-spectrum-svg" viewBox={`0 0 ${width} 404`} role="group"
        aria-label={`${species.label} ${view} spectrum`}>
        <defs>
          <linearGradient id={`${id}-rainbow`}>
            {Array.from({ length: 81 }, (_, i) => (
              <stop key={i} offset={i / 80} stopColor={colorAt(minNm + (i / 80) * span)} />
            ))}
          </linearGradient>
          <clipPath id={`${id}-strip`}>
            <rect x={LEFT} y={STRIP_Y} width={WIDTH} height={STRIP_H} rx={5} />
          </clipPath>
          {visibleLines.map((line, i) => (
            <linearGradient key={line.lambdaNm} id={`${id}-line-${i}`}>
              {Array.from({ length: 25 }, (_, j) => (
                <stop key={j} offset={j / 24}
                  stopColor={view === "absorption" ? "#000" : colorAt(line.lambdaNm)}
                  stopOpacity={Math.exp(-0.5 * ((j - 12) / 2) ** 2) * line.strength * (view === "absorption" ? 0.88 : 1)} />
              ))}
            </linearGradient>
          ))}
        </defs>
        <text x={LEFT} y={27} className="atomic-svg-heading">{label}</text>
        <text x={LEFT + WIDTH} y={27} textAnchor="end" className="atomic-svg-muted">
          {minNm.toFixed(span < 20 ? 1 : 0)}–{maxNm.toFixed(span < 20 ? 1 : 0)} nm
        </text>
        <rect x={LEFT} y={STRIP_Y} width={WIDTH} height={STRIP_H} rx={5}
          fill={view === "emission" ? "#000" : `url(#${id}-rainbow)`} />
        <g clipPath={`url(#${id}-strip)`} aria-hidden="true">
          {view !== "continuum" && visibleLines.map((line, i) => {
            // A minimum display width keeps unresolved lines visible in the overview.
            const sigmaPx = Math.max(0.75, ATOMIC_LINE_SIGMA_NM * WIDTH / span);
            return <rect key={line.lambdaNm} x={xAt(line.lambdaNm) - 6 * sigmaPx}
              y={STRIP_Y} width={12 * sigmaPx} height={STRIP_H} fill={`url(#${id}-line-${i})`} />;
          })}
        </g>
        <rect x={LEFT} y={STRIP_Y} width={WIDTH} height={STRIP_H} rx={5}
          fill="none" stroke="#536070" />

        <text x={LEFT} y={139} className="atomic-svg-muted">
          {view === "emission" ? "Relative intensity" : "Intensity / continuum"}
        </text>
        {[0, 0.5, 1].map((value) => (
          <g key={value} className="atomic-gridline">
            <line x1={LEFT} x2={LEFT + WIDTH} y1={yAt(value)} y2={yAt(value)} />
            <text x={LEFT - 12} y={yAt(value) + 5} textAnchor="end">{value}</text>
          </g>
        ))}
        {ticks.map((tick) => (
          <g key={tick} className="atomic-gridline">
            <line x1={xAt(tick)} x2={xAt(tick)} y1={153} y2={BASE_Y + 5} />
            <text x={xAt(tick)} y={BASE_Y + 27} textAnchor="middle">{tick}</text>
          </g>
        ))}
        <path d={`${path} L${LEFT + WIDTH},${BASE_Y} L${LEFT},${BASE_Y} Z`}
          fill="#acd9ff" opacity={0.07} />
        <path d={path} fill="none" stroke="#d4eaff" strokeWidth={2} strokeLinejoin="round" />
        {view !== "continuum" && visibleLines.map((line) => {
          const active = selected === line;
          return (
            <g key={line.lambdaNm} className="atomic-plot-line" role="button" tabIndex={0}
              aria-label={`Select ${line.label} ${line.lambdaNm.toFixed(2)} nm`}
              aria-pressed={active} onClick={() => onSelect(line)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(line);
                }
              }}>
              <title>{line.label} · {line.lambdaNm.toFixed(2)} nm</title>
              <rect className="atomic-line-target" x={xAt(line.lambdaNm) - 8} y={STRIP_Y - 6}
                width={16} height={BASE_Y - STRIP_Y + 12} fill="transparent" />
              <path d={`M${xAt(line.lambdaNm)},${STRIP_Y - 5} V${STRIP_Y + STRIP_H + 5} M${xAt(line.lambdaNm)},151 V${BASE_Y + 5}`}
                stroke={active ? "#fff1bf" : "transparent"} strokeDasharray="3 5" strokeWidth={1.3}
                pointerEvents="none" />
              {active && <path d={`M${xAt(line.lambdaNm) - 5},${STRIP_Y - 13} h10 l-5,6 Z`} fill="#fff1bf" />}
            </g>
          );
        })}
        <text x={LEFT + WIDTH / 2} y={395} textAnchor="middle" className="atomic-svg-muted">
          Wavelength (nm, air)
        </text>
      </svg>
    </div>
  );
}
