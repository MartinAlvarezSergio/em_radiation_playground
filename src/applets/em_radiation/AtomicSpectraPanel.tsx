import { useEffect, useRef, useState, type ReactNode } from "react";
import { ATOMIC_SPECIES, atomicSpecies, atomicWindow, type SpectralLine } from "./atomicLines";
import { AtomicSpectrumPlot } from "./AtomicSpectrumPlot";
import { AtomicLightPath, AtomicTransition } from "./AtomicVisualAids";
import { atomicLineColor } from "./atomicColor";
import type { AtomicSpeciesId, AtomicViewMode } from "./types";

const VIEWS: { id: AtomicViewMode; label: string }[] = [
  { id: "emission", label: "Emission" },
  { id: "absorption", label: "Absorption" },
  { id: "continuum", label: "Continuum" }
];

export function AtomicSpectraPanel({ modeControl }: { modeControl: ReactNode }): JSX.Element {
  const [speciesId, setSpeciesId] = useState<AtomicSpeciesId>("hydrogen");
  const [view, setView] = useState<AtomicViewMode>("emission");
  const [selectedNm, setSelectedNm] = useState(656.28);
  const [zoomed, setZoomed] = useState(false);
  const observationRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(800);
  useEffect(() => {
    const element = observationRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setPlotWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const species = atomicSpecies(speciesId);
  const selected = species.lines.find((line) => line.lambdaNm === selectedNm) ?? species.lines[0];
  const window = atomicWindow(selected, zoomed);

  function selectSpecies(id: AtomicSpeciesId): void {
    const next = atomicSpecies(id);
    setSpeciesId(id);
    setSelectedNm(next.lines.reduce((a, b) => a.strength >= b.strength ? a : b).lambdaNm);
  }

  function selectLine(line: SpectralLine): void {
    setSelectedNm(line.lambdaNm);
  }

  return (
    <section className="atomic-lab" aria-label="Atomic spectra lab">
      <header className="atomic-header">
        <h2>Atomic spectra</h2>
        {modeControl}
      </header>
      <div className="atomic-toolbar">
        <div className="atomic-segmented atomic-elements" role="group" aria-label="Element">
          {ATOMIC_SPECIES.map((atom) => (
            <button key={atom.id} type="button" aria-pressed={speciesId === atom.id}
              aria-label={atom.id === "calcium" ? "Calcium, singly ionized" : atom.label}
              title={`${atom.label} · ${atom.ion}`} onClick={() => selectSpecies(atom.id)}>
              {atom.symbol}
            </button>
          ))}
        </div>
        <div className="atomic-segmented" role="group" aria-label="Spectrum type">
          {VIEWS.map((option) => (
            <button key={option.id} type="button" aria-pressed={view === option.id}
              onClick={() => setView(option.id)}>{option.label}</button>
          ))}
        </div>
        <div className="atomic-segmented atomic-zoom" role="group" aria-label="Wavelength window">
          <button type="button" aria-pressed={!zoomed} onClick={() => setZoomed(false)}>Visible</button>
          <button type="button" aria-pressed={zoomed} onClick={() => setZoomed(true)}>Line zoom</button>
        </div>
      </div>
      <div className="atomic-workspace">
        <div className="atomic-observation" ref={observationRef}>
          <AtomicSpectrumPlot width={plotWidth} species={species} view={view} window={window} selected={selected} onSelect={selectLine} />
          <AtomicLightPath compact={plotWidth < 500} view={view} line={selected} />
          <p className="atomic-caption">Selected lines · schematic widths &amp; strengths</p>
        </div>
        <aside className="atomic-reference" aria-label="Line reference">
          <div className="atomic-reference-title">
            <h3>{species.label}</h3>
            <span>{species.ion}</span>
          </div>
          <div className="atomic-reference-heading"><strong>Line reference</strong><span>λ / nm</span></div>
          <div className="atomic-line-list">
            {species.lines.map((line) => (
              <button type="button" key={line.lambdaNm} className="atomic-line-button"
                aria-label={`${line.label} ${line.lambdaNm.toFixed(2)} nm`}
                aria-pressed={selected === line} onClick={() => selectLine(line)}>
                <span className="atomic-line-swatch" aria-hidden="true"
                  style={{ backgroundColor: atomicLineColor(line.lambdaNm) }} />
                <span>{line.label}</span>
                <strong>{line.lambdaNm.toFixed(2)}</strong>
              </button>
            ))}
          </div>
          <AtomicTransition line={selected} view={view} />
          <a className="atomic-source" href={species.sourceUrl} target="_blank" rel="noreferrer">NIST · rest wavelengths in air ↗</a>
        </aside>
      </div>
    </section>
  );
}
