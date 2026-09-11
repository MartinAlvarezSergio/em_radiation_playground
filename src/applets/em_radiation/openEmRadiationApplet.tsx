import { OpenAppletOptions, OpenedApplet } from "../../core/host";
import { EmRadiationCanvas } from "./EmRadiationCanvas";

export function openEmRadiationApplet(options?: OpenAppletOptions): OpenedApplet {
  return {
    id: "em-radiation",
    title: "Light, heat, and spectra",
    description:
      "Atomic spectra with line zoom and energy levels, plus blackbody and EM-wave views.",
    close: () => {
      options?.host?.onClose?.();
    },
    render: () => <EmRadiationCanvas host={options?.host} />
  };
}
