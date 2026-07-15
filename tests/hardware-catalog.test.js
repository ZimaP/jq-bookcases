import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  HARDWARE_CATALOG_URL,
  HARDWARE_CATALOG_VERSION,
  HARDWARE_SELECTION_SCHEMA_VERSION,
  LEGACY_HARDWARE_VARIANT_IDS,
  LEGACY_VARIANT_SNAPSHOTS,
  createHardwareCatalogIndex,
  createHardwareVariantSnapshot,
  createLegacyHardwareSelections,
  getHardwareProxySpec,
  loadHardwareCatalog,
  normalizeHardwareSelections,
  projectVariantToLegacyHardware,
  resolveHardwareSelectionForHost,
  searchHardwareCatalog,
  validateHardwareCatalog
} from "../hardware-catalog.js";

const seedBytes = readFileSync(new URL("../data/hardware/jq-hardware-catalog.seed.json", import.meta.url));
const evidenceBytes = readFileSync(new URL("../data/hardware/jq-hardware-evidence.csv", import.meta.url));
const seed = JSON.parse(seedBytes.toString("utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const issueCodes = (issues) => issues.map((issue) => issue.code);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("package catalog and research evidence retain their audited bytes", () => {
  assert.equal(sha256(seedBytes), "a18c25c7002ff178361392d9a76982da7b8cdf48e03daae249ab9feb44006e3d");
  assert.equal(sha256(evidenceBytes), "3f288757f45e602576482fcd9b6a0c6c517cb9c83a4a8ac1dd19b8ddd6edbacd");
  assert.equal(seed.schemaVersion, "1.0.0");
  assert.equal(seed.catalogVersion, HARDWARE_CATALOG_VERSION);
  assert.match(HARDWARE_CATALOG_URL, /^\.\/data\/hardware\/jq-hardware-catalog\.seed\.json\?v=/);
});

test("the complete seed validates with only its two documented release warnings", () => {
  const validation = validateHardwareCatalog(seed);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(issueCodes(validation.warnings), [
    "RELEASE_GATE_VERIFICATION_CAVEAT",
    "MISSING_CARTESIAN_VARIANT_COMBINATIONS"
  ]);
  assert.deepEqual(validation.statistics, {
    canonicalFinishCount: 17,
    brandCount: 6,
    collectionCount: 10,
    familyCount: 12,
    sizeVariantCount: 32,
    finishVariantCount: 47,
    exactVariantCount: 124,
    sourceCount: 19,
    expectedCartesianVariantCount: 125,
    missingCartesianVariantCount: 1,
    duplicateCartesianVariantCount: 0,
    knownDimensionValueCount: 130,
    unknownDimensionValueCount: 5,
    zeroDimensionValueCount: 4,
    releaseGateWarningCount: 1,
    pricingModeCounts: { reference_unit: 64, band: 8, quote_only: 52 },
    assetStrategyCounts: { A: 0, B: 1, C: 10, D: 1 }
  });
  assert.match(validation.warnings[0].message, /SELECT Rectangular Bar Smooth/);
  assert.match(validation.warnings[1].message, /bp-cross-large \+ bp-cross-steel/);
});

test("validation is defensive and keeps finish IDs scoped to their family", () => {
  const malformed = clone(seed);
  malformed.families[0] = null;
  assert.doesNotThrow(() => validateHardwareCatalog(malformed));
  assert.equal(validateHardwareCatalog(malformed).valid, false);

  // armac-bel legitimately occurs in two separate Queslett family scopes.
  assert.equal(validateHardwareCatalog(seed).valid, true);
  const wrongScope = clone(seed);
  const variant = wrongScope.exactVariants.find((entry) => entry.familyId === "armac-queslett-knob");
  variant.finishVariantId = "emtek-us4";
  variant.id = `${variant.familyId}__${variant.sizeVariantId}__${variant.finishVariantId}`;
  const validation = validateHardwareCatalog(wrongScope);
  assert.equal(validation.valid, false);
  assert.ok(issueCodes(validation.errors).includes("UNKNOWN_FAMILY_FINISH_VARIANT"));
});

