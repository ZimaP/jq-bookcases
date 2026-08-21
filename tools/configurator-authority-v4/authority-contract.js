export const V4_PROOF = Object.freeze({
  id: "configurator-authority-v4",
  flag: "authorityProof=configurator-v4",
  allowedHosts: Object.freeze(["127.0.0.1", "localhost", "::1", "[::1]"]),
  acceptedCommit: "109e5cf6c420725ec872530d4809675f4a09c7e6",
  acceptedTree: "d46d3cb00357fa24c5b5346392b0f65d390534ae",
  customerProductId: "cabinet-shelves",
  storage: Object.freeze({
    draft: "jq-configurator-authority-v4-draft",
    projects: "jq-configurator-authority-v4-projects"
  })
});

export const AUTHORITY_STATUSES = Object.freeze([
  "customer-live",
  "conditional",
  "standardized-hidden",
  "pending-authority",
  "blocked-by-asset",
  "review-only"
]);

export const LAYOUTS = Object.freeze([
  Object.freeze({
    id: "fireplace-wall",
    label: "Fireplace Wall",
    authorityId: "JQ-STYLE-LAYOUT-001",
    description: "Cabinetry arranged around the existing fireplace opening.",
    asset: "assets/models/room2/Room2-Fireplace-bookcases-source-v1.glb",
    bytes: 6712076,
    sha256: "251af4f7cb669976dec9dcaa46905982f9ae085b7bfb30e27e1bf9900a01a8d5",
    sourceContractFingerprint: "8762fe4326e22e46a163343e5fde410e231d651b48d1b1c9be8391febec8f6ff",
    geometryFingerprint: "63f9753290f89c234758a14ae5a67165c1a4708a3a9f34e7519435d2511e4022",
    nativeDegenerateTriangles: 115,
    primitiveCount: 185,
    triangleCount: 18306,
    nativeBounds: Object.freeze({ min: [-2.389632018, -0.000762, -1.232916008], max: [3.249167914, 2.438399971, 1.053083964] }),
    heroBounds: Object.freeze({ min: [-2.237304, 0, -1.080571], max: [3.096768, 2.4384, -0.464571] }),
    orbitTarget: Object.freeze([0.429732, 1.2192, -0.772571])
  }),
  Object.freeze({
    id: "door-wall",
    label: "Door Wall",
    authorityId: "JQ-STYLE-LAYOUT-001",
    description: "Cabinetry divided by the existing interior door.",
    asset: "assets/models/room2/jq-door-wall-bookcase-room2-authoritative-v01.glb",
    bytes: 6755128,
    sha256: "4969169cb29bcf51a72a2db6c4cd83631cd94c7d78154bc37558ee9adaba98cb",
    sourceContractFingerprint: "302ad57c1f7360966fb42714b2fd8c519f64856586eba632bf2f89427f2bc4d8",
    geometryFingerprint: "a110cfc8ec18e8b3cc9ee8b1bf872fdf56062b69f90abd65df17656d58bf57e2",
    nativeDegenerateTriangles: 85,
    primitiveCount: 127,
    triangleCount: 15017,
    nativeBounds: Object.freeze({ min: [-1.844293993, -0.000762, -1.092872911], max: [2.01650596, 2.438399971, 0.608330012] }),
    heroBounds: Object.freeze({ min: [-1.691894, -0.000127, -1.092873], max: [1.86417, 2.4384, -0.368031] }),
    orbitTarget: Object.freeze([0.086138, 1.219136, -0.730452])
  }),
  Object.freeze({
    id: "window-wall",
    label: "Window Wall",
    authorityId: "JQ-STYLE-LAYOUT-001",
    description: "Cabinetry arranged around the existing picture window.",
    asset: "assets/models/room4/jq-window-wall-bookcases-cabinets-room4-authoritative-v01.glb",
    bytes: 6993036,
    sha256: "631005c025324c5162de6e414267101d6260d58c6198d561e6799568cef1fd24",
    sourceContractFingerprint: "0f339076140a88e3942b220fcb217bbf3133876717149cba0522bc1e0b539e9c",
    geometryFingerprint: "9110cea6105192e04f4159fa3cc7e16271a339a014d5e260c0241a0f5eb0df3b",
    nativeDegenerateTriangles: 146,
    primitiveCount: 182,
    triangleCount: 19244,
    nativeBounds: Object.freeze({ min: [-2.620517922, -0.000762, -1.194332608], max: [0.732281989, 2.438399971, 0.506983971] }),
    heroBounds: Object.freeze({ min: [-2.467993, 0, -1.194333], max: [0.580136, 2.4384, -0.46949] }),
    orbitTarget: Object.freeze([-0.943928, 1.2192, -0.831912])
  })
]);

export const STEPS = Object.freeze([
  Object.freeze({ id: "choose-product", number: 1, label: "Choose Product", authorityId: "JQ-UX-JOURNEY-001", summary: "Accepted baseline product selection" }),
  Object.freeze({ id: "choose-layout", number: 2, label: "Choose Layout", authorityId: "JQ-UX-JOURNEY-001", summary: "Accepted baseline layout selection" }),
  Object.freeze({ id: "customization", number: 3, label: "Customization", authorityId: "JQ-UX-JOURNEY-001", summary: "V4 authority-backed customization" }),
  Object.freeze({ id: "review-details", number: 4, label: "Review & Details", authorityId: "JQ-UX-JOURNEY-001", summary: "Accepted baseline review" })
]);

