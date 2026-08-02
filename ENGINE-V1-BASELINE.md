# Luxury configurator engine v1 — baseline

Audit date: 2026-08-02

## Revisions and supplied package

- Repository HEAD before engine work: `4e2eb2a46919df74f69a2a9e49d8728094667c51` on `agent/architectural-dimensions`.
- Production `origin/main` observed before integration: `ae58c3ad1f5f90183898214069764cf0534d2743`.
- Supplied archive SHA-256: `ded6d3c2f3c1d4f83f1f9f66ef67ba832e4b12bb8c4f3aa33e7f61bbb5da0940`.
- Master prompt SHA-256: `d7b32f4d2193850b92cafa3b5b1d8e77e09992d262b7fabae722f4b9f174e6f0`.
- Every file in the archive matched `MANIFEST.sha256`.

## Existing live preview call sites

The guided project state in `guided-configurator-state.js` stores customer measurements, but it also resolves and persists a `previewAsset`. The browser flow in `guided-configurator.js` calls `renderConceptPreview()` in both Customization and Review, retains `renderConceptFinishOverlay()` and the room/furniture/finish-mask fallback sources, and mounts `guided-configurator-3d.js` over those assets.

The feature-branch Three.js path improved continuity but did not yet satisfy the physical contract:

- `guided-scene-plan.js` declared its output `guided-concept-only` and produced renderer-oriented target zones.
- `GuidedSceneController.update()` converted that plan and rebuilt the entire scene on every update.
- `renderProductPlan()` selected product-specific drawing routines, which calculated sections, shelves, cabinet fronts, base/top parts, TV dimensions, and feature avoidance inside the renderer.
- `createProductMaterials()` created a procedural canvas wood texture with fixed repeat values. It did not use the supplied albedo/normal/roughness/AO maps or physical part dimensions.
- `buildProjectSummary()`, local save/reload, and quote submission used raw UI state, not a validated accepted descriptor graph and geometry fingerprint.

Production `main` had intentionally rolled the guided Three.js prototype back while retaining the opaque product/room composite, clear-wall furniture layer, and pixel-mask finish corrections. Those paths changed selected imagery and tint masks; they did not regenerate fitted casework from the complete measurement object.

## Baseline verification

- `npm run build`: passed.
- `npm test`: 534 tests passed before merging current `origin/main`; 536 passed after the merge resolution.
- Initial Playwright run: 41 passed and 8 failed. The run overlapped the `origin/main` merge and therefore is recorded only as a diagnostic baseline, not a stable regression result. Failures included the existing Clear Wall overlay-ratio assertion and guided-flow timing/state mismatches while files were changing.
- The baseline TV Unit → Right Niche → 120 × 96 × 14 in → 65 in TV flow showed a two-sided center-recess-like room, a boxy renderer-derived product, and no auditable fit summary.

## Root cause

The UI measurement model and the visual construction model were separate. Images or renderer-authored heuristics represented the product while measurements mainly affected labels, approximate room bounds, and camera framing. There was no atomic topology → fit → product → validation transaction whose accepted output simultaneously drove the renderer, review, save/reload, pricing input, and quote payload.
