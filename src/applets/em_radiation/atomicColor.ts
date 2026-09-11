/** Illustrative visible-spectrum colors, not calibrated colorimetry. */
export function atomicLineColor(lambdaNm: number): string {
  const wavelength = Math.min(750, Math.max(380, lambdaNm));
  let r = 0;
  let g = 0;
  let b = 0;
  if (wavelength < 440) {
    r = (440 - wavelength) / 60;
    b = 1;
  } else if (wavelength < 490) {
    g = (wavelength - 440) / 50;
    b = 1;
  } else if (wavelength < 510) {
    g = 1;
    b = (510 - wavelength) / 20;
  } else if (wavelength < 580) {
    r = (wavelength - 510) / 70;
    g = 1;
  } else if (wavelength < 645) {
    r = 1;
    g = (645 - wavelength) / 65;
  } else {
    r = 1;
  }
  const channel = (value: number): number => Math.round(255 * value ** 0.8);
  return `rgb(${channel(r)}, ${channel(g)}, ${channel(b)})`;
}