const emailSource = Object.freeze({
  type: "John Quinn email",
  date: "2026-07-17/2026-07-18",
  reference: "Gmail thread ‘Some stuff’, thread 19f6cf838a5ad0dc",
  authority: "John Quinn written requirements"
});
const pdfSource = Object.freeze({
  type: "John Quinn construction drawing",
  date: "2026-07-17",
  reference: "sources/configurator-authority-v4/Fireplace-Bookcases-7-17-26.pdf",
  sha256: "c0261a6a728da2a6fec69da79e16b7e56e8ddb9801f8ca0724efa35e7f6c2600"
});
const acceptedSource = (reference) => Object.freeze({
  type: "accepted repository configuration",
  date: "2026-08-20",
  commit: V4_PROOF.acceptedCommit,
  reference
});

const persistence = (scope = "layout") => Object.freeze({
  scope,
  navigation: "persist",
  reload: "persist",
  savedProject: "persist",
  reset: "authority-backed default",
  staleValue: "reject or normalize without cross-layout effects"
});

const modelFeasibility = (status, region, reason) => Object.freeze({ status, affectedModelRegion: region, reason });

const item = (definition) => Object.freeze({
  applicableLayouts: Object.freeze(["fireplace-wall", "door-wall", "window-wall"]),
  applicableStyles: Object.freeze(["cabinet-shelves"]),
  customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "none" }),
  units: "none",
  authoritativeDefaultSource: null,
  authoritativeRangeSource: null,
  persistence: Object.freeze({ scope: "none", navigation: "not-applicable", reload: "not-applicable", savedProject: "not-applicable", reset: "not-applicable", staleValue: "drop" }),
  implementationStatus: "implemented",
  blocker: null,
  pendingDecision: null,
  ...definition
});