test("null dimensions stay unknown while zero is reserved for single-hole center spacing", () => {
  const index = createHardwareCatalogIndex(seed);
  const latchId = seed.exactVariants.find((entry) => entry.familyId === "emtek-cabinet-latch-2270").id;
  const latch = createHardwareVariantSnapshot(index, latchId);
  const knob = createHardwareVariantSnapshot(index, LEGACY_HARDWARE_VARIANT_IDS.brass_knob);
  const latchProxy = getHardwareProxySpec(latch);
  const knobProxy = getHardwareProxySpec(knob);

  assert.equal(latch.dimensionsMm.projection, null);
  assert.equal(latchProxy.projectionMm, null);
  assert.equal(latchProxy.centerToCenterMm, null);
  assert.equal(latchProxy.isAccurate3d, false);
  assert.equal(knob.dimensionsMm.centerToCenter, 0);
  assert.equal(knobProxy.centerToCenterMm, 0);
  assert.equal(knobProxy.mounting.holeCount, 1);
  assert.equal(knobProxy.isAccurate3d, true);

  const invalidZero = clone(seed);
  invalidZero.families[0].sizeVariants[0].dimensionsMm.width = 0;
  assert.ok(issueCodes(validateHardwareCatalog(invalidZero).errors).includes("INVALID_DIMENSION_RANGE"));

  const invalidSingleHole = clone(seed);
  const knobFamily = invalidSingleHole.families.find((family) => family.id === "armac-queslett-knob");
  knobFamily.sizeVariants[0].mounting.holeCount = 2;
  assert.ok(issueCodes(validateHardwareCatalog(invalidSingleHole).errors).includes("ZERO_CENTER_TO_CENTER_REQUIRES_SINGLE_HOLE"));
});

test("pricing and availability modes enforce the seed's explicit null/source rules", () => {
  const reference = seed.exactVariants.find((entry) => entry.pricing.mode === "reference_unit");
  const band = seed.exactVariants.find((entry) => entry.pricing.mode === "band");
  const quoteOnly = seed.exactVariants.find((entry) => entry.pricing.mode === "quote_only");

  const mutations = [
    [reference.id, (pricing) => { pricing.amount = null; }, "INVALID_REFERENCE_UNIT_AMOUNT"],
    [reference.id, (pricing) => { pricing.sourceId = null; }, "REFERENCE_UNIT_SOURCE_REQUIRED"],
    [band.id, (pricing) => { pricing.amount = 25; }, "NON_UNIT_AMOUNT_MUST_BE_NULL"],
    [band.id, (pricing) => { pricing.checkedAt = "2026-07-14"; }, "NON_UNIT_SOURCE_FIELDS_MUST_BE_NULL"],
    [quoteOnly.id, (pricing) => { pricing.priceBand = "$"; }, "QUOTE_ONLY_BAND_MUST_BE_NULL"]
  ];

  for (const [id, mutate, expectedCode] of mutations) {
    const catalog = clone(seed);
    const pricing = catalog.exactVariants.find((entry) => entry.id === id).pricing;
    mutate(pricing);
    assert.ok(issueCodes(validateHardwareCatalog(catalog).errors).includes(expectedCode), expectedCode);
  }

  const unavailable = clone(seed);
  unavailable.exactVariants[0].availability.checkedAt = null;
  assert.ok(issueCodes(validateHardwareCatalog(unavailable).errors).includes("INVALID_AVAILABILITY_DATE"));
});

