# JQ Bookcases Engine Hardening Audit

**Audit date:** 2026-07-11  
**Working branch:** `engine-hardening-supervisor`  
**Repository:** `ZimaP/jq-bookcases`

## Executive finding

The project already has a strong foundation: `bookcase-layout.js` is a pure, deterministic descriptor generator with structured validation and a meaningful test suite.

The largest remaining risk is not the basic frame math. The largest risk is that the rest of the application does not consistently treat the validated descriptor graph as the only source of truth.

The engine can therefore pass layout tests while the customer sees, prices, or saves a different design.

## Priority defects

| Priority | Defect | Why it matters | Primary files |
| --- | --- | --- | --- |
| P0 | Renderer recalculates visible geometry | Validation proves descriptor boxes, but renderer-only crown/base/shelf/door details can still be misplaced, oversized, duplicated, or colliding. | `configurator-3d.js`, `bookcase-layout.js` |
| P0 | Candidate state is committed before validation outcome is honored | Controls, summary, price, and save state can represent an invalid candidate while the viewer keeps the previous valid model. | `configurator-3d.js` |
| P0 | Price and design ID are based on configuration instead of accepted generated quantities | Auto-corrections and suppressed special-zone components can make the estimate disagree with the visible model. | `bookcase-pricing.js`, `configurator-3d.js` |
| P1 | Two overlapping normalization systems | `normalizeBookcaseConfig` and `normalizeLayoutConfig` can disagree about supported values, aliases, counts, and corrections. | `bookcase-config.js`, `bookcase-layout.js` |
| P1 | `doorCount` is accepted as a customer field but physical doors follow section openings | A visible control/value that geometry ignores is a trust-breaking product bug even when a warning is generated. | `bookcase-config.js`, `bookcase-layout.js`, `configurator-3d.js` |
| P1 | Renderer rebuilds and disposes the complete model for every update | Rapid sliders and preset switching can create avoidable GPU churn, flicker, or resource leaks. Stable descriptor IDs are not yet used as an update key. | `configurator-3d.js` |
| P1 | Renderer decorative meshes are not represented by validated bounds | Front bands, reveals, rails, highlights, and profile approximations can extend beyond the descriptor that was collision-checked. | `configurator-3d.js` |
| P1 | No automated descriptor-to-scene parity check | There is no test proving every physical descriptor is rendered once and that no extra construction component exists only in the scene. | renderer tests needed |
| P1 | No browser visual regression suite | Node tests cannot detect z-fighting, incorrect profile scale, camera clipping, stale objects, visual leakage between bays, or model/price desynchronization. | E2E/visual tests needed |
| P2 | Collision model is AABB-only and closed-state-only | It does not model hinge swing, drawer travel, profile-level collisions, or load/material engineering. | `bookcase-layout.js` |

## Code-level evidence and interpretation

### 1. Renderer boundary is not strict enough

The intended architecture says the renderer should consume descriptor size and position without recalculating layout. Current rendering paths still include special geometry logic such as:

- `renderLayoutBase`
- `renderLayoutCrown`
- `addShelf`
- `addDoor`
- `addLayoutHandle`
- `addLayoutLight`

There are also legacy geometry helpers farther down `configurator-3d.js`, including bay-based and config-based calculations. Even when some are currently unused, their presence makes regression easy and obscures which path owns construction truth.

Required fix:

- inventory every geometry-producing function;
- prove call reachability;
- remove dead legacy builders;
- render each physical descriptor exactly once;
- represent any visible overhang/detail with explicit visual bounds or child descriptors;
- add a runtime scene audit.

### 2. UI update is not transactional

The current update flow normalizes a candidate, generates a layout, assigns state, updates controls/price/summary, and calls the viewer. The viewer rejects an invalid model by keeping the old scene, but the surrounding UI has already moved forward.

That creates a split-brain state:

```text
controls / price / save payload = candidate
visible model = last valid design
```

Required fix:

- maintain accepted artifacts separately;
- evaluate a candidate without mutating accepted state;
- commit state, layout, BOM, price, controls, and model together only after validation;
- on failure, retain or restore accepted controls and pricing;
- expose the rejected candidate as an error, not as the current design.

### 3. Pricing is configuration-driven

`bookcase-pricing.js` currently estimates shelf, section, lower-cabinet, hardware, and lighting costs from normalized configuration values. It does not consume the accepted descriptor graph.

This can disagree with:

- auto-reduced sections or shelves;
- feature zones that suppress shelves or lower cabinets;
- mixed drawer/door sections;
- tall storage;
- generated primary versus secondary doors;
- actual light count and type;
- actual trim/crown component count.