export const AUTHORITY_ITEMS = Object.freeze([
  item({
    id: "JQ-UX-JOURNEY-001", label: "Accepted four-step application journey", source: acceptedSource("guided-configurator.js STEP_DEFINITIONS and accepted four-step navigation"),
    authorityStatus: "customer-live", customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "accepted shared step navigation" }),
    modelRegion: "none", liveModelFeasibility: modelFeasibility("not-applicable", "none", "Journey architecture does not mutate the model."),
    implementationStatus: "implemented", testId: "V4-AUTH-JOURNEY-001"
  }),
  item({
    id: "JQ-UX-MINIMAL-001", label: "Minimal relevant screen content", source: emailSource,
    authorityStatus: "standardized-hidden", modelRegion: "none", liveModelFeasibility: modelFeasibility("not-applicable", "none", "Presentation policy."),
    testId: "V4-AUTH-MINIMAL-001"
  }),
  item({
    id: "JQ-UX-MODEL-NAV-001", label: "Model preview navigation", source: acceptedSource("guided-layout-viewer.js camera/orbit controls and configurator.html accessible viewer shell"),
    authorityStatus: "customer-live", customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "shared model stage" }),
    modelRegion: "camera only", liveModelFeasibility: modelFeasibility("proven", "camera", "Accepted viewer navigation changes only the camera and never project parameters or model geometry."),
    persistence: persistence("session-camera"), testId: "V4-UX-MODEL-NAV-001"
  }),
  item({
    id: "JQ-UX-LOCAL-PROJECT-001", label: "Local project save and resume", source: acceptedSource("configurator.html local Save Project/My Projects chrome and guided-configurator-state.js local serialization behavior"),
    authorityStatus: "customer-live", customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "accepted site header and local project dialogs" }),
    modelRegion: "none", liveModelFeasibility: modelFeasibility("not-applicable", "none", "Existing local/project serialization only; no backend or account behavior."),
    persistence: persistence("local-project"), testId: "V4-UX-LOCAL-PROJECT-001"
  }),
  item({
    id: "JQ-UX-SITE-NAV-001", label: "Accepted site navigation", source: acceptedSource("configurator.html site header, skip link and configurator menu"),
    authorityStatus: "customer-live", customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "accepted site header and menu" }),
    modelRegion: "none", liveModelFeasibility: modelFeasibility("not-applicable", "none", "Accepted navigation infrastructure; it does not add a product parameter."),
    persistence: persistence("site-navigation"), testId: "V4-UX-SITE-NAV-001"
  }),
  item({
    id: "JQ-STYLE-LAYOUT-001", label: "Approved Cabinets + Shelves layout", source: acceptedSource("guided-layout-registry.js:28-255 and guided-configurator-data.js:898-925"),
    authorityStatus: "customer-live", customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "Choose Layout (accepted Step 2)" }),
    authoritativeDefaultSource: Object.freeze({ source: "accepted project default", value: "fireplace-wall", reference: "guided-configurator-state.js default project" }),
    modelRegion: "whole immutable registered layout", liveModelFeasibility: modelFeasibility("proven", "whole layout", "Exact hash-registered source asset switch only; no product combination is created."),
    persistence: persistence("project"), testId: "V4-LIVE-LAYOUT-001"
  }),
  item({
    id: "JQ-ROOM-WIDTH-001", label: "Room width", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted by owner; Room Size workflow is not authorized" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:43-53 default 120 in"),
    authoritativeRangeSource: acceptedSource("guided-configurator-data.js:43-53 range 24–144 in"),
    modelRegion: "room envelope", liveModelFeasibility: modelFeasibility("blocked", "room shell", "No authoritative anchor/stretch/repetition contract; immutable world bounds are protected."),
    persistence: persistence(), testId: "V4-INPUT-ROOM-WIDTH-001"
  }),
  item({
    id: "JQ-ROOM-HEIGHT-001", label: "Room height", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted by owner; Room Size workflow is not authorized" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:54-63 default 96 in"),
    authoritativeRangeSource: acceptedSource("guided-configurator-data.js:54-63 range 72–120 in"),
    modelRegion: "room envelope", liveModelFeasibility: modelFeasibility("blocked", "room shell", "No authoritative height transform contract; immutable ceiling/reference planes are protected."),
    persistence: persistence(), testId: "V4-INPUT-ROOM-HEIGHT-001"
  }),
  item({
    id: "JQ-ROOM-DEPTH-001", label: "Built-in depth", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted by owner; Room Size workflow is not authorized" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:62-64 default 14 in"),
    authoritativeRangeSource: acceptedSource("guided-configurator-data.js:62-64 range 10–24 in"),
    modelRegion: "cabinet and room depth", liveModelFeasibility: modelFeasibility("blocked", "cabinet/room depth planes", "No authoritative front/back-plane transform contract."),
    persistence: persistence(), testId: "V4-INPUT-ROOM-DEPTH-001"
  }),
  item({
    id: "JQ-ROOM-FIREPLACE-OPENING-001", label: "Fireplace opening dimensions", source: acceptedSource("guided-configurator-data.js:138-147"),
    authorityStatus: "conditional", applicableLayouts: Object.freeze(["fireplace-wall"]),
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted by owner; Room Size workflow is not authorized" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("fireplace width 42, height 32, projection 8 in"),
    authoritativeRangeSource: acceptedSource("width 18–96, height 18–72, projection 0–30 in"),
    modelRegion: "existing fireplace opening", liveModelFeasibility: modelFeasibility("blocked", "fireplace frame/opening", "Opening and fireplace are protected and lack an audited resize contract."),
    persistence: persistence(), testId: "V4-INPUT-FIREPLACE-001"
  }),
  item({
    id: "JQ-ROOM-FIREPLACE-SIDE-WIDTHS-001", label: "Available width beside fireplace", source: acceptedSource("guided-configurator-data.js:144-145"),
    authorityStatus: "conditional", applicableLayouts: Object.freeze(["fireplace-wall"]),
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted by owner; Room Size workflow is not authorized" }), units: "inch",
    authoritativeDefaultSource: Object.freeze({ source: "accepted configuration", value: null, reference: "guided-configurator-data.js:144-145" }),
    authoritativeRangeSource: acceptedSource("guided-configurator-data.js:144-145 left/right range 12–96 in"),
    modelRegion: "left/right available wall", liveModelFeasibility: modelFeasibility("blocked", "room/cabinet spans", "No authoritative span transform contract."),
    persistence: persistence(), testId: "V4-INPUT-FIREPLACE-SIDES-001"
  }),
  item({
    id: "JQ-ROOM-DOOR-OPENING-001", label: "Door opening dimensions", source: acceptedSource("guided-configurator-data.js:126-137"),
    authorityStatus: "conditional", applicableLayouts: Object.freeze(["door-wall"]),
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted by owner; Room Size workflow is not authorized" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("door width 36, height 80, left offset 24, trim 3.5 in"),
    authoritativeRangeSource: acceptedSource("width 24–72, height 72–108, offset 0–144, trim 1–12 in"),
    modelRegion: "existing architectural door", liveModelFeasibility: modelFeasibility("blocked", "door opening/frame/hardware", "Architectural door is protected and lacks an audited resize/offset contract."),
    persistence: persistence(), testId: "V4-INPUT-DOOR-001"
  }),
  item({
    id: "JQ-ROOM-WINDOW-OPENING-001", label: "Window opening dimensions", source: acceptedSource("guided-configurator-data.js:118-125"),
    authorityStatus: "conditional", applicableLayouts: Object.freeze(["window-wall"]),
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted by owner; Room Size workflow is not authorized" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("window width 48, height 42, sill 30 in; offsets unset"),
    authoritativeRangeSource: acceptedSource("width 12–144, height 12–96, sill 12–72, offsets 0–144 in"),
    modelRegion: "existing architectural window", liveModelFeasibility: modelFeasibility("blocked", "window frame/glazing/opening", "Window, glazing and opening are protected and lack an audited resize/offset contract."),
    persistence: persistence(), testId: "V4-INPUT-WINDOW-001"
  }),
  item({
    id: "JQ-CONFIG-TV-OPENING-001", label: "TV opening size", source: emailSource,
    authorityStatus: "blocked-by-asset", applicableLayouts: Object.freeze([]), applicableStyles: Object.freeze([]),
    customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "omitted; no applicable approved style" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:148-165 defaults 72×42 in"),
    authoritativeRangeSource: acceptedSource("guided-configurator-data.js:148-165 width 24–120, height 16–72 in"),
    modelRegion: "TV opening", liveModelFeasibility: modelFeasibility("blocked", "none in registered GLBs", "No authorized TV style/node exists in the three registered Cabinets + Shelves assets."),
    implementationStatus: "blocked", testId: "V4-BLOCK-TV-001", blocker: "Approved TV-containing style and audited TV-opening asset mapping are missing."
  }),
  item({
    id: "JQ-CONFIG-LOWER-HEIGHT-001", label: "Lower cabinet height", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "Customization (Step 3)" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:68-71 default 34.5 in"), authoritativeRangeSource: acceptedSource("guided-configurator-data.js:68-71 range 24–48 in"),
    modelRegion: "lower cabinet assemblies", liveModelFeasibility: modelFeasibility("blocked", "lower doors/rails/backs/ends/tops/hardware", "No coordinated multi-node height transform contract."),
    persistence: persistence(), testId: "V4-INPUT-LOWER-HEIGHT-001"
  }),
  item({
    id: "JQ-CONFIG-LOWER-DEPTH-001", label: "Lower cabinet depth", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "Customization (Step 3)" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:75-78 default 24 in"), authoritativeRangeSource: acceptedSource("guided-configurator-data.js:75-78 range 12–30 in"),
    modelRegion: "lower cabinet assemblies", liveModelFeasibility: modelFeasibility("blocked", "front/back/shelf/top planes", "No protected-plane depth transform contract."),
    persistence: persistence(), testId: "V4-INPUT-LOWER-DEPTH-001"
  }),
  item({
    id: "JQ-CONFIG-OVERHEAD-DEPTH-001", label: "Overhead bookcase depth", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "Customization (Step 3)" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:82-85 default 12 in"), authoritativeRangeSource: acceptedSource("guided-configurator-data.js:82-85 range 8–20 in"),
    modelRegion: "overhead bookcase", liveModelFeasibility: modelFeasibility("blocked", "shelves/supports/backs/ends", "No coordinated depth transform contract."),
    persistence: persistence(), testId: "V4-INPUT-OVERHEAD-DEPTH-001"
  }),
  item({
    id: "JQ-CONFIG-TOE-KICK-HEIGHT-001", label: "Toe-kick height", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "Customization (Step 3)" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:89-92 default 4 in"), authoritativeRangeSource: acceptedSource("guided-configurator-data.js:89-92 range 0–8 in"),
    modelRegion: "toe kick/base", liveModelFeasibility: modelFeasibility("blocked", "toe skins and cabinet elevation", "Changing this requires a coordinated carcass shift with no audited contract."),
    persistence: persistence(), testId: "V4-INPUT-TOE-KICK-001"
  }),
  item({
    id: "JQ-CONFIG-TOP-FASCIA-HEIGHT-001", label: "Top-fascia height", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "Customization (Step 3)" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("guided-configurator-data.js:96-99 default 3 in"), authoritativeRangeSource: acceptedSource("guided-configurator-data.js:96-99 range 0–12 in"),
    modelRegion: "top treatment", liveModelFeasibility: modelFeasibility("blocked", "unmapped", "No exact Fascia node or audited region mapping exists; top rails cannot be relabeled as fascia."),
    persistence: persistence(), testId: "V4-INPUT-TOP-FASCIA-001"
  }),
  item({
    id: "JQ-CONFIG-BASE-TYPE-001", label: "Base type", source: emailSource, authorityStatus: "review-only",
    customerVisibility: Object.freeze({ visible: true, interactive: true, surface: "Customization (Step 3)" }), units: "enum: flush|recessed",
    authoritativeDefaultSource: Object.freeze({ source: "accepted state plus John Quinn direction", value: "flush", reference: "guided-configurator-state.js:55-60 and 2026-07-17 email" }),
    authoritativeRangeSource: Object.freeze({ source: "John Quinn email", values: ["flush", "recessed"], reference: "2026-07-17 16:32 message" }),
    modelRegion: "base/toe construction", liveModelFeasibility: modelFeasibility("blocked", "base/toe assemblies", "Assets encode one fixed construction with no variant visibility contract."),
    persistence: persistence(), testId: "V4-INPUT-BASE-TYPE-001"
  }),
  item({
    id: "JQ-CONFIG-RECESSED-BASE-HEIGHT-001", label: "Recessed-base height", source: emailSource,
    authorityStatus: "blocked-by-asset", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization note when Recessed applies" }), units: "inch",
    authoritativeDefaultSource: acceptedSource("config/fit-policy.json:9-12 nominal 4 in"), authoritativeRangeSource: null,
    modelRegion: "distinct recessed base", liveModelFeasibility: modelFeasibility("blocked", "not independently represented", "No authoritative range, independent node, or safe transform exists."),
    implementationStatus: "blocked", testId: "V4-BLOCK-RECESSED-BASE-001", blocker: "Authoritative range and independent asset-region mapping are missing."
  }),
  item({
    id: "JQ-FINISH-PAINT-001", label: "Sherwin-Williams cabinet-grade painted finish", source: emailSource,
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "exterior millwork", liveModelFeasibility: modelFeasibility("blocked", "all-layout exterior millwork", "Exact approved colors/SKUs are not selected."),
    implementationStatus: "pending", testId: "V4-PENDING-PAINT-001", pendingDecision: "Approved Sherwin-Williams palette and product specification."
  }),
  item({
    id: "JQ-FINISH-WHITE-OAK-001", label: "Prefinished white oak", source: emailSource,
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "exterior millwork", liveModelFeasibility: modelFeasibility("blocked", "all-layout exterior millwork", "Exact supplier/product/appearance is not approved."),
    implementationStatus: "pending", testId: "V4-PENDING-WHITE-OAK-001", pendingDecision: "Approved prefinished white-oak product."
  }),
  item({
    id: "JQ-FINISH-WALNUT-001", label: "Prefinished walnut", source: emailSource,
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "exterior millwork", liveModelFeasibility: modelFeasibility("blocked", "all-layout exterior millwork", "Exact supplier/product/appearance is not approved."),
    implementationStatus: "pending", testId: "V4-PENDING-WALNUT-001", pendingDecision: "Approved prefinished walnut product."
  }),
  item({
    id: "JQ-FINISH-SHOP-PRIMED-001", label: "Shop-primed", source: emailSource,
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "exterior millwork", liveModelFeasibility: modelFeasibility("blocked", "all-layout exterior millwork", "Final offering and specification are not approved."),
    implementationStatus: "pending", testId: "V4-PENDING-SHOP-PRIMED-001", pendingDecision: "Confirm whether shop-primed is offered and define its specification."
  }),
  item({
    id: "JQ-DOOR-CATALOG-001", label: "Door choices", source: emailSource,
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "cabinet doors", liveModelFeasibility: modelFeasibility("blocked", "cabinet door meshes", "Only the direction ‘a few options’ is confirmed; exact choices are missing."),
    implementationStatus: "pending", testId: "V4-PENDING-DOORS-001", pendingDecision: "Approved limited door catalog."
  }),
  item({
    id: "JQ-DYKES-CROWN-CATALOG-001", label: "Dykes crown profiles", source: emailSource,
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "crown/top treatment", liveModelFeasibility: modelFeasibility("blocked", "no approved crown geometry", "Exact Dykes profiles are not selected."),
    implementationStatus: "pending", testId: "V4-PENDING-CROWN-001", pendingDecision: "Approved Dykes moulding profile list and geometry."
  }),
  item({
    id: "JQ-HARDWARE-CATALOG-001", label: "Hardware choices", source: Object.freeze({ ...emailSource, note: "No exact customer hardware catalog was finalized." }),
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "cabinet hardware", liveModelFeasibility: modelFeasibility("blocked", "hardware meshes", "Existing asset hardware is not an approved selectable catalog."),
    implementationStatus: "pending", testId: "V4-PENDING-HARDWARE-001", pendingDecision: "Approved hardware catalog and applicability."
  }),
  item({
    id: "JQ-LIGHTING-SYSTEM-001", label: "Lighting system", source: emailSource,
    authorityStatus: "pending-authority", customerVisibility: Object.freeze({ visible: true, interactive: false, surface: "Customization pending catalog" }),
    modelRegion: "cabinet lighting", liveModelFeasibility: modelFeasibility("blocked", "no selected system", "John deferred controls until a real lighting system is selected."),
    implementationStatus: "pending", testId: "V4-PENDING-LIGHTING-001", pendingDecision: "Select and authorize the lighting system."
  }),
  item({
    id: "JQ-INTERIOR-MAPLE-001", label: "Clear maple UV-coated/prefinished maple interiors", source: emailSource,
    authorityStatus: "standardized-hidden", modelRegion: "cabinet interiors", liveModelFeasibility: modelFeasibility("review-only", "cabinet-interior role", "Construction requirement is recorded; current proof diagnostics are not manufacturer calibration."),
    testId: "V4-HIDDEN-INTERIOR-MAPLE-001"
  }),
  item({
    id: "JQ-FILLER-CONSTRUCTION-001", label: "Standardized filler construction", source: emailSource,
    authorityStatus: "standardized-hidden", modelRegion: "fillers/end panels", liveModelFeasibility: modelFeasibility("not-customer-controlled", "filler meshes", "Repeatable installation construction is standardized, not selected by the customer."),
    testId: "V4-HIDDEN-FILLER-001"
  }),
  item({
    id: "JQ-KICK-CONSTRUCTION-001", label: "Standardized kick construction", source: emailSource,
    authorityStatus: "standardized-hidden", modelRegion: "toe kick/base", liveModelFeasibility: modelFeasibility("not-customer-controlled", "toe/base meshes", "Repeatable construction is standardized."),
    testId: "V4-HIDDEN-KICK-001"
  }),
  item({
    id: "JQ-FILLER-BACKER-ADJUSTMENT-001", label: "Finished filler/backer adjustment construction", source: pdfSource,
    authorityStatus: "standardized-hidden", modelRegion: "fillers/backers", liveModelFeasibility: modelFeasibility("not-customer-controlled", "filler/backer construction", "Fabrication rule only."),
    testId: "V4-HIDDEN-FILLER-BACKER-001"
  }),
  item({
    id: "JQ-SHELF-1IN-27MAX-001", label: "1-inch MDF shelf maximum width 27 inches", source: pdfSource,
    authorityStatus: "standardized-hidden", units: "inch", modelRegion: "shelf fabrication", liveModelFeasibility: modelFeasibility("validation-only", "shelves", "Fabrication validation rule; never a spacing control."),
    testId: "V4-HIDDEN-SHELF-1IN-001"
  }),
  item({
    id: "JQ-SHELF-1_25IN-31MAX-001", label: "1.25-inch MDF shelf maximum width 31 inches", source: pdfSource,
    authorityStatus: "standardized-hidden", units: "inch", modelRegion: "shelf fabrication", liveModelFeasibility: modelFeasibility("validation-only", "shelves", "Fabrication validation rule; never a spacing control."),
    testId: "V4-HIDDEN-SHELF-1_25IN-001"
  }),
  item({
    id: "JQ-SHELF-1_5IN-36MAX-001", label: "1.5-inch MDF shelf maximum width 36 inches", source: pdfSource,
    authorityStatus: "standardized-hidden", units: "inch", modelRegion: "shelf fabrication", liveModelFeasibility: modelFeasibility("validation-only", "shelves", "Fabrication validation rule; never a spacing control."),
    testId: "V4-HIDDEN-SHELF-1_5IN-001"
  }),
  item({
    id: "JQ-SHELF-PIN-5MM-001", label: "Typical 5 mm shelf pins", source: pdfSource,
    authorityStatus: "standardized-hidden", units: "millimeter", modelRegion: "shelf support hardware", liveModelFeasibility: modelFeasibility("validation-only", "shelf-pin construction", "Fabrication rule; never a customer control."),
    testId: "V4-HIDDEN-SHELF-PIN-001"
  }),
  item({
    id: "JQ-SIZE-VARIABLE-RULES-CONSTANT-001", label: "Variable sizes with standardized construction", source: emailSource,
    authorityStatus: "standardized-hidden", modelRegion: "engineering policy", liveModelFeasibility: modelFeasibility("policy", "none", "Values may vary while construction rules remain fixed."),
    testId: "V4-HIDDEN-STANDARDIZATION-001"
  }),
  item({
    id: "JQ-SMALL-CHANGES-NOT-ENGINEERING-001", label: "Small customer changes, not arbitrary engineering", source: emailSource,
    authorityStatus: "standardized-hidden", modelRegion: "engineering policy", liveModelFeasibility: modelFeasibility("policy", "none", "Defines the product/configurator boundary."),
    testId: "V4-HIDDEN-SMALL-CHANGES-001"
  }),
  item({
    id: "JQ-PROOF-DIAGNOSTIC-MATERIALS-001", label: "Proof light, mid and dark diagnostics", source: Object.freeze({ type: "V4 proof methodology", date: "2026-08-20", reference: "User-authorized visual QA diagnostic" }),
    authorityStatus: "review-only", customerVisibility: Object.freeze({ visible: false, interactive: false, surface: "query-selected QA capture only" }),
    modelRegion: "audited visual-role primitives", liveModelFeasibility: modelFeasibility("proof-only", "audited cabinetry roles", "Never enters customer state and is unreachable without the exact loopback proof flag."),
    implementationStatus: "implemented", testId: "V4-PROOF-MATERIAL-001"
  })
]);