test("asset strategies cannot claim exact geometry without a license record", () => {
  const unlicensedExact = clone(seed);
  unlicensedExact.families[0].asset = {
    ...unlicensedExact.families[0].asset,
    strategy: "A",
    accuracy: "licensed_exact",
    exactGeometryLicensed: true,
    licenseRecordId: null
  };
  assert.ok(issueCodes(validateHardwareCatalog(unlicensedExact).errors).includes("EXACT_ASSET_LICENSE_REQUIRED"));

  const falseClaim = clone(seed);
  falseClaim.families[0].asset.exactGeometryLicensed = true;
  assert.ok(issueCodes(validateHardwareCatalog(falseClaim).errors).includes("NON_EXACT_ASSET_LICENSE_MISMATCH"));

  const unsafePath = clone(seed);
  unsafePath.families[0].asset.localGlbPath = "../vendor/model.glb";
  assert.ok(issueCodes(validateHardwareCatalog(unsafePath).errors).includes("UNSAFE_OR_UNLICENSED_LOCAL_ASSET"));
});

test("the index resolves exact variants, scoped finishes, and immutable factual snapshots", () => {
  const index = createHardwareCatalogIndex(seed);

  assert.equal(index.kind, "jq-hardware-catalog-index");
  assert.equal(index.catalogVersion, HARDWARE_CATALOG_VERSION);
  assert.equal(index.variants.length, 124);
  assert.equal(index.variantSnapshotsById.size, 124);
  assert.equal(index.finishVariantsById.get("armac-bel").length, 2);
  assert.deepEqual(
    index.finishVariantsById.get("armac-bel").map((entry) => entry.familyId),
    ["armac-queslett-cup", "armac-queslett-knob"]
  );

  for (const [token, id] of Object.entries(LEGACY_HARDWARE_VARIANT_IDS)) {
    assert.deepEqual(createHardwareVariantSnapshot(index, id), LEGACY_VARIANT_SNAPSHOTS[token]);
    assert.deepEqual(createHardwareVariantSnapshot(index, token), LEGACY_VARIANT_SNAPSHOTS[token]);
  }
  assert.equal(createHardwareVariantSnapshot(index, "missing-variant"), null);

  const snapshot = createHardwareVariantSnapshot(index, LEGACY_HARDWARE_VARIANT_IDS.brass_pull);
  snapshot.finishName = "changed by consumer";
  assert.equal(index.variantSnapshotsById.get(snapshot.variantId).finishName, "Warm Brass");

  const releaseGated = index.variants.find((entry) => entry.familyId === "emtek-select-rectangular-smooth");
  assert.equal(releaseGated.releaseGate, true);
  assert.equal(releaseGated.selectable, false);
  assert.match(releaseGated.warnings[0].message, /specification PDF/);
});

test("the loader uses the local same-origin endpoint and rejects invalid responses", async () => {
  let request = null;
  const catalog = await loadHardwareCatalog(async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json; charset=utf-8" : null },
      json: async () => clone(seed)
    };
  });
  assert.equal(catalog.catalogVersion, HARDWARE_CATALOG_VERSION);
  assert.equal(request.url, HARDWARE_CATALOG_URL);
  assert.deepEqual(request.options, {
    credentials: "same-origin",
    cache: "force-cache",
    headers: { Accept: "application/json" }
  });

  await assert.rejects(
    () => loadHardwareCatalog(async () => ({ ok: false, status: 503 })),
    /status 503/
  );
  await assert.rejects(
    () => loadHardwareCatalog(async () => ({
      ok: true,
      headers: { get: () => "text/html" },
      json: async () => clone(seed)
    })),
    /application\/json/
  );
  await assert.rejects(
    () => loadHardwareCatalog(async () => ({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ ...clone(seed), catalogVersion: "stale" })
    })),
    (error) => error.validation?.valid === false && /CATALOG_VERSION_MISMATCH/.test(error.message)
  );
});