Required fix:

- derive a BOM from accepted layout components;
- calculate price from BOM plus explicit non-geometric selections;
- return a transparent breakdown;
- version the pricing table;
- save the pricing version and layout fingerprint.

### 4. Normalization ownership is duplicated

`bookcase-config.js` performs UI normalization and legacy mapping. `bookcase-layout.js` performs a second normalization and correction pass. This is workable only if the contracts are formally separated and tested.

Observed warning signs include:

- separate min/max logic;
- separate alias tables;
- hardware behavior that differs between UI options and layout support;
- requested versus applied section/shelf values;
- layout metadata being normalized in more than one place.

Required fix:

Define four explicit stages:

1. raw UI parsing;
2. legacy migration;
3. canonical customer-state validation;
4. construction feasibility correction.

Only one stage may own each rule.

### 5. Stable IDs are generated but not fully exploited

The layout engine creates stable descriptor IDs, which is excellent. The viewer currently rebuilds the whole model rather than reconciling by ID.

Required fix:

- maintain `Map<componentId, Object3D>`;
- update transforms/material variants for existing IDs;
- create new IDs;
- remove and dispose deleted IDs;
- reuse shared geometry/material resources when possible;
- verify resource counts after long update sequences.

## Hardening strategy

### Gate A — Canonical truth

Deliverables:

- one documented configuration contract;
- idempotent normalization tests;
- explicit corrections;
- layout fingerprint;
- accepted-state transaction helper.

Exit condition:

No layer can hold a different accepted configuration.

### Gate B — Renderer parity

Deliverables:

- no active legacy construction builders;
- strict descriptor renderer;
- explicit visual bounds/details;
- scene parity audit;
- stable object IDs or documented leak-free rebuild strategy.

Exit condition:

```text
rendered physical IDs === validated physical descriptor IDs
```

### Gate C — BOM and estimate parity

Deliverables:

- deterministic BOM;
- price breakdown from BOM;
- pricing version;
- save/quote payload tied to accepted layout fingerprint.

Exit condition:

The same accepted design always regenerates the same BOM, breakdown, total, and design ID.

### Gate D — Automated reliability

Deliverables:

- deterministic matrix tests;
- seeded fuzz tests;
- mutation tests;
- browser E2E tests;
- visual regression screenshots;
- resource-cycle tests;
- CI workflow.

Exit condition:

No release is possible while any gate fails.

## Test matrix required before release

At minimum, automate:

1. all ten presets;
2. all dimension boundaries;
3. every section count and supported shelf count;
4. every shelf thickness;
5. lower cabinets on/off;
6. doors, drawers, mixed storage, tall storage, and glass doors;
7. media, desk, fireplace, display, and asymmetric layouts;
8. every base and crown style;
9. every hardware and lighting option;
10. every light temperature;
11. valid, corrected, and rejected section-ratio scenarios;
12. rapid sequential changes;
13. save/load/migration;
14. model-price-save synchronization;
15. 100+ update resource cycles.

## Release-blocking invariants

- All accepted physical sizes are finite and positive.
- Root dimensions match the accepted nominal dimensions exactly.
- Component IDs are unique and deterministic.
- Parent and host references resolve.
- Attachments touch declared faces.
- Unauthorized solids do not overlap.
- Sections and openings contain their owned content.
- No renderer-only construction component exists.
- No physical descriptor is missing from the scene.
- Invalid candidates cannot alter accepted price or persistence.
- BOM counts match descriptor counts.
- Save/load regenerates the same layout fingerprint.
- Repeated updates do not produce unbounded WebGL resource growth.

## Information needed from the owner

These answers improve manufacturing and pricing accuracy but do not block architectural hardening:

1. The worst three broken configurations, with preset and exact input values.
2. Screenshots or short recordings from front and 3/4 views.
3. Target browser/device priority.
4. Whether `doorCount` is a genuine selectable product rule or should be removed and derived.
5. Final fabrication rules for shelf span, shelf thickness, lower cabinet height, reveals, crown/base overhang, and supported feature-opening widths.
6. Final pricing rates and whether automatic corrections should immediately change the displayed estimate.
7. Preferred invalid-input behavior: auto-correct, block, or offer the nearest valid alternatives.

## Immediate work order

1. Add CI and a seeded combinatorial engine test.
2. Add an accepted-state transaction module and tests.
3. Add BOM derivation and make pricing consume accepted layout data.
4. Audit and remove renderer-side construction calculations.
5. Add descriptor-to-scene parity diagnostics.
6. Add Playwright E2E and visual baselines.
7. Run the full matrix, fix failures by root cause, and only then merge.
