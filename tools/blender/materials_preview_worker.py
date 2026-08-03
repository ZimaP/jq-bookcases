#!/usr/bin/env python3
"""Strict Blender 5.2 material-only translator for the accepted TV01 scene.

The Phase 5 Blender package remains the sole geometry authority.  This worker
validates both that package and the renderer-neutral Phase 6 material sidecar
before Blender opens the source scene.  It then verifies the saved clay scene,
creates only material/node datablocks, assigns the exact sidecar bindings, and
renders a separate material-validation image.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import traceback
from typing import Any, Iterable

SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import clay_worker as clay


MATERIAL_PACKAGE_KIND = "jq-render-material-package"
MATERIAL_PACKAGE_SCHEMA = "jq-render-material-package-v1"
MATERIAL_PACKAGE_SCHEMA_VERSION = 1
MATERIAL_PREVIEW_CAPTURE_ID = "materials-preview-v1"
MATERIAL_PREVIEW_RESULT_KIND = "jq-render-material-preview-result"
MATERIAL_PREVIEW_RESULT_SCHEMA_VERSION = 1
PBR_MATERIAL_LIBRARY_VERSION = "jq-pbr-material-library-v1"
PROCEDURAL_OAK_ALGORITHM_VERSION = "jq-procedural-natural-oak-v1"
MATERIAL_FRAME_VERSION = "jq-material-frame-v1"
MATERIAL_SEED_RULE_VERSION = "jq-material-piece-seed-sha256-v1"
BLENDER_MATERIAL_TRANSLATOR_VERSION = "jq-blender-material-translator-v1"
BLENDER_TRANSLATION_POLICY_VERSION = "jq-blender-material-translation-policy-v1"
MATERIAL_PIPELINE_VERSION = "2026.08-deterministic-pbr-materials-v1"
SHADER_TOPOLOGY_VERSION = "jq-blender-pbr-node-topology-v1"

EXPECTED_BLENDER_VERSION = "5.2.0 LTS"
EXPECTED_BLENDER_BUILD = "fbe6228777e7"
EXPECTED_GEOMETRY_FINGERPRINT = "jq-guided-geometry-v1-028YPJG43EJF6"
EXPECTED_PRIMARY_PACKAGE_KEY = (
    "jq-blender-package-v1-"
    "f80f6b84cb804623613e3ecb55aa61461e71e7a4dc70816e37bae38bd5e5be15"
)
EXPECTED_COMPONENT_COUNT = 44
EXPECTED_PRODUCT_OBJECT_COUNT = 78
EXPECTED_ROOM_OBJECT_COUNT = 2
EXPECTED_CONSTRAINT_COUNT = 7
EXPECTED_CAMERA_COUNT = 1
EXPECTED_LIGHT_COUNT = 0
EXPECTED_COLLECTION_COUNT = 4
EXPECTED_BINDING_COUNT = 80
EXPECTED_FRAME_COUNT = 65
MAX_JSON_BYTES = 16 * 1024 * 1024
MAX_OUTPUT_BYTES = 32 * 1024 * 1024
GEOMETRY_TOLERANCE = 1e-6
NUMERIC_TOLERANCE = 1e-9

MATERIAL_IDS = {
    "oak": "natural-oak-visualization-v1",
    "countertop": "natural-oak-countertop-visualization-v1",
    "hardware": "matte-black-hardware-v1",
    "screen": "tv-black-glass-v1",
    "lens": "warm-opal-puck-lens-v1",
    "roomWall": "inherited-room-wall-clay-v1",
    "roomFloor": "inherited-room-floor-clay-v1",
}
EXPECTED_BINDING_COUNTS = {
    MATERIAL_IDS["oak"]: 64,
    MATERIAL_IDS["countertop"]: 1,
    MATERIAL_IDS["hardware"]: 10,
    MATERIAL_IDS["screen"]: 1,
    MATERIAL_IDS["lens"]: 2,
    MATERIAL_IDS["roomWall"]: 1,
    MATERIAL_IDS["roomFloor"]: 1,
}
WOOD_MATERIAL_IDS = {MATERIAL_IDS["oak"], MATERIAL_IDS["countertop"]}
FLAT_PRODUCT_MATERIAL_IDS = {
    MATERIAL_IDS["hardware"], MATERIAL_IDS["screen"], MATERIAL_IDS["lens"]
}
MATERIAL_FRAMES_BY_ROLE = {
    **{
        role: {"grainAxis": [1, 0, 0], "crossGrainAxis": [0, 0, 1], "normalAxis": [0, -1, 0]}
        for role in ("front_rail", "crown", "base")
    },
    **{
        role: {"grainAxis": [1, 0, 0], "crossGrainAxis": [0, 1, 0], "normalAxis": [0, 0, 1]}
        for role in ("shelf", "fixed_shelf", "top_panel", "bottom_panel")
    },
    **{
        role: {"grainAxis": [0, 0, 1], "crossGrainAxis": [1, 0, 0], "normalAxis": [0, 1, 0]}
        for role in ("front_stile", "front_field", "filler", "back_panel", "backing_panel")
    },
    **{
        role: {"grainAxis": [0, 0, 1], "crossGrainAxis": [0, 1, 0], "normalAxis": [-1, 0, 0]}
        for role in ("side_panel", "divider")
    },
}
EXPECTED_COLLECTION_NAMES = [
    "JQ_CASEWORK", "JQ_ROOM", "JQ_CONSTRAINTS_DEBUG", "JQ_CAMERAS"
]
EXPECTED_ROOM_NAMES = ["room-floor", "room-rear-wall"]
HERO_CAMERA_NAME = "JQ_HERO_CAMERA"
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/+:\-]{0,511}$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
MATERIAL_PACKAGE_KEY_RE = re.compile(r"^jq-render-material-package-v1-[a-f0-9]{64}$")
CAPTURE_KEY_RE = re.compile(r"^jq-materials-preview-v1-[a-f0-9]{64}$")

TOP_LEVEL_KEYS = {
    "kind", "schema", "schemaVersion", "authority", "versions", "baseGeometry",
    "translatorPolicy", "materialLibrary", "materialFrames", "bindings",
    "materialPackageKey", "capture",
}
AUTHORITY_KEYS = {
    "classification", "visualizationProfileId", "materialColorReferenceStatus",
    "customerMaterialApproved", "customerBeautyRenderApproved", "sourceRuleIds",
    "limitations",
}
VERSION_KEYS = {
    "descriptorSchemaVersion", "materialLibraryVersion", "proceduralOakAlgorithmVersion",
    "materialFrameVersion", "seedRuleVersion", "shaderTopologyVersion",
    "blenderMaterialTranslatorVersion", "blenderTranslationPolicyVersion",
    "materialPipelineVersion",
}
TRANSLATOR_POLICY_KEYS = {
    "policyId", "materialDatablock", "principled", "textureCoordinates",
    "vectorMath", "noise", "mix", "mapRange", "bump", "output",
}
MATERIAL_DATABLOCK_POLICY_KEYS = {
    "useNodes", "surfaceRenderMethod", "useTransparencyOverlap",
}
PRINCIPLED_POLICY_KEYS = {
    "distribution", "weight", "normalInput", "subsurfaceWeight",
    "subsurfaceRadius", "subsurfaceScale", "subsurfaceIor", "anisotropy",
    "specularTint", "tangentInput", "coatTint", "coatNormalInput",
    "sheenWeight", "sheenRoughness", "sheenTint", "thinFilmThickness",
    "thinFilmIor",
}
TEXTURE_COORDINATE_POLICY_KEYS = {"output", "object", "fromInstancer"}
VECTOR_MATH_POLICY_KEYS = {
    "subtractOriginOperation", "axisProjectionOperation",
    "physicalScaleOperation", "phaseOperation",
}
NOISE_POLICY_KEYS = {"offset", "gain"}
MIX_POLICY_KEYS = {"useAlpha"}
MAP_RANGE_POLICY_KEYS = {"dataType"}
BUMP_POLICY_KEYS = {"filterWidth", "normalInput"}
OUTPUT_POLICY_KEYS = {"surfaceOnly"}
BASE_GEOMETRY_KEYS = {
    "geometryFingerprint", "primaryPackageKey", "primaryPackageSha256",
    "packageSchemaVersion", "primitiveContractVersion", "componentCount",
    "submeshObjectCount", "constraintCount", "objectManifestSha256", "cameraFingerprint",
}
MATERIAL_KEYS = {
    "materialId", "recipeVersion", "family", "declaredColorSpace",
    "supportedBlenderVersion", "shaderTopologyId", "coordinatePolicy",
    "externalResources", "trueDisplacement", "parameters",
}
PRINCIPLED_KEYS = {
    "baseColor", "baseColorRamp", "metallic", "roughness", "ior", "alpha",
    "diffuseRoughness", "specularIorLevel", "anisotropic", "anisotropicRotation",
    "coatWeight", "coatRoughness", "coatIor", "transmissionWeight", "thinWall",
    "emissionColor", "emissionStrength", "colorTemperatureK", "bump", "procedural",
}
BUMP_KEYS = {"enabled", "strength", "distanceM", "invert", "source"}
RAMP_KEYS = {"interpolation", "colorMode", "hueInterpolation", "clamp", "stops"}
RAMP_STOP_KEYS = {"position", "color"}
PROCEDURAL_KEYS = {
    "algorithmVersion", "coordinateSpace", "basisOrder", "physicalTextureScaleM",
    "coarseNoise", "grainBands", "fiberNoise", "mix", "toneMap",
    "clampFactors", "clampColors",
}
TEXTURE_SCALE_KEYS = {"crossGrain", "grain", "normal"}
NOISE_KEYS = {"dimensions", "normalize", "scale", "detail", "roughness", "lacunarity", "distortion"}
WAVE_KEYS = {
    "waveType", "bandsDirection", "profile", "scale", "distortion", "detail",
    "detailScale", "detailRoughness",
}
MIX_KEYS = {"blendType", "factor", "useClamp"}
TONE_MAP_KEYS = {"interpolationType", "clamp", "fromMin", "fromMax", "toMin", "toMax", "steps"}
FRAME_KEYS = {
    "frameId", "mappingId", "componentId", "primitiveId", "submeshId",
    "surfaceGroupId", "coordinateSpace", "origin", "grainAxis", "crossGrainAxis",
    "normalAxis", "physicalTextureScaleM", "seedRuleVersion", "seedHex", "seedUint32",
    "phaseOffset", "colorVariation", "mappingDigest",
}
BINDING_KEYS = {
    "bindingId", "targetKind", "componentId", "primitiveId", "submeshId",
    "surfaceGroupId", "objectId", "materialSlotIndex", "sourceMaterialSlot",
    "sourceMaterialId", "materialId", "materialFrameId",
}
CAPTURE_KEYS = {
    "captureId", "captureKey", "materialMode", "camera", "sceneIdentity",
    "inheritedRender", "renderPolicy", "blenderRuntime", "output",
}
SCENE_IDENTITY_KEYS = {
    "sceneVersion", "environment", "shell", "room", "lightManifest",
    "worldIdentitySha256", "lightManifestSha256",
}
RENDER_POLICY_KEYS = {
    "engine", "blenderEngine", "renderDevice", "samples", "samplingSeed",
    "animatedSeed", "adaptiveSampling", "denoiser", "materialPipelineVersion",
}
POLICY_VALUE_KEYS = {"value", "policy"}
RUNTIME_KEYS = {"version", "buildHash", "backend", "vendor", "renderer", "deviceVersion"}
OUTPUT_KEYS = {
    "pass", "filename", "mimeType", "width", "height", "maxBytes", "webpColorMode",
    "webpColorDepth", "webpQuality", "colorManagement",
}
BINDING_COUNT_BY_SLOT = {
    "back": "clay-casework", "cabinet_finish": "clay-casework",
    "cabinet_interior": "clay-casework", "case": "clay-casework",
    "front": "clay-casework", "side": "clay-casework", "toe": "clay-casework",
    "hardware": "clay-hardware", "led": "clay-led", "screen": "clay-screen",
}


class MaterialWorkerError(RuntimeError):
    """Expected fail-closed worker error."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def fail(code: str, message: str) -> None:
    raise MaterialWorkerError(code, message)


def exact_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        actual = sorted(value) if isinstance(value, dict) else type(value).__name__
        fail("UNKNOWN_OR_MISSING_PROPERTY", f"{label} keys are invalid: {actual!r}")
    return value


