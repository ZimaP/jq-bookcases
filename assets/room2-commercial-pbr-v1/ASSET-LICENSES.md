# Room 2 commercial PBR v1 asset notices

This file covers the new production-sidecar assets under this directory. The
Room 2 appearance remains a provisional digital preview and is not a calibrated
or approved physical finish sample.

## Oak Veneer 01

- Asset: `textures/oak/base-color.webp`, `textures/oak/normal.webp`, and
  `textures/oak/roughness.webp`
- Original: **Oak Veneer 01** by Jenelle van Heerden
- Source: <https://polyhaven.com/a/oak_veneer_01>
- License: CC0 1.0 Universal, <https://creativecommons.org/publicdomain/zero/1.0/>
- Modifications: the 1K diffuse, OpenGL normal, and roughness maps were resized
  to 512 px; the diffuse map was neutralized and lightly blurred; the roughness
  map was converted to grayscale and range-adjusted; all maps were encoded as
  local WebP sidecars. Exact source and derived hashes and commands are recorded
  in `config/room2-commercial-pbr-v1-assets.json`.

## Texture de noyer

- Asset: `textures/walnut/base-color.webp` and
  `textures/walnut/roughness.webp`
- Original: **Texture de noyer.jpg** by Cyril5555
- Source: <https://commons.wikimedia.org/wiki/File:Texture_de_noyer.jpg>
- License selected for this derivative: CC BY-SA 3.0,
  <https://creativecommons.org/licenses/by-sa/3.0/>
- Attribution: © Cyril5555; original and derivative are shared under CC BY-SA
  3.0.
- Modifications: a 2048 px square was cropped and rotated. Translation-only
  half-width and half-height cyclic offsets were blended through deterministic
  edge bands to make the texture wrap; no flip, reflection, or mirrored pixels
  were used. The result was resized to 512 px, neutralized, and encoded as the
  base-color WebP. A grayscale range-adjusted derivative supplies the roughness
  map. No walnut normal map is used. Exact source and derived hashes and
  commands are recorded in `config/room2-commercial-pbr-v1-assets.json`.

## Repository-owned sources

The paint micro-normal, paint roughness, and neutral studio HDRI are derived
from existing JQ Bookcases repository-owned visualization assets. Their exact
repository commit, source hashes, derived hashes, and transformation commands
are recorded in `config/room2-commercial-pbr-v1-assets.json`.
