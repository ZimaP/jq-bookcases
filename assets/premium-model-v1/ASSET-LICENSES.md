# Premium model preview asset licenses

## White Oak Veneer

- Creator: Jenelle van Heerden / Poly Haven
- Source: https://polyhaven.com/a/white_oak_veneer
- License: CC0 1.0 Universal
- License page: https://polyhaven.com/license
- Source resolution used: 1K JPEG diffuse, OpenGL normal, and roughness maps
- Runtime derivative: local 1024 × 1024 WebP encodes. The base color has a deterministic low-contrast cabinet-finish tone balance; no AI generation or painted seam detail.
- Cabinet projection: the original 0.5 m tile is mapped with a deterministic 0.52 m cross-grain × 1.6 m long-grain period to avoid short repeating cathedral patterns on tall casework.

The source maps are used only by the isolated `modelQuality=premium-v1` 3D preview.

## Natural Oak workplace-reference synthesis

- Reference source: five project-owner-supplied workplace photographs captured on August 25, 2026.
- Reference role: appearance, grain language, pore scale, and neutral oak color only; the photographs themselves are not shipped.
- Runtime derivative: a new seamless square base-color texture was synthesized from the reference set, then deterministic 1024 × 1024 normal and roughness maps were derived locally with FFmpeg and encoded to WebP with `cwebp`.
- Scope: selected only for the `natural-oak` finish; the existing White Oak and clear-maple/interior texture path remains unchanged.
- Calibration status: visual appearance reference only. The material is not identified as a manufacturer product, exact oak species, approved SKU, or manufacturer-calibrated finish.
- Exclusions: no room background, wall, floor, tape, outlet, panel edge, baked highlight, or baked shadow from the photographs is present in the runtime asset.

## European Walnut Veneer 05

- Creator: Jenelle van Heerden / Poly Haven
- Source: https://polyhaven.com/a/european_walnut_veneer_05
- License: CC0 1.0 Universal
- License page: https://polyhaven.com/license
- Source resolution used: 1K JPEG diffuse, OpenGL normal, and roughness maps
- Runtime derivative: local 1024 × 1024 WebP encodes. The base color has a deterministic low-contrast neutral cabinet-finish tone balance so Light, Medium, and Dark Walnut remain distinct without becoming a noisy board pattern.
- Cabinet projection: the original 1 m tile keeps its 1 m cross-grain scale and uses a deterministic 2.25 m long-grain period. The texture's horizontal grain axis is explicitly mapped to the authored long axis of each audited cabinet part.

The source maps are used only by the isolated `modelQuality=premium-v1` 3D preview.