const numericField = (definition) => Object.freeze({
  type: "number",
  unit: "in",
  step: 0.25,
  required: true,
  reset: "default",
  ...definition
});

export const FIELDS = Object.freeze([
  numericField({ id: "lowerCabinetHeight", label: "Lower cabinet height", authorityId: "JQ-CONFIG-LOWER-HEIGHT-001", stepId: "customization", min: 24, max: 48, defaultValue: 34.5, layouts: ["fireplace-wall", "door-wall", "window-wall"] }),
  numericField({ id: "lowerCabinetDepth", label: "Lower cabinet depth", authorityId: "JQ-CONFIG-LOWER-DEPTH-001", stepId: "customization", min: 12, max: 30, defaultValue: 24, layouts: ["fireplace-wall", "door-wall", "window-wall"] }),
  numericField({ id: "overheadDepth", label: "Overhead bookcase depth", authorityId: "JQ-CONFIG-OVERHEAD-DEPTH-001", stepId: "customization", min: 8, max: 20, defaultValue: 12, layouts: ["fireplace-wall", "door-wall", "window-wall"] }),
  numericField({ id: "toeKickHeight", label: "Toe-kick height", authorityId: "JQ-CONFIG-TOE-KICK-HEIGHT-001", stepId: "customization", min: 0, max: 8, defaultValue: 4, layouts: ["fireplace-wall", "door-wall", "window-wall"] }),
  numericField({ id: "topFasciaHeight", label: "Top-fascia height", authorityId: "JQ-CONFIG-TOP-FASCIA-HEIGHT-001", stepId: "customization", min: 0, max: 12, defaultValue: 3, layouts: ["fireplace-wall", "door-wall", "window-wall"] }),
  Object.freeze({ id: "baseType", label: "Base type", authorityId: "JQ-CONFIG-BASE-TYPE-001", stepId: "customization", type: "radio", required: true, defaultValue: "flush", values: Object.freeze([Object.freeze({ value: "flush", label: "Flush" }), Object.freeze({ value: "recessed", label: "Recessed" })]), layouts: Object.freeze(["fireplace-wall", "door-wall", "window-wall"]), reset: "default" })
]);