def finite(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        fail("NON_FINITE_NUMBER", f"{label} must be a finite JSON number")
    number = float(value)
    if not math.isfinite(number):
        fail("NON_FINITE_NUMBER", f"{label} must be finite")
    return number


def nonnegative(value: Any, label: str) -> float:
    number = finite(value, label)
    if number < 0:
        fail("NEGATIVE_NUMBER", f"{label} must not be negative")
    return number


def positive(value: Any, label: str) -> float:
    number = finite(value, label)
    if number <= 0:
        fail("NON_POSITIVE_NUMBER", f"{label} must be positive")
    return number


def unit_interval(value: Any, label: str) -> float:
    number = finite(value, label)
    if not 0 <= number <= 1:
        fail("NUMBER_OUT_OF_RANGE", f"{label} must be in [0,1]")
    return number


def safe_id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SAFE_ID_RE.fullmatch(value):
        fail("INVALID_IDENTIFIER", f"{label} is not a safe deterministic ID")
    return value


def color(value: Any, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != 4:
        fail("INVALID_COLOR", f"{label} must be RGBA")
    return [unit_interval(channel, f"{label}[{index}]") for index, channel in enumerate(value)]


def vector3(value: Any, label: str, *, unit: bool = False) -> list[float]:
    if not isinstance(value, list) or len(value) != 3:
        fail("INVALID_VECTOR", f"{label} must contain three numbers")
    validator = unit_interval if unit else finite
    return [validator(entry, f"{label}[{index}]") for index, entry in enumerate(value)]


def point(value: Any, label: str) -> dict[str, float]:
    item = exact_keys(value, {"x", "y", "z"}, label)
    return {axis: finite(item[axis], f"{label}.{axis}") for axis in "xyz"}


def reject_nonfinite(value: Any, path: str) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            reject_nonfinite(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_nonfinite(child, f"{path}[{index}]")
    elif isinstance(value, float) and not math.isfinite(value):
        fail("NON_FINITE_NUMBER", f"{path} must be finite")
    elif not isinstance(value, (str, int, float, bool, type(None))):
        fail("INVALID_JSON_VALUE", f"{path} has an unsupported JSON value")


def load_strict_json(path: Path, label: str) -> tuple[dict[str, Any], bytes]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        fail("JSON_READ_FAILED", f"Cannot read {label}: {error}")
    if not raw or len(raw) > MAX_JSON_BYTES:
        fail("INVALID_JSON_SIZE", f"{label} is empty or exceeds 16 MiB")

    def reject_constant(value: str) -> None:
        fail("NON_FINITE_NUMBER", f"{label} contains non-finite value {value}")

    def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                fail("DUPLICATE_JSON_KEY", f"{label} repeats JSON key {key}")
            result[key] = value
        return result

    try:
        value = json.loads(
            raw.decode("utf-8"),
            parse_constant=reject_constant,
            object_pairs_hook=unique_object,
        )
    except MaterialWorkerError:
        raise
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        fail("INVALID_JSON", f"{label} is not strict UTF-8 JSON: {error}")
    if not isinstance(value, dict):
        fail("INVALID_JSON_ROOT", f"{label} root must be an object")
    reject_nonfinite(value, label)
    return value, raw


def hash_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def hash_canonical(value: Any) -> str:
    return hashlib.sha256(clay.js_stable_stringify(value).encode("utf-8")).hexdigest()


def canonical_equal(left: Any, right: Any) -> bool:
    return clay.js_stable_stringify(left) == clay.js_stable_stringify(right)


def round_metric(value: float) -> float:
    rounded = round(float(value), 12)
    return 0.0 if rounded == 0 else rounded


def round_geometry(value: float) -> float:
    """Canonicalize Blender float32 mesh storage at the contract tolerance."""
    rounded = round(float(value), 6)
    return 0.0 if rounded == 0 else rounded


def validate_texture_scale(value: Any, label: str) -> dict[str, float]:
    item = exact_keys(value, TEXTURE_SCALE_KEYS, label)
    return {key: positive(item[key], f"{label}.{key}") for key in sorted(TEXTURE_SCALE_KEYS)}


def validate_noise(value: Any, label: str) -> None:
    item = exact_keys(value, NOISE_KEYS, label)
    if item["dimensions"] != "4D" or item["normalize"] is not False:
        fail("UNSUPPORTED_NOISE_NODE", f"{label} must be deterministic 4D noise")
    positive(item["scale"], f"{label}.scale")
    nonnegative(item["detail"], f"{label}.detail")
    unit_interval(item["roughness"], f"{label}.roughness")
    positive(item["lacunarity"], f"{label}.lacunarity")
    nonnegative(item["distortion"], f"{label}.distortion")


def validate_principled(material: dict[str, Any]) -> None:
    material_id = material["materialId"]
    parameters = exact_keys(material["parameters"], PRINCIPLED_KEYS, f"{material_id}.parameters")
    procedural = parameters["procedural"]
    if procedural is None:
        color(parameters["baseColor"], f"{material_id}.baseColor")
        if parameters["baseColorRamp"] is not None:
            fail("UNEXPECTED_COLOR_RAMP", f"{material_id} cannot contain a color ramp")
    else:
        if parameters["baseColor"] is not None:
            fail("PROCEDURAL_BASE_COLOR_INVALID", f"{material_id} base color must come from its ramp")
        ramp = exact_keys(parameters["baseColorRamp"], RAMP_KEYS, f"{material_id}.baseColorRamp")
        if (
            ramp["interpolation"] != "LINEAR"
            or ramp["colorMode"] != "RGB"
            or ramp["hueInterpolation"] != "NEAR"
            or ramp["clamp"] is not True
        ):
            fail("INVALID_COLOR_RAMP_POLICY", f"{material_id} color ramp policy drifted")
        stops = ramp["stops"]
        if not isinstance(stops, list) or len(stops) < 2:
            fail("MISSING_COLOR_RAMP_STOPS", f"{material_id} needs at least two ramp stops")
        prior = -1.0
        for index, stop_value in enumerate(stops):
            stop = exact_keys(stop_value, RAMP_STOP_KEYS, f"{material_id}.stops[{index}]")
            position = unit_interval(stop["position"], f"{material_id}.stops[{index}].position")
            if position <= prior:
                fail("COLOR_RAMP_ORDER_INVALID", f"{material_id} ramp stops are not ordered")
            prior = position
            color(stop["color"], f"{material_id}.stops[{index}].color")
        if stops[0]["position"] != 0 or stops[-1]["position"] != 1:
            fail("COLOR_RAMP_ENDPOINTS_INVALID", f"{material_id} ramp endpoints drifted")

        proc = exact_keys(procedural, PROCEDURAL_KEYS, f"{material_id}.procedural")
        if (
            proc["algorithmVersion"] != PROCEDURAL_OAK_ALGORITHM_VERSION
            or proc["coordinateSpace"] != "PACKAGE_WORLD_METERS"
            or proc["basisOrder"] != "CROSS_GRAIN_NORMAL"
            or proc["clampFactors"] is not True
            or proc["clampColors"] is not True
        ):
            fail("UNSUPPORTED_PROCEDURAL_RECIPE", f"{material_id} procedural contract drifted")
        validate_texture_scale(proc["physicalTextureScaleM"], f"{material_id}.procedural.physicalTextureScaleM")
        validate_noise(proc["coarseNoise"], f"{material_id}.coarseNoise")
        validate_noise(proc["fiberNoise"], f"{material_id}.fiberNoise")
        wave = exact_keys(proc["grainBands"], WAVE_KEYS, f"{material_id}.grainBands")
        if wave["waveType"] != "BANDS" or wave["bandsDirection"] != "X" or wave["profile"] != "SIN":
            fail("UNSUPPORTED_GRAIN_NODE", f"{material_id} grain node is unsupported")
        positive(wave["scale"], f"{material_id}.grainBands.scale")
        positive(wave["detailScale"], f"{material_id}.grainBands.detailScale")
        for key in ("distortion", "detail", "detailRoughness"):
            nonnegative(wave[key], f"{material_id}.grainBands.{key}")
        mix = exact_keys(proc["mix"], MIX_KEYS, f"{material_id}.mix")
        if mix["blendType"] != "MIX" or mix["useClamp"] is not True:
            fail("UNSUPPORTED_MATERIAL_MIX", f"{material_id} mix policy is unsupported")
        unit_interval(mix["factor"], f"{material_id}.mix.factor")
        tone_map = exact_keys(proc["toneMap"], TONE_MAP_KEYS, f"{material_id}.toneMap")
        if (
            tone_map["interpolationType"] != "LINEAR"
            or tone_map["clamp"] is not True
            or tone_map["fromMin"] != 0
            or tone_map["fromMax"] != 1
            or tone_map["steps"] != 4
        ):
            fail("UNSUPPORTED_TONE_MAP", f"{material_id} tone map policy drifted")
        tone_min = unit_interval(tone_map["toMin"], f"{material_id}.toneMap.toMin")
        tone_max = unit_interval(tone_map["toMax"], f"{material_id}.toneMap.toMax")
        if tone_max <= tone_min:
            fail("UNSUPPORTED_TONE_MAP", f"{material_id} tone map range is unordered")

    for key in (
        "metallic", "roughness", "alpha", "diffuseRoughness", "specularIorLevel",
        "anisotropic", "anisotropicRotation", "coatWeight", "coatRoughness",
        "transmissionWeight",
    ):
        unit_interval(parameters[key], f"{material_id}.{key}")
    positive(parameters["ior"], f"{material_id}.ior")
    positive(parameters["coatIor"], f"{material_id}.coatIor")
    if not isinstance(parameters["thinWall"], bool):
        fail("INVALID_SHADER_BOOLEAN", f"{material_id}.thinWall must be boolean")
    color(parameters["emissionColor"], f"{material_id}.emissionColor")
    nonnegative(parameters["emissionStrength"], f"{material_id}.emissionStrength")
    color_temperature = parameters["colorTemperatureK"]
    if material_id == MATERIAL_IDS["lens"]:
        if color_temperature != 2700:
            fail("INVALID_COLOR_TEMPERATURE", f"{material_id}.colorTemperatureK must be exactly 2700")
    elif color_temperature is not None:
        fail("UNEXPECTED_COLOR_TEMPERATURE", f"{material_id}.colorTemperatureK must be null")
    bump = exact_keys(parameters["bump"], BUMP_KEYS, f"{material_id}.bump")
    if not isinstance(bump["enabled"], bool) or not isinstance(bump["invert"], bool):
        fail("INVALID_BUMP_BOOLEAN", f"{material_id} bump flags must be boolean")
    unit_interval(bump["strength"], f"{material_id}.bump.strength")
    nonnegative(bump["distanceM"], f"{material_id}.bump.distanceM")
    if bump["source"] not in {"none", "fiber-noise-factor"}:
        fail("INVALID_BUMP_SOURCE", f"{material_id} bump source is unsupported")
    if bump["enabled"] != (procedural is not None):
        fail("INVALID_PROCEDURAL_BUMP", f"{material_id} bump enablement contradicts its recipe")
    if bump["enabled"] and (bump["distanceM"] <= 0 or bump["source"] != "fiber-noise-factor"):
        fail("INVALID_PROCEDURAL_BUMP", f"{material_id} procedural bump is incomplete")
    if not bump["enabled"] and (bump["strength"] != 0 or bump["distanceM"] != 0 or bump["source"] != "none"):
        fail("DISABLED_BUMP_NOT_ZERO", f"{material_id} disabled bump must use explicit zeroes")


def create_object_manifest(render_package: dict[str, Any]) -> list[dict[str, Any]]:
    manifest: list[dict[str, Any]] = []
    for component in render_package["components"]:
        for submesh in component["submeshes"]:
            object_id = f"{component['componentId']}::{submesh['submeshId']}"
            manifest.append({
                "componentId": component["componentId"],
                "componentRole": component["role"],
                "primitiveId": f"{component['componentId']}/primitive/{submesh['submeshId']}",
                "submeshId": submesh["submeshId"],
                "surfaceGroupId": object_id,
                "objectId": object_id,
                "geometry": submesh["geometry"],
                "grainRole": submesh["grainRole"],
                "sourceMaterialSlot": submesh["sourceMaterialSlot"],
                "sourceMaterialId": submesh["materialId"],
                "blenderWorldBounds": submesh["blenderWorldBounds"],
                "primitiveGeometry": submesh["primitiveGeometry"],
            })
    manifest.sort(key=lambda item: item["objectId"])
    if len(manifest) != EXPECTED_PRODUCT_OBJECT_COUNT:
        fail("SUBMESH_COUNT_MISMATCH", "The accepted package must contain 78 submeshes")
    return manifest


def expected_product_material(entry: dict[str, Any]) -> tuple[str, str | None]:
    slot = entry["sourceMaterialSlot"]
    source_id = entry["sourceMaterialId"]
    if slot in {"back", "cabinet_finish", "cabinet_interior", "case", "front", "side", "toe"} and source_id == "natural-oak":
        material_id = (
            MATERIAL_IDS["countertop"]
            if entry["componentId"] == "guided-installation-main/continuous-countertop"
            else MATERIAL_IDS["oak"]
        )
        return material_id, f"{MATERIAL_FRAME_VERSION}/{entry['objectId']}"
    if (
        slot == "hardware" and source_id == "black-pull"
        and (
            entry["componentRole"] == "handle"
            or entry["componentRole"] == "light"
            and entry["primitiveGeometry"].get("surfaceRole") == "housing"
        )
    ):
        return MATERIAL_IDS["hardware"], None
    if (
        slot == "led" and source_id == "warm-led"
        and entry["componentRole"] == "light"
        and entry["primitiveGeometry"].get("surfaceRole") == "emissive_lens"
    ):
        return MATERIAL_IDS["lens"], None
    if (
        entry["componentId"] == "guided-installation-main/tv-body"
        and slot == "screen" and source_id == "tv-screen-neutral"
    ):
        return MATERIAL_IDS["screen"], None
    fail("UNRESOLVED_PRODUCT_SURFACE", f"{entry['objectId']} has no authorized material")
    raise AssertionError("unreachable")


def expected_oak_recipe(
    material_id: str,
    recipe_version: str,
    *,
    roughness: float,
    coat_weight: float,
    coat_roughness: float,
    grain_scale: float,
    grain_mix: float,
    tone_min: float,
    tone_max: float,
    bump_strength: float,
    bump_distance_m: float,
) -> dict[str, Any]:
    return {
        "materialId": material_id,
        "recipeVersion": recipe_version,
        "family": "procedural-wood",
        "declaredColorSpace": "Linear Rec.709",
        "supportedBlenderVersion": "5.2",
        "shaderTopologyId": f"{SHADER_TOPOLOGY_VERSION}/procedural-oak",
        "coordinatePolicy": "package-world-material-frame-v1",
        "externalResources": [],
        "trueDisplacement": False,
        "parameters": {
            "baseColor": None,
            "baseColorRamp": {
                "interpolation": "LINEAR", "colorMode": "RGB",
                "hueInterpolation": "NEAR", "clamp": True,
                "stops": [
                    {"position": 0, "color": [0.4, 0.29, 0.18, 1]},
                    {"position": 0.34, "color": [0.47, 0.36, 0.235, 1]},
                    {"position": 0.68, "color": [0.55, 0.45, 0.31, 1]},
                    {"position": 1, "color": [0.64, 0.55, 0.41, 1]},
                ],
            },
            "metallic": 0, "roughness": roughness, "ior": 1.5, "alpha": 1,
            "diffuseRoughness": 0.2, "specularIorLevel": 0.5,
            "anisotropic": 0.05, "anisotropicRotation": 0,
            "coatWeight": coat_weight, "coatRoughness": coat_roughness, "coatIor": 1.5,
            "transmissionWeight": 0, "thinWall": False,
            "emissionColor": [0, 0, 0, 1], "emissionStrength": 0,
            "colorTemperatureK": None,
            "bump": {
                "enabled": True, "strength": bump_strength,
                "distanceM": bump_distance_m, "invert": False,
                "source": "fiber-noise-factor",
            },
            "procedural": {
                "algorithmVersion": PROCEDURAL_OAK_ALGORITHM_VERSION,
                "coordinateSpace": "PACKAGE_WORLD_METERS",
                "basisOrder": "CROSS_GRAIN_NORMAL",
                "physicalTextureScaleM": {
                    "crossGrain": 0.6096, "grain": 1.2192, "normal": 0.0254,
                },
                "coarseNoise": {
                    "dimensions": "4D", "normalize": False, "scale": 2.2,
                    "detail": 2, "roughness": 0.42, "lacunarity": 2,
                    "distortion": 0.05,
                },
                "grainBands": {
                    "waveType": "BANDS", "bandsDirection": "X", "profile": "SIN",
                    "scale": grain_scale, "distortion": 2.2, "detail": 3,
                    "detailScale": 1.5, "detailRoughness": 0.42,
                },
                "fiberNoise": {
                    "dimensions": "4D", "normalize": False, "scale": 72,
                    "detail": 2, "roughness": 0.48, "lacunarity": 2,
                    "distortion": 0,
                },
                "mix": {"blendType": "MIX", "factor": grain_mix, "useClamp": True},
                "toneMap": {
                    "interpolationType": "LINEAR", "clamp": True,
                    "fromMin": 0, "fromMax": 1,
                    "toMin": tone_min, "toMax": tone_max, "steps": 4,
                },
                "clampFactors": True, "clampColors": True,
            },
        },
    }


def expected_flat_recipe(
    material_id: str,
    recipe_version: str,
    family: str,
    *,
    base_color: list[float], metallic: float, roughness: float, ior: float,
    coat_weight: float, coat_roughness: float, coat_ior: float,
    transmission_weight: float, alpha: float, thin_wall: bool,
    emission_color: list[float], emission_strength: float,
) -> dict[str, Any]:
    return {
        "materialId": material_id, "recipeVersion": recipe_version, "family": family,
        "declaredColorSpace": "Linear Rec.709", "supportedBlenderVersion": "5.2",
        "shaderTopologyId": f"{SHADER_TOPOLOGY_VERSION}/principled-flat",
        "coordinatePolicy": "none", "externalResources": [], "trueDisplacement": False,
        "parameters": {
            "baseColor": base_color, "baseColorRamp": None, "metallic": metallic,
            "roughness": roughness, "ior": ior, "alpha": alpha,
            "diffuseRoughness": 0, "specularIorLevel": 0.5,
            "anisotropic": 0, "anisotropicRotation": 0,
            "coatWeight": coat_weight, "coatRoughness": coat_roughness,
            "coatIor": coat_ior, "transmissionWeight": transmission_weight,
            "thinWall": thin_wall, "emissionColor": emission_color,
            "emissionStrength": emission_strength,
            "colorTemperatureK": 2700 if material_id == MATERIAL_IDS["lens"] else None,
            "bump": {"enabled": False, "strength": 0, "distanceM": 0,
                     "invert": False, "source": "none"},
            "procedural": None,
        },
    }


def expected_material_library(render_package: dict[str, Any]) -> list[dict[str, Any]]:
    wall = render_package["scene"]["shell"]["wallSurface"]
    floor = render_package["scene"]["shell"]["floorSurface"]
    led = warm_led_authority(render_package)
    recipes = [
        expected_oak_recipe(
            MATERIAL_IDS["oak"], "natural-oak-visualization-v1",
            roughness=0.58, coat_weight=0.08, coat_roughness=0.34,
            grain_scale=10, grain_mix=0.666666666667,
            tone_min=0.49, tone_max=0.65, bump_strength=0.12,
            bump_distance_m=0.00018,
        ),
        expected_oak_recipe(
            MATERIAL_IDS["countertop"], "natural-oak-countertop-visualization-v1",
            roughness=0.54, coat_weight=0.12, coat_roughness=0.3,
            grain_scale=9, grain_mix=0.65,
            tone_min=0.51, tone_max=0.65, bump_strength=0.1,
            bump_distance_m=0.00016,
        ),
        expected_flat_recipe(
            MATERIAL_IDS["hardware"], "matte-black-coated-dielectric-v1", "coated-hardware",
            base_color=[0.014, 0.016, 0.018, 1], metallic=0, roughness=0.47,
            ior=1.5, coat_weight=0.16, coat_roughness=0.4, coat_ior=1.5,
            transmission_weight=0, alpha=1, thin_wall=False,
            emission_color=[0, 0, 0, 1], emission_strength=0,
        ),
        expected_flat_recipe(
            MATERIAL_IDS["screen"], "tv-black-glass-v1", "dark-glass",
            base_color=[0.0035, 0.0045, 0.006, 1], metallic=0, roughness=0.16,
            ior=1.52, coat_weight=0.34, coat_roughness=0.12, coat_ior=1.52,
            transmission_weight=0.06, alpha=1, thin_wall=True,
            emission_color=[0, 0, 0, 1], emission_strength=0,
        ),
        expected_flat_recipe(
            MATERIAL_IDS["lens"], "warm-opal-puck-lens-v1", "opal-emissive",
            base_color=[0.78, 0.56, 0.3, 1], metallic=0, roughness=0.34,
            ior=1.46, coat_weight=0.04, coat_roughness=0.3, coat_ior=1.46,
            transmission_weight=0.22, alpha=1, thin_wall=False,
            emission_color=led["linearEmissionColor"],
            emission_strength=led["emissionStrength"],
        ),
        expected_flat_recipe(
            MATERIAL_IDS["roomWall"], "inherited-room-clay-v1", "inherited-room-clay",
            base_color=list(wall["baseColor"]), metallic=wall["metallic"],
            roughness=wall["roughness"], ior=1.5, coat_weight=0,
            coat_roughness=0, coat_ior=1.5, transmission_weight=0, alpha=1,
            thin_wall=False, emission_color=[0, 0, 0, 1], emission_strength=0,
        ),
        expected_flat_recipe(
            MATERIAL_IDS["roomFloor"], "inherited-room-clay-v1", "inherited-room-clay",
            base_color=list(floor["baseColor"]), metallic=floor["metallic"],
            roughness=floor["roughness"], ior=1.5, coat_weight=0,
            coat_roughness=0, coat_ior=1.5, transmission_weight=0, alpha=1,
            thin_wall=False, emission_color=[0, 0, 0, 1], emission_strength=0,
        ),
    ]
    return sorted(recipes, key=lambda item: item["materialId"])


def js_round_metric(value: float) -> float:
    rounded = math.floor((float(value) + sys.float_info.epsilon) * 1_000_000_000_000 + 0.5)
    result = rounded / 1_000_000_000_000
    return 0.0 if result == 0 else result


def unit_from_hex(value: str) -> float:
    return js_round_metric(int(value, 16) / 0xFFFFFFFF)


def js_round_color_variation(value: float) -> float:
    rounded = math.floor((float(value) + sys.float_info.epsilon) * 10_000 + 0.5) / 10_000
    return 0.0 if rounded == 0 else rounded


def expected_material_frame(entry: dict[str, Any]) -> dict[str, Any]:
    axes = MATERIAL_FRAMES_BY_ROLE.get(entry["grainRole"])
    if axes is None:
        fail("UNSUPPORTED_GRAIN_ROLE", f"{entry['objectId']} has no authorized grain axis")
    seed_source = "\0".join((
        PBR_MATERIAL_LIBRARY_VERSION,
        entry["componentId"], entry["primitiveId"], entry["submeshId"],
        entry["surfaceGroupId"],
    ))
    seed_hex = hashlib.sha256(seed_source.encode("utf-8")).hexdigest()
    frame_core = {
        "frameId": f"{MATERIAL_FRAME_VERSION}/{entry['objectId']}",
        "mappingId": f"jq-material-mapping-v1-{seed_hex}",
        "componentId": entry["componentId"], "primitiveId": entry["primitiveId"],
        "submeshId": entry["submeshId"], "surfaceGroupId": entry["surfaceGroupId"],
        "coordinateSpace": "PACKAGE_WORLD_METERS",
        "origin": dict(entry["blenderWorldBounds"]["min"]),
        "grainAxis": list(axes["grainAxis"]),
        "crossGrainAxis": list(axes["crossGrainAxis"]),
        "normalAxis": list(axes["normalAxis"]),
        "physicalTextureScaleM": {
            "crossGrain": 0.6096, "grain": 1.2192, "normal": 0.0254,
        },
        "seedRuleVersion": MATERIAL_SEED_RULE_VERSION,
        "seedHex": seed_hex,
        "seedUint32": int(seed_hex[:8], 16),
        "phaseOffset": [
            unit_from_hex(seed_hex[8:16]), unit_from_hex(seed_hex[16:24]),
            unit_from_hex(seed_hex[24:32]),
        ],
        "colorVariation": js_round_color_variation(
            (unit_from_hex(seed_hex[32:40]) - 0.5) * 0.024
        ),
    }
    return {**frame_core, "mappingDigest": hash_canonical(frame_core)}


def expected_material_frames(manifest: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = []
    for entry in manifest:
        _, frame_id = expected_product_material(entry)
        if frame_id is not None:
            result.append(expected_material_frame(entry))
    return sorted(result, key=lambda item: item["frameId"])


def expected_translator_policy() -> dict[str, Any]:
    """Return every Blender-side value intentionally pinned by the sidecar."""
    return {
        "policyId": BLENDER_TRANSLATION_POLICY_VERSION,
        "materialDatablock": {
            "useNodes": True,
            "surfaceRenderMethod": "DITHERED",
            "useTransparencyOverlap": True,
        },
        "principled": {
            "distribution": "MULTI_GGX",
            "weight": 1,
            "normalInput": [0, 0, 0],
            "subsurfaceWeight": 0,
            "subsurfaceRadius": [1, 0.2, 0.1],
            "subsurfaceScale": 0.05,
            "subsurfaceIor": 1.4,
            "anisotropy": 0,
            "specularTint": [1, 1, 1, 1],
            "tangentInput": [0, 0, 0],
            "coatTint": [1, 1, 1, 1],
            "coatNormalInput": [0, 0, 0],
            "sheenWeight": 0,
            "sheenRoughness": 0.5,
            "sheenTint": [1, 1, 1, 1],
            "thinFilmThickness": 0,
            "thinFilmIor": 1.33,
        },
        "textureCoordinates": {
            "output": "Object", "object": None, "fromInstancer": False,
        },
        "vectorMath": {
            "subtractOriginOperation": "SUBTRACT",
            "axisProjectionOperation": "DOT_PRODUCT",
            "physicalScaleOperation": "DIVIDE",
            "phaseOperation": "ADD",
        },
        "noise": {"offset": 0, "gain": 1},
        "mix": {"useAlpha": False},
        "mapRange": {"dataType": "FLOAT"},
        "bump": {"filterWidth": 0.1, "normalInput": [0, 0, 0]},
        "output": {"surfaceOnly": True},
    }


def validate_translator_policy(value: Any) -> dict[str, Any]:
    policy = exact_keys(value, TRANSLATOR_POLICY_KEYS, "translatorPolicy")
    exact_keys(policy["materialDatablock"], MATERIAL_DATABLOCK_POLICY_KEYS,
               "translatorPolicy.materialDatablock")
    exact_keys(policy["principled"], PRINCIPLED_POLICY_KEYS,
               "translatorPolicy.principled")
    exact_keys(policy["textureCoordinates"], TEXTURE_COORDINATE_POLICY_KEYS,
               "translatorPolicy.textureCoordinates")
    exact_keys(policy["vectorMath"], VECTOR_MATH_POLICY_KEYS,
               "translatorPolicy.vectorMath")
    exact_keys(policy["noise"], NOISE_POLICY_KEYS, "translatorPolicy.noise")
    exact_keys(policy["mix"], MIX_POLICY_KEYS, "translatorPolicy.mix")
    exact_keys(policy["mapRange"], MAP_RANGE_POLICY_KEYS, "translatorPolicy.mapRange")
    exact_keys(policy["bump"], BUMP_POLICY_KEYS, "translatorPolicy.bump")
    exact_keys(policy["output"], OUTPUT_POLICY_KEYS, "translatorPolicy.output")
    if not canonical_equal(policy, expected_translator_policy()):
        fail("BLENDER_TRANSLATION_POLICY_INVALID", "Blender translation policy drifted")
    return policy


def srgb_hex_to_linear_rec709(value: str) -> list[float]:
    if not re.fullmatch(r"#[a-fA-F0-9]{6}", value):
        fail("WARM_LED_AUTHORITY_INVALID", "warm-led baseColor must be six-digit sRGB hex")
    channels = []
    for offset in (1, 3, 5):
        srgb = int(value[offset:offset + 2], 16) / 255
        linear = srgb / 12.92 if srgb <= 0.04045 else ((srgb + 0.055) / 1.055) ** 2.4
        channels.append(round_metric(linear))
    return [*channels, 1]


def warm_led_authority(render_package: dict[str, Any]) -> dict[str, Any]:
    """Derive the lens emission only from the verified package authority."""
    definitions = [
        item for item in render_package["materials"]
        if item.get("materialId") == "warm-led"
    ]
    if len(definitions) != 1:
        fail("WARM_LED_AUTHORITY_INVALID", "Geometry package must define warm-led exactly once")
    definition = definitions[0]
    expected_definition = {
        "family": "emissive",
        "baseColor": "#fff3df",
        "strength": 6,
        "colorTemperatureSource": "component.metadata.warmth",
    }
    if (
        definition.get("sourceMaterialSlot") != "led"
        or definition.get("definition") != expected_definition
    ):
        fail("WARM_LED_AUTHORITY_INVALID", "warm-led definition differs from its canonical recipe")
    puck_components = [
        component for component in render_package["components"]
        if component.get("materialId") == "warm-led"
    ]
    if len(puck_components) != 2 or any(
        component.get("metadata", {}).get("warmth") != 2700
        for component in puck_components
    ):
        fail("WARM_LED_AUTHORITY_INVALID", "Both warm-led pucks must author exactly 2700K")
    linear_color = srgb_hex_to_linear_rec709(definition["definition"]["baseColor"])
    if linear_color != [1, 0.896269353374, 0.737910408773, 1]:
        fail("WARM_LED_AUTHORITY_INVALID", "warm-led linear conversion drifted")
    return {
        "sourceColor": definition["definition"]["baseColor"],
        "linearEmissionColor": linear_color,
        "emissionStrength": definition["definition"]["strength"],
        "colorTemperatureK": 2700,
    }


def validate_material_package(
    render_package: dict[str, Any], material_package: dict[str, Any], package_raw: bytes
) -> dict[str, Any]:
    exact_keys(material_package, TOP_LEVEL_KEYS, "materialPackage")
    if (
        material_package["kind"] != MATERIAL_PACKAGE_KIND
        or material_package["schema"] != MATERIAL_PACKAGE_SCHEMA
        or material_package["schemaVersion"] != MATERIAL_PACKAGE_SCHEMA_VERSION
    ):
        fail("INVALID_MATERIAL_PACKAGE_SCHEMA", "Material package schema is unsupported")
    reject_nonfinite(material_package, "materialPackage")

    authority = exact_keys(material_package["authority"], AUTHORITY_KEYS, "authority")
    if (
        authority["classification"] != "PREVIEW_ONLY_AUTHORIZED"
        or authority["visualizationProfileId"] != MATERIAL_IDS["oak"]
        or authority["materialColorReferenceStatus"] != "UNVERIFIED"
        or authority["customerMaterialApproved"] is not False
        or authority["customerBeautyRenderApproved"] is not False
        or not isinstance(authority["sourceRuleIds"], list)
        or not authority["sourceRuleIds"]
        or not all(isinstance(item, str) and item for item in authority["sourceRuleIds"])
        or not isinstance(authority["limitations"], list)
        or not all(isinstance(item, str) for item in authority["limitations"])
    ):
        fail("INVALID_MATERIAL_AUTHORITY", "Material authority must remain preview-only and unapproved")

    versions = exact_keys(material_package["versions"], VERSION_KEYS, "versions")
    expected_versions = {
        "descriptorSchemaVersion": 1,
        "materialLibraryVersion": PBR_MATERIAL_LIBRARY_VERSION,
        "proceduralOakAlgorithmVersion": PROCEDURAL_OAK_ALGORITHM_VERSION,
        "materialFrameVersion": MATERIAL_FRAME_VERSION,
        "seedRuleVersion": MATERIAL_SEED_RULE_VERSION,
        "shaderTopologyVersion": SHADER_TOPOLOGY_VERSION,
        "blenderMaterialTranslatorVersion": BLENDER_MATERIAL_TRANSLATOR_VERSION,
        "blenderTranslationPolicyVersion": BLENDER_TRANSLATION_POLICY_VERSION,
        "materialPipelineVersion": MATERIAL_PIPELINE_VERSION,
    }
    if not canonical_equal(versions, expected_versions):
        fail("MATERIAL_VERSION_MISMATCH", "Material package versions drifted")

    translator_policy = validate_translator_policy(material_package["translatorPolicy"])

    manifest = create_object_manifest(render_package)
    base = exact_keys(material_package["baseGeometry"], BASE_GEOMETRY_KEYS, "baseGeometry")
    expected_base = {
        "geometryFingerprint": EXPECTED_GEOMETRY_FINGERPRINT,
        "primaryPackageKey": EXPECTED_PRIMARY_PACKAGE_KEY,
        "primaryPackageSha256": hash_canonical(render_package),
        "packageSchemaVersion": render_package["schemaVersion"],
        "primitiveContractVersion": render_package["primitiveContractVersion"],
        "componentCount": EXPECTED_COMPONENT_COUNT,
        "submeshObjectCount": EXPECTED_PRODUCT_OBJECT_COUNT,
        "constraintCount": EXPECTED_CONSTRAINT_COUNT,
        "objectManifestSha256": hash_canonical(manifest),
        "cameraFingerprint": render_package["identity"]["cameraFingerprint"],
    }
    if not canonical_equal(base, expected_base):
        fail("BASE_GEOMETRY_IDENTITY_MISMATCH", "Material sidecar targets different geometry")

    library = material_package["materialLibrary"]
    if not isinstance(library, list) or len(library) != 7:
        fail("MATERIAL_LIBRARY_CARDINALITY", "Material library must contain seven recipes")
    material_by_id: dict[str, dict[str, Any]] = {}
    for index, material_value in enumerate(library):
        material = exact_keys(material_value, MATERIAL_KEYS, f"materialLibrary[{index}]")
        material_id = safe_id(material["materialId"], f"materialLibrary[{index}].materialId")
        if material_id in material_by_id:
            fail("DUPLICATE_MATERIAL_ID", f"Duplicate material {material_id}")
        if material["supportedBlenderVersion"] != "5.2" or material["declaredColorSpace"] != "Linear Rec.709":
            fail("UNSUPPORTED_MATERIAL_BLENDER_VERSION", f"{material_id} version or color space drifted")
        if material["externalResources"] != [] or material["trueDisplacement"] is not False:
            fail("EXTERNAL_OR_DISPLACEMENT_FORBIDDEN", f"{material_id} uses a forbidden resource")
        safe_id(material["recipeVersion"], f"{material_id}.recipeVersion")
        safe_id(material["family"], f"{material_id}.family")
        validate_principled(material)
        material_by_id[material_id] = material
    if list(material_by_id) != sorted(material_by_id) or set(material_by_id) != set(MATERIAL_IDS.values()):
        fail("MATERIAL_LIBRARY_INCOMPLETE", "Material definitions must be complete and sorted")
    if not canonical_equal(library, expected_material_library(render_package)):
        fail("MATERIAL_RECIPE_DRIFT", "Material recipes differ from their exact authorized values")

    frames = material_package["materialFrames"]
    if not isinstance(frames, list) or len(frames) != EXPECTED_FRAME_COUNT:
        fail("MATERIAL_FRAME_CARDINALITY", "Material sidecar requires 65 frames")
    frame_by_id: dict[str, dict[str, Any]] = {}
    mapping_ids: set[str] = set()
    for index, frame_value in enumerate(frames):
        frame = exact_keys(frame_value, FRAME_KEYS, f"materialFrames[{index}]")
        for key in ("frameId", "mappingId", "componentId", "primitiveId", "submeshId", "surfaceGroupId"):
            safe_id(frame[key], f"materialFrames[{index}].{key}")
        if frame["frameId"] in frame_by_id or frame["mappingId"] in mapping_ids:
            fail("DUPLICATE_MATERIAL_FRAME", f"Duplicate frame or mapping {frame['frameId']}")
        if frame["coordinateSpace"] != "PACKAGE_WORLD_METERS" or frame["seedRuleVersion"] != MATERIAL_SEED_RULE_VERSION:
            fail("UNSUPPORTED_COORDINATE_SPACE", f"{frame['frameId']} coordinate policy drifted")
        point(frame["origin"], f"{frame['frameId']}.origin")
        grain = vector3(frame["grainAxis"], f"{frame['frameId']}.grainAxis")
        cross_grain = vector3(frame["crossGrainAxis"], f"{frame['frameId']}.crossGrainAxis")
        normal = vector3(frame["normalAxis"], f"{frame['frameId']}.normalAxis")
        lengths = [math.sqrt(sum(component * component for component in axis)) for axis in (grain, cross_grain, normal)]
        dots = [
            sum(grain[i] * cross_grain[i] for i in range(3)),
            sum(grain[i] * normal[i] for i in range(3)),
            sum(cross_grain[i] * normal[i] for i in range(3)),
        ]
        cross_product = [
            grain[1] * cross_grain[2] - grain[2] * cross_grain[1],
            grain[2] * cross_grain[0] - grain[0] * cross_grain[2],
            grain[0] * cross_grain[1] - grain[1] * cross_grain[0],
        ]
        handedness = sum(cross_product[i] * normal[i] for i in range(3))
        if any(abs(length - 1) > NUMERIC_TOLERANCE for length in lengths):
            fail("NON_NORMALIZED_MATERIAL_FRAME", f"{frame['frameId']} axes are not normalized")
        if any(abs(value) > NUMERIC_TOLERANCE for value in dots) or handedness < 1 - NUMERIC_TOLERANCE:
            fail("NON_ORTHOGONAL_MATERIAL_FRAME", f"{frame['frameId']} is not right-handed orthogonal")
        validate_texture_scale(frame["physicalTextureScaleM"], f"{frame['frameId']}.scale")
        if not isinstance(frame["seedHex"], str) or not SHA256_RE.fullmatch(frame["seedHex"]):
            fail("INVALID_MATERIAL_SEED", f"{frame['frameId']} seed is invalid")
        if not isinstance(frame["seedUint32"], int) or isinstance(frame["seedUint32"], bool) or not 0 <= frame["seedUint32"] <= 0xFFFFFFFF:
            fail("INVALID_MATERIAL_SEED", f"{frame['frameId']} uint32 seed is invalid")
        vector3(frame["phaseOffset"], f"{frame['frameId']}.phaseOffset", unit=True)
        variation = finite(frame["colorVariation"], f"{frame['frameId']}.colorVariation")
        if abs(variation) > 0.012:
            fail("INVALID_COLOR_VARIATION", f"{frame['frameId']} variation is invalid")
        core = {key: value for key, value in frame.items() if key != "mappingDigest"}
        if frame["mappingDigest"] != hash_canonical(core):
            fail("MAPPING_DIGEST_MISMATCH", f"{frame['frameId']} mapping digest is stale")
        frame_by_id[frame["frameId"]] = frame
        mapping_ids.add(frame["mappingId"])
    if list(frame_by_id) != sorted(frame_by_id):
        fail("MATERIAL_FRAME_ORDER_INVALID", "Material frames must be sorted")
    if not canonical_equal(frames, expected_material_frames(manifest)):
        fail(
            "MATERIAL_FRAME_DERIVATION_MISMATCH",
            "Material frames do not match exact semantic identities, bounds, axes, seeds, or phases",
        )

    bindings = material_package["bindings"]
    if not isinstance(bindings, list) or len(bindings) != EXPECTED_BINDING_COUNT:
        fail("MATERIAL_BINDING_CARDINALITY", "Material sidecar requires 80 bindings")
    expected_entries = {entry["objectId"]: entry for entry in manifest}
    binding_by_object: dict[str, dict[str, Any]] = {}
    binding_ids: set[str] = set()
    used_frames: set[str] = set()
    counts = {material_id: 0 for material_id in MATERIAL_IDS.values()}
    for index, binding_value in enumerate(bindings):
        binding = exact_keys(binding_value, BINDING_KEYS, f"bindings[{index}]")
        for key in (
            "bindingId", "componentId", "primitiveId", "submeshId", "surfaceGroupId",
            "objectId", "sourceMaterialSlot", "sourceMaterialId", "materialId",
        ):
            safe_id(binding[key], f"bindings[{index}].{key}")
        if binding["bindingId"] in binding_ids or binding["objectId"] in binding_by_object:
            fail("CONFLICTING_MATERIAL_BINDING", f"Duplicate binding for {binding['objectId']}")
        if binding["materialSlotIndex"] != 0 or binding["targetKind"] not in {"PRODUCT_SUBMESH", "ROOM_SURFACE"}:
            fail("UNKNOWN_BINDING_TARGET", f"{binding['bindingId']} target is unsupported")
        if binding["materialId"] not in material_by_id:
            fail("UNKNOWN_BINDING_MATERIAL", f"{binding['bindingId']} material is unknown")
        if binding["targetKind"] == "PRODUCT_SUBMESH":
            entry = expected_entries.get(binding["objectId"])
            if entry is None:
                fail("UNRESOLVED_MATERIAL_BINDING", f"{binding['objectId']} is not an accepted object")
            expected_material, expected_frame = expected_product_material(entry)
            expected_binding = {
                "bindingId": f"product/{entry['objectId']}",
                "targetKind": "PRODUCT_SUBMESH",
                "componentId": entry["componentId"],
                "primitiveId": entry["primitiveId"],
                "submeshId": entry["submeshId"],
                "surfaceGroupId": entry["surfaceGroupId"],
                "objectId": entry["objectId"],
                "materialSlotIndex": 0,
                "sourceMaterialSlot": entry["sourceMaterialSlot"],
                "sourceMaterialId": entry["sourceMaterialId"],
                "materialId": expected_material,
                "materialFrameId": expected_frame,
            }
            if not canonical_equal(binding, expected_binding):
                fail("MATERIAL_BINDING_MISMATCH", f"{binding['bindingId']} contradicts the geometry package")
        else:
            expected_room = {
                "room-floor": {
                    "bindingId": "room/room-floor", "targetKind": "ROOM_SURFACE",
                    "componentId": "JQ_ROOM", "primitiveId": "room-floor-plane",
                    "submeshId": "surface", "surfaceGroupId": "room-floor",
                    "objectId": "room-floor", "materialSlotIndex": 0,
                    "sourceMaterialSlot": "room-floor", "sourceMaterialId": "room-floor-clay",
                    "materialId": MATERIAL_IDS["roomFloor"], "materialFrameId": None,
                },
                "room-rear-wall": {
                    "bindingId": "room/room-rear-wall", "targetKind": "ROOM_SURFACE",
                    "componentId": "JQ_ROOM", "primitiveId": "room-rear-wall-plane",
                    "submeshId": "surface", "surfaceGroupId": "room-rear-wall",
                    "objectId": "room-rear-wall", "materialSlotIndex": 0,
                    "sourceMaterialSlot": "room-wall", "sourceMaterialId": "room-wall-clay",
                    "materialId": MATERIAL_IDS["roomWall"], "materialFrameId": None,
                },
            }.get(binding["objectId"])
            if expected_room is None or not canonical_equal(binding, expected_room):
                fail("ROOM_BINDING_MISMATCH", f"{binding['bindingId']} room binding drifted")
        if binding["materialFrameId"] is not None:
            if binding["materialFrameId"] not in frame_by_id or binding["materialFrameId"] in used_frames:
                fail("MISSING_OR_DUPLICATE_MATERIAL_FRAME", f"{binding['bindingId']} frame is invalid")
            used_frames.add(binding["materialFrameId"])
        counts[binding["materialId"]] += 1
        binding_by_object[binding["objectId"]] = binding
        binding_ids.add(binding["bindingId"])
    if [binding["bindingId"] for binding in bindings] != sorted(binding_ids):
        fail("MATERIAL_BINDING_ORDER_INVALID", "Material bindings must be sorted")
    if set(binding_by_object) != set(expected_entries) | set(EXPECTED_ROOM_NAMES):
        fail("UNBOUND_REQUIRED_SURFACE", "Every product and room surface must be bound")
    if used_frames != set(frame_by_id) or counts != EXPECTED_BINDING_COUNTS:
        fail("MATERIAL_BINDING_COUNTS_MISMATCH", "Frame use or per-material counts drifted")

    key_payload = {
        "keyVersion": MATERIAL_PACKAGE_SCHEMA,
        "versions": versions,
        "baseGeometry": base,
        "translatorPolicy": translator_policy,
        "materialLibrary": sorted(library, key=lambda item: item["materialId"]),
        "materialFrames": sorted(frames, key=lambda item: item["frameId"]),
        "bindings": sorted(bindings, key=lambda item: item["bindingId"]),
    }
    expected_package_key = f"jq-render-material-package-v1-{hash_canonical(key_payload)}"
    if (
        not isinstance(material_package["materialPackageKey"], str)
        or not MATERIAL_PACKAGE_KEY_RE.fullmatch(material_package["materialPackageKey"])
        or material_package["materialPackageKey"] != expected_package_key
    ):
        fail("STALE_MATERIAL_PACKAGE_KEY", "Material package key does not match canonical content")

    capture = exact_keys(material_package["capture"], CAPTURE_KEYS, "capture")
    if (
        capture["captureId"] != MATERIAL_PREVIEW_CAPTURE_ID
        or capture["materialMode"] != MATERIAL_PIPELINE_VERSION
        or not canonical_equal(capture["camera"], render_package["camera"])
        or not canonical_equal(capture["inheritedRender"], render_package["render"])
    ):
        fail("CAPTURE_IDENTITY_MUTATION", "Capture changed its camera or inherited render contract")
    scene_identity = exact_keys(capture["sceneIdentity"], SCENE_IDENTITY_KEYS, "capture.sceneIdentity")
    expected_scene = {
        "sceneVersion": render_package["scene"]["sceneVersion"],
        "environment": render_package["scene"]["environment"],
        "shell": render_package["scene"]["shell"],
        "room": render_package["room"],
        "lightManifest": [],
        "worldIdentitySha256": hash_canonical(render_package["scene"]["environment"]),
        "lightManifestSha256": hash_canonical([]),
    }
    if not canonical_equal(scene_identity, expected_scene):
        fail("SCENE_IDENTITY_MUTATION", "Capture changed room, world, or lights")
    policy = exact_keys(capture["renderPolicy"], RENDER_POLICY_KEYS, "capture.renderPolicy")
    for key in ("samplingSeed", "animatedSeed", "adaptiveSampling", "denoiser"):
        exact_keys(policy[key], POLICY_VALUE_KEYS, f"capture.renderPolicy.{key}")
    expected_policy = {
        "engine": "BLENDER_EEVEE_NEXT", "blenderEngine": "BLENDER_EEVEE",
        "renderDevice": "BLENDER_EEVEE_INTERNAL", "samples": 128,
        "samplingSeed": {"value": None, "policy": "not-applicable-eevee-5.2"},
        "animatedSeed": {"value": None, "policy": "not-applicable-eevee-5.2"},
        "adaptiveSampling": {"value": None, "policy": "not-applicable-eevee-5.2"},
        "denoiser": {
            "value": False,
            "policy": "not-applicable-eevee-5.2-compositor-disabled",
        },
        "materialPipelineVersion": MATERIAL_PIPELINE_VERSION,
    }
    if not canonical_equal(policy, expected_policy):
        fail("MATERIAL_RENDER_POLICY_INVALID", "Material render policy drifted")
    runtime = exact_keys(capture["blenderRuntime"], RUNTIME_KEYS, "capture.blenderRuntime")
    if (
        runtime["version"] != EXPECTED_BLENDER_VERSION
        or runtime["buildHash"] != EXPECTED_BLENDER_BUILD
        or runtime["backend"] != "METAL"
        or runtime["renderer"] != "Metal API"
        or not all(isinstance(runtime[key], str) and runtime[key] for key in RUNTIME_KEYS)
    ):
        fail("BLENDER_RUNTIME_INVALID", "Capture Blender runtime is unsupported")
    output = exact_keys(capture["output"], OUTPUT_KEYS, "capture.output")
    expected_output = {
        "pass": "materials-preview", "filename": "materials-preview.webp",
        "mimeType": "image/webp", "width": 960, "height": 640,
        "maxBytes": MAX_OUTPUT_BYTES, "webpColorMode": "RGB", "webpColorDepth": "8",
        "webpQuality": 90, "colorManagement": "FOLLOW_SCENE",
    }
    if not canonical_equal(output, expected_output):
        fail("MATERIAL_OUTPUT_CONTRACT_INVALID", "Material output contract drifted")
    without_capture_key = {key: value for key, value in capture.items() if key != "captureKey"}
    capture_payload = {
        "keyVersion": MATERIAL_PREVIEW_CAPTURE_ID,
        "materialPackageKey": material_package["materialPackageKey"],
        "capture": without_capture_key,
    }
    expected_capture_key = f"jq-materials-preview-v1-{hash_canonical(capture_payload)}"
    if (
        not isinstance(capture["captureKey"], str)
        or not CAPTURE_KEY_RE.fullmatch(capture["captureKey"])
        or capture["captureKey"] != expected_capture_key
    ):
        fail("STALE_CAPTURE_KEY", "Material preview capture key is stale")
    return {
        "materials": material_by_id,
        "frames": frame_by_id,
        "bindings": bindings,
        "manifest": manifest,
        "capture": capture,
        "translatorPolicy": translator_policy,
    }


def expected_product_geometry(
    component: dict[str, Any], submesh: dict[str, Any]
) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
    item_bounds = clay.bounds(submesh["blenderWorldBounds"], "submesh.blenderWorldBounds")
    geometry = submesh["geometry"]
    if geometry == "box":
        return clay.box_vertices_faces(item_bounds)
    if geometry == "crown_profile_extrusion":
        return clay.crown_vertices_faces(item_bounds, submesh["profileGeometry"])
    if geometry == "cylinder":
        return clay.cylinder_vertices_faces(submesh["primitiveGeometry"])
    fail("UNKNOWN_PRIMITIVE_KIND", f"{component['componentId']} has unknown geometry {geometry}")
    raise AssertionError("unreachable")


def normalized_face(
    face: Iterable[int], vertices: list[tuple[float, float, float]]
) -> list[list[float]]:
    coordinates = [tuple(round_geometry(value) for value in vertices[index]) for index in face]
    candidates: list[tuple[tuple[float, float, float], ...]] = []
    for sequence in (coordinates, list(reversed(coordinates))):
        for offset in range(len(sequence)):
            candidates.append(tuple(sequence[offset:] + sequence[:offset]))
    return [list(point_value) for point_value in min(candidates)]


def geometry_signature(
    vertices: list[tuple[float, float, float]], faces: Iterable[Iterable[int]]
) -> dict[str, Any]:
    canonical_vertices = sorted(
        [list(round_geometry(value) for value in vertex) for vertex in vertices]
    )
    canonical_faces = sorted(normalized_face(face, vertices) for face in faces)
    return {
        "vertexCount": len(vertices),
        "faceCount": len(canonical_faces),
        "verticesSha256": hash_canonical(canonical_vertices),
        "topologySha256": hash_canonical(canonical_faces),
    }


def coordinates_match(left: Iterable[float], right: Iterable[float]) -> bool:
    return all(
        abs(float(left_value) - float(right_value)) <= GEOMETRY_TOLERANCE
        for left_value, right_value in zip(left, right)
    )


def contract_value_matches(actual: Any, expected: Any, tolerance: float = GEOMETRY_TOLERANCE) -> bool:
    if isinstance(expected, bool) or isinstance(actual, bool):
        return actual is expected
    if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
        return abs(float(actual) - float(expected)) <= tolerance
    if isinstance(expected, list) and isinstance(actual, list) and len(actual) == len(expected):
        return all(contract_value_matches(left, right, tolerance) for left, right in zip(actual, expected))
    return actual == expected


def face_coordinates_match(
    actual: list[tuple[float, float, float]],
    expected: list[tuple[float, float, float]],
) -> bool:
    if len(actual) != len(expected):
        return False
    for sequence in (actual, list(reversed(actual))):
        for offset in range(len(sequence)):
            rotated = sequence[offset:] + sequence[:offset]
            if all(coordinates_match(left, right) for left, right in zip(rotated, expected)):
                return True
    return False


def validate_mesh_geometry(
    obj: Any,
    expected_vertices: list[tuple[float, float, float]],
    expected_faces: list[tuple[int, ...]],
    label: str,
) -> None:
    """Prove package geometry/topology despite Blender's float32 and winding rewrites."""
    actual_vertices = [tuple(float(value) for value in vertex.co) for vertex in obj.data.vertices]
    actual_faces = [tuple(polygon.vertices) for polygon in obj.data.polygons]
    if len(actual_vertices) != len(expected_vertices) or len(actual_faces) != len(expected_faces):
        fail("MESH_TOPOLOGY_DRIFT", f"{label} vertex or face count differs from its package primitive")

    unmatched_vertices = list(actual_vertices)
    for expected_vertex in expected_vertices:
        match_index = next(
            (index for index, actual_vertex in enumerate(unmatched_vertices)
             if coordinates_match(actual_vertex, expected_vertex)),
            None,
        )
        if match_index is None:
            fail("MESH_VERTEX_DRIFT", f"{label} has a vertex outside package tolerance")
        unmatched_vertices.pop(match_index)

    unmatched_faces = [
        [actual_vertices[index] for index in face]
        for face in actual_faces
    ]
    for expected_face in expected_faces:
        expected_coordinates = [expected_vertices[index] for index in expected_face]
        match_index = next(
            (index for index, actual_face in enumerate(unmatched_faces)
             if face_coordinates_match(actual_face, expected_coordinates)),
            None,
        )
        if match_index is None:
            fail("MESH_TOPOLOGY_DRIFT", f"{label} polygon connectivity differs from its package primitive")
        unmatched_faces.pop(match_index)


def object_transform(obj: Any) -> dict[str, list[float]]:
    return {
        "location": [round_metric(value) for value in obj.location],
        "rotationEuler": [round_metric(value) for value in obj.rotation_euler],
        "scale": [round_metric(value) for value in obj.scale],
    }


def mesh_world_bounds(obj: Any) -> dict[str, dict[str, float]]:
    if obj.type != "MESH" or not obj.data.vertices:
        fail("MESH_MISSING", f"{obj.name} is not a non-empty mesh")
    coordinates = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    return {
        "min": {
            axis: round_metric(min(float(value[index]) for value in coordinates))
            for index, axis in enumerate("xyz")
        },
        "max": {
            axis: round_metric(max(float(value[index]) for value in coordinates))
            for index, axis in enumerate("xyz")
        },
    }


def bounds_delta(left: dict[str, Any], right: dict[str, Any]) -> float:
    return max(
        abs(float(left[side][axis]) - float(right[side][axis]))
        for side in ("min", "max") for axis in "xyz"
    )


def mesh_signature(obj: Any) -> dict[str, Any]:
    vertices = [tuple(float(value) for value in vertex.co) for vertex in obj.data.vertices]
    faces = [tuple(polygon.vertices) for polygon in obj.data.polygons]
    signature = geometry_signature(vertices, faces)
    return {
        **signature,
        "orderedVerticesSha256": hash_canonical([
            [round_metric(value) for value in vertex] for vertex in vertices
        ]),
        "orderedFacesSha256": hash_canonical([list(face) for face in faces]),
        "bounds": mesh_world_bounds(obj),
        "transform": object_transform(obj),
        "modifierCount": len(obj.modifiers),
        "constraintCount": len(obj.constraints),
    }


def validate_identity_transform(obj: Any, label: str) -> None:
    if object_transform(obj) != {
        "location": [0.0, 0.0, 0.0],
        "rotationEuler": [0.0, 0.0, 0.0],
        "scale": [1.0, 1.0, 1.0],
    }:
        fail("OBJECT_TRANSFORM_DRIFT", f"{label} does not have an applied identity transform")
    if len(obj.modifiers) != 0 or len(obj.constraints) != 0:
        fail("OBJECT_STACK_MUTATION", f"{label} has modifiers or Blender constraints")


def validate_beauty_visibility(obj: Any, label: str) -> None:
    if obj.hide_render or obj.hide_viewport or obj.hide_get():
        fail("BEAUTY_VISIBILITY_DRIFT", f"{label} is hidden from the material preview")


def rounded_shader_value(value: Any) -> Any:
    if isinstance(value, (bool, str)):
        return value
    if isinstance(value, (int, float)):
        return round(float(value), 6)
    try:
        return [round(float(item), 6) for item in value]
    except TypeError:
        return str(value)


def validate_inherited_room_material(material: Any, surface: dict[str, Any], label: str) -> None:
    if (
        material.use_nodes is not True
        or material.surface_render_method != "DITHERED"
        or material.use_transparency_overlap is not True
    ):
        fail("ROOM_MATERIAL_SETTINGS_DRIFT", f"{label} inherited clay material settings drifted")
    nodes = list(material.node_tree.nodes)
    if sorted(node.bl_idname for node in nodes) != [
        "ShaderNodeBsdfPrincipled", "ShaderNodeOutputMaterial",
    ]:
        fail("ROOM_MATERIAL_NODE_DRIFT", f"{label} inherited clay node topology drifted")
    shader = next(node for node in nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")
    if shader.distribution != "MULTI_GGX":
        fail("ROOM_MATERIAL_NODE_DRIFT", f"{label} Principled distribution drifted")
    expected_inputs = {
        "Base Color": list(surface["baseColor"]), "Metallic": surface["metallic"],
        "Roughness": surface["roughness"], "IOR": 1.5, "Alpha": 1,
        "Thin Wall": False, "Normal": [0, 0, 0], "Weight": 0,
        "Diffuse Roughness": 0, "Subsurface Weight": 0,
        "Subsurface Radius": [1, 0.2, 0.1], "Subsurface Scale": 0.005,
        "Subsurface IOR": 1.4, "Subsurface Anisotropy": 0,
        "Specular IOR Level": 0.5, "Specular Tint": [1, 1, 1, 1],
        "Anisotropic": 0, "Anisotropic Rotation": 0, "Tangent": [0, 0, 0],
        "Transmission Weight": 0, "Coat Weight": 0, "Coat Roughness": 0.03,
        "Coat IOR": 1.5, "Coat Tint": [1, 1, 1, 1], "Coat Normal": [0, 0, 0],
        "Sheen Weight": 0, "Sheen Roughness": 0.5, "Sheen Tint": [1, 1, 1, 1],
        "Emission Color": [0, 0, 0, 1], "Emission Strength": 0,
        "Thin Film Thickness": 0, "Thin Film IOR": 1.33,
    }
    if [socket.name for socket in shader.inputs] != list(expected_inputs):
        fail("ROOM_MATERIAL_SOCKET_DRIFT", f"{label} inherited clay sockets drifted")
    socket_by_name = {socket.name: socket for socket in shader.inputs}
    for socket_name, expected in expected_inputs.items():
        if rounded_shader_value(socket_by_name[socket_name].default_value) != rounded_shader_value(expected):
            fail("ROOM_MATERIAL_VALUE_DRIFT", f"{label} inherited clay differs at {socket_name}")
    links = [
        (link.from_node.bl_idname, link.from_socket.name, link.to_node.bl_idname, link.to_socket.name)
        for link in material.node_tree.links
    ]
    if links != [("ShaderNodeBsdfPrincipled", "BSDF", "ShaderNodeOutputMaterial", "Surface")]:
        fail("ROOM_MATERIAL_LINK_DRIFT", f"{label} inherited clay links drifted")
    if rounded_shader_value(material.diffuse_color) != rounded_shader_value(surface["baseColor"]):
        fail("ROOM_MATERIAL_VALUE_DRIFT", f"{label} inherited clay viewport color drifted")


def expected_room_geometry(render_package: dict[str, Any]) -> dict[str, tuple[list[Any], list[Any]]]:
    room = render_package["room"]
    shell = render_package["scene"]["shell"]
    planes = room["planes"]
    left = float(planes["leftWall"]["value"]) * clay.INCHES_TO_METERS
    right = float(planes["rightWall"]["value"]) * clay.INCHES_TO_METERS
    floor_z = float(planes["floor"]["value"]) * clay.INCHES_TO_METERS
    ceiling_z = float(planes["ceiling"]["value"]) * clay.INCHES_TO_METERS
    rear_y = -float(planes["rearWall"]["value"]) * clay.INCHES_TO_METERS
    front_y = rear_y + float(shell["floorDepthIn"]) * clay.INCHES_TO_METERS
    return {
        "room-floor": (
            [(left, rear_y, floor_z), (right, rear_y, floor_z),
             (right, front_y, floor_z), (left, front_y, floor_z)],
            [(0, 1, 2, 3)],
        ),
        "room-rear-wall": (
            [(left, rear_y, floor_z), (left, rear_y, ceiling_z),
             (right, rear_y, ceiling_z), (right, rear_y, floor_z)],
            [(0, 1, 2, 3)],
        ),
    }


def camera_snapshot(camera: Any) -> dict[str, Any]:
    return {
        "objectName": camera.name,
        "dataName": camera.data.name,
        "location": [round_metric(value) for value in camera.location],
        "rotationEuler": [round_metric(value) for value in camera.rotation_euler],
        "scale": [round_metric(value) for value in camera.scale],
        "type": camera.data.type,
        "lensMm": round_metric(camera.data.lens),
        "sensorWidthMm": round_metric(camera.data.sensor_width),
        "sensorFit": camera.data.sensor_fit,
        "depthOfField": bool(camera.data.dof.use_dof),
        "clipStartM": round_metric(camera.data.clip_start),
        "clipEndM": round_metric(camera.data.clip_end),
        "cameraVersion": camera.get("jq_camera_version"),
        "target": [round_metric(value) for value in camera.get("jq_target", [])],
    }


def render_snapshot(scene: Any) -> dict[str, Any]:
    return {
        "engine": scene.render.engine,
        "width": scene.render.resolution_x,
        "height": scene.render.resolution_y,
        "resolutionPercentage": scene.render.resolution_percentage,
        "samples": scene.eevee.taa_render_samples,
        "useShadows": bool(scene.eevee.use_shadows),
        "useRaytracing": bool(scene.eevee.use_raytracing),
        "useFastGi": bool(scene.eevee.use_fast_gi),
        "useTaaReprojection": bool(scene.eevee.use_taa_reprojection),
        "filmTransparent": bool(scene.render.film_transparent),
        "pixelAspectX": round_metric(scene.render.pixel_aspect_x),
        "pixelAspectY": round_metric(scene.render.pixel_aspect_y),
        "useCompositing": bool(scene.render.use_compositing),
        "useSequencer": bool(scene.render.use_sequencer),
        "useFileExtension": bool(scene.render.use_file_extension),
        "useStamp": bool(scene.render.use_stamp),
        "useBorder": bool(scene.render.use_border),
        "useCropToBorder": bool(scene.render.use_crop_to_border),
        "ditherIntensity": round_metric(scene.render.dither_intensity),
        "fileFormat": scene.render.image_settings.file_format,
        "colorMode": scene.render.image_settings.color_mode,
        "colorDepth": scene.render.image_settings.color_depth,
        "quality": scene.render.image_settings.quality,
        "imageColorManagement": scene.render.image_settings.color_management,
        "displayDevice": scene.display_settings.display_device,
        "viewTransform": scene.view_settings.view_transform,
        "look": scene.view_settings.look,
        "exposure": round_metric(scene.view_settings.exposure),
        "gamma": round_metric(scene.view_settings.gamma),
        "useCurveMapping": bool(scene.view_settings.use_curve_mapping),
        "unitSystem": scene.unit_settings.system,
        "unitScale": round_metric(scene.unit_settings.scale_length),
        "lengthUnit": scene.unit_settings.length_unit,
    }


def expected_render_snapshot(render: dict[str, Any]) -> dict[str, Any]:
    engine = render["engineSettings"]
    options = render["renderOptions"]
    image = render["imageSettings"]
    color_contract = render["colorManagement"]
    return {
        "engine": render["blenderEngine"],
        "width": render["width"], "height": render["height"],
        "resolutionPercentage": render["resolutionPercentage"],
        "samples": engine["taaRenderSamples"],
        "useShadows": engine["useShadows"],
        "useRaytracing": engine["useRaytracing"],
        "useFastGi": engine["useFastGi"],
        "useTaaReprojection": engine["useTaaReprojection"],
        "filmTransparent": render["film"]["transparent"],
        "pixelAspectX": options["pixelAspectX"], "pixelAspectY": options["pixelAspectY"],
        "useCompositing": options["useCompositing"],
        "useSequencer": options["useSequencer"],
        "useFileExtension": options["useFileExtension"],
        "useStamp": options["useStamp"], "useBorder": options["useBorder"],
        "useCropToBorder": options["useCropToBorder"],
        "ditherIntensity": options["ditherIntensity"],
        "fileFormat": image["fileFormat"], "colorMode": image["colorMode"],
        "colorDepth": image["colorDepth"], "quality": image["quality"],
        "imageColorManagement": image["colorManagement"],
        "displayDevice": color_contract["displayDevice"],
        "viewTransform": color_contract["viewTransform"], "look": color_contract["look"],
        "exposure": color_contract["exposure"], "gamma": color_contract["gamma"],
        "useCurveMapping": color_contract["useCurveMapping"],
        "unitSystem": "METRIC", "unitScale": 1, "lengthUnit": "METERS",
    }


def socket_default(socket: Any) -> Any:
    if not hasattr(socket, "default_value"):
        return None
    value = socket.default_value
    if isinstance(value, (int, float, bool, str)):
        return round_metric(value) if isinstance(value, float) else value
    try:
        return [round_metric(item) for item in value]
    except (TypeError, ValueError):
        return str(value)


def node_specific_snapshot(node: Any) -> dict[str, Any]:
    specific: dict[str, Any] = {}
    if node.bl_idname == "ShaderNodeBsdfPrincipled":
        specific["distribution"] = node.distribution
    elif node.bl_idname == "ShaderNodeVectorMath":
        specific["operation"] = node.operation
    elif node.bl_idname == "ShaderNodeTexNoise":
        specific.update({
            "noiseDimensions": node.noise_dimensions,
            "normalize": bool(node.normalize),
        })
    elif node.bl_idname == "ShaderNodeTexWave":
        specific.update({
            "waveType": node.wave_type,
            "bandsDirection": node.bands_direction,
            "waveProfile": node.wave_profile,
        })
    elif node.bl_idname == "ShaderNodeMixRGB":
        specific.update({
            "blendType": node.blend_type,
            "useClamp": bool(node.use_clamp),
            "useAlpha": bool(node.use_alpha),
        })
    elif node.bl_idname == "ShaderNodeMapRange":
        specific.update({
            "dataType": node.data_type,
            "interpolationType": node.interpolation_type,
            "clamp": bool(node.clamp),
        })
    elif node.bl_idname == "ShaderNodeValToRGB":
        ramp = node.color_ramp
        specific.update({
            "interpolation": ramp.interpolation,
            "colorMode": ramp.color_mode,
            "hueInterpolation": ramp.hue_interpolation,
            "elements": [
                {
                    "position": round_metric(element.position),
                    "color": [round_metric(value) for value in element.color],
                }
                for element in ramp.elements
            ],
        })
    elif node.bl_idname == "ShaderNodeBump":
        specific["invert"] = bool(node.invert)
    elif node.bl_idname == "ShaderNodeTexCoord":
        specific["object"] = node.object.name if node.object is not None else None
        specific["fromInstancer"] = bool(node.from_instancer)
    return specific


def node_tree_snapshot(tree: Any) -> dict[str, Any]:
    nodes = []
    for node in tree.nodes:
        nodes.append({
            "name": node.name,
            "type": node.bl_idname,
            "inputs": [
                {"name": socket.name, "default": socket_default(socket)}
                for socket in node.inputs if not socket.is_linked
            ],
            "properties": node_specific_snapshot(node),
        })
    links = sorted(
        f"{link.from_node.name}:{link.from_socket.name}->{link.to_node.name}:{link.to_socket.name}"
        for link in tree.links
    )
    return {"nodes": nodes, "links": links}


def world_snapshot(world: Any) -> dict[str, Any]:
    if world is None or not world.use_nodes:
        fail("WORLD_MISSING", "Scene has no package-defined node world")
    tree = node_tree_snapshot(world.node_tree)
    return {"name": world.name, "nodeTree": tree, "nodeTreeSha256": hash_canonical(tree)}


def validate_world(world: Any, environment_path: Path, environment: dict[str, Any]) -> None:
    if world.name != "JQ_WORLD" or len(world.node_tree.nodes) != 5:
        fail("WORLD_IDENTITY_DRIFT", "Clay world identity or node count drifted")
    by_type: dict[str, list[Any]] = {}
    for node in world.node_tree.nodes:
        by_type.setdefault(node.bl_idname, []).append(node)
    expected_types = {
        "ShaderNodeOutputWorld", "ShaderNodeBackground", "ShaderNodeTexEnvironment",
        "ShaderNodeTexCoord", "ShaderNodeMapping",
    }
    if set(by_type) != expected_types or any(len(nodes) != 1 for nodes in by_type.values()):
        fail("WORLD_NODE_DRIFT", "World contains unsupported nodes")
    background = by_type["ShaderNodeBackground"][0]
    texture = by_type["ShaderNodeTexEnvironment"][0]
    mapping = by_type["ShaderNodeMapping"][0]
    if (
        not contract_value_matches(
            round_metric(background.inputs["Strength"].default_value), environment["strength"]
        )
        or texture.projection != environment["projection"]
        or texture.interpolation != environment["interpolation"]
        or texture.image is None
        or texture.image.colorspace_settings.name != environment["colorSpace"]
        or not contract_value_matches(
            [round_metric(value) for value in mapping.inputs["Rotation"].default_value[:3]],
            environment["rotationEuler"],
        )
    ):
        fail("WORLD_PARAMETER_DRIFT", "World parameters differ from the capture contract")
    try:
        loaded_path = Path(texture.image.filepath_from_user()).resolve(strict=True)
    except OSError as error:
        fail("WORLD_ENVIRONMENT_MISSING", f"Cannot resolve world environment: {error}")
    if loaded_path != environment_path.resolve(strict=True) or clay.file_sha256(loaded_path) != environment["sha256"]:
        fail("WORLD_ENVIRONMENT_DRIFT", "World environment path or hash drifted")
    links = {
        (link.from_node.bl_idname, link.from_socket.name, link.to_node.bl_idname, link.to_socket.name)
        for link in world.node_tree.links
    }
    expected_links = {
        ("ShaderNodeTexCoord", "Generated", "ShaderNodeMapping", "Vector"),
        ("ShaderNodeMapping", "Vector", "ShaderNodeTexEnvironment", "Vector"),
        ("ShaderNodeTexEnvironment", "Color", "ShaderNodeBackground", "Color"),
        ("ShaderNodeBackground", "Background", "ShaderNodeOutputWorld", "Surface"),
    }
    if links != expected_links:
        fail("WORLD_LINK_DRIFT", "World node links differ from the clay scene")


def validate_scene(
    bpy: Any,
    render_package: dict[str, Any],
    material_data: dict[str, Any],
    environment_path: Path,
) -> dict[str, Any]:
    scene = bpy.context.scene
    manifest = material_data["manifest"]
    product_names = [entry["objectId"] for entry in manifest]
    constraint_names = [
        f"{constraint['constraintId']}::{constraint['kind']}"
        for constraint in render_package["constraints"]
    ]
    expected_names = sorted(product_names + EXPECTED_ROOM_NAMES + constraint_names + [HERO_CAMERA_NAME])
    actual_object_names = [obj.name for obj in bpy.data.objects]
    if sorted(actual_object_names) != expected_names:
        fail("SCENE_OBJECT_DRIFT", "Source blend object identities differ from the package")
    actual_collection_names = [collection.name for collection in bpy.data.collections]
    if sorted(actual_collection_names) != sorted(EXPECTED_COLLECTION_NAMES):
        fail("COLLECTION_DRIFT", "Source blend collection identities drifted")
    for collection_name in ("JQ_CASEWORK", "JQ_ROOM", "JQ_CAMERAS"):
        collection = bpy.data.collections[collection_name]
        if collection.hide_render or collection.hide_viewport:
            fail("COLLECTION_VISIBILITY_DRIFT", f"{collection_name} must remain visible")
    if len(bpy.data.objects) != 88 or len(bpy.data.meshes) != 87:
        fail("SCENE_DATABLOCK_COUNT_DRIFT", "Source blend object or mesh count drifted")
    if len(bpy.data.cameras) != EXPECTED_CAMERA_COUNT or len(bpy.data.lights) != EXPECTED_LIGHT_COUNT:
        fail("CAMERA_OR_LIGHT_DRIFT", "Source blend camera or light count drifted")
    if sum(len(obj.modifiers) for obj in scene.objects) != 0:
        fail("MODIFIER_DRIFT", "Source blend contains modifiers")

    component_by_id = {component["componentId"]: component for component in render_package["components"]}
    product_manifest: list[dict[str, Any]] = []
    for entry in manifest:
        obj = bpy.data.objects.get(entry["objectId"])
        if obj is None or obj.type != "MESH" or obj.data.name != obj.name:
            fail("PRODUCT_OBJECT_MISSING", f"Missing exact product mesh {entry['objectId']}")
        if [collection.name for collection in obj.users_collection] != ["JQ_CASEWORK"]:
            fail("PRODUCT_COLLECTION_DRIFT", f"{obj.name} is outside JQ_CASEWORK")
        validate_identity_transform(obj, obj.name)
        validate_beauty_visibility(obj, obj.name)
        if (
            obj.get("jq_component_id") != entry["componentId"]
            or obj.get("jq_submesh_id") != entry["submeshId"]
            or obj.get("jq_geometry") != entry["geometry"]
            or obj.get("jq_material_slot") != entry["sourceMaterialSlot"]
        ):
            fail("PRODUCT_IDENTITY_PROPERTY_DRIFT", f"{obj.name} custom identity drifted")
        component = component_by_id[entry["componentId"]]
        submesh = next(item for item in component["submeshes"] if item["submeshId"] == entry["submeshId"])
        expected_vertices, expected_faces = expected_product_geometry(component, submesh)
        validate_mesh_geometry(obj, expected_vertices, expected_faces, obj.name)
        actual_signature = mesh_signature(obj)
        if bounds_delta(actual_signature["bounds"], entry["blenderWorldBounds"]) > GEOMETRY_TOLERANCE:
            fail("PRODUCT_BOUNDS_DRIFT", f"{obj.name} differs from package bounds")
        expected_clay = BINDING_COUNT_BY_SLOT.get(entry["sourceMaterialSlot"])
        if expected_clay is None or len(obj.data.materials) != 1 or obj.data.materials[0].name != expected_clay:
            fail("SOURCE_MATERIAL_SLOT_DRIFT", f"{obj.name} does not have its exact clay source slot")
        product_manifest.append({"objectId": obj.name, **actual_signature})

    room_expected = expected_room_geometry(render_package)
    room_materials = {"room-floor": "JQ_ROOM_FLOOR", "room-rear-wall": "JQ_ROOM_WALL"}
    room_properties = {"room-floor": "floor", "room-rear-wall": "rearWall"}
    room_surfaces = {
        "room-floor": render_package["scene"]["shell"]["floorSurface"],
        "room-rear-wall": render_package["scene"]["shell"]["wallSurface"],
    }
    room_manifest: list[dict[str, Any]] = []
    for name in EXPECTED_ROOM_NAMES:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH" or [item.name for item in obj.users_collection] != ["JQ_ROOM"]:
            fail("ROOM_OBJECT_DRIFT", f"Missing exact room mesh {name}")
        validate_identity_transform(obj, name)
        validate_beauty_visibility(obj, name)
        if obj.get("jq_room_plane") != room_properties[name]:
            fail("ROOM_IDENTITY_DRIFT", f"{name} room identity property drifted")
        expected_vertices, expected_faces = room_expected[name]
        validate_mesh_geometry(obj, expected_vertices, expected_faces, name)
        actual_signature = mesh_signature(obj)
        if len(obj.data.materials) != 1 or obj.data.materials[0].name != room_materials[name]:
            fail("ROOM_MATERIAL_DRIFT", f"{name} did not retain its exact clay material")
        validate_inherited_room_material(obj.data.materials[0], room_surfaces[name], name)
        room_manifest.append({"objectId": name, **actual_signature})

    constraint_manifest: list[dict[str, Any]] = []
    debug_collection = bpy.data.collections["JQ_CONSTRAINTS_DEBUG"]
    if debug_collection.hide_render is not True:
        fail("CONSTRAINT_RENDER_VISIBILITY_DRIFT", "Constraint debug collection must remain hidden")
    for constraint, name in zip(render_package["constraints"], constraint_names):
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH" or [item.name for item in obj.users_collection] != ["JQ_CONSTRAINTS_DEBUG"]:
            fail("CONSTRAINT_OBJECT_DRIFT", f"Missing exact debug constraint {name}")
        validate_identity_transform(obj, name)
        if (
            obj.hide_render is not True
            or obj.get("jq_constraint_id") != constraint["constraintId"]
            or obj.get("jq_constraint_kind") != constraint["kind"]
        ):
            fail("CONSTRAINT_IDENTITY_DRIFT", f"{name} constraint identity drifted")
        constraint_bounds = clay.bounds(
            constraint["blenderWorldBounds"], f"{name}.blenderWorldBounds"
        )
        expected_vertices, expected_faces = clay.box_vertices_faces(constraint_bounds)
        validate_mesh_geometry(obj, expected_vertices, expected_faces, name)
        signature = mesh_signature(obj)
        if bounds_delta(signature["bounds"], constraint["blenderWorldBounds"]) > GEOMETRY_TOLERANCE:
            fail("CONSTRAINT_BOUNDS_DRIFT", f"{name} bounds differ from package")
        constraint_manifest.append({"objectId": name, **signature})

    camera = bpy.data.objects.get(HERO_CAMERA_NAME)
    if camera is None or camera.type != "CAMERA" or scene.camera is not camera:
        fail("CUSTOMER_CAMERA_DRIFT", "Source blend customer camera is missing or inactive")
    camera_state = camera_snapshot(camera)
    contract_camera = material_data["capture"]["camera"]
    from mathutils import Vector

    package_position = Vector(tuple(contract_camera["position"][axis] for axis in "xyz"))
    package_target = Vector(tuple(contract_camera["target"][axis] for axis in "xyz"))
    expected_rotation = (package_target - package_position).to_track_quat("-Z", "Y").to_euler()
    expected_camera = {
        "objectName": HERO_CAMERA_NAME, "dataName": HERO_CAMERA_NAME,
        "location": [contract_camera["position"][axis] for axis in "xyz"],
        "type": contract_camera["type"], "lensMm": contract_camera["lensMm"],
        "sensorWidthMm": contract_camera["sensorWidthMm"],
        "sensorFit": contract_camera["sensorFit"],
        "depthOfField": contract_camera["depthOfField"],
        "clipStartM": contract_camera["clipStartM"], "clipEndM": contract_camera["clipEndM"],
        "cameraVersion": contract_camera["cameraVersion"],
        "target": [contract_camera["target"][axis] for axis in "xyz"],
        "rotationEuler": [round_metric(value) for value in expected_rotation],
    }
    for key, expected in expected_camera.items():
        if not contract_value_matches(camera_state[key], expected):
            fail("CUSTOMER_CAMERA_DRIFT", f"Customer camera differs at {key}")
    if camera_state["scale"] != [1.0, 1.0, 1.0]:
        fail("CUSTOMER_CAMERA_DRIFT", "Customer camera has non-unit scale")

    current_render = render_snapshot(scene)
    expected_render = expected_render_snapshot(material_data["capture"]["inheritedRender"])
    if not canonical_equal(current_render, expected_render):
        fail("RENDER_SETTINGS_DRIFT", "Source blend render settings differ from the capture")
    validate_world(scene.world, environment_path, material_data["capture"]["sceneIdentity"]["environment"])

    geometry_manifest = product_manifest + room_manifest + constraint_manifest
    geometry_manifest.sort(key=lambda item: item["objectId"])
    return {
        "productNames": product_names,
        "roomNames": EXPECTED_ROOM_NAMES,
        "constraintNames": constraint_names,
        "objectNames": actual_object_names,
        "collectionNames": actual_collection_names,
        "geometryManifest": geometry_manifest,
        "camera": camera_state,
        "world": world_snapshot(scene.world),
        "render": current_render,
        "counts": {
            "sceneObjectCount": len(scene.objects), "productObjectCount": len(product_names),
            "roomObjectCount": len(EXPECTED_ROOM_NAMES), "constraintObjectCount": len(constraint_names),
            "meshDatablockCount": len(bpy.data.meshes), "cameraCount": len(bpy.data.cameras),
            "lightCount": len(bpy.data.lights), "collectionCount": len(bpy.data.collections),
            "modifierCount": sum(len(obj.modifiers) for obj in scene.objects),
            "blenderConstraintCount": sum(len(obj.constraints) for obj in scene.objects),
        },
    }


def set_socket(shader: Any, name: str, value: Any) -> None:
    named_socket(shader.inputs, name, shader.name).default_value = value


def named_socket(sockets: Any, name: str, node_name: str, required: bool = True) -> Any | None:
    matches = [socket for socket in sockets if socket.name == name]
    if len(matches) == 1:
        return matches[0]
    if not matches and not required:
        return None
    fail("BLENDER_SOCKET_MISSING", f"Blender node {node_name} lacks one exact socket {name}")
    raise AssertionError("unreachable")


def set_socket_index(shader: Any, index: int, value: Any) -> None:
    if index < 0 or index >= len(shader.inputs):
        fail("BLENDER_SOCKET_MISSING", f"Blender node {shader.name} lacks input {index}")
    shader.inputs[index].default_value = value


def configure_principled(
    shader: Any,
    parameters: dict[str, Any],
    base_color: list[float],
    translator_policy: dict[str, Any],
) -> None:
    if shader.bl_idname != "ShaderNodeBsdfPrincipled":
        fail("BLENDER_NODE_MISMATCH", "Material shader is not Principled BSDF")
    principled = translator_policy["principled"]
    shader.distribution = principled["distribution"]
    set_socket(shader, "Base Color", tuple(base_color))
    set_socket(shader, "Metallic", float(parameters["metallic"]))
    set_socket(shader, "Roughness", float(parameters["roughness"]))
    set_socket(shader, "IOR", float(parameters["ior"]))
    set_socket(shader, "Alpha", float(parameters["alpha"]))
    set_socket(shader, "Thin Wall", bool(parameters["thinWall"]))
    set_socket(shader, "Weight", float(principled["weight"]))
    set_socket(shader, "Diffuse Roughness", float(parameters["diffuseRoughness"]))
    set_socket(shader, "Normal", tuple(principled["normalInput"]))
    set_socket(shader, "Subsurface Weight", float(principled["subsurfaceWeight"]))
    set_socket(shader, "Subsurface Radius", tuple(principled["subsurfaceRadius"]))
    set_socket(shader, "Subsurface Scale", float(principled["subsurfaceScale"]))
    set_socket(shader, "Subsurface IOR", float(principled["subsurfaceIor"]))
    set_socket(shader, "Subsurface Anisotropy", float(principled["anisotropy"]))
    set_socket(shader, "Specular IOR Level", float(parameters["specularIorLevel"]))
    set_socket(shader, "Specular Tint", tuple(principled["specularTint"]))
    set_socket(shader, "Anisotropic", float(parameters["anisotropic"]))
    set_socket(shader, "Anisotropic Rotation", float(parameters["anisotropicRotation"]))
    set_socket(shader, "Tangent", tuple(principled["tangentInput"]))
    set_socket(shader, "Transmission Weight", float(parameters["transmissionWeight"]))
    set_socket(shader, "Coat Weight", float(parameters["coatWeight"]))
    set_socket(shader, "Coat Roughness", float(parameters["coatRoughness"]))
    set_socket(shader, "Coat IOR", float(parameters["coatIor"]))
    set_socket(shader, "Coat Tint", tuple(principled["coatTint"]))
    set_socket(shader, "Coat Normal", tuple(principled["coatNormalInput"]))
    set_socket(shader, "Sheen Weight", float(principled["sheenWeight"]))
    set_socket(shader, "Sheen Roughness", float(principled["sheenRoughness"]))
    set_socket(shader, "Sheen Tint", tuple(principled["sheenTint"]))
    set_socket(shader, "Emission Color", tuple(parameters["emissionColor"]))
    set_socket(shader, "Emission Strength", float(parameters["emissionStrength"]))
    set_socket(shader, "Thin Film Thickness", float(principled["thinFilmThickness"]))
    set_socket(shader, "Thin Film IOR", float(principled["thinFilmIor"]))


def new_node(nodes: Any, node_type: str, name: str) -> Any:
    node = nodes.new(node_type)
    node.name = name
    node.label = name
    if node.name != name:
        fail("BLENDER_NODE_NAME_COLLISION", f"Blender could not preserve node name {name}")
    return node


def new_material(bpy: Any, name: str, translator_policy: dict[str, Any]) -> Any:
    if bpy.data.materials.get(name) is not None:
        fail("BLENDER_MATERIAL_NAME_COLLISION", f"Material name already exists: {name}")
    material = bpy.data.materials.new(name=name)
    if material.name != name:
        fail("BLENDER_MATERIAL_NAME_COLLISION", f"Blender renamed material {name}")
    material_policy = translator_policy["materialDatablock"]
    material.use_nodes = material_policy["useNodes"]
    material.surface_render_method = material_policy["surfaceRenderMethod"]
    material.use_transparency_overlap = material_policy["useTransparencyOverlap"]
    material.node_tree.nodes.clear()
    return material


def link_surface_only(
    tree: Any, shader: Any, output: Any, translator_policy: dict[str, Any]
) -> None:
    if translator_policy["output"]["surfaceOnly"] is not True:
        fail("BLENDER_TRANSLATION_POLICY_INVALID", "Only a surface shader output is supported")
    tree.links.new(
        named_socket(shader.outputs, "BSDF", shader.name),
        named_socket(output.inputs, "Surface", output.name),
    )


def create_flat_material(
    bpy: Any,
    material_recipe: dict[str, Any],
    name: str,
    translator_policy: dict[str, Any],
) -> Any:
    material = new_material(bpy, name, translator_policy)
    nodes = material.node_tree.nodes
    output = new_node(nodes, "ShaderNodeOutputMaterial", "00_OUTPUT")
    shader = new_node(nodes, "ShaderNodeBsdfPrincipled", "10_PRINCIPLED")
    parameters = material_recipe["parameters"]
    configure_principled(shader, parameters, parameters["baseColor"], translator_policy)
    link_surface_only(material.node_tree, shader, output, translator_policy)
    material.diffuse_color = tuple(parameters["baseColor"])
    material.metallic = float(parameters["metallic"])
    material.roughness = float(parameters["roughness"])
    material["jq_material_id"] = material_recipe["materialId"]
    material["jq_recipe_version"] = material_recipe["recipeVersion"]
    material["jq_shader_topology_id"] = material_recipe["shaderTopologyId"]
    return material


def set_noise(
    node: Any,
    recipe: dict[str, Any],
    w_value: float,
    translator_policy: dict[str, Any],
) -> None:
    node.noise_dimensions = recipe["dimensions"]
    node.normalize = recipe["normalize"]
    set_socket(node, "W", float(w_value))
    for package_key, socket_name in (
        ("scale", "Scale"), ("detail", "Detail"), ("roughness", "Roughness"),
        ("lacunarity", "Lacunarity"), ("distortion", "Distortion"),
    ):
        set_socket(node, socket_name, float(recipe[package_key]))
    set_socket(node, "Offset", float(translator_policy["noise"]["offset"]))
    set_socket(node, "Gain", float(translator_policy["noise"]["gain"]))


def varied_ramp_color(color_value: list[float], variation: float) -> tuple[float, float, float, float]:
    offsets = (variation, variation * 0.75, variation * 0.5)
    return tuple(
        min(1.0, max(0.0, float(color_value[index]) + offsets[index]))
        for index in range(3)
    ) + (float(color_value[3]),)


def create_oak_material(
    bpy: Any,
    material_recipe: dict[str, Any],
    frame: dict[str, Any],
    name: str,
    translator_policy: dict[str, Any],
) -> Any:
    material = new_material(bpy, name, translator_policy)
    tree = material.node_tree
    nodes = tree.nodes
    output = new_node(nodes, "ShaderNodeOutputMaterial", "00_OUTPUT")
    shader = new_node(nodes, "ShaderNodeBsdfPrincipled", "10_PRINCIPLED")
    coordinates = new_node(nodes, "ShaderNodeTexCoord", "20_PACKAGE_WORLD_COORDINATES")
    coordinate_policy = translator_policy["textureCoordinates"]
    coordinates.object = coordinate_policy["object"]
    coordinates.from_instancer = coordinate_policy["fromInstancer"]
    vector_policy = translator_policy["vectorMath"]
    subtract = new_node(nodes, "ShaderNodeVectorMath", "30_SUBTRACT_FRAME_ORIGIN")
    subtract.operation = vector_policy["subtractOriginOperation"]
    set_socket_index(subtract, 1, tuple(frame["origin"][axis] for axis in "xyz"))
    dot_cross = new_node(nodes, "ShaderNodeVectorMath", "40_DOT_CROSS_GRAIN")
    dot_cross.operation = vector_policy["axisProjectionOperation"]
    set_socket_index(dot_cross, 1, tuple(frame["crossGrainAxis"]))
    dot_grain = new_node(nodes, "ShaderNodeVectorMath", "41_DOT_GRAIN")
    dot_grain.operation = vector_policy["axisProjectionOperation"]
    set_socket_index(dot_grain, 1, tuple(frame["grainAxis"]))
    dot_normal = new_node(nodes, "ShaderNodeVectorMath", "42_DOT_NORMAL")
    dot_normal.operation = vector_policy["axisProjectionOperation"]
    set_socket_index(dot_normal, 1, tuple(frame["normalAxis"]))
    combine = new_node(nodes, "ShaderNodeCombineXYZ", "50_COMBINE_CROSS_GRAIN_NORMAL")
    physical_scale = new_node(nodes, "ShaderNodeVectorMath", "60_PHYSICAL_SCALE_METERS")
    physical_scale.operation = vector_policy["physicalScaleOperation"]
    frame_scale = frame["physicalTextureScaleM"]
    set_socket_index(
        physical_scale,
        1,
        (float(frame_scale["crossGrain"]), float(frame_scale["grain"]), float(frame_scale["normal"])),
    )
    phase = new_node(nodes, "ShaderNodeVectorMath", "70_DETERMINISTIC_PHASE")
    phase.operation = vector_policy["phaseOperation"]
    set_socket_index(phase, 1, tuple(frame["phaseOffset"]))
    coarse = new_node(nodes, "ShaderNodeTexNoise", "80_COARSE_OAK_NOISE")
    grain = new_node(nodes, "ShaderNodeTexWave", "81_GRAIN_BANDS")
    fiber = new_node(nodes, "ShaderNodeTexNoise", "82_FINE_FIBER_NOISE")
    mix = new_node(nodes, "ShaderNodeMixRGB", "90_MIX_COARSE_AND_GRAIN")
    tone = new_node(nodes, "ShaderNodeMapRange", "91_WEIGHTED_TONE_RANGE")
    ramp = new_node(nodes, "ShaderNodeValToRGB", "92_NATURAL_OAK_COLOR_RAMP")
    bump = new_node(nodes, "ShaderNodeBump", "93_SHADER_ONLY_FIBER_BUMP")

    parameters = material_recipe["parameters"]
    procedural = parameters["procedural"]
    set_noise(coarse, procedural["coarseNoise"], frame["phaseOffset"][0], translator_policy)
    set_noise(fiber, procedural["fiberNoise"], frame["phaseOffset"][1], translator_policy)
    wave = procedural["grainBands"]
    grain.wave_type = wave["waveType"]
    grain.bands_direction = wave["bandsDirection"]
    grain.wave_profile = wave["profile"]
    for package_key, socket_name in (
        ("scale", "Scale"), ("distortion", "Distortion"), ("detail", "Detail"),
        ("detailScale", "Detail Scale"), ("detailRoughness", "Detail Roughness"),
    ):
        set_socket(grain, socket_name, float(wave[package_key]))
    set_socket(grain, "Phase Offset", float(frame["phaseOffset"][2]) * 2.0 * math.pi)
    mix.blend_type = procedural["mix"]["blendType"]
    mix.use_clamp = procedural["mix"]["useClamp"]
    mix.use_alpha = translator_policy["mix"]["useAlpha"]
    set_socket(mix, "Factor", float(procedural["mix"]["factor"]))
    tone_map = procedural["toneMap"]
    tone.data_type = translator_policy["mapRange"]["dataType"]
    tone.interpolation_type = tone_map["interpolationType"]
    tone.clamp = tone_map["clamp"]
    for package_key, socket_index in (
        ("fromMin", 1), ("fromMax", 2), ("toMin", 3),
        ("toMax", 4), ("steps", 5),
    ):
        set_socket_index(tone, socket_index, float(tone_map[package_key]))

    ramp.color_ramp.interpolation = parameters["baseColorRamp"]["interpolation"]
    ramp.color_ramp.color_mode = parameters["baseColorRamp"]["colorMode"]
    ramp.color_ramp.hue_interpolation = parameters["baseColorRamp"]["hueInterpolation"]
    stops = parameters["baseColorRamp"]["stops"]
    while len(ramp.color_ramp.elements) > 2:
        ramp.color_ramp.elements.remove(ramp.color_ramp.elements[-1])
    elements = [ramp.color_ramp.elements[0]]
    for stop in stops[1:-1]:
        elements.append(ramp.color_ramp.elements.new(float(stop["position"])))
    elements.append(ramp.color_ramp.elements[-1])
    for element, stop in zip(elements, stops):
        element.position = float(stop["position"])
        element.color = varied_ramp_color(stop["color"], float(frame["colorVariation"]))

    bump.invert = parameters["bump"]["invert"]
    set_socket(bump, "Strength", float(parameters["bump"]["strength"]))
    set_socket(bump, "Distance", float(parameters["bump"]["distanceM"]))
    set_socket(bump, "Filter Width", float(translator_policy["bump"]["filterWidth"]))
    set_socket(bump, "Normal", tuple(translator_policy["bump"]["normalInput"]))
    configure_principled(shader, parameters, list(elements[1].color), translator_policy)

    links = [
        (named_socket(coordinates.outputs, coordinate_policy["output"], coordinates.name), subtract.inputs[0]),
        (named_socket(subtract.outputs, "Vector", subtract.name), dot_cross.inputs[0]),
        (named_socket(subtract.outputs, "Vector", subtract.name), dot_grain.inputs[0]),
        (named_socket(subtract.outputs, "Vector", subtract.name), dot_normal.inputs[0]),
        (named_socket(dot_cross.outputs, "Value", dot_cross.name), named_socket(combine.inputs, "X", combine.name)),
        (named_socket(dot_grain.outputs, "Value", dot_grain.name), named_socket(combine.inputs, "Y", combine.name)),
        (named_socket(dot_normal.outputs, "Value", dot_normal.name), named_socket(combine.inputs, "Z", combine.name)),
        (named_socket(combine.outputs, "Vector", combine.name), physical_scale.inputs[0]),
        (named_socket(physical_scale.outputs, "Vector", physical_scale.name), phase.inputs[0]),
        (named_socket(phase.outputs, "Vector", phase.name), named_socket(coarse.inputs, "Vector", coarse.name)),
        (named_socket(phase.outputs, "Vector", phase.name), named_socket(grain.inputs, "Vector", grain.name)),
        (named_socket(phase.outputs, "Vector", phase.name), named_socket(fiber.inputs, "Vector", fiber.name)),
        (named_socket(coarse.outputs, "Factor", coarse.name), named_socket(mix.inputs, "Color1", mix.name)),
        (named_socket(grain.outputs, "Color", grain.name), named_socket(mix.inputs, "Color2", mix.name)),
        (named_socket(mix.outputs, "Color", mix.name), tone.inputs[0]),
        (tone.outputs[0], named_socket(ramp.inputs, "Factor", ramp.name)),
        (named_socket(ramp.outputs, "Color", ramp.name), named_socket(shader.inputs, "Base Color", shader.name)),
        (named_socket(fiber.outputs, "Factor", fiber.name), named_socket(bump.inputs, "Height", bump.name)),
        (named_socket(bump.outputs, "Normal", bump.name), named_socket(shader.inputs, "Normal", shader.name)),
    ]
    for output_socket, input_socket in links:
        tree.links.new(output_socket, input_socket)
    link_surface_only(tree, shader, output, translator_policy)

    midpoint = varied_ramp_color(stops[len(stops) // 2]["color"], frame["colorVariation"])
    material.diffuse_color = midpoint
    material.metallic = float(parameters["metallic"])
    material.roughness = float(parameters["roughness"])
    material["jq_material_id"] = material_recipe["materialId"]
    material["jq_recipe_version"] = material_recipe["recipeVersion"]
    material["jq_shader_topology_id"] = material_recipe["shaderTopologyId"]
    material["jq_material_frame_id"] = frame["frameId"]
    material["jq_mapping_digest"] = frame["mappingDigest"]
    return material


def created_material_snapshot(materials: list[Any]) -> dict[str, Any]:
    materials = sorted(materials, key=lambda material: material.name)
    material_records = []
    node_names: list[str] = []
    node_records: list[dict[str, Any]] = []
    link_names: list[str] = []
    for material in materials:
        tree = node_tree_snapshot(material.node_tree)
        record = {
            "name": material.name,
            "materialId": material.get("jq_material_id"),
            "recipeVersion": material.get("jq_recipe_version"),
            "shaderTopologyId": material.get("jq_shader_topology_id"),
            "frameId": material.get("jq_material_frame_id"),
            "mappingDigest": material.get("jq_mapping_digest"),
            "surfaceRenderMethod": material.surface_render_method,
            "useTransparencyOverlap": bool(material.use_transparency_overlap),
            "diffuseColor": [round_metric(value) for value in material.diffuse_color],
            "metallic": round_metric(material.metallic),
            "roughness": round_metric(material.roughness),
            "nodeNames": [node["name"] for node in tree["nodes"]],
            "links": tree["links"],
            "nodeTreeSha256": hash_canonical(tree),
        }
        material_records.append(record)
        node_names.extend(f"{material.name}::{node['name']}" for node in tree["nodes"])
        node_records.extend({"materialName": material.name, **node} for node in tree["nodes"])
        link_names.extend(f"{material.name}::{link}" for link in tree["links"])
    return {
        "materials": material_records,
        "materialNames": [material.name for material in materials],
        "materialCount": len(materials),
        "nodeNames": node_names,
        "nodeCount": len(node_names),
        "linkNames": link_names,
        "linkCount": len(link_names),
        "materialSha256": hash_canonical(material_records),
        "nodeSha256": hash_canonical(node_records),
        "linkSha256": hash_canonical(link_names),
    }


FLAT_SHADER_NODES = [
    ("00_OUTPUT", "ShaderNodeOutputMaterial"),
    ("10_PRINCIPLED", "ShaderNodeBsdfPrincipled"),
]
OAK_SHADER_NODES = [
    ("00_OUTPUT", "ShaderNodeOutputMaterial"),
    ("10_PRINCIPLED", "ShaderNodeBsdfPrincipled"),
    ("20_PACKAGE_WORLD_COORDINATES", "ShaderNodeTexCoord"),
    ("30_SUBTRACT_FRAME_ORIGIN", "ShaderNodeVectorMath"),
    ("40_DOT_CROSS_GRAIN", "ShaderNodeVectorMath"),
    ("41_DOT_GRAIN", "ShaderNodeVectorMath"),
    ("42_DOT_NORMAL", "ShaderNodeVectorMath"),
    ("50_COMBINE_CROSS_GRAIN_NORMAL", "ShaderNodeCombineXYZ"),
    ("60_PHYSICAL_SCALE_METERS", "ShaderNodeVectorMath"),
    ("70_DETERMINISTIC_PHASE", "ShaderNodeVectorMath"),
    ("80_COARSE_OAK_NOISE", "ShaderNodeTexNoise"),
    ("81_GRAIN_BANDS", "ShaderNodeTexWave"),
    ("82_FINE_FIBER_NOISE", "ShaderNodeTexNoise"),
    ("90_MIX_COARSE_AND_GRAIN", "ShaderNodeMixRGB"),
    ("91_WEIGHTED_TONE_RANGE", "ShaderNodeMapRange"),
    ("92_NATURAL_OAK_COLOR_RAMP", "ShaderNodeValToRGB"),
    ("93_SHADER_ONLY_FIBER_BUMP", "ShaderNodeBump"),
]


def shader_value(value: Any) -> Any:
    if isinstance(value, bool) or value is None or isinstance(value, str):
        return value
    if isinstance(value, (int, float)):
        return round_metric(float(value))
    try:
        return [shader_value(item) for item in value]
    except TypeError:
        return value


def require_shader_parity(actual: Any, expected: Any, label: str) -> None:
    actual_value = shader_value(actual)
    expected_value = shader_value(expected)
    if not contract_value_matches(actual_value, expected_value, GEOMETRY_TOLERANCE):
        fail(
            "SHADER_PARAMETER_PARITY_MISMATCH",
            f"{label} differs: actual={actual_value!r}, expected={expected_value!r}",
        )


def audit_socket_value(node: Any, socket_name: str, expected: Any, label: str) -> Any:
    socket = named_socket(node.inputs, socket_name, node.name)
    require_shader_parity(socket.default_value, expected, f"{label}.{socket_name}")
    return socket_default(socket)


def audit_socket_index_value(node: Any, index: int, expected: Any, label: str) -> Any:
    if index < 0 or index >= len(node.inputs):
        fail("SHADER_PARAMETER_PARITY_MISMATCH", f"{label} lacks input {index}")
    socket = node.inputs[index]
    require_shader_parity(socket.default_value, expected, f"{label}[{index}]")
    return socket_default(socket)


def exact_shader_nodes(material: Any, expected: list[tuple[str, str]]) -> dict[str, Any]:
    actual = [(node.name, node.bl_idname) for node in material.node_tree.nodes]
    if actual != expected:
        fail(
            "SHADER_PARAMETER_PARITY_MISMATCH",
            f"{material.name} node identity/order differs: {actual!r}",
        )
    return {node.name: node for node in material.node_tree.nodes}


def exact_shader_links(material: Any, expected: list[str]) -> list[str]:
    links = node_tree_snapshot(material.node_tree)["links"]
    if links != sorted(expected):
        fail("SHADER_PARAMETER_PARITY_MISMATCH", f"{material.name} topology differs")
    return links


def audit_material_datablock(
    material: Any,
    recipe: dict[str, Any],
    frame: dict[str, Any] | None,
    policy: dict[str, Any],
) -> dict[str, Any]:
    datablock = policy["materialDatablock"]
    require_shader_parity(material.use_nodes, datablock["useNodes"], f"{material.name}.use_nodes")
    require_shader_parity(
        material.surface_render_method,
        datablock["surfaceRenderMethod"],
        f"{material.name}.surface_render_method",
    )
    require_shader_parity(
        material.use_transparency_overlap,
        datablock["useTransparencyOverlap"],
        f"{material.name}.use_transparency_overlap",
    )
    if (
        material.get("jq_material_id") != recipe["materialId"]
        or material.get("jq_recipe_version") != recipe["recipeVersion"]
        or material.get("jq_shader_topology_id") != recipe["shaderTopologyId"]
        or material.get("jq_material_frame_id") != (frame["frameId"] if frame else None)
        or material.get("jq_mapping_digest") != (frame["mappingDigest"] if frame else None)
    ):
        fail("SHADER_PARAMETER_PARITY_MISMATCH", f"{material.name} identity metadata differs")
    parameters = recipe["parameters"]
    expected_diffuse = (
        varied_ramp_color(
            parameters["baseColorRamp"]["stops"][len(parameters["baseColorRamp"]["stops"]) // 2]["color"],
            frame["colorVariation"],
        )
        if frame else parameters["baseColor"]
    )
    require_shader_parity(material.diffuse_color, expected_diffuse, f"{material.name}.diffuse_color")
    require_shader_parity(material.metallic, parameters["metallic"], f"{material.name}.metallic")
    require_shader_parity(material.roughness, parameters["roughness"], f"{material.name}.roughness")
    return {
        "useNodes": bool(material.use_nodes),
        "surfaceRenderMethod": material.surface_render_method,
        "useTransparencyOverlap": bool(material.use_transparency_overlap),
        "diffuseColor": shader_value(material.diffuse_color),
        "metallic": shader_value(material.metallic),
        "roughness": shader_value(material.roughness),
    }


def audit_principled_node(
    shader: Any,
    recipe: dict[str, Any],
    frame: dict[str, Any] | None,
    policy: dict[str, Any],
) -> dict[str, Any]:
    parameters = recipe["parameters"]
    principled = policy["principled"]
    require_shader_parity(shader.distribution, principled["distribution"], f"{shader.name}.distribution")
    expected_base = (
        varied_ramp_color(parameters["baseColorRamp"]["stops"][1]["color"], frame["colorVariation"])
        if frame else parameters["baseColor"]
    )
    expected_inputs = {
        "Base Color": expected_base,
        "Metallic": parameters["metallic"],
        "Roughness": parameters["roughness"],
        "IOR": parameters["ior"],
        "Alpha": parameters["alpha"],
        "Thin Wall": parameters["thinWall"],
        "Weight": principled["weight"],
        "Diffuse Roughness": parameters["diffuseRoughness"],
        "Normal": principled["normalInput"],
        "Subsurface Weight": principled["subsurfaceWeight"],
        "Subsurface Radius": principled["subsurfaceRadius"],
        "Subsurface Scale": principled["subsurfaceScale"],
        "Subsurface IOR": principled["subsurfaceIor"],
        "Subsurface Anisotropy": principled["anisotropy"],
        "Specular IOR Level": parameters["specularIorLevel"],
        "Specular Tint": principled["specularTint"],
        "Anisotropic": parameters["anisotropic"],
        "Anisotropic Rotation": parameters["anisotropicRotation"],
        "Tangent": principled["tangentInput"],
        "Transmission Weight": parameters["transmissionWeight"],
        "Coat Weight": parameters["coatWeight"],
        "Coat Roughness": parameters["coatRoughness"],
        "Coat IOR": parameters["coatIor"],
        "Coat Tint": principled["coatTint"],
        "Coat Normal": principled["coatNormalInput"],
        "Sheen Weight": principled["sheenWeight"],
        "Sheen Roughness": principled["sheenRoughness"],
        "Sheen Tint": principled["sheenTint"],
        "Emission Color": parameters["emissionColor"],
        "Emission Strength": parameters["emissionStrength"],
        "Thin Film Thickness": principled["thinFilmThickness"],
        "Thin Film IOR": principled["thinFilmIor"],
    }
    actual_inputs = {
        name: audit_socket_value(shader, name, value, shader.name)
        for name, value in expected_inputs.items()
    }
    return {"distribution": shader.distribution, "inputs": actual_inputs}


def audit_flat_shader(
    material: Any,
    recipe: dict[str, Any],
    policy: dict[str, Any],
) -> dict[str, Any]:
    nodes = exact_shader_nodes(material, FLAT_SHADER_NODES)
    links = exact_shader_links(material, ["10_PRINCIPLED:BSDF->00_OUTPUT:Surface"])
    if policy["output"]["surfaceOnly"] is not True:
        fail("SHADER_PARAMETER_PARITY_MISMATCH", "Output policy is not surface-only")
    return {
        "principled": audit_principled_node(nodes["10_PRINCIPLED"], recipe, None, policy),
        "links": links,
        "nodeTreeSha256": hash_canonical(node_tree_snapshot(material.node_tree)),
    }


def audit_noise_node(
    node: Any,
    recipe: dict[str, Any],
    w_value: float,
    policy: dict[str, Any],
) -> dict[str, Any]:
    require_shader_parity(node.noise_dimensions, recipe["dimensions"], f"{node.name}.noise_dimensions")
    require_shader_parity(bool(node.normalize), recipe["normalize"], f"{node.name}.normalize")
    values = {
        "W": w_value,
        "Scale": recipe["scale"],
        "Detail": recipe["detail"],
        "Roughness": recipe["roughness"],
        "Lacunarity": recipe["lacunarity"],
        "Distortion": recipe["distortion"],
        "Offset": policy["noise"]["offset"],
        "Gain": policy["noise"]["gain"],
    }
    return {
        "noiseDimensions": node.noise_dimensions,
        "normalize": bool(node.normalize),
        "inputs": {name: audit_socket_value(node, name, value, node.name) for name, value in values.items()},
    }


def audit_oak_shader(
    material: Any,
    recipe: dict[str, Any],
    frame: dict[str, Any],
    policy: dict[str, Any],
) -> dict[str, Any]:
    nodes = exact_shader_nodes(material, OAK_SHADER_NODES)
    expected_links = [
        "20_PACKAGE_WORLD_COORDINATES:Object->30_SUBTRACT_FRAME_ORIGIN:Vector",
        "30_SUBTRACT_FRAME_ORIGIN:Vector->40_DOT_CROSS_GRAIN:Vector",
        "30_SUBTRACT_FRAME_ORIGIN:Vector->41_DOT_GRAIN:Vector",
        "30_SUBTRACT_FRAME_ORIGIN:Vector->42_DOT_NORMAL:Vector",
        "40_DOT_CROSS_GRAIN:Value->50_COMBINE_CROSS_GRAIN_NORMAL:X",
        "41_DOT_GRAIN:Value->50_COMBINE_CROSS_GRAIN_NORMAL:Y",
        "42_DOT_NORMAL:Value->50_COMBINE_CROSS_GRAIN_NORMAL:Z",
        "50_COMBINE_CROSS_GRAIN_NORMAL:Vector->60_PHYSICAL_SCALE_METERS:Vector",
        "60_PHYSICAL_SCALE_METERS:Vector->70_DETERMINISTIC_PHASE:Vector",
        "70_DETERMINISTIC_PHASE:Vector->80_COARSE_OAK_NOISE:Vector",
        "70_DETERMINISTIC_PHASE:Vector->81_GRAIN_BANDS:Vector",
        "70_DETERMINISTIC_PHASE:Vector->82_FINE_FIBER_NOISE:Vector",
        "80_COARSE_OAK_NOISE:Factor->90_MIX_COARSE_AND_GRAIN:Color1",
        "81_GRAIN_BANDS:Color->90_MIX_COARSE_AND_GRAIN:Color2",
        "90_MIX_COARSE_AND_GRAIN:Color->91_WEIGHTED_TONE_RANGE:Value",
        "91_WEIGHTED_TONE_RANGE:Result->92_NATURAL_OAK_COLOR_RAMP:Factor",
        "92_NATURAL_OAK_COLOR_RAMP:Color->10_PRINCIPLED:Base Color",
        "82_FINE_FIBER_NOISE:Factor->93_SHADER_ONLY_FIBER_BUMP:Height",
        "93_SHADER_ONLY_FIBER_BUMP:Normal->10_PRINCIPLED:Normal",
        "10_PRINCIPLED:BSDF->00_OUTPUT:Surface",
    ]
    links = exact_shader_links(material, expected_links)
    coordinate = nodes["20_PACKAGE_WORLD_COORDINATES"]
    coordinate_policy = policy["textureCoordinates"]
    require_shader_parity(coordinate.object, coordinate_policy["object"], f"{coordinate.name}.object")
    require_shader_parity(
        bool(coordinate.from_instancer), coordinate_policy["fromInstancer"],
        f"{coordinate.name}.from_instancer",
    )
    vector_policy = policy["vectorMath"]
    vector_nodes = [
        (
            "30_SUBTRACT_FRAME_ORIGIN", vector_policy["subtractOriginOperation"],
            [frame["origin"][axis] for axis in "xyz"],
        ),
        ("40_DOT_CROSS_GRAIN", vector_policy["axisProjectionOperation"], frame["crossGrainAxis"]),
        ("41_DOT_GRAIN", vector_policy["axisProjectionOperation"], frame["grainAxis"]),
        ("42_DOT_NORMAL", vector_policy["axisProjectionOperation"], frame["normalAxis"]),
        (
            "60_PHYSICAL_SCALE_METERS", vector_policy["physicalScaleOperation"],
            [frame["physicalTextureScaleM"][key] for key in ("crossGrain", "grain", "normal")],
        ),
        ("70_DETERMINISTIC_PHASE", vector_policy["phaseOperation"], frame["phaseOffset"]),
    ]
    vector_records = []
    for name, operation, second_input in vector_nodes:
        node = nodes[name]
        require_shader_parity(node.operation, operation, f"{name}.operation")
        vector_records.append({
            "name": name,
            "operation": node.operation,
            "secondInput": audit_socket_index_value(node, 1, second_input, name),
        })
    procedural = recipe["parameters"]["procedural"]
    coarse = audit_noise_node(
        nodes["80_COARSE_OAK_NOISE"], procedural["coarseNoise"],
        frame["phaseOffset"][0], policy,
    )
    fiber = audit_noise_node(
        nodes["82_FINE_FIBER_NOISE"], procedural["fiberNoise"],
        frame["phaseOffset"][1], policy,
    )
    grain = nodes["81_GRAIN_BANDS"]
    wave = procedural["grainBands"]
    for actual, expected, suffix in (
        (grain.wave_type, wave["waveType"], "wave_type"),
        (grain.bands_direction, wave["bandsDirection"], "bands_direction"),
        (grain.wave_profile, wave["profile"], "wave_profile"),
    ):
        require_shader_parity(actual, expected, f"{grain.name}.{suffix}")
    grain_inputs = {
        "Scale": wave["scale"], "Distortion": wave["distortion"],
        "Detail": wave["detail"], "Detail Scale": wave["detailScale"],
        "Detail Roughness": wave["detailRoughness"],
        "Phase Offset": frame["phaseOffset"][2] * 2 * math.pi,
    }
    grain_record = {
        "waveType": grain.wave_type,
        "bandsDirection": grain.bands_direction,
        "waveProfile": grain.wave_profile,
        "inputs": {name: audit_socket_value(grain, name, value, grain.name) for name, value in grain_inputs.items()},
    }
    mix_node = nodes["90_MIX_COARSE_AND_GRAIN"]
    mix_recipe = procedural["mix"]
    require_shader_parity(mix_node.blend_type, mix_recipe["blendType"], f"{mix_node.name}.blend_type")
    require_shader_parity(bool(mix_node.use_clamp), mix_recipe["useClamp"], f"{mix_node.name}.use_clamp")
    require_shader_parity(bool(mix_node.use_alpha), policy["mix"]["useAlpha"], f"{mix_node.name}.use_alpha")
    mix_record = {
        "blendType": mix_node.blend_type,
        "useClamp": bool(mix_node.use_clamp),
        "useAlpha": bool(mix_node.use_alpha),
        "factor": audit_socket_value(mix_node, "Factor", mix_recipe["factor"], mix_node.name),
    }
    tone = nodes["91_WEIGHTED_TONE_RANGE"]
    tone_recipe = procedural["toneMap"]
    require_shader_parity(tone.data_type, policy["mapRange"]["dataType"], f"{tone.name}.data_type")
    require_shader_parity(tone.interpolation_type, tone_recipe["interpolationType"], f"{tone.name}.interpolation_type")
    require_shader_parity(bool(tone.clamp), tone_recipe["clamp"], f"{tone.name}.clamp")
    tone_inputs = {
        key: audit_socket_index_value(tone, index, tone_recipe[key], tone.name)
        for key, index in (("fromMin", 1), ("fromMax", 2), ("toMin", 3), ("toMax", 4), ("steps", 5))
    }
    ramp = nodes["92_NATURAL_OAK_COLOR_RAMP"].color_ramp
    ramp_recipe = recipe["parameters"]["baseColorRamp"]
    require_shader_parity(ramp.interpolation, ramp_recipe["interpolation"], "oakRamp.interpolation")
    require_shader_parity(ramp.color_mode, ramp_recipe["colorMode"], "oakRamp.color_mode")
    require_shader_parity(ramp.hue_interpolation, ramp_recipe["hueInterpolation"], "oakRamp.hue_interpolation")
    expected_elements = [
        {
            "position": stop["position"],
            "color": varied_ramp_color(stop["color"], frame["colorVariation"]),
        }
        for stop in ramp_recipe["stops"]
    ]
    actual_elements = [
        {"position": shader_value(element.position), "color": shader_value(element.color)}
        for element in ramp.elements
    ]
    require_shader_parity(actual_elements, expected_elements, "oakRamp.elements")
    bump = nodes["93_SHADER_ONLY_FIBER_BUMP"]
    bump_recipe = recipe["parameters"]["bump"]
    require_shader_parity(bool(bump.invert), bump_recipe["invert"], f"{bump.name}.invert")
    bump_values = {
        "Strength": bump_recipe["strength"], "Distance": bump_recipe["distanceM"],
        "Filter Width": policy["bump"]["filterWidth"],
        "Normal": policy["bump"]["normalInput"],
    }
    bump_record = {
        "invert": bool(bump.invert),
        "inputs": {name: audit_socket_value(bump, name, value, bump.name) for name, value in bump_values.items()},
    }
    if policy["output"]["surfaceOnly"] is not True:
        fail("SHADER_PARAMETER_PARITY_MISMATCH", "Output policy is not surface-only")
    return {
        "principled": audit_principled_node(nodes["10_PRINCIPLED"], recipe, frame, policy),
        "coordinates": {"output": coordinate_policy["output"], "object": None,
                        "fromInstancer": bool(coordinate.from_instancer)},
        "vectors": vector_records, "coarseNoise": coarse, "fiberNoise": fiber,
        "grain": grain_record, "mix": mix_record,
        "mapRange": {"dataType": tone.data_type, "interpolationType": tone.interpolation_type,
                     "clamp": bool(tone.clamp), "inputs": tone_inputs},
        "ramp": {"interpolation": ramp.interpolation, "colorMode": ramp.color_mode,
                 "hueInterpolation": ramp.hue_interpolation, "elements": actual_elements},
        "bump": bump_record, "links": links,
        "nodeTreeSha256": hash_canonical(node_tree_snapshot(material.node_tree)),
    }


def shader_parameter_audit(bpy: Any, material_data: dict[str, Any]) -> dict[str, Any]:
    """Read actual Blender state and independently prove package/policy parity."""
    policy = material_data["translatorPolicy"]
    recipes = material_data["materials"]
    expected_instances: dict[str, tuple[dict[str, Any], dict[str, Any] | None]] = {}
    for material_id in sorted(FLAT_PRODUCT_MATERIAL_IDS):
        expected_instances[f"JQ_PBR::{material_id}"] = (recipes[material_id], None)
    for binding in material_data["bindings"]:
        if binding["materialId"] in WOOD_MATERIAL_IDS:
            frame = material_data["frames"][binding["materialFrameId"]]
            expected_instances[f"JQ_PBR_WOOD_{frame['mappingDigest'][:32]}"] = (
                recipes[binding["materialId"]], frame,
            )
    records = []
    for name in sorted(expected_instances):
        recipe, frame = expected_instances[name]
        material = bpy.data.materials.get(name)
        if material is None:
            fail("SHADER_PARAMETER_PARITY_MISMATCH", f"Missing created material {name}")
        record = {
            "materialName": name,
            "materialId": recipe["materialId"],
            "recipeSha256": hash_canonical(recipe),
            "frameId": frame["frameId"] if frame else None,
            "frameSha256": hash_canonical(frame) if frame else None,
            "mappingDigest": frame["mappingDigest"] if frame else None,
            "datablock": audit_material_datablock(material, recipe, frame, policy),
            "shader": (
                audit_oak_shader(material, recipe, frame, policy)
                if frame else audit_flat_shader(material, recipe, policy)
            ),
        }
        records.append(record)
    actual_created_names = sorted(
        material.name for material in bpy.data.materials
        if material.name.startswith("JQ_PBR::") or material.name.startswith("JQ_PBR_WOOD_")
    )
    if actual_created_names != sorted(expected_instances):
        fail("SHADER_PARAMETER_PARITY_MISMATCH", "Created material instance set differs")
    audit = {
        "policyId": policy["policyId"],
        "policySha256": hash_canonical(policy),
        "materialCount": len(records),
        "materials": records,
    }
    return {**audit, "sha256": hash_canonical(audit)}


def assign_materials(
    bpy: Any, material_data: dict[str, Any]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    recipes = material_data["materials"]
    frames = material_data["frames"]
    translator_policy = material_data["translatorPolicy"]
    planned: list[tuple[str, str, dict[str, Any], dict[str, Any] | None]] = []
    for material_id in sorted(FLAT_PRODUCT_MATERIAL_IDS):
        planned.append((f"JQ_PBR::{material_id}", material_id, recipes[material_id], None))
    for binding in material_data["bindings"]:
        if binding["materialId"] in WOOD_MATERIAL_IDS:
            frame = frames[binding["materialFrameId"]]
            planned.append((
                f"JQ_PBR_WOOD_{frame['mappingDigest'][:32]}",
                binding["materialId"], recipes[binding["materialId"]], frame,
            ))
    planned.sort(key=lambda item: item[0])
    material_by_instance: dict[tuple[str, str | None], Any] = {}
    created: list[Any] = []
    for name, material_id, recipe, frame in planned:
        material = (
            create_oak_material(bpy, recipe, frame, name, translator_policy)
            if frame is not None
            else create_flat_material(bpy, recipe, name, translator_policy)
        )
        material_by_instance[(material_id, frame["frameId"] if frame else None)] = material
        created.append(material)

    assignments: list[dict[str, Any]] = []
    inherited_room_materials: dict[str, Any] = {}
    room_material_names = {"room-floor": "JQ_ROOM_FLOOR", "room-rear-wall": "JQ_ROOM_WALL"}
    for binding in material_data["bindings"]:
        obj = bpy.data.objects.get(binding["objectId"])
        if obj is None or obj.type != "MESH":
            fail("BINDING_OBJECT_MISSING", f"Cannot resolve exact object {binding['objectId']}")
        if binding["targetKind"] == "ROOM_SURFACE":
            material = obj.data.materials[0] if len(obj.data.materials) == 1 else None
            if material is None or material.name != room_material_names[obj.name]:
                fail("INHERITED_ROOM_MATERIAL_DRIFT", f"{obj.name} room clay did not remain inherited")
            inherited_room_materials[material.name] = material
        else:
            material = material_by_instance.get((binding["materialId"], binding["materialFrameId"]))
            if material is None:
                fail("MATERIAL_INSTANCE_MISSING", f"No material instance for {binding['bindingId']}")
            obj.data.materials.clear()
            obj.data.materials.append(material)
            if len(obj.data.materials) != 1 or obj.data.materials[0] is not material:
                fail("MATERIAL_ASSIGNMENT_FAILED", f"Blender did not assign {binding['bindingId']}")
        assignments.append({
            "bindingId": binding["bindingId"], "objectId": binding["objectId"],
            "materialId": binding["materialId"], "materialFrameId": binding["materialFrameId"],
            "materialName": material.name, "materialSlotIndex": 0,
        })
    return created_material_snapshot(created + list(inherited_room_materials.values())), assignments


def geometry_parity_snapshot(scene_data: dict[str, Any]) -> dict[str, str]:
    manifest = scene_data["geometryManifest"]
    return {
        "geometrySha256": hash_canonical(manifest),
        "topologySha256": hash_canonical([
            {"objectId": item["objectId"], "verticesSha256": item["verticesSha256"],
             "topologySha256": item["topologySha256"],
             "orderedVerticesSha256": item["orderedVerticesSha256"],
             "orderedFacesSha256": item["orderedFacesSha256"],
             "vertexCount": item["vertexCount"], "faceCount": item["faceCount"]}
            for item in manifest
        ]),
        "boundsSha256": hash_canonical([
            {"objectId": item["objectId"], "bounds": item["bounds"]} for item in manifest
        ]),
        "transformSha256": hash_canonical([
            {"objectId": item["objectId"], "transform": item["transform"]} for item in manifest
        ]),
    }


def verify_no_entity_creation(bpy: Any, before: dict[str, Any], after: dict[str, Any]) -> None:
    if before["counts"] != after["counts"]:
        fail("SCENE_ENTITY_MUTATION", "Material translation changed scene entity counts")
    for key in ("objectNames", "collectionNames", "productNames", "roomNames", "constraintNames"):
        if before[key] != after[key]:
            fail("SCENE_ENTITY_MUTATION", f"Material translation changed {key}")
    if len(bpy.data.node_groups) != 0:
        fail("NODE_GROUP_CREATION_FORBIDDEN", "Material translation created node groups")


def runtime_identity(bpy: Any) -> dict[str, str]:
    import gpu

    gpu.init()
    build_hash = bpy.app.build_hash.decode("utf-8") if isinstance(bpy.app.build_hash, bytes) else str(bpy.app.build_hash)
    return {
        "version": bpy.app.version_string,
        "buildHash": build_hash,
        "backend": gpu.platform.backend_type_get(),
        "vendor": gpu.platform.vendor_get(),
        "renderer": gpu.platform.renderer_get(),
        "deviceVersion": gpu.platform.version_get(),
    }


def write_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    serialized = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    try:
        temporary.write_text(serialized, encoding="utf-8")
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def result_document(material_package: dict[str, Any], output: dict[str, Any]) -> dict[str, Any]:
    result_without_key = {
        "kind": MATERIAL_PREVIEW_RESULT_KIND,
        "schemaVersion": MATERIAL_PREVIEW_RESULT_SCHEMA_VERSION,
        "materialPackageKey": material_package["materialPackageKey"],
        "captureKey": material_package["capture"]["captureKey"],
        "materialPipelineVersion": MATERIAL_PIPELINE_VERSION,
        "status": "succeeded",
        "outputs": [output],
    }
    return {
        **result_without_key,
        "resultKey": f"jq-materials-preview-result-v1-{hash_canonical(result_without_key)}",
    }


def render_material_preview(
    paths: dict[str, Path],
    render_package: dict[str, Any],
    material_package: dict[str, Any],
    material_data: dict[str, Any],
    environment_path: Path,
) -> None:
    import bpy

    runtime = runtime_identity(bpy)
    if runtime != material_data["capture"]["blenderRuntime"]:
        fail("BLENDER_RUNTIME_MISMATCH", "Actual Blender build or Metal device differs from capture")
    if tuple(bpy.app.version[:3]) != (5, 2, 0):
        fail("UNSUPPORTED_BLENDER_VERSION", f"Blender 5.2.0 is required, found {bpy.app.version_string}")

    result = bpy.ops.wm.open_mainfile(filepath=str(paths["sourceBlend"]))
    if "FINISHED" not in result or Path(bpy.data.filepath).resolve() != paths["sourceBlend"]:
        fail("SOURCE_BLEND_OPEN_FAILED", "Blender did not open the exact source clay blend")
    before = validate_scene(bpy, render_package, material_data, environment_path)
    before_parity = geometry_parity_snapshot(before)
    before_camera_sha = hash_canonical(before["camera"])
    before_world_sha = hash_canonical(before["world"])
    before_render_sha = hash_canonical(before["render"])
    before_material_count = len(bpy.data.materials)

    material_snapshot, assignments = assign_materials(bpy, material_data)
    if len(assignments) != EXPECTED_BINDING_COUNT:
        fail("MATERIAL_ASSIGNMENT_COUNT_MISMATCH", "Not every sidecar binding was assigned")
    after_assignment = validate_scene_after_materials(bpy, render_package, material_data, environment_path)
    verify_no_entity_creation(bpy, before, after_assignment)
    after_parity = geometry_parity_snapshot(after_assignment)
    if before_parity != after_parity:
        fail("GEOMETRY_MUTATION", "Material assignment changed geometry, topology, bounds, or transforms")
    if (
        hash_canonical(after_assignment["camera"]) != before_camera_sha
        or hash_canonical(after_assignment["world"]) != before_world_sha
        or hash_canonical(after_assignment["render"]) != before_render_sha
    ):
        fail("SCENE_CONTEXT_MUTATION", "Material assignment changed camera, world, or render settings")
    shader_audit_before = shader_parameter_audit(bpy, material_data)

    scene = bpy.context.scene
    scene.render.filepath = "//materials-preview.webp"
    bpy.ops.wm.save_as_mainfile(filepath=str(paths["blend"]), check_existing=False)
    if not paths["blend"].is_file() or paths["blend"].stat().st_size <= 0:
        fail("MATERIAL_BLEND_OUTPUT_MISSING", "Blender did not save TV01-materials-preview.blend")
    scene.render.filepath = str(paths["preview"])
    bpy.ops.render.render(write_still=True)
    scene.render.filepath = "//materials-preview.webp"

    if not paths["preview"].is_file():
        fail("MATERIAL_PREVIEW_OUTPUT_MISSING", "Blender did not write materials-preview.webp")
    byte_count = paths["preview"].stat().st_size
    output_contract = material_data["capture"]["output"]
    if byte_count <= 0 or byte_count > output_contract["maxBytes"]:
        fail("MATERIAL_PREVIEW_SIZE_INVALID", f"Material preview has invalid size {byte_count}")
    image = bpy.data.images.load(str(paths["preview"]), check_existing=False)
    try:
        dimensions = tuple(int(value) for value in image.size)
    finally:
        bpy.data.images.remove(image)
    if dimensions != (output_contract["width"], output_contract["height"]):
        fail("MATERIAL_PREVIEW_DIMENSIONS_MISMATCH", f"Material preview dimensions are {dimensions}")

    after_render = validate_scene_after_materials(bpy, render_package, material_data, environment_path)
    verify_no_entity_creation(bpy, before, after_render)
    render_parity = geometry_parity_snapshot(after_render)
    if render_parity != before_parity:
        fail("RENDER_GEOMETRY_MUTATION", "Rendering changed geometry, topology, bounds, or transforms")
    if (
        hash_canonical(after_render["camera"]) != before_camera_sha
        or hash_canonical(after_render["world"]) != before_world_sha
        or hash_canonical(after_render["render"]) != before_render_sha
    ):
        fail("RENDER_CONTEXT_MUTATION", "Rendering changed camera, world, or render settings")
    shader_audit_after = shader_parameter_audit(bpy, material_data)
    if shader_audit_before["sha256"] != shader_audit_after["sha256"]:
        fail(
            "SHADER_PARAMETER_PARITY_MISMATCH",
            "Rendering changed package/policy shader parameters or topology",
        )

    output = {
        "pass": output_contract["pass"],
        "objectKey": f"{material_data['capture']['captureKey']}/{output_contract['filename']}",
        "mimeType": output_contract["mimeType"],
        "width": dimensions[0], "height": dimensions[1], "bytes": byte_count,
        "sha256": clay.file_sha256(paths["preview"]),
    }
    result_value = result_document(material_package, output)
    write_json(paths["result"], result_value)

    counts_by_material = {material_id: 0 for material_id in MATERIAL_IDS.values()}
    for assignment in assignments:
        counts_by_material[assignment["materialId"]] += 1
    slot_digest = hash_canonical(assignments)
    report = {
        "kind": "jq-local-blender-materials-preview-report",
        "schemaVersion": 1,
        "status": "succeeded",
        "blenderRuntime": runtime,
        "materialPackageKey": material_package["materialPackageKey"],
        "captureKey": material_data["capture"]["captureKey"],
        "materialPipelineVersion": MATERIAL_PIPELINE_VERSION,
        "resultKey": result_value["resultKey"],
        "freshIsolatedOutput": True,
        "counts": {
            "productMeshObjects": before["counts"]["productObjectCount"],
            "roomMeshObjects": before["counts"]["roomObjectCount"],
            "constraintObjects": before["counts"]["constraintObjectCount"],
            "cameras": before["counts"]["cameraCount"],
            "lights": before["counts"]["lightCount"],
            "collections": before["counts"]["collectionCount"],
            "modifiers": before["counts"]["modifierCount"],
            "materials": material_snapshot["materialCount"],
            "nodes": material_snapshot["nodeCount"],
            "links": material_snapshot["linkCount"],
            "bindings": len(assignments),
            "materialFrames": len(material_data["frames"]),
        },
        "parity": {
            "geometry": True,
            "topology": True,
            "bounds": True,
            "transforms": True,
            "objects": True,
            "camera": True,
            "world": True,
            "lights": True,
            "renderSettings": True,
            "shaderParameters": True,
        },
        "objectNames": before["objectNames"],
        "materialNames": material_snapshot["materialNames"],
        "nodeNames": material_snapshot["nodeNames"],
        "linkNames": material_snapshot["linkNames"],
        "digests": {
            "geometryBeforeSha256": before_parity["geometrySha256"],
            "geometryAfterSha256": render_parity["geometrySha256"],
            "topologyBeforeSha256": before_parity["topologySha256"],
            "topologyAfterSha256": render_parity["topologySha256"],
            "boundsBeforeSha256": before_parity["boundsSha256"],
            "boundsAfterSha256": render_parity["boundsSha256"],
            "transformsBeforeSha256": before_parity["transformSha256"],
            "transformsAfterSha256": render_parity["transformSha256"],
            "cameraBeforeSha256": before_camera_sha,
            "cameraAfterSha256": hash_canonical(after_render["camera"]),
            "worldBeforeSha256": before_world_sha,
            "worldAfterSha256": hash_canonical(after_render["world"]),
            "renderSettingsBeforeSha256": before_render_sha,
            "renderSettingsAfterSha256": hash_canonical(after_render["render"]),
            "shaderParametersBeforeSha256": shader_audit_before["sha256"],
            "shaderParametersAfterSha256": shader_audit_after["sha256"],
            "materialsSha256": material_snapshot["materialSha256"],
            "nodesSha256": material_snapshot["nodeSha256"],
            "linksSha256": material_snapshot["linkSha256"],
            "slotAssignmentsSha256": slot_digest,
        },
        "materials": {
            "bindingCount": len(assignments), "materialFrameCount": len(material_data["frames"]),
            "bindingCountsByMaterial": counts_by_material,
            "sourceMaterialDatablockCount": before_material_count,
            "createdMaterialDatablockCount": len(bpy.data.materials) - before_material_count,
            "totalMaterialDatablockCount": len(bpy.data.materials),
            "usedMaterialNames": material_snapshot["materialNames"],
            "nodeCount": material_snapshot["nodeCount"],
            "linkCount": material_snapshot["linkCount"],
            "materialSha256": material_snapshot["materialSha256"],
            "nodeSha256": material_snapshot["nodeSha256"], "linkSha256": material_snapshot["linkSha256"],
            "slotAssignmentSha256": slot_digest, "slotAssignments": assignments,
        },
        "output": {
            "filename": output_contract["filename"], "logicalObjectKey": output["objectKey"],
            "mimeType": output["mimeType"], "width": output["width"], "height": output["height"],
            "bytes": output["bytes"], "sha256": output["sha256"],
        },
    }
    write_json(paths["report"], report)


def validate_scene_after_materials(
    bpy: Any,
    render_package: dict[str, Any],
    material_data: dict[str, Any],
    environment_path: Path,
) -> dict[str, Any]:
    """Revalidate every non-material scene property after intentional slot changes."""
    scene = bpy.context.scene
    manifest = material_data["manifest"]
    product_names = [entry["objectId"] for entry in manifest]
    constraint_names = [
        f"{constraint['constraintId']}::{constraint['kind']}"
        for constraint in render_package["constraints"]
    ]
    expected_names = sorted(product_names + EXPECTED_ROOM_NAMES + constraint_names + [HERO_CAMERA_NAME])
    binding_by_object = {binding["objectId"]: binding for binding in material_data["bindings"]}
    actual_object_names = [obj.name for obj in bpy.data.objects]
    if sorted(actual_object_names) != expected_names:
        fail("SCENE_OBJECT_DRIFT", "Material translation changed scene objects")
    actual_collection_names = [collection.name for collection in bpy.data.collections]
    if sorted(actual_collection_names) != sorted(EXPECTED_COLLECTION_NAMES):
        fail("COLLECTION_DRIFT", "Material translation changed collections")
    for collection_name in ("JQ_CASEWORK", "JQ_ROOM", "JQ_CAMERAS"):
        collection = bpy.data.collections[collection_name]
        if collection.hide_render or collection.hide_viewport:
            fail("COLLECTION_VISIBILITY_DRIFT", f"{collection_name} visibility changed")
    if bpy.data.collections["JQ_CONSTRAINTS_DEBUG"].hide_render is not True:
        fail("CONSTRAINT_RENDER_VISIBILITY_DRIFT", "Constraint collection became render-visible")
    if len(bpy.data.objects) != 88 or len(bpy.data.meshes) != 87 or len(bpy.data.cameras) != 1 or len(bpy.data.lights) != 0:
        fail("SCENE_DATABLOCK_COUNT_DRIFT", "Material translation changed scene datablocks")
    geometry_manifest = []
    for name in product_names + EXPECTED_ROOM_NAMES + constraint_names:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH":
            fail("SCENE_MESH_MISSING", f"Material translation removed {name}")
        validate_identity_transform(obj, name)
        if name in product_names or name in EXPECTED_ROOM_NAMES:
            validate_beauty_visibility(obj, name)
        elif obj.hide_render is not True:
            fail("CONSTRAINT_RENDER_VISIBILITY_DRIFT", f"{name} became render-visible")
        if name in binding_by_object:
            binding = binding_by_object[name]
            if binding["materialFrameId"] is not None:
                frame = material_data["frames"][binding["materialFrameId"]]
                expected_material_name = f"JQ_PBR_WOOD_{frame['mappingDigest'][:32]}"
            elif binding["targetKind"] == "ROOM_SURFACE":
                expected_material_name = {
                    "room-floor": "JQ_ROOM_FLOOR", "room-rear-wall": "JQ_ROOM_WALL",
                }[name]
            else:
                expected_material_name = f"JQ_PBR::{binding['materialId']}"
            if (
                len(obj.data.materials) != 1
                or obj.data.materials[0].name != expected_material_name
            ):
                fail("MATERIAL_ASSIGNMENT_DRIFT", f"{name} lost its exact material assignment")
            if name in EXPECTED_ROOM_NAMES:
                room_surface = material_data["capture"]["sceneIdentity"]["shell"][
                    "floorSurface" if name == "room-floor" else "wallSurface"
                ]
                validate_inherited_room_material(obj.data.materials[0], room_surface, name)
        geometry_manifest.append({"objectId": name, **mesh_signature(obj)})
    geometry_manifest.sort(key=lambda item: item["objectId"])
    camera = bpy.data.objects.get(HERO_CAMERA_NAME)
    if camera is None or scene.camera is not camera:
        fail("CUSTOMER_CAMERA_DRIFT", "Material translation changed active camera")
    validate_world(scene.world, environment_path, material_data["capture"]["sceneIdentity"]["environment"])
    current_render = render_snapshot(scene)
    expected_render = expected_render_snapshot(material_data["capture"]["inheritedRender"])
    if not canonical_equal(current_render, expected_render):
        fail("RENDER_SETTINGS_DRIFT", "Material translation changed render settings")
    return {
        "productNames": product_names, "roomNames": EXPECTED_ROOM_NAMES,
        "constraintNames": constraint_names, "objectNames": actual_object_names,
        "collectionNames": actual_collection_names, "geometryManifest": geometry_manifest,
        "camera": camera_snapshot(camera), "world": world_snapshot(scene.world),
        "render": current_render,
        "counts": {
            "sceneObjectCount": len(scene.objects), "productObjectCount": len(product_names),
            "roomObjectCount": len(EXPECTED_ROOM_NAMES), "constraintObjectCount": len(constraint_names),
            "meshDatablockCount": len(bpy.data.meshes), "cameraCount": len(bpy.data.cameras),
            "lightCount": len(bpy.data.lights), "collectionCount": len(bpy.data.collections),
            "modifierCount": sum(len(obj.modifiers) for obj in scene.objects),
            "blenderConstraintCount": sum(len(obj.constraints) for obj in scene.objects),
        },
    }


def parse_arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render the verified TV01 PBR material sidecar")
    parser.add_argument("--geometry-package", required=True)
    parser.add_argument("--materials-package", required=True)
    parser.add_argument("--project-root")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--source-blend")
    parser.add_argument("--output-dir")
    parser.add_argument("--blend")
    parser.add_argument("--preview")
    parser.add_argument("--result")
    parser.add_argument("--report")
    raw_arguments = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    arguments = parser.parse_args(raw_arguments)
    render_values = (
        arguments.source_blend, arguments.output_dir, arguments.blend,
        arguments.preview, arguments.result, arguments.report,
    )
    if arguments.validate_only:
        if any(render_values):
            parser.error("--validate-only cannot accept render output arguments")
    elif not all(render_values):
        parser.error("rendering requires source blend, output directory, blend, preview, result, and worker report")
    return arguments


def resolve_paths(arguments: argparse.Namespace) -> dict[str, Path | None]:
    def absolute(value: str, label: str) -> Path:
        candidate = Path(value).expanduser()
        if not candidate.is_absolute():
            fail("RELATIVE_CLI_PATH", f"{label} must be absolute")
        return candidate.resolve(strict=False)

    package = absolute(arguments.geometry_package, "--geometry-package")
    materials_package = absolute(arguments.materials_package, "--materials-package")
    project_root = (
        absolute(arguments.project_root, "--project-root")
        if arguments.project_root else Path(__file__).resolve().parents[2]
    )
    if not project_root.is_dir():
        fail("INVALID_PROJECT_ROOT", "Project root is not a directory")
    if package == materials_package:
        fail("INPUT_PATH_COLLISION", "Geometry and material packages must be distinct")
    paths: dict[str, Path | None] = {
        "package": package, "materialsPackage": materials_package,
        "projectRoot": project_root, "sourceBlend": None, "outputDir": None,
        "blend": None, "preview": None, "result": None, "report": None,
    }
    if arguments.validate_only:
        return paths
    source_blend = absolute(arguments.source_blend, "--source-blend")
    output_dir = absolute(arguments.output_dir, "--output-dir")
    blend = absolute(arguments.blend, "--blend")
    preview = absolute(arguments.preview, "--preview")
    result = absolute(arguments.result, "--result")
    report = absolute(arguments.report, "--report")
    expected = {
        blend: "TV01-materials-preview.blend", preview: "materials-preview.webp",
        result: "materials-preview-result.json", report: "materials-preview-report.json",
    }
    for path, filename in expected.items():
        if path.parent != output_dir or path.name != filename:
            fail("INVALID_OUTPUT_PATH", f"Material output must be {output_dir / filename}")
    all_paths = [package, materials_package, source_blend, blend, preview, result, report]
    if len(set(all_paths)) != len(all_paths):
        fail("CLI_PATH_COLLISION", "Every material worker input/output path must be distinct")
    if source_blend.name != "TV01-clay.blend" or not source_blend.is_file():
        fail("INVALID_SOURCE_BLEND", "Source blend must be the existing TV01-clay.blend")
    if output_dir.exists() and not output_dir.is_dir():
        fail("INVALID_OUTPUT_DIRECTORY", "Output path exists but is not a directory")
    for output_path in (blend, preview, result, report):
        if output_path.exists():
            fail("STALE_OUTPUT_FORBIDDEN", f"Fresh output already exists: {output_path.name}")
    paths.update({
        "sourceBlend": source_blend, "outputDir": output_dir, "blend": blend,
        "preview": preview, "result": result, "report": report,
    })
    return paths


def main(argv: list[str]) -> int:
    arguments = parse_arguments(argv)
    paths = resolve_paths(arguments)
    package_path = paths["package"]
    materials_path = paths["materialsPackage"]
    project_root = paths["projectRoot"]
    assert isinstance(package_path, Path) and isinstance(materials_path, Path)
    assert isinstance(project_root, Path)

    # Both renderer-neutral contracts are completely validated before Blender
    # imports bpy or opens the source scene.
    render_package, package_raw = load_strict_json(package_path, "geometry package")
    validated_geometry = clay.validate_package(render_package)
    environment_path = clay.validate_assets(render_package, validated_geometry, project_root)
    material_package, _ = load_strict_json(materials_path, "material package")
    material_data = validate_material_package(render_package, material_package, package_raw)
    if arguments.validate_only:
        print(json.dumps({
            "valid": True,
            "materialPackageKey": material_package["materialPackageKey"],
            "captureKey": material_data["capture"]["captureKey"],
            "bindingCount": len(material_data["bindings"]),
            "materialFrameCount": len(material_data["frames"]),
        }, separators=(",", ":")))
        return 0

    output_dir = paths["outputDir"]
    assert isinstance(output_dir, Path)
    if not output_dir.exists():
        output_dir.mkdir(parents=True, exist_ok=False)
    expected_inputs = {package_path.name, materials_path.name}
    actual_entries = {path.name for path in output_dir.iterdir()}
    if actual_entries != expected_inputs:
        fail(
            "OUTPUT_DIRECTORY_NOT_FRESH",
            "Material output directory must contain only render-package.json and materials-package.json",
        )
    required_paths = {key: value for key, value in paths.items() if isinstance(value, Path)}
    render_material_preview(
        required_paths, render_package, material_package, material_data, environment_path
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv))
    except MaterialWorkerError as error:
        print(f"JQ_MATERIAL_WORKER_ERROR [{error.code}] {error}", file=sys.stderr)
        raise SystemExit(2)
    except clay.WorkerError as error:
        print(f"JQ_MATERIAL_WORKER_ERROR [{error.code}] {error}", file=sys.stderr)
        raise SystemExit(2)
    except SystemExit:
        raise
    except Exception as error:
        print(f"JQ_MATERIAL_WORKER_ERROR [UNEXPECTED] {error}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise SystemExit(3)
