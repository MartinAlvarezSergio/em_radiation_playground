# Atomic spectra teaching model

The atomic view opens by default at `?applet=em-radiation`. Select H, He, Na, or Ca⁺,
choose emission/absorption/continuum, and select a line in the plot or the right-hand
reference. **Line zoom** shows an 8 nm window around that line; **Visible** restores
380–750 nm. Line selection also updates the photon color and the energy-level aid.
Plot lines and reference buttons support keyboard selection.

## Wavelengths

Representative rest wavelengths in **standard air**, in nm, from the NIST Handbook
of Basic Atomic Spectroscopic Data (consulted 2026-09-11):

- [H I](https://physics.nist.gov/PhysRefData/Handbook/Tables/hydrogentable2.htm):
  four Balmer lines, Hδ through Hα. Hα 656.28 and Hβ 486.133 are rounded
  representatives of the listed fine-structure components; those components are
  not resolved in this model.
- [He I](https://physics.nist.gov/PhysRefData/Handbook/Tables/heliumtable2.htm):
  six selected visible lines; a representative component is used for each multiplet.
- [Na I](https://physics.nist.gov/PhysRefData/Handbook/Tables/sodiumtable2.htm):
  the D₂/D₁ doublet, 588.995 and 589.5924 nm.
- [Ca II](https://physics.nist.gov/PhysRefData/Handbook/Tables/calciumtable2.htm):
  K/H at 393.366 and 396.847 nm, explicitly singly ionized calcium. These are
  calcium lines, not hydrogen Hα/Hβ.

These are deliberately incomplete line lists. Wavelength positions are sourced;
the displayed strengths are illustrative and are not measured ratios, oscillator
strengths, abundances, or predictions for a particular star or nebula.

## Profiles and rendering

Each emission line is a Gaussian with a fixed sigma of 0.07 nm. Absorption uses
the product of `1 - 0.88 * strength * Gaussian` over a continuum normalized to one.
Continuum mode is flat at one. It represents a continuum-normalized spectrum,
not a flat physical Planck spectrum. All views use a fixed vertical scale.

Sampling includes each exact line center and its wings. Changing the wavelength
window does not change the line widths or strengths. The colored strip uses the
same wavelength mapping as the curve and approximate display colors. Its minimum
display width keeps unresolved lines visible in the full visible range; zoom is
needed to separate the sodium doublet. The applet does not model instrumental
resolution, detailed radiative transfer, level populations, or ionization balance.

## Energy levels and light path

For hydrogen, the selected Balmer levels use `E_n ≈ -13.6 / n² eV`, relative to
ionization. Other species show only the selected energy gap, with generic upper
and lower levels; no hydrogen-like quantum numbers or absolute energies are
assigned to them. Photon energy is approximately `1239.841984 / lambda_nm eV`.
Using air rather than vacuum wavelengths introduces less than 0.04% error in this
visible range, below the two-decimal eV display precision here.

Emission arrows go downward and absorption arrows upward. In continuum mode no
transition arrow is shown. The source–gas–observer aid is a static schematic;
its photon wave is color-linked to the selected line, with arbitrary spatial scale.
Absorption depicts removal from the observer's line of sight, not photon destruction.

The code and data are local; source links are optional and no network fetch is
needed to use the applet.