export const PENDING_ITEMS = Object.freeze([
  "JQ-FINISH-PAINT-001",
  "JQ-FINISH-WHITE-OAK-001",
  "JQ-FINISH-WALNUT-001",
  "JQ-FINISH-SHOP-PRIMED-001",
  "JQ-DOOR-CATALOG-001",
  "JQ-DYKES-CROWN-CATALOG-001",
  "JQ-HARDWARE-CATALOG-001",
  "JQ-LIGHTING-SYSTEM-001"
]);

const visibleCopy = (id, label, authorityId, selector, match = "exact") => Object.freeze({ id, label, authorityId, selector, match });

// Every non-field/non-option label reachable in the V4 proof route is registered here.
// Field labels, units, defaults, ranges, validation messages and radio options are
// generated directly from FIELDS and are inventoried separately in the coverage report.
export const UI_COPY = Object.freeze([
  visibleCopy("site.skip", "Skip to configurator", "JQ-UX-SITE-NAV-001", ".skip-link"),
  visibleCopy("site.brand", "JQ Bookcases home", "JQ-UX-SITE-NAV-001", ".guided-brand", "accessible-name"),
  visibleCopy("site.save", "Save Project", "JQ-UX-LOCAL-PROJECT-001", "[data-guided-save]", "accessible-name"),
  visibleCopy("site.projects", "My Projects", "JQ-UX-LOCAL-PROJECT-001", "[data-guided-projects]", "accessible-name"),
  visibleCopy("site.menu.open", "Open menu", "JQ-UX-SITE-NAV-001", "[data-guided-menu-button]", "accessible-name"),
  visibleCopy("site.menu.close", "Close menu", "JQ-UX-SITE-NAV-001", "[data-guided-menu-button]", "accessible-name"),
  visibleCopy("site.menu.label", "Configurator menu", "JQ-UX-SITE-NAV-001", "#guided-menu", "accessible-name"),
  ...["Home", "How It Works", "Materials", "Inspiration", "FAQ", "Contact the design team"].map((label, index) => visibleCopy(`site.menu.link.${index + 1}`, label, "JQ-UX-SITE-NAV-001", `#guided-menu a:nth-of-type(${index + 1})`)),
  visibleCopy("journey.navigation", "Project steps", "JQ-UX-JOURNEY-001", ".guided-stepper", "accessible-name"),
  visibleCopy("stage.label", "Interactive selected layout model", "JQ-UX-MODEL-NAV-001", ".v4-model-stage", "accessible-name"),
  visibleCopy("stage.selected-layout", "Selected layout", "JQ-STYLE-LAYOUT-001", ".v4-stage-heading small"),
  visibleCopy("stage.loading", "Preparing verified model", "JQ-PROOF-DIAGNOSTIC-MATERIALS-001", "[data-v4-viewer-state]"),
  visibleCopy("stage.ready", "Verified source · proof diagnostic", "JQ-PROOF-DIAGNOSTIC-MATERIALS-001", "[data-v4-viewer-state]"),
  visibleCopy("stage.error", "Model unavailable", "JQ-PROOF-DIAGNOSTIC-MATERIALS-001", "[data-v4-viewer-state]", "prefix"),
  visibleCopy("camera.group", "Model view controls", "JQ-UX-MODEL-NAV-001", ".v4-camera-bar", "accessible-name"),
  visibleCopy("camera.front", "Front", "JQ-UX-MODEL-NAV-001", "[data-v4-view=front]"),
  visibleCopy("camera.left", "Left", "JQ-UX-MODEL-NAV-001", "[data-v4-view=left]"),
  visibleCopy("camera.right", "Right", "JQ-UX-MODEL-NAV-001", "[data-v4-view=right]"),
  visibleCopy("camera.zoom-out", "Zoom out", "JQ-UX-MODEL-NAV-001", "[data-v4-camera=out]", "accessible-name"),
  visibleCopy("camera.zoom-in", "Zoom in", "JQ-UX-MODEL-NAV-001", "[data-v4-camera=in]", "accessible-name"),
  visibleCopy("camera.fit", "Fit", "JQ-UX-MODEL-NAV-001", "[data-v4-camera=fit]"),
  visibleCopy("camera.reset", "Reset view", "JQ-UX-MODEL-NAV-001", "[data-v4-camera=reset]"),
  visibleCopy("customization.eyebrow", "Design review inputs", "JQ-SMALL-CHANGES-NOT-ENGINEERING-001", ".v4-eyebrow"),
  visibleCopy("customization.title", "Customization", "JQ-UX-JOURNEY-001", "#v4-customization-title"),
  visibleCopy("customization.intro", "Record only confirmed construction details for the selected layout.", "JQ-SMALL-CHANGES-NOT-ENGINEERING-001", ".v4-customization-panel > header > p:last-child", "contains"),
  visibleCopy("base.review-note", "Saved for design review; the source model does not switch base construction.", "JQ-CONFIG-BASE-TYPE-001", ".v4-field-card .v4-field-note"),
  visibleCopy("base.blocked-title", "Recessed-base height requires design confirmation.", "JQ-CONFIG-RECESSED-BASE-HEIGHT-001", ".v4-blocked-note", "contains"),
  visibleCopy("base.blocked-body", "No authoritative range or independent model region exists, so no height control is shown.", "JQ-CONFIG-RECESSED-BASE-HEIGHT-001", ".v4-blocked-note p"),
  visibleCopy("finish.pending-title", "Finish & options", "JQ-UX-MINIMAL-001", "#v4-pending-title"),
  visibleCopy("finish.pending-body", "Selections pending approved catalog. Nothing in this section is selectable yet.", "JQ-PROOF-DIAGNOSTIC-MATERIALS-001", ".v4-pending-intro p"),
  visibleCopy("finish.pending-list", "Pending product decisions", "JQ-UX-MINIMAL-001", ".v4-pending-list", "accessible-name"),
  visibleCopy("action.back", "Back", "JQ-UX-JOURNEY-001", "[data-v4-back]"),
  visibleCopy("action.review", "Review & Details", "JQ-UX-JOURNEY-001", "[data-v4-review]"),
  visibleCopy("status.review", "Design review", "JQ-SMALL-CHANGES-NOT-ENGINEERING-001", ".v4-status-pill--review-only"),
  visibleCopy("status.pending", "Pending", "JQ-UX-MINIMAL-001", ".v4-status-pill--pending-authority"),
  visibleCopy("status.blocked", "Blocked", "JQ-CONFIG-RECESSED-BASE-HEIGHT-001", ".v4-status-pill--blocked-by-asset"),
  visibleCopy("dialog.save.title", "Save this project", "JQ-UX-LOCAL-PROJECT-001", "#save-dialog-title"),
  visibleCopy("dialog.save.eyebrow", "Keep for later", "JQ-UX-LOCAL-PROJECT-001", "[data-save-dialog] .guided-eyebrow"),
  visibleCopy("dialog.save.close", "Close save project dialog", "JQ-UX-LOCAL-PROJECT-001", "[data-save-dialog] [data-dialog-close][aria-label]", "accessible-name"),
  visibleCopy("dialog.save.name", "Project name", "JQ-UX-LOCAL-PROJECT-001", "[data-save-dialog] label"),
  visibleCopy("dialog.save.name-input", "Project name", "JQ-UX-LOCAL-PROJECT-001", "[data-save-form] input[name=projectName]", "template"),
  visibleCopy("dialog.save.note", "Saved projects stay on this device and can be resumed from My Projects.", "JQ-UX-LOCAL-PROJECT-001", "[data-save-dialog] .guided-dialog-note"),
  visibleCopy("dialog.save.cancel", "Cancel", "JQ-UX-LOCAL-PROJECT-001", "[data-save-dialog] button[data-dialog-close]:not([aria-label])"),
  visibleCopy("dialog.save.submit", "Save Project", "JQ-UX-LOCAL-PROJECT-001", "[data-save-form] button[type=submit]"),
  visibleCopy("dialog.projects.title", "My Projects", "JQ-UX-LOCAL-PROJECT-001", "#projects-dialog-title"),
  visibleCopy("dialog.projects.eyebrow", "Saved on this device", "JQ-UX-LOCAL-PROJECT-001", "[data-projects-dialog] .guided-eyebrow"),
  visibleCopy("dialog.projects.close-icon", "Close projects dialog", "JQ-UX-LOCAL-PROJECT-001", "[data-projects-dialog] [data-dialog-close][aria-label]", "accessible-name"),
  visibleCopy("dialog.projects.close", "Close", "JQ-UX-LOCAL-PROJECT-001", "[data-projects-dialog] button[data-dialog-close]:not([aria-label])"),
  visibleCopy("dialog.projects.new", "Start New Project", "JQ-UX-LOCAL-PROJECT-001", "[data-new-project]")
]);

export function authorityItem(id) {
  return AUTHORITY_ITEMS.find((entry) => entry.id === id) || null;
}

export function fieldsFor(layoutId, stepId = "customization") {
  return FIELDS.filter((field) => field.stepId === stepId && field.layouts.includes(layoutId));
}

export function layoutById(layoutId) {
  return LAYOUTS.find((layout) => layout.id === layoutId) || null;
}

export function isV4ProofRoute(locationLike = globalThis.location) {
  const hostname = String(locationLike?.hostname || "");
  const normalized = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  const query = new URLSearchParams(String(locationLike?.search || ""));
  return V4_PROOF.allowedHosts.includes(hostname)
    || V4_PROOF.allowedHosts.includes(normalized)
    ? query.get("authorityProof") === "configurator-v4"
    : false;
}
