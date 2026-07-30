# Guided 3D Concept Scene

## Purpose

The public guided configurator uses a code-native Three.js scene to make the
customer's approximate room and selected fitted furniture read as one spatial
concept. It replaces normal-path photo compositing with actual room and product
geometry while preserving approved static photography as a graceful fallback.

This is a concept renderer. It is explicitly separate from the accepted-design
renderer and from every physical layout, bill-of-material, quantity, pricing,
and manufacturing decision.

## Public flow

One guided scene controller, WebGL renderer, canvas, camera, and Three.js scene
persist through public steps 3–5. The runtime may move its canvas between the
step-specific hosts, but it must not create a second viewer or reset the room
into an unrelated photographic composition.

| Step | Scene responsibility |
| --- | --- |
| 3 — Room & Size | Render the selected room topology and measurement-driven architecture. Show dimension lines anchored in world space, with projected labels. |
| 4 — Customization | Keep the same room and camera basis, add the selected concept product, and update its visible finish and supported details. |
| 5 — Review & Details | Keep the same room/product concept available as the visual summary of the guided project. |

Room surfaces, architectural features, and concept cabinetry occupy one
`THREE.Scene`. They share the same perspective camera, depth buffer, lighting,
occlusion, and shadows. The product is not a transparent cutout, billboard, or
photograph placed inside a separate room photograph.

## Measurement-driven scene contract

`guided-configurator-state.js` normalizes the customer's approximate
measurements and reports non-blocking range or spatial warnings.
`guided-scene-plan.js` converts that guided state into a renderer-neutral,
inch-based scene plan. The plan describes:

- room bounds and layout topology;
- walls, floor, returns, recesses, projections, and explicit openings;
- product target zones and concept-product descriptors;
- dimension anchors and labels;
- selection and appearance values needed by the concept scene.

`guided-configurator-3d.js` consumes that plan and converts inches to scene
units in one place. Changing a supported width, height, depth, return, opening,
or clearance changes the corresponding geometry instead of merely changing
text over a fixed image.

Dimension lines use the same world-space anchors as the geometry they describe.
Their text labels may live in a DOM overlay for legibility, but their screen
positions are projected from the active Three.js camera. They are not authored
as fixed SVG coordinates over a photograph.

When an entered dimension cannot fit inside another entered envelope, the form
shows a live, non-blocking spatial warning. If the concept scene must fit that
feature to the available room geometry, its callout reports both the dimension
shown and the value entered; it must never label clamped geometry with the
unclamped value.

Architectural openings are explicit exclusions in the product target zones.
Category features such as a TV, window, or radiator are placed in available
wall intervals when their position was not explicitly measured. Concept
cabinetry must honor those exclusions rather than crossing a door, window,
fireplace, projection, or opening.

## Persistence and updates

`guided-configurator.js` owns one lazily created guided scene controller. State
changes update the existing controller; navigation between steps 3–5 remounts
the same runtime where necessary. The scene may rebuild descriptor-driven
content, but the WebGL renderer and canvas remain the same until the guided
application is disposed.

Rapid measurement input is coalesced before rebuilding scene geometry; a
finalized value renders immediately.

The selected layout remains the same room across measurement, customization,
and review. Adding the product does not swap to a photograph with a different
lens, horizon, crop, or room proportions.

## Graceful photo fallback

Approved room-layout and integrated concept photos remain available only when
the Three.js module cannot load, WebGL initialization fails, or the guided
runtime otherwise cannot render safely. Fallback presentation must:

- use the approved asset mapped to the selected room and product where one
  exists;
- avoid presenting image zoom as true 3D orbit or depth;
- remain usable without concealing the measurement and project controls;
- never be layered into the working WebGL scene as a fake room or product.

Static photography is not the normal rendering path for steps 3–5 and is not a
source of geometry.

Fallback photo and finish-mask URLs remain deferred while WebGL is loading or
ready. The application hydrates those assets only after the scene enters its
fallback state, so the normal 3D path does not download an integrated
photo-composite behind the canvas.

## Explicit boundary from accepted design

The guided scene answers: “How could this selection sit in this approximate
space?” It does not answer: “Is this the accepted, manufacturable design?”

In particular, the guided renderer and scene plan must not:

- create or certify physical part geometry;
- calculate generated quantities, bills of material, estimates, or prices;
- claim structural, installation, or manufacturing validity;
- become the source of truth for an accepted customer design;
- bypass validation owned by the physical configurator and domain engines.

The accepted-design path remains owned by `configurator-3d.js` together with
the physical configuration, layout, render-contract, billable, BOM, and pricing
modules. If guided selections later enter that path, they must be translated
and validated through its public contracts; concept-scene meshes are never
reused as accepted physical output.

## File ownership

- `guided-configurator-data.js` — guided catalog and room/selection definitions.
- `guided-configurator-state.js` — project normalization, approximate validation,
  summaries, and persistence.
- `guided-scene-plan.js` — pure scene-plan construction in measurement space.
- `guided-configurator-3d.js` — persistent Three.js concept renderer and
  interaction.
- `guided-configurator.js` — public step orchestration, lazy loading, and
  controller updates.
- Approved files under `assets/photos/configurator/room-layouts/` and
  `assets/photos/configurator/integrated/` — graceful fallback imagery only.