test("legacy tokens migrate to exact snapshots and unknown tokens remain reviewable", () => {
  assert.deepEqual(LEGACY_HARDWARE_VARIANT_IDS, {
    brass_knob: "armac-queslett-knob__armac-qk34__armac-bel",
    matte_black_knob: "armac-queslett-knob__armac-qk34__armac-mbl",
    brass_pull: "atlas-oskar-pull__atlas-oskar-6-3125__atlas-wb",
    matte_black_pull: "atlas-oskar-pull__atlas-oskar-6-3125__atlas-bl",
    polished_nickel_pull: "atlas-oskar-pull__atlas-oskar-6-3125__atlas-pn"
  });
  assert.equal(HARDWARE_SELECTION_SCHEMA_VERSION, 1);

  const migrated = createLegacyHardwareSelections("matte_black_pull");
  assert.equal(migrated.defaultVariantId, LEGACY_HARDWARE_VARIANT_IDS.matte_black_pull);
  assert.deepEqual(migrated.defaultSnapshot, LEGACY_VARIANT_SNAPSHOTS.matte_black_pull);
  assert.deepEqual(migrated.byHostId, {});
  assert.deepEqual(migrated.migrationWarnings, []);

  const unknown = createLegacyHardwareSelections("vendor_custom_42");
  assert.equal(unknown.defaultVariantId, LEGACY_HARDWARE_VARIANT_IDS.brass_knob);
  assert.equal(unknown.migrationWarnings[0].code, "UNKNOWN_LEGACY_HARDWARE");
  assert.equal(unknown.migrationWarnings[0].legacyToken, "vendor_custom_42");
  assert.equal(normalizeHardwareSelections("brass_pull").defaultVariantId, LEGACY_HARDWARE_VARIANT_IDS.brass_pull);
});

test("normalization preserves saved snapshots, host overrides, placement zeroes, and warnings", () => {
  const saved = {
    schemaVersion: HARDWARE_SELECTION_SCHEMA_VERSION,
    catalogVersion: "2026.01.01-saved",
    defaultVariantId: LEGACY_HARDWARE_VARIANT_IDS.brass_knob,
    defaultSnapshot: clone(LEGACY_VARIANT_SNAPSHOTS.brass_knob),
    byHostId: {
      "section-01-door-left": {
        variantId: LEGACY_HARDWARE_VARIANT_IDS.polished_nickel_pull,
        snapshot: clone(LEGACY_VARIANT_SNAPSHOTS.polished_nickel_pull),
        placement: {
          orientation: "vertical",
          horizontalAnchor: "right",
          verticalAnchor: "custom",
          edgeOffsetMm: 0,
          crossAxisOffsetMm: 0,
          mirrored: true,
          quantityPerFront: 2,
          ignored: "not persisted"
        }
      }
    },
    migrationWarnings: [{ code: "SAVED_REVIEW", message: "Preserve me." }]
  };
  const normalized = normalizeHardwareSelections(saved);

  assert.equal(normalized.catalogVersion, "2026.01.01-saved");
  assert.deepEqual(normalized.defaultSnapshot, saved.defaultSnapshot);
  assert.deepEqual(normalized.byHostId["section-01-door-left"].placement, {
    orientation: "vertical",
    horizontalAnchor: "right",
    verticalAnchor: "custom",
    edgeOffsetMm: 0,
    crossAxisOffsetMm: 0,
    mirrored: true,
    quantityPerFront: 2
  });
  assert.ok(issueCodes(normalized.migrationWarnings).includes("SAVED_REVIEW"));
  assert.ok(issueCodes(normalized.migrationWarnings).includes("HARDWARE_CATALOG_VERSION_REVIEW_REQUIRED"));

  const host = resolveHardwareSelectionForHost(normalized, "section-01-door-left");
  assert.equal(host.resolvedFrom, "host");
  assert.equal(host.variantId, LEGACY_HARDWARE_VARIANT_IDS.polished_nickel_pull);
  assert.equal(host.placement.edgeOffsetMm, 0);

  const inherited = resolveHardwareSelectionForHost({ hardwareSelections: normalized }, "section-02-door-right");
  assert.equal(inherited.resolvedFrom, "default");
  assert.equal(inherited.variantId, LEGACY_HARDWARE_VARIANT_IDS.brass_knob);
  assert.deepEqual(inherited.placement, {});

  const missingSnapshot = normalizeHardwareSelections({
    schemaVersion: 1,
    catalogVersion: HARDWARE_CATALOG_VERSION,
    defaultVariantId: "retired-saved-variant",
    defaultSnapshot: null,
    byHostId: {}
  });
  assert.equal(missingSnapshot.defaultSnapshot, null);
  assert.ok(issueCodes(missingSnapshot.migrationWarnings).includes("MISSING_HARDWARE_VARIANT_SNAPSHOT"));
});

