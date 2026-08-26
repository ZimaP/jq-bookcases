# Premium model preview asset licenses

## White Oak Veneer

- Creator: Jenelle van Heerden / Poly Haven
- Source: https://polyhaven.com/a/white_oak_veneer
- License: CC0 1.0 Universal
- License page: https://polyhaven.com/license
- Source resolution reviewed: official 1K JPEG diffuse, OpenGL normal, and roughness maps
- Runtime derivative: the official diffuse was used as an appearance reference for a new seamless, vertically grained furniture-veneer albedo synthesis. A deterministic 1024 × 1024 luminance-gradient normal and bounded roughness map were derived locally with FFmpeg and encoded with `cwebp`.
- Generated source SHA-256: `ddcc79814ed38b7b7da1b7d55f7be035772640fd5f606a1464a853b9d6ab594c`
- Scope: `white-oak` exterior cabinetry only. Clear-maple/interior construction retains the accepted repository oak map.
- Calibration status: visual appearance reference only; not a manufacturer-calibrated finish, certified species sample, or approved SKU.
- Cabinet projection: the original 0.5 m tile is mapped with a deterministic 0.52 m cross-grain × 1.6 m long-grain period to avoid short repeating cathedral patterns on tall casework.

The source maps are used only by the isolated `modelQuality=premium-v1` 3D preview.

## Natural Oak workplace-reference synthesis

- Reference source: five project-owner-supplied workplace photographs captured on August 25, 2026.
- Reference role: appearance, grain language, pore scale, and neutral oak color only; the photographs themselves are not shipped.
- Runtime derivative: a new seamless square base-color texture was synthesized from the reference set, then deterministic 1024 × 1024 normal and roughness maps were derived locally with FFmpeg and encoded to WebP with `cwebp`.
- Scope: selected only for the `natural-oak` finish; the existing White Oak and clear-maple/interior texture path remains unchanged.
- Calibration status: visual appearance reference only. The material is not identified as a manufacturer product, exact oak species, approved SKU, or manufacturer-calibrated finish.
- Exclusions: no room background, wall, floor, tape, outlet, panel edge, baked highlight, or baked shadow from the photographs is present in the runtime asset.

## Natural Walnut Veneer

- Creator: Jenelle van Heerden / Poly Haven
- Source: https://polyhaven.com/a/natural_walnut_veneer
- License: CC0 1.0 Universal
- License page: https://polyhaven.com/license
- Source resolution reviewed: official 1K JPEG diffuse, OpenGL normal, and roughness maps
- Runtime derivative: the official diffuse was used as an appearance reference for one seamless, vertically grained furniture-veneer albedo synthesis. Light, Medium, and Dark Walnut receive separate deterministic base-color derivatives instead of a runtime tint overlay; they share aligned deterministic normal and bounded roughness maps.
- Generated source SHA-256: `a65dac230796d654aa861b87cc54302aa67e6cf9dccff5442dba3d547f030c7f`
- Cabinet projection: deterministic 0.72 m cross-grain × 2.25 m long-grain period, with the texture V axis mapped to the authored long axis of each audited cabinet part.
- Calibration status: visual appearance references only; the three tones are not manufacturer-calibrated products, certified species samples, or approved SKUs.

The source maps are used only by the isolated `modelQuality=premium-v1` 3D preview.

## Cabinet paint micro-surface

- Source: existing accepted repository sprayed-paint normal and roughness maps.
- Runtime derivative: no new color catalog or remote texture. Each existing paint color keeps its canonical state value while receiving a bounded finish-specific satin response, subtle micro-normal scale, and highlight energy selected to preserve door/profile readability on light and dark colors.
- Scope: Shop-Primed, Warm White, Soft Ivory, Light Greige, Sage Gray, and Charcoal only.
- Calibration status: visual rendering response only; no manufacturer, paint code, color standard, or SKU calibration is claimed.

## iOS floor-image derivatives

- Source: the exact embedded maple-floor PNG already present in each authoritative Fireplace, Door Wall, and Window Wall GLB.
- Runtime derivative: a deterministic 1024 × 1024 JPEG (`source-maple-floor-ios-v1.jpg`) made from that embedded source image at quality 82. It is used only inside the three `-ios-v1.glb` mobile delivery assets.
- Scope: iPhone and touch-iPad model loading only. Desktop selects the original authoritative GLBs.
- Geometry contract: nodes, meshes, accessors, materials, texture bindings, transforms, pivots, bounds, and every non-floor buffer view remain byte-equivalent to their authoritative source. Only the embedded floor image payload, its MIME type, required later buffer offsets, buffer length, and a provenance marker differ.
- Purpose: reduce per-scene transfer by about 5.7 MB and floor decode memory from about 16 MB to about 4 MB so iOS WebKit can complete parsing without changing the visible model design.
- License: project-owned derivative of an existing project asset; no remote or third-party content was added.
