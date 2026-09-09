import { OpenAppletOptions, OpenedApplet } from "../../core/host";
import { EmRadiationCanvas } from "./EmRadiationCanvas";

export function openEmRadiationApplet(options?: OpenAppletOptions): OpenedApplet {
  return {
    id: "em-radiation",
    title: "Light, heat, and spectra",
    description:
      "Blackbody spectra with emitter presets and human-seen vs EM false-color views, plus a schematic atomic absorption/emission mode.",
    close: () => {
      options?.host?.onClose?.();
    },
    render: () => <EmRadiationCanvas host={options?.host} />
  };
}
