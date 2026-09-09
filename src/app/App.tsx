import { useMemo } from "react";
import { AppletHostAdapter } from "../core/host";
import { EmRadiationCanvas } from "../applets/em_radiation/EmRadiationCanvas";

export function App(): JSX.Element {
  const host: AppletHostAdapter = useMemo(
    () => ({
      onClose: () => {},
      readReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    }),
    []
  );

  return (
    <div className="app-shell">
      <main>
        <section className="modal card">
          <EmRadiationCanvas host={host} />
        </section>
      </main>
    </div>
  );
}
