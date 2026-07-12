# Benjamin Moore official palette provenance

The files in `source/` were downloaded on 2026-07-12 from Benjamin Moore's
official [Color Palette Downloads for Design Professionals](https://www.benjaminmoore.com/en-us/architects-designers/download-benjamin-moore-color-palettes)
page. The repository contains the 11 English (United States) Adobe Swatch
Exchange palettes linked there on that date:

- Affinity Color Collection
- Benjamin Moore Classics
- Color Trends 2026 Palette
- Color Stories
- Color Preview
- Historical Colors
- Off White Collection
- Williamsburg Color Collection
- America's Colors
- Designer Classics
- Colors for Vinyl

Run `npm run catalog:benjamin-moore` to parse the official ASE RGB values,
normalize codes, merge duplicate collection membership, validate conflicts, and
regenerate `data/generated/benjamin-moore-colors.json` plus its manifest. The
manifest records the source URLs, byte sizes, SHA-256 hashes, record counts, and
deterministic catalog version.

The generated values are for digital preview only. JQ Bookcases does not claim
an official Benjamin Moore partnership. On-screen color depends on the display,
lighting, paint product, substrate, and sheen; customers must confirm the final
physical color with an official Benjamin Moore sample.
