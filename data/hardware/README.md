# JQ hardware catalog

This directory contains the audited, version-controlled MVP source data for direct-on-model decorative hardware editing.

## Files and provenance

- `jq-hardware-catalog.seed.json` is the runtime catalog, copied byte-for-byte from the supplied `JQ_Bookcases_Direct_Edit_Hardware_Package (1).zip`. Catalog version: `2026.07.14-mvp.1`. SHA-256: `a18c25c7002ff178361392d9a76982da7b8cdf48e03daae249ab9feb44006e3d`.
- `jq-hardware-evidence.csv` is the accompanying research-evidence ledger, also copied byte-for-byte from the package. SHA-256: `36c5bc75ed01c2b4c4ca890c86e0ddf4403900da7c8388f3f0bfc70ef217240a`. It is provenance for review only and is **not runtime application data**.

The seed has 17 canonical finish groups, 6 brands, 10 collections, 12 product families, 32 size variants, 47 family-scoped finish variants, and 124 exact variants. Manufacturer finish IDs are family-scoped; the same finish ID in two families is not a collision. Canonical finishes are filter groups, not substitutions for exact manufacturer names or codes.

Do not hand-edit facts in either package artifact. Replace them only with a reviewed source package that preserves IDs, source URLs, verification dates, caveats, explicit nulls, and rights posture, then update the catalog version, hashes, embedded migration snapshots, and tests together.

## Runtime contract

[`hardware-catalog.js`](../../hardware-catalog.js) exports:

- `validateHardwareCatalog(catalog)` for schema, ID, relationship, dimension, pricing, availability, source, Cartesian-combination, and asset/license checks;
- `createHardwareCatalogIndex(catalog)` for synchronous maps, factual variant snapshots, and search records;
- `loadHardwareCatalog(fetchImpl?)` for the same-origin local JSON request and validation;
- `createHardwareVariantSnapshot(indexOrCatalog, id)` for a cloned denormalized exact-variant record;
- `searchHardwareCatalog(indexOrCatalog, query, filters, sort)` for exact-variant query/filter/sort results;
- state helpers `createLegacyHardwareSelections`, `normalizeHardwareSelections`, `resolveHardwareSelectionForHost`, and `projectVariantToLegacyHardware`;
- `getHardwareProxySpec(selectionOrSnapshot)` for millimeter geometry, mounting, finish, accuracy, license, fallback, and release-review facts.

The loader has no manufacturer or retailer runtime dependency. Official links in snapshots are attribution/reference links only. No manufacturer photography, logos, textures, CAD, or exact geometry is bundled.

## Selection state

Committed design state stores both the catalog ID and a denormalized factual snapshot so layout, BOM, restore, and quote flows stay synchronous and a retired variant remains explainable:

```js
{
  schemaVersion: 1,
  catalogVersion: "2026.07.14-mvp.1",
  defaultVariantId: "exact-variant-id",
  defaultSnapshot: { /* denormalized manufacturer and specification facts */ },
  byHostId: {
    "stable-semantic-host-id": {
      variantId: "exact-variant-id",
      snapshot: { /* denormalized facts */ },
      placement: {
        orientation: "horizontal" | "vertical",
        horizontalAnchor: "left" | "center" | "right" | "custom",
        verticalAnchor: "top" | "middle" | "bottom" | "custom",
        edgeOffsetMm: 0,
        crossAxisOffsetMm: 0,
        mirrored: false,
        quantityPerFront: 1
      }
    }
  },
  migrationWarnings: []
}
```

`null` means an audited unknown value. It is never normalized to numeric zero. Zero center-to-center means verified single-hole mounting and is intentionally preserved.

## Legacy mapping

| Legacy token | Exact catalog variant |
| --- | --- |
| `brass_knob` | `armac-queslett-knob__armac-qk34__armac-bel` |
| `matte_black_knob` | `armac-queslett-knob__armac-qk34__armac-mbl` |
| `brass_pull` | `atlas-oskar-pull__atlas-oskar-6-3125__atlas-wb` |
| `matte_black_pull` | `atlas-oskar-pull__atlas-oskar-6-3125__atlas-bl` |
| `polished_nickel_pull` | `atlas-oskar-pull__atlas-oskar-6-3125__atlas-pn` |

Unknown legacy tokens use the safe `brass_knob` preview fallback but remain verbatim in a structured `UNKNOWN_LEGACY_HARDWARE` migration warning for human review.

## Intentional validation warnings

The unmodified seed is valid with two warnings:

1. Emtek SELECT Rectangular Bar Smooth remains release-gated because the linked specification filename says “Knurled”; those variants remain resolvable but are not newly selectable.
2. Buster + Punch Pull Bar / Cross intentionally or accidentally lacks the `bp-cross-large` × `bp-cross-steel` exact combination. Missing Cartesian combinations are reported and never synthesized.

Pricing follows the audited seed exactly: `reference_unit` has a positive amount plus source and checked date; `band` has a text band with explicit null amount/source/date; `quote_only` has explicit null amount/band/source/date. Every mode retains its disclosure note and currency. Reference/list amounts are not guaranteed retail prices.