test("legacy projection and proxy facts stay backward compatible", () => {
  for (const [token, id] of Object.entries(LEGACY_HARDWARE_VARIANT_IDS)) {
    assert.equal(projectVariantToLegacyHardware(id), token);
    assert.equal(projectVariantToLegacyHardware({ variantId: id }), token);
    assert.equal(projectVariantToLegacyHardware(token), token);
  }
  assert.equal(projectVariantToLegacyHardware("new-catalog-variant", "matte_black_pull"), "matte_black_pull");
  assert.equal(projectVariantToLegacyHardware("new-catalog-variant", "invalid"), "brass_knob");

  const proxy = getHardwareProxySpec("polished_nickel_pull");
  assert.equal(proxy.variantId, LEGACY_HARDWARE_VARIANT_IDS.polished_nickel_pull);
  assert.equal(proxy.category, "d_handle_pull");
  assert.equal(proxy.units, "millimeters");
  assert.equal(proxy.centerToCenterMm, 160.337);
  assert.equal(proxy.finish.code, "PN");
  assert.deepEqual(proxy.coordinateSystem, {
    origin: "mounting_plane_center",
    xAxis: "center_to_center",
    yAxis: "up",
    zAxis: "outward"
  });
  assert.equal(proxy.exactAssetUsable, false);
  assert.equal(proxy.requiresFallback, false);
});

test("catalog search covers IDs, codes, scoped filters, availability, accuracy, and null-last sorts", () => {
  const index = createHardwareCatalogIndex(seed);
  const exact = searchHardwareCatalog(index, "A104-PN");
  assert.equal(exact.length, 1);
  assert.equal(exact[0].variantId, LEGACY_HARDWARE_VARIANT_IDS.polished_nickel_pull);

  const scopedFinish = searchHardwareCatalog(index, "", { finishVariantId: "armac-bel" });
  assert.deepEqual(new Set(scopedFinish.map((entry) => entry.familyId)), new Set([
    "armac-queslett-cup",
    "armac-queslett-knob"
  ]));
  const scopedFamily = searchHardwareCatalog(index, "knob", {
    familyId: "armac-queslett-knob",
    canonicalFinishGroup: "brass_gold",
    centerToCenterMm: 0,
    selectableOnly: true,
    region: "US"
  });
  assert.ok(scopedFamily.length > 0);
  assert.ok(scopedFamily.every((entry) => entry.familyId === "armac-queslett-knob"));

  const emtekSelectable = searchHardwareCatalog(index, "", {
    familyId: "emtek-select-rectangular-smooth",
    selectableOnly: true
  });
  assert.deepEqual(emtekSelectable, []);
  const inaccurate = searchHardwareCatalog(index, "", { accurate3D: false });
  assert.ok(inaccurate.some((entry) => entry.familyId === "emtek-cabinet-latch-2270"));
  assert.ok(inaccurate.some((entry) => entry.familyId === "richelieu-edge-pull-9898"));

  for (const sort of ["price_asc", "price_desc"]) {
    const results = searchHardwareCatalog(index, "", {}, sort);
    const known = results.filter((entry) => Number.isFinite(entry.pricing.amount)).map((entry) => entry.pricing.amount);
    const expected = [...known].sort((left, right) => sort === "price_asc" ? left - right : right - left);
    assert.deepEqual(known, expected);
    const firstUnknown = results.findIndex((entry) => !Number.isFinite(entry.pricing.amount));
    assert.equal(firstUnknown, known.length, `${sort} keeps band and quote-only entries after known reference prices`);
  }

  const result = searchHardwareCatalog(index, "oskar", {}, "name")[0];
  result.familyName = "consumer mutation";
  assert.equal(searchHardwareCatalog(index, "A104-PN")[0].familyName, "Oskar Pull");
});
