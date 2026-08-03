#!/usr/bin/env python3
"""Strict Blender 5.2 renderer for the additive TV01 presentation pass.

The renderer-neutral geometry and Phase 6 material packages remain the only
product authorities.  This worker validates those packages and the complete
Phase 7 presentation sidecar before importing :mod:`bpy` or opening a blend.
It then opens the accepted Phase 6 material-preview scene, audits that scene,
adds only contracted presentation cameras/lights/material overrides/world
state, and writes isolated photoreal outputs.
"""

from __future__ import annotations

import argparse
from decimal import Decimal
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sys
import traceback
from typing import Any


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

import clay_worker as clay
import materials_preview_worker as materials


PRESENTATION_PACKAGE_KIND = "jq-photoreal-presentation-package"
PRESENTATION_PACKAGE_SCHEMA = "jq-photoreal-presentation-package-v1"
PRESENTATION_PACKAGE_SCHEMA_VERSION = 1
PRESENTATION_CAPTURE_ID = "photoreal-beauty-v1"
PRESENTATION_RESULT_KIND = "jq-photoreal-presentation-result"
PRESENTATION_RESULT_SCHEMA_VERSION = 1
PRESENTATION_PACKAGE_VERSION = "jq-photoreal-presentation-package-v1"
PRESENTATION_CAMERA_VERSION = "jq-photoreal-presentation-camera-v1"
PRESENTATION_LIGHTING_VERSION = "jq-photoreal-presentation-lighting-v1"
PRESENTATION_ROOM_MATERIAL_VERSION = "jq-photoreal-room-materials-v1"
PRESENTATION_WORLD_VERSION = "jq-photoreal-presentation-world-v1"
PRESENTATION_RENDER_VERSION = "jq-photoreal-cycles-render-v1"
PRESENTATION_PIPELINE_VERSION = "2026.08-photoreal-presentation-baseline-v1"
MATERIAL_PIPELINE_VERSION = "2026.08-deterministic-pbr-materials-v1"

EXPECTED_BLENDER_VERSION = "5.2.0 LTS"
EXPECTED_BLENDER_BUILD = "fbe6228777e7"
EXPECTED_GEOMETRY_FINGERPRINT = materials.EXPECTED_GEOMETRY_FINGERPRINT
EXPECTED_PRIMARY_PACKAGE_KEY = materials.EXPECTED_PRIMARY_PACKAGE_KEY
EXPECTED_MATERIAL_PACKAGE_KEY = (
    "jq-render-material-package-v1-"
    "6d180ecff47487de4692620d5387b7bde3b827a5a0a5f6b4ad438cb6335d2794"
)
EXPECTED_MATERIAL_CAPTURE_KEY = (
    "jq-materials-preview-v1-"
    "ea08c048092d14f80da06924ec82126c8edae36a388b785313bac02e763b91ea"
)
EXPECTED_PRODUCT_OBJECT_COUNT = 78
EXPECTED_ROOM_OBJECT_COUNT = 2
EXPECTED_CONSTRAINT_COUNT = 7
EXPECTED_SOURCE_CAMERA_COUNT = 1
EXPECTED_SOURCE_LIGHT_COUNT = 0
EXPECTED_SOURCE_COLLECTION_COUNT = 4
EXPECTED_PRESENTATION_CAMERA_COUNT = 2
EXPECTED_PRESENTATION_LIGHT_COUNT = 4
EXPECTED_PRESENTATION_COLLECTION_COUNT = 6
EXPECTED_SCENE_OBJECT_COUNT = 93
EXPECTED_MESH_DATABLOCK_COUNT = 87
EXPECTED_CAMERA_NAME = "JQ_PHOTOREAL_BEAUTY_CAMERA"
EXPECTED_CAMERA_COLLECTION = "JQ_PRESENTATION_CAMERAS"
EXPECTED_LIGHT_COLLECTION = "JQ_PRESENTATION_LIGHTS"
EXPECTED_WORLD_NAME = "JQ_BEAUTY_WORLD"
EXPECTED_WALL_MATERIAL_NAME = "JQ_PRESENTATION_ROOM_WALL"
EXPECTED_FLOOR_MATERIAL_NAME = "JQ_PRESENTATION_ROOM_FLOOR"
EXPECTED_OUTPUT_NAMES = {
    "blend": "TV01-photoreal-beauty.blend",
    "master": "photoreal-beauty-master.png",
    "beauty": "photoreal-beauty.webp",
    "result": "photoreal-beauty-result.json",
    "report": "photoreal-beauty-report.json",
}

MAX_JSON_BYTES = 16 * 1024 * 1024
MAX_MASTER_BYTES = 256 * 1024 * 1024
MAX_BEAUTY_BYTES = 64 * 1024 * 1024
NUMERIC_TOLERANCE = 1e-9
GEOMETRY_TOLERANCE = materials.GEOMETRY_TOLERANCE
SAFE_ID_RE = materials.SAFE_ID_RE
SHA256_RE = materials.SHA256_RE
PRESENTATION_PACKAGE_KEY_RE = re.compile(
    r"^jq-photoreal-presentation-package-v1-[a-f0-9]{64}$"
)
CAPTURE_KEY_RE = re.compile(r"^jq-photoreal-beauty-v1-[a-f0-9]{64}$")

TOP_LEVEL_KEYS = {
    "kind", "schema", "schemaVersion", "authority", "versions",
    "phase6Foundation", "presentation", "capture", "presentationPackageKey",
}
AUTHORITY_KEYS = {
    "scope", "productGeometryAuthority", "materialBindingAuthority",
    "materialAuthorityClassification", "materialColorReferenceStatus",
    "customerMaterialApproved", "customerBeautyRenderApproved",
}
VERSION_KEYS = {
    "presentationPackageVersion", "cameraVersion", "lightingVersion", "roomMaterialVersion",
    "worldVersion", "renderVersion", "presentationPipelineVersion",
}
FOUNDATION_KEYS = {
    "geometryFingerprint", "primaryPackageKey", "primaryPackageSha256",
    "materialPackageKey", "materialPackageFileSha256", "materialCaptureKey",
    "materialResultKey", "cameraFingerprint", "objectManifestSha256", "reportKind",
    "reportSchemaVersion", "counts", "digests",
}
FOUNDATION_COUNT_KEYS = {
    "bindings", "cameras", "collections", "constraintObjects", "lights", "links",
    "materialFrames", "materials", "modifiers", "nodes", "productMeshObjects",
    "roomMeshObjects",
}
FOUNDATION_DIGEST_KEYS = {
    "geometrySha256", "topologySha256", "boundsSha256", "transformsSha256",
    "cameraSha256", "worldSha256", "renderSettingsSha256",
    "materialsSha256", "shaderParametersSha256",
    "slotAssignmentsSha256", "nodesSha256", "linksSha256",
}
PRESENTATION_KEYS = {
    "camera", "collectionPolicy", "roomMaterials", "world", "lights",
    "edgeSoftening",
}
CAMERA_KEYS = {
    "cameraId", "cameraVersion", "blenderObjectName", "type", "position",
    "target", "up", "lensMm", "sensorWidthMm", "sensorFit", "clipStartM",
    "clipEndM", "depthOfField",
}
DEPTH_OF_FIELD_KEYS = {"enabled"}
COLLECTION_POLICY_KEYS = {"cameraCollection", "lightCollection"}
ROOM_MATERIAL_KEYS = {
    "materialId", "recipeVersion", "targetObjectId", "blenderMaterialName",
    "declaredColorSpace", "externalResources", "trueDisplacement", "parameters",
}
ROOM_PARAMETERS_KEYS = {
    "baseColor", "metallic", "roughness", "ior", "alpha", "coatWeight",
    "coatRoughness", "transmissionWeight", "emissionColor", "emissionStrength",
    "noise", "bump",
}
ROOM_NOISE_KEYS = {"dimensions", "scale", "detail", "roughness", "w", "colorVariation"}
ROOM_BUMP_KEYS = {"enabled", "strength", "distanceM", "source"}
WORLD_KEYS = {
    "worldVersion", "blenderWorldName", "environmentAssetPath",
    "environmentSha256", "projection", "interpolation", "colorSpace", "strength",
    "rotationEuler",
}
LIGHT_KEYS = {
    "lightId", "lightingVersion", "blenderObjectName", "role", "blenderType", "position", "target",
    "color", "energyW", "useShadow", "normalize", "diffuseFactor",
    "specularFactor", "volumeFactor", "shape", "sizeM", "sizeYM",
    "spreadRadians", "spotSizeRadians", "spotBlend", "shadowSoftSizeM", "anchor",
}
LIGHT_ANCHOR_KEYS = {
    "componentId", "primitiveId", "submeshId", "objectId", "materialId",
    "surfaceRole", "center",
}
EDGE_SOFTENING_KEYS = {"enabled", "method", "modifierCount"}
CAPTURE_KEYS = {
    "captureId", "captureKey", "blenderRuntime", "renderPolicy", "film",
    "renderOptions", "colorManagement", "outputs",
}
RUNTIME_KEYS = {"version", "buildHash", "backend", "vendor", "renderer", "deviceVersion"}
RENDER_POLICY_KEYS = {
    "renderVersion", "engine", "blenderEngine", "computeDeviceType", "deviceType",
    "deviceName", "sceneDevice", "width", "height", "resolutionPercentage",
    "pixelAspectX", "pixelAspectY", "samples", "adaptiveSampling",
    "adaptiveThreshold", "adaptiveMinSamples", "samplingSeed", "animatedSeed",
    "useLightTree", "useGuiding", "maxBounces", "diffuseBounces",
    "glossyBounces", "transmissionBounces", "transparentBounces",
    "volumeBounces", "reflectiveCaustics", "refractiveCaustics", "directClamp",
    "indirectClamp", "filterWidth", "denoising",
}
DENOISING_KEYS = {"enabled", "denoiser", "inputPasses", "prefilter", "quality", "useGpu"}
COLOR_MANAGEMENT_KEYS = {
    "displayDevice", "viewTransform", "look", "exposure", "gamma", "useCurveMapping",
}
FILM_KEYS = {"transparent", "transparentGlass", "transparentRoughnessThreshold"}
RENDER_OPTIONS_KEYS = {
    "useCompositing", "useSequencer", "useFileExtension", "useStamp", "useBorder",
    "useCropToBorder", "ditherIntensity",
}
OUTPUT_KEYS = {
    "pass", "filename", "mimeType", "width", "height", "maxBytes", "colorMode",
    "colorDepth", "colorManagement", "compression", "quality",
}

EXPECTED_FOUNDATION_DIGESTS = {
    "geometrySha256": "0e34d05fac3b3ac025dbbce3104d24c97b704ae168884d97713c3e7978159c72",
    "topologySha256": "1bf523568c6fbd240543b5f0a25bed34881a66f5ba5e3dad43ff8878c1cebb63",
    "boundsSha256": "3b621a2266378944888bde6efde033bf92eb7d208160fa1987dbb78766ec2d6c",
    "transformsSha256": "81254f454170b20f074e7da09a62590796bc58aac3fd81d74033a8c028f5c0cf",
    "cameraSha256": "1f27768d5c672576eb7bfa093b5be44125135c35c9b6494cd06eb54f20574de0",
    "worldSha256": "5ea7c02b7db8d70edcf86c4138691cc3c0f01f562153a299995ea8619f6953b1",
    "renderSettingsSha256": "04c600a9d0dc859e9f42c2b8891d807ec6ee0cfaf8b01fe3c891bbc455318d53",
    "materialsSha256": "520be8b532c79c17c50d2a73e31d4f4094df81a4d71192877bcbc316d6bbf7f6",
    "shaderParametersSha256": "54ba4a5444fe595a05118146e33987fdffe0136ba8316a131ea821592d0ea36a",
    "slotAssignmentsSha256": "1ebac1ccbc11474416ae1c6510e819916cb689ee1e4943e2d25e0b3f2d5f0540",
    "nodesSha256": "95f4c09daa27ec6b7bb25bea15d814359e362c4360fe63e33c8295a2d8ba867a",
    "linksSha256": "1b83b7addb95360954e05f4ca1c0b19925430f6c37184e5b7059437a940b721f",
}
EXPECTED_AUTHORITY = {
    "scope": "local-photoreal-presentation-only",
    "productGeometryAuthority": "jq-javascript-engine-only",
    "materialBindingAuthority": MATERIAL_PIPELINE_VERSION,
    "materialAuthorityClassification": "PREVIEW_ONLY_AUTHORIZED",
    "materialColorReferenceStatus": "UNVERIFIED",
    "customerMaterialApproved": False,
    "customerBeautyRenderApproved": False,
}


class PresentationWorkerError(RuntimeError):
    """Expected fail-closed presentation worker error."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def fail(code: str, message: str) -> None:
    raise PresentationWorkerError(code, message)


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


def positive(value: Any, label: str) -> float:
    number = finite(value, label)
    if number <= 0:
        fail("NON_POSITIVE_NUMBER", f"{label} must be positive")
    return number


def nonnegative(value: Any, label: str) -> float:
    number = finite(value, label)
    if number < 0:
        fail("NEGATIVE_NUMBER", f"{label} must not be negative")
    return number


def unit_interval(value: Any, label: str) -> float:
    number = finite(value, label)
    if not 0 <= number <= 1:
        fail("NUMBER_OUT_OF_RANGE", f"{label} must be in [0,1]")
    return number


def integer(value: Any, label: str, *, minimum: int | None = None) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        fail("INVALID_INTEGER", f"{label} must be an integer")
    if minimum is not None and value < minimum:
        fail("INVALID_INTEGER", f"{label} must be at least {minimum}")
    return value


def safe_id(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SAFE_ID_RE.fullmatch(value):
        fail("INVALID_IDENTIFIER", f"{label} is not a safe deterministic ID")
    return value


def vector3(value: Any, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != 3:
        fail("INVALID_VECTOR", f"{label} must contain three finite numbers")
    return [finite(item, f"{label}[{index}]") for index, item in enumerate(value)]


def point(value: Any, label: str) -> dict[str, float]:
    entry = exact_keys(value, {"x", "y", "z"}, label)
    return {axis: finite(entry[axis], f"{label}.{axis}") for axis in "xyz"}


def rgb(value: Any, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != 3:
        fail("INVALID_COLOR", f"{label} must be linear RGB")
    return [unit_interval(item, f"{label}[{index}]") for index, item in enumerate(value)]


def canonical_equal(left: Any, right: Any) -> bool:
    return materials.canonical_equal(left, right)


def hash_canonical(value: Any) -> str:
    return hashlib.sha256(js_stable_stringify(value).encode("utf-8")).hexdigest()


def js_stable_stringify(value: Any) -> str:
    """Match ECMAScript JSON number formatting for the Phase 7 key payload."""
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            fail("NON_FINITE_NUMBER", "Canonical payload contains a non-finite number")
        if value == 0:
            return "0"
        if value.is_integer():
            return str(int(value))
        rendered = repr(value)
        magnitude = abs(value)
        if "e" in rendered.lower() and 1e-6 <= magnitude < 1e21:
            return format(Decimal(rendered), "f")
        return rendered.replace("e-0", "e-").replace("e+0", "e+")
    if isinstance(value, list):
        return "[" + ",".join(js_stable_stringify(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(
            f"{js_stable_stringify(key)}:{js_stable_stringify(value[key])}"
            for key in sorted(value)
        ) + "}"
    fail("INVALID_JSON_VALUE", "Canonical payload contains an unsupported value")
    raise AssertionError("unreachable")


def round_metric(value: float) -> float:
    return materials.round_metric(value)


def write_json(path: Path, value: dict[str, Any]) -> None:
    materials.write_json(path, value)


def expected_versions() -> dict[str, Any]:
    return {
        "presentationPackageVersion": PRESENTATION_PACKAGE_VERSION,
        "cameraVersion": PRESENTATION_CAMERA_VERSION,
        "lightingVersion": PRESENTATION_LIGHTING_VERSION,
        "roomMaterialVersion": PRESENTATION_ROOM_MATERIAL_VERSION,
        "worldVersion": PRESENTATION_WORLD_VERSION,
        "renderVersion": PRESENTATION_RENDER_VERSION,
        "presentationPipelineVersion": PRESENTATION_PIPELINE_VERSION,
    }


def expected_foundation(
    render_package: dict[str, Any], material_package: dict[str, Any], material_raw: bytes
) -> dict[str, Any]:
    base = material_package["baseGeometry"]
    return {
        "geometryFingerprint": EXPECTED_GEOMETRY_FINGERPRINT,
        "cameraFingerprint": base["cameraFingerprint"],
        "primaryPackageKey": EXPECTED_PRIMARY_PACKAGE_KEY,
        "primaryPackageSha256": base["primaryPackageSha256"],
        "objectManifestSha256": base["objectManifestSha256"],
        "materialPackageKey": EXPECTED_MATERIAL_PACKAGE_KEY,
        "materialPackageFileSha256": materials.hash_bytes(material_raw),
        "materialCaptureKey": EXPECTED_MATERIAL_CAPTURE_KEY,
        "materialResultKey": (
            "jq-materials-preview-result-v1-"
            "367133ae6a20e4a562159a67d38b993396a3d94ec7ac8a3710fac395e857314e"
        ),
        "reportKind": "jq-local-blender-materials-preview-report",
        "reportSchemaVersion": 1,
        "counts": {
            "bindings": 80, "cameras": 1, "collections": 4,
            "constraintObjects": 7, "lights": 0, "links": 1305,
            "materialFrames": 65, "materials": 70, "modifiers": 0,
            "nodes": 1115, "productMeshObjects": 78, "roomMeshObjects": 2,
        },
        "digests": EXPECTED_FOUNDATION_DIGESTS,
    }


def expected_camera() -> dict[str, Any]:
    return {
        "cameraId": "beauty-camera-v1",
        "cameraVersion": PRESENTATION_CAMERA_VERSION,
        "blenderObjectName": EXPECTED_CAMERA_NAME,
        "type": "PERSP",
        "position": {"x": -0.85, "y": 5.75, "z": 1.56},
        "target": {"x": 0.05, "y": 0.19, "z": 1.22},
        "up": [0, 0, 1],
        "lensMm": 52,
        "sensorWidthMm": 36,
        "sensorFit": "HORIZONTAL",
        "clipStartM": 0.05,
        "clipEndM": 25,
        "depthOfField": {"enabled": False},
    }


def room_material(
    material_id: str, recipe_version: str, target: str, blender_name: str,
    base_color: list[float], roughness: float, ior: float, coat_weight: float,
    coat_roughness: float, noise_scale: float, noise_w: float,
    color_variation: float, bump_strength: float, bump_distance: float,
) -> dict[str, Any]:
    return {
        "materialId": material_id,
        "recipeVersion": recipe_version,
        "targetObjectId": target,
        "blenderMaterialName": blender_name,
        "declaredColorSpace": "Linear Rec.709",
        "externalResources": [],
        "trueDisplacement": False,
        "parameters": {
            "baseColor": base_color,
            "metallic": 0,
            "roughness": roughness,
            "ior": ior,
            "alpha": 1,
            "coatWeight": coat_weight,
            "coatRoughness": coat_roughness,
            "transmissionWeight": 0,
            "emissionColor": [0, 0, 0],
            "emissionStrength": 0,
            "noise": {
                "dimensions": "4D",
                "scale": noise_scale,
                "detail": 2,
                "roughness": 0.45,
                "w": noise_w,
                "colorVariation": color_variation,
            },
            "bump": {
                "enabled": True,
                "strength": bump_strength,
                "distanceM": bump_distance,
                "source": "noise-factor",
            },
        },
    }


def expected_room_materials() -> list[dict[str, Any]]:
    return [
        room_material(
            "warm-natural-floor-v1", "warm-natural-floor-v1-recipe-v1",
            "room-floor", EXPECTED_FLOOR_MATERIAL_NAME,
            [0.28, 0.22, 0.16], 0.55, 1.5, 0.04, 0.35,
            3.5, 0.61, 0.035, 0.12, 0.0004,
        ),
        room_material(
            "warm-off-white-wall-v1", "warm-off-white-wall-v1-recipe-v1",
            "room-rear-wall", EXPECTED_WALL_MATERIAL_NAME,
            [0.78, 0.72, 0.64], 0.78, 1.45, 0, 0,
            70, 0.37, 0, 0.08, 0.0001,
        ),
    ]


def light_descriptor(
    light_id: str, object_name: str, role: str, blender_type: str,
    position: list[float], target: list[float], color_value: list[float],
    energy: float, *, shape: str | None = None, size: float | None = None,
    size_y: float | None = None, spread: float | None = None,
    spot_size: float | None = None, spot_blend: float | None = None,
    soft_size: float | None = None, anchor: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "lightId": light_id,
        "lightingVersion": PRESENTATION_LIGHTING_VERSION,
        "blenderObjectName": object_name,
        "role": role,
        "blenderType": blender_type,
        "position": dict(zip("xyz", position)),
        "target": dict(zip("xyz", target)),
        "color": color_value,
        "energyW": energy,
        "useShadow": True,
        "normalize": True,
        "diffuseFactor": 1,
        "specularFactor": 1,
        "volumeFactor": 1,
        "shape": shape,
        "sizeM": size,
        "sizeYM": size_y,
        "spreadRadians": spread,
        "spotSizeRadians": spot_size,
        "spotBlend": spot_blend,
        "shadowSoftSizeM": soft_size,
        "anchor": anchor,
    }


def expected_lights() -> list[dict[str, Any]]:
    left_component = "guided-installation-main/section-01-light-puck"
    right_component = "guided-installation-main/section-04-light-puck"
    warm = [1, 0.896269353374, 0.737910408773]
    return [
        light_descriptor(
            "presentation-key-daylight-v1", "JQ_PRESENTATION_KEY_DAYLIGHT",
            "soft-daylight-key", "AREA", [-2.3, 3, 2.45], [-0.25, 0.2, 1.2],
            [1, 0.93, 0.84], 420, shape="RECTANGLE", size=2.2, size_y=1.6,
            spread=math.pi,
        ),
        light_descriptor(
            "presentation-fill-daylight-v1", "JQ_PRESENTATION_FILL_DAYLIGHT",
            "cool-neutral-fill", "AREA", [2.2, 2.4, 1.75], [0.35, 0.18, 1.1],
            [0.84, 0.91, 1], 110, shape="RECTANGLE", size=2.5, size_y=1.8,
            spread=math.pi,
        ),
        light_descriptor(
            "presentation-puck-left-v1", "JQ_PRESENTATION_PUCK_LEFT",
            "warm-puck-left", "SPOT", [-1.12395, 0.28575, 2.405],
            [-1.12395, 0.28575, 1.4], warm, 18,
            spot_size=1.2217304764, spot_blend=0.65, soft_size=0.025,
            anchor={
                "componentId": left_component,
                "primitiveId": f"{left_component}/primitive/emissive-lens",
                "submeshId": "emissive-lens",
                "objectId": f"{left_component}::emissive-lens",
                "materialId": "warm-opal-puck-lens-v1",
                "surfaceRole": "emissive-lens",
                "center": {"x": -1.12395, "y": 0.28575, "z": 2.41379375},
            },
        ),
        light_descriptor(
            "presentation-puck-right-v1", "JQ_PRESENTATION_PUCK_RIGHT",
            "warm-puck-right", "SPOT", [1.12395, 0.28575, 2.405],
            [1.12395, 0.28575, 1.4], warm, 18,
            spot_size=1.2217304764, spot_blend=0.65, soft_size=0.025,
            anchor={
                "componentId": right_component,
                "primitiveId": f"{right_component}/primitive/emissive-lens",
                "submeshId": "emissive-lens",
                "objectId": f"{right_component}::emissive-lens",
                "materialId": "warm-opal-puck-lens-v1",
                "surfaceRole": "emissive-lens",
                "center": {"x": 1.12395, "y": 0.28575, "z": 2.41379375},
            },
        ),
    ]


def expected_presentation(render_package: dict[str, Any]) -> dict[str, Any]:
    environment = render_package["scene"]["environment"]
    return {
        "camera": expected_camera(),
        "collectionPolicy": {
            "cameraCollection": EXPECTED_CAMERA_COLLECTION,
            "lightCollection": EXPECTED_LIGHT_COLLECTION,
        },
        "roomMaterials": expected_room_materials(),
        "world": {
            "worldVersion": PRESENTATION_WORLD_VERSION,
            "blenderWorldName": EXPECTED_WORLD_NAME,
            "environmentAssetPath": environment["path"],
            "environmentSha256": environment["sha256"],
            "projection": environment["projection"],
            "interpolation": environment["interpolation"],
            "colorSpace": environment["colorSpace"],
            "strength": 0.32,
            "rotationEuler": [0, 0, 0.35],
        },
        "lights": expected_lights(),
        "edgeSoftening": {
            "enabled": False,
            "method": "none-v1",
            "modifierCount": 0,
        },
    }


def expected_render_policy() -> dict[str, Any]:
    return {
        "renderVersion": PRESENTATION_RENDER_VERSION,
        "engine": "CYCLES",
        "blenderEngine": "CYCLES",
        "computeDeviceType": "METAL",
        "deviceType": "METAL",
        "deviceName": "Apple M4 (GPU - 10 cores)",
        "sceneDevice": "GPU",
        "width": 1920,
        "height": 1280,
        "resolutionPercentage": 100,
        "pixelAspectX": 1,
        "pixelAspectY": 1,
        "samples": 256,
        "adaptiveSampling": True,
        "adaptiveThreshold": 0.01,
        "adaptiveMinSamples": 32,
        "samplingSeed": 170219,
        "animatedSeed": False,
        "useLightTree": True,
        "useGuiding": False,
        "maxBounces": 8,
        "diffuseBounces": 4,
        "glossyBounces": 4,
        "transmissionBounces": 6,
        "transparentBounces": 4,
        "volumeBounces": 0,
        "reflectiveCaustics": False,
        "refractiveCaustics": False,
        "directClamp": 0,
        "indirectClamp": 5,
        "filterWidth": 1.5,
        "denoising": {
            "enabled": True,
            "denoiser": "OPENIMAGEDENOISE",
            "inputPasses": "RGB_ALBEDO_NORMAL",
            "prefilter": "ACCURATE",
            "quality": "HIGH",
            "useGpu": False,
        },
    }


def expected_outputs() -> list[dict[str, Any]]:
    return [
        {
            "pass": "photoreal-master",
            "filename": EXPECTED_OUTPUT_NAMES["master"],
            "mimeType": "image/png",
            "width": 1920, "height": 1280, "maxBytes": MAX_MASTER_BYTES,
            "colorMode": "RGB", "colorDepth": "16", "colorManagement": "FOLLOW_SCENE",
            "compression": 15, "quality": None,
        },
        {
            "pass": "photoreal-beauty",
            "filename": EXPECTED_OUTPUT_NAMES["beauty"],
            "mimeType": "image/webp",
            "width": 1920, "height": 1280, "maxBytes": MAX_BEAUTY_BYTES,
            "colorMode": "RGB", "colorDepth": "8", "colorManagement": "FOLLOW_SCENE",
            "compression": None, "quality": 92,
        },
    ]


def expected_capture_base(material_package: dict[str, Any]) -> dict[str, Any]:
    return {
        "captureId": PRESENTATION_CAPTURE_ID,
        "blenderRuntime": material_package["capture"]["blenderRuntime"],
        "renderPolicy": expected_render_policy(),
        "colorManagement": {
            "displayDevice": "sRGB", "viewTransform": "AgX",
            "look": "AgX - Medium High Contrast", "exposure": 0,
            "gamma": 1, "useCurveMapping": False,
        },
        "film": {
            "transparent": False, "transparentGlass": False,
            "transparentRoughnessThreshold": 0,
        },
        "renderOptions": {
            "useCompositing": False, "useSequencer": False,
            "useFileExtension": True, "useStamp": False, "useBorder": False,
            "useCropToBorder": False, "ditherIntensity": 1,
        },
        "outputs": expected_outputs(),
    }


def validate_package_shapes(package: dict[str, Any]) -> None:
    exact_keys(package, TOP_LEVEL_KEYS, "presentationPackage")
    exact_keys(package["authority"], AUTHORITY_KEYS, "authority")
    exact_keys(package["versions"], VERSION_KEYS, "versions")
    foundation = exact_keys(package["phase6Foundation"], FOUNDATION_KEYS, "phase6Foundation")
    exact_keys(foundation["counts"], FOUNDATION_COUNT_KEYS, "phase6Foundation.counts")
    exact_keys(foundation["digests"], FOUNDATION_DIGEST_KEYS, "phase6Foundation.digests")
    presentation = exact_keys(package["presentation"], PRESENTATION_KEYS, "presentation")
    camera = exact_keys(presentation["camera"], CAMERA_KEYS, "presentation.camera")
    exact_keys(camera["depthOfField"], DEPTH_OF_FIELD_KEYS, "camera.depthOfField")
    exact_keys(presentation["collectionPolicy"], COLLECTION_POLICY_KEYS, "collectionPolicy")
    room_materials = presentation["roomMaterials"]
    if not isinstance(room_materials, list) or len(room_materials) != 2:
        fail("ROOM_MATERIAL_CARDINALITY", "Presentation requires exactly two room recipes")
    for index, material in enumerate(room_materials):
        descriptor = exact_keys(material, ROOM_MATERIAL_KEYS, f"roomMaterials[{index}]")
        parameters = exact_keys(
            descriptor["parameters"], ROOM_PARAMETERS_KEYS,
            f"roomMaterials[{index}].parameters",
        )
        exact_keys(parameters["noise"], ROOM_NOISE_KEYS, f"roomMaterials[{index}].noise")
        exact_keys(parameters["bump"], ROOM_BUMP_KEYS, f"roomMaterials[{index}].bump")
    exact_keys(presentation["world"], WORLD_KEYS, "presentation.world")
    exact_keys(presentation["edgeSoftening"], EDGE_SOFTENING_KEYS, "edgeSoftening")
    lights = presentation["lights"]
    if not isinstance(lights, list) or len(lights) != 4:
        fail("LIGHT_CARDINALITY", "Presentation requires exactly four lights")
    for index, light in enumerate(lights):
        descriptor = exact_keys(light, LIGHT_KEYS, f"lights[{index}]")
        if descriptor["anchor"] is not None:
            anchor = exact_keys(descriptor["anchor"], LIGHT_ANCHOR_KEYS, f"lights[{index}].anchor")
            point(anchor["center"], f"lights[{index}].anchor.center")
    capture = exact_keys(package["capture"], CAPTURE_KEYS, "capture")
    exact_keys(capture["blenderRuntime"], RUNTIME_KEYS, "capture.blenderRuntime")
    render = exact_keys(capture["renderPolicy"], RENDER_POLICY_KEYS, "capture.renderPolicy")
    exact_keys(render["denoising"], DENOISING_KEYS, "capture.renderPolicy.denoising")
    exact_keys(capture["film"], FILM_KEYS, "capture.film")
    exact_keys(capture["renderOptions"], RENDER_OPTIONS_KEYS, "capture.renderOptions")
    exact_keys(capture["colorManagement"], COLOR_MANAGEMENT_KEYS, "capture.colorManagement")
    outputs = capture["outputs"]
    if not isinstance(outputs, list) or len(outputs) != 2:
        fail("OUTPUT_CARDINALITY", "Presentation capture requires PNG and WebP outputs")
    for index, output in enumerate(outputs):
        exact_keys(output, OUTPUT_KEYS, f"capture.outputs[{index}]")


def validate_puck_light_anchors(
    render_package: dict[str, Any], material_data: dict[str, Any], lights: list[dict[str, Any]]
) -> None:
    components = {component["componentId"]: component for component in render_package["components"]}
    binding_by_object = {binding["objectId"]: binding for binding in material_data["bindings"]}
    anchored = [light for light in lights if light["anchor"] is not None]
    if len(anchored) != 2:
        fail("PUCK_LIGHT_ANCHOR_COUNT", "Exactly two presentation lights must be puck-anchored")
    for light in anchored:
        anchor = light["anchor"]
        component = components.get(anchor["componentId"])
        if component is None or component["role"] != "light":
            fail("PUCK_LIGHT_ANCHOR_INVALID", f"Unknown light component {anchor['componentId']}")
        matches = [
            submesh for submesh in component["submeshes"]
            if submesh["submeshId"] == anchor["submeshId"]
        ]
        if len(matches) != 1:
            fail("PUCK_LIGHT_ANCHOR_INVALID", "Puck lens submesh is missing or duplicated")
        submesh = matches[0]
        primitive = submesh["primitiveGeometry"]
        expected_object_id = f"{component['componentId']}::{submesh['submeshId']}"
        binding = binding_by_object.get(expected_object_id)
        expected_anchor = {
            "componentId": component["componentId"],
            "primitiveId": f"{component['componentId']}/primitive/{submesh['submeshId']}",
            "submeshId": submesh["submeshId"],
            "objectId": expected_object_id,
            "materialId": "warm-opal-puck-lens-v1",
            "surfaceRole": "emissive-lens",
            "center": primitive["center"],
        }
        if (
            primitive.get("kind") != "cylinder"
            or primitive.get("surfaceRole") != "emissive_lens"
            or primitive.get("segments") != 32
            or primitive.get("axis") != "z"
            or binding is None
            or binding["materialId"] != "warm-opal-puck-lens-v1"
            or not canonical_equal(anchor, expected_anchor)
        ):
            fail("PUCK_LIGHT_ANCHOR_INVALID", f"{light['lightId']} anchor contradicts the accepted puck")
        position = light["position"]
        if (
            position["x"] != anchor["center"]["x"]
            or position["y"] != anchor["center"]["y"]
            or position["z"] != 2.405
        ):
            fail("PUCK_LIGHT_POSITION_INVALID", f"{light['lightId']} is not centered beneath its lens")


def validate_presentation_package(
    render_package: dict[str, Any],
    material_package: dict[str, Any],
    material_data: dict[str, Any],
    presentation_package: dict[str, Any],
    package_raw: bytes,
    material_raw: bytes,
) -> dict[str, Any]:
    del package_raw  # The canonical geometry digest is already validated by Phase 6.
    validate_package_shapes(presentation_package)
    if (
        presentation_package["kind"] != PRESENTATION_PACKAGE_KIND
        or presentation_package["schema"] != PRESENTATION_PACKAGE_SCHEMA
        or presentation_package["schemaVersion"] != PRESENTATION_PACKAGE_SCHEMA_VERSION
    ):
        fail("INVALID_PRESENTATION_SCHEMA", "Presentation package schema is unsupported")
    if not canonical_equal(presentation_package["authority"], EXPECTED_AUTHORITY):
        fail("PRESENTATION_AUTHORITY_DRIFT", "Presentation authority or approval gates drifted")
    versions = expected_versions()
    if not canonical_equal(presentation_package["versions"], versions):
        fail("PRESENTATION_VERSION_DRIFT", "Presentation versions drifted")
    foundation = expected_foundation(render_package, material_package, material_raw)
    if not canonical_equal(presentation_package["phase6Foundation"], foundation):
        fail("PHASE6_FOUNDATION_DRIFT", "Presentation targets a different Phase 6 foundation")
    presentation = expected_presentation(render_package)
    if not canonical_equal(presentation_package["presentation"], presentation):
        fail("PRESENTATION_CONTRACT_DRIFT", "Camera, lights, room, world, or edge policy drifted")
    validate_camera_geometry(presentation_package["presentation"]["camera"], "presentation.camera")
    light_ids: set[str] = set()
    light_names: set[str] = set()
    for index, light in enumerate(presentation_package["presentation"]["lights"]):
        light_id = safe_id(light["lightId"], f"lights[{index}].lightId")
        object_name = safe_id(light["blenderObjectName"], f"lights[{index}].blenderObjectName")
        if light_id in light_ids or object_name in light_names:
            fail("DUPLICATE_LIGHT_ID", f"Duplicate light {light_id}")
        light_ids.add(light_id)
        light_names.add(object_name)
        position_value = point(light["position"], f"lights[{index}].position")
        target_value = point(light["target"], f"lights[{index}].target")
        if all(position_value[axis] == target_value[axis] for axis in "xyz"):
            fail("DEGENERATE_LIGHT", f"{light_id} position equals target")
        rgb(light["color"], f"lights[{index}].color")
    validate_puck_light_anchors(render_package, material_data, presentation["lights"])

    capture = presentation_package["capture"]
    capture_without_key = {key: value for key, value in capture.items() if key != "captureKey"}
    expected_capture = expected_capture_base(material_package)
    if not canonical_equal(capture_without_key, expected_capture):
        fail("PRESENTATION_CAPTURE_DRIFT", "Cycles, runtime, color, film, or output contract drifted")

    package_base = {
        key: value for key, value in presentation_package.items()
        if key not in {"capture", "presentationPackageKey"}
    }
    expected_package_key = (
        "jq-photoreal-presentation-package-v1-"
        + hash_canonical({"keyVersion": PRESENTATION_PACKAGE_SCHEMA, **package_base})
    )
    package_key = presentation_package["presentationPackageKey"]
    if (
        not isinstance(package_key, str)
        or not PRESENTATION_PACKAGE_KEY_RE.fullmatch(package_key)
        or package_key != expected_package_key
    ):
        fail("STALE_PRESENTATION_PACKAGE_KEY", "Presentation package key is stale")
    capture_payload = {
        "keyVersion": PRESENTATION_CAPTURE_ID,
        "presentationPackageKey": package_key,
        "capture": capture_without_key,
    }
    expected_capture_key = f"jq-photoreal-beauty-v1-{hash_canonical(capture_payload)}"
    if (
        not isinstance(capture["captureKey"], str)
        or not CAPTURE_KEY_RE.fullmatch(capture["captureKey"])
        or capture["captureKey"] != expected_capture_key
    ):
        fail("STALE_PRESENTATION_CAPTURE_KEY", "Presentation capture key is stale")
    return {"presentation": presentation_package["presentation"]}


def normalized(values: list[float], label: str) -> list[float]:
    length = math.sqrt(sum(value * value for value in values))
    if length <= NUMERIC_TOLERANCE:
        fail("DEGENERATE_VECTOR", f"{label} has zero length")
    return [value / length for value in values]


def dot(left: list[float], right: list[float]) -> float:
    return sum(left[index] * right[index] for index in range(3))


def validate_camera_geometry(camera: dict[str, Any], label: str) -> None:
    position = point(camera["position"], f"{label}.position")
    target = point(camera["target"], f"{label}.target")
    up = normalized(vector3(camera["up"], f"{label}.up"), f"{label}.up")
    direction = normalized(
        [target[axis] - position[axis] for axis in "xyz"], f"{label}.direction"
    )
    if abs(dot(direction, up)) >= 1 - 1e-6:
        fail("DEGENERATE_CAMERA", f"{label} viewing direction is parallel to up")


def create_principled_room_material(
    bpy: Any, descriptor: dict[str, Any]
) -> Any:
    name = descriptor["blenderMaterialName"]
    if bpy.data.materials.get(name) is not None:
        fail("PRESENTATION_DATABLOCK_COLLISION", f"Material {name} already exists")
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    material.surface_render_method = "DITHERED"
    material.use_transparency_overlap = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    output.name = "00_OUTPUT"
    output.label = "00_OUTPUT"
    output.location = (420, 0)
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.name = "10_PRINCIPLED"
    shader.label = "10_PRINCIPLED"
    shader.location = (80, 0)
    parameters = descriptor["parameters"]
    values = {
        "Base Color": tuple(parameters["baseColor"] + [1.0]),
        "Metallic": parameters["metallic"],
        "Roughness": parameters["roughness"],
        "IOR": parameters["ior"],
        "Alpha": parameters["alpha"],
        "Coat Weight": parameters["coatWeight"],
        "Coat Roughness": parameters["coatRoughness"],
        "Transmission Weight": parameters["transmissionWeight"],
        "Emission Color": tuple(parameters["emissionColor"] + [1.0]),
        "Emission Strength": parameters["emissionStrength"],
    }
    for socket_name, value in values.items():
        socket = shader.inputs.get(socket_name)
        if socket is None:
            fail("BLENDER_SOCKET_MISSING", f"Room shader lacks {socket_name}")
        socket.default_value = value
    coordinates = nodes.new("ShaderNodeTexCoord")
    coordinates.name = "20_OBJECT_COORDINATES"
    coordinates.label = coordinates.name
    coordinates.location = (-820, 0)
    coordinates.from_instancer = False
    noise_contract = parameters["noise"]
    noise = nodes.new("ShaderNodeTexNoise")
    noise.name = "30_DETERMINISTIC_ROOM_NOISE"
    noise.label = noise.name
    noise.location = (-590, 0)
    noise.noise_dimensions = noise_contract["dimensions"]
    noise.normalize = False
    for socket_name, value in (
        ("W", noise_contract["w"]),
        ("Scale", noise_contract["scale"]),
        ("Detail", noise_contract["detail"]),
        ("Roughness", noise_contract["roughness"]),
        ("Lacunarity", 2.0),
        ("Distortion", 0.0),
    ):
        socket = noise.inputs.get(socket_name)
        if socket is None:
            fail("BLENDER_SOCKET_MISSING", f"Room noise lacks {socket_name}")
        socket.default_value = value
    material.node_tree.links.new(coordinates.outputs["Object"], noise.inputs["Vector"])

    variation = noise_contract["colorVariation"]
    if variation > 0:
        mix = nodes.new("ShaderNodeMixRGB")
        mix.name = "40_DETERMINISTIC_COLOR_VARIATION"
        mix.label = mix.name
        mix.location = (-300, 150)
        mix.blend_type = "MIX"
        mix.use_alpha = False
        mix.use_clamp = True
        mix.inputs[1].default_value = tuple(
            max(0.0, channel - variation) for channel in parameters["baseColor"]
        ) + (1.0,)
        mix.inputs[2].default_value = tuple(
            min(1.0, channel + variation) for channel in parameters["baseColor"]
        ) + (1.0,)
        material.node_tree.links.new(noise.outputs["Fac"], mix.inputs[0])
        material.node_tree.links.new(mix.outputs["Color"], shader.inputs["Base Color"])

    bump_contract = parameters["bump"]
    if bump_contract["enabled"]:
        bump = nodes.new("ShaderNodeBump")
        bump.name = "50_SHADER_ONLY_ROOM_BUMP"
        bump.label = bump.name
        bump.location = (-290, -170)
        bump.invert = False
        bump.inputs["Strength"].default_value = bump_contract["strength"]
        bump.inputs["Distance"].default_value = bump_contract["distanceM"]
        material.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        material.node_tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])

    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    material["jq_presentation_material_id"] = descriptor["materialId"]
    material["jq_presentation_recipe_version"] = descriptor["recipeVersion"]
    return material


def point_tuple(value: dict[str, Any]) -> tuple[float, float, float]:
    return tuple(float(value[axis]) for axis in "xyz")


def create_presentation_camera(
    bpy: Any, descriptor: dict[str, Any], collection: Any
) -> Any:
    object_name = descriptor["blenderObjectName"]
    if bpy.data.objects.get(object_name) is not None or bpy.data.cameras.get(object_name) is not None:
        fail("PRESENTATION_DATABLOCK_COLLISION", f"Camera {object_name} already exists")
    data = bpy.data.cameras.new(object_name)
    camera = bpy.data.objects.new(object_name, data)
    collection.objects.link(camera)
    data.type = descriptor["type"]
    data.lens = descriptor["lensMm"]
    data.sensor_width = descriptor["sensorWidthMm"]
    data.sensor_fit = descriptor["sensorFit"]
    data.clip_start = descriptor["clipStartM"]
    data.clip_end = descriptor["clipEndM"]
    data.dof.use_dof = descriptor["depthOfField"]["enabled"]
    camera.location = point_tuple(descriptor["position"])
    from mathutils import Vector

    direction = Vector(point_tuple(descriptor["target"])) - camera.location
    if direction.length <= NUMERIC_TOLERANCE:
        fail("DEGENERATE_CAMERA", "Presentation camera position equals its target")
    camera.rotation_mode = "XYZ"
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.scale = (1.0, 1.0, 1.0)
    camera["jq_presentation_camera_id"] = descriptor["cameraId"]
    camera["jq_camera_version"] = descriptor["cameraVersion"]
    camera["jq_target"] = list(point_tuple(descriptor["target"]))
    camera["jq_up"] = descriptor["up"]
    return camera


def create_presentation_light(
    bpy: Any, descriptor: dict[str, Any], collection: Any
) -> Any:
    object_name = descriptor["blenderObjectName"]
    if bpy.data.objects.get(object_name) is not None or bpy.data.lights.get(object_name) is not None:
        fail("PRESENTATION_DATABLOCK_COLLISION", f"Light {object_name} already exists")
    data = bpy.data.lights.new(name=object_name, type=descriptor["blenderType"])
    obj = bpy.data.objects.new(object_name, data)
    collection.objects.link(obj)
    obj.location = point_tuple(descriptor["position"])
    obj.scale = (1.0, 1.0, 1.0)
    data.color = tuple(descriptor["color"])
    data.energy = descriptor["energyW"]
    data.use_shadow = descriptor["useShadow"]
    data.normalize = descriptor["normalize"]
    data.diffuse_factor = descriptor["diffuseFactor"]
    data.specular_factor = descriptor["specularFactor"]
    data.volume_factor = descriptor["volumeFactor"]
    if descriptor["blenderType"] == "AREA":
        data.shape = descriptor["shape"]
        data.size = descriptor["sizeM"]
        data.size_y = descriptor["sizeYM"]
        data.spread = descriptor["spreadRadians"]
    elif descriptor["blenderType"] == "SPOT":
        data.spot_size = descriptor["spotSizeRadians"]
        data.spot_blend = descriptor["spotBlend"]
        data.shadow_soft_size = descriptor["shadowSoftSizeM"]
    else:
        fail("UNSUPPORTED_LIGHT_TYPE", f"Unsupported light {descriptor['blenderType']}")
    from mathutils import Vector

    target = Vector(point_tuple(descriptor["target"]))
    direction = target - obj.location
    if direction.length <= NUMERIC_TOLERANCE:
        fail("DEGENERATE_LIGHT", f"{descriptor['lightId']} position equals target")
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    obj["jq_presentation_light_id"] = descriptor["lightId"]
    obj["jq_presentation_light_role"] = descriptor["role"]
    if descriptor["anchor"] is not None:
        obj["jq_anchor_component_id"] = descriptor["anchor"]["componentId"]
        obj["jq_anchor_primitive_id"] = descriptor["anchor"]["primitiveId"]
        obj["jq_anchor_submesh_id"] = descriptor["anchor"]["submeshId"]
    return obj


def clone_presentation_world(
    bpy: Any, source_world: Any, descriptor: dict[str, Any]
) -> Any:
    if bpy.data.worlds.get(descriptor["blenderWorldName"]) is not None:
        fail("PRESENTATION_DATABLOCK_COLLISION", "Presentation world already exists")
    source_snapshot = materials.world_snapshot(source_world)
    world = source_world.copy()
    world.name = descriptor["blenderWorldName"]
    if world.node_tree is source_world.node_tree:
        fail("SHARED_WORLD_NODE_TREE", "Presentation world did not receive an isolated node tree")
    by_type: dict[str, list[Any]] = {}
    for node in world.node_tree.nodes:
        by_type.setdefault(node.bl_idname, []).append(node)
    for required in ("ShaderNodeBackground", "ShaderNodeMapping", "ShaderNodeTexEnvironment"):
        if len(by_type.get(required, [])) != 1:
            fail("WORLD_NODE_DRIFT", f"Presentation world lacks one {required}")
    background = by_type["ShaderNodeBackground"][0]
    mapping = by_type["ShaderNodeMapping"][0]
    texture = by_type["ShaderNodeTexEnvironment"][0]
    background.inputs["Strength"].default_value = descriptor["strength"]
    rotation = mapping.inputs["Rotation"].default_value
    rotation[0] = descriptor["rotationEuler"][0]
    rotation[1] = descriptor["rotationEuler"][1]
    rotation[2] = descriptor["rotationEuler"][2]
    if texture.image is None:
        fail("WORLD_ENVIRONMENT_MISSING", "Presentation world lost the inherited HDR")
    world["jq_presentation_world_version"] = descriptor["worldVersion"]
    if materials.world_snapshot(source_world) != source_snapshot:
        fail("SOURCE_WORLD_MUTATION", "Cloning presentation world changed Phase 6 world")
    return world


def presentation_camera_snapshot(camera: Any) -> dict[str, Any]:
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
        "cameraId": camera.get("jq_presentation_camera_id"),
        "cameraVersion": camera.get("jq_camera_version"),
        "target": [round_metric(value) for value in camera.get("jq_target", [])],
        "up": [round_metric(value) for value in camera.get("jq_up", [])],
    }


def presentation_light_snapshot(light: Any) -> dict[str, Any]:
    data = light.data
    result = {
        "objectName": light.name,
        "dataName": data.name,
        "lightId": light.get("jq_presentation_light_id"),
        "role": light.get("jq_presentation_light_role"),
        "type": data.type,
        "location": [round_metric(value) for value in light.location],
        "rotationEuler": [round_metric(value) for value in light.rotation_euler],
        "scale": [round_metric(value) for value in light.scale],
        "color": [round_metric(value) for value in data.color],
        "energyW": round_metric(data.energy),
        "useShadow": bool(data.use_shadow),
        "normalize": bool(data.normalize),
        "diffuseFactor": round_metric(data.diffuse_factor),
        "specularFactor": round_metric(data.specular_factor),
        "volumeFactor": round_metric(data.volume_factor),
    }
    if data.type == "AREA":
        result.update({
            "shape": data.shape, "sizeM": round_metric(data.size),
            "sizeYM": round_metric(data.size_y), "spreadRadians": round_metric(data.spread),
        })
    elif data.type == "SPOT":
        result.update({
            "spotSizeRadians": round_metric(data.spot_size),
            "spotBlend": round_metric(data.spot_blend),
            "shadowSoftSizeM": round_metric(data.shadow_soft_size),
        })
    return result


def configure_cycles_metal(bpy: Any, policy: dict[str, Any]) -> dict[str, Any]:
    scene = bpy.context.scene
    scene.render.engine = policy["blenderEngine"]
    if scene.render.engine != "CYCLES":
        fail("CYCLES_UNAVAILABLE", "Blender could not activate Cycles")
    try:
        preferences = bpy.context.preferences.addons["cycles"].preferences
        preferences.compute_device_type = policy["computeDeviceType"]
        preferences.get_devices()
    except Exception as error:
        fail("CYCLES_DEVICE_CONFIGURATION_FAILED", f"Cannot enumerate Metal devices: {error}")
    devices = []
    target_count = 0
    for device in preferences.devices:
        use = device.type == policy["deviceType"] and device.name == policy["deviceName"]
        device.use = use
        target_count += int(use)
        devices.append({"name": device.name, "type": device.type, "use": bool(device.use)})
    if target_count != 1:
        fail("CYCLES_METAL_DEVICE_MISSING", "The contracted Apple Metal GPU is unavailable")

    cycles = scene.cycles
    cycles.device = policy["sceneDevice"]
    cycles.samples = policy["samples"]
    cycles.use_adaptive_sampling = policy["adaptiveSampling"]
    cycles.adaptive_threshold = policy["adaptiveThreshold"]
    cycles.adaptive_min_samples = policy["adaptiveMinSamples"]
    cycles.seed = policy["samplingSeed"]
    cycles.use_animated_seed = policy["animatedSeed"]
    cycles.use_light_tree = policy["useLightTree"]
    cycles.use_guiding = policy["useGuiding"]
    cycles.max_bounces = policy["maxBounces"]
    cycles.diffuse_bounces = policy["diffuseBounces"]
    cycles.glossy_bounces = policy["glossyBounces"]
    cycles.transmission_bounces = policy["transmissionBounces"]
    cycles.transparent_max_bounces = policy["transparentBounces"]
    cycles.volume_bounces = policy["volumeBounces"]
    cycles.caustics_reflective = policy["reflectiveCaustics"]
    cycles.caustics_refractive = policy["refractiveCaustics"]
    cycles.sample_clamp_direct = policy["directClamp"]
    cycles.sample_clamp_indirect = policy["indirectClamp"]
    cycles.filter_width = policy["filterWidth"]
    cycles.use_denoising = policy["denoising"]["enabled"]
    cycles.denoiser = policy["denoising"]["denoiser"]
    cycles.denoising_input_passes = policy["denoising"]["inputPasses"]
    cycles.denoising_prefilter = policy["denoising"]["prefilter"]
    cycles.denoising_quality = policy["denoising"]["quality"]
    cycles.denoising_use_gpu = policy["denoising"]["useGpu"]
    return {"computeDeviceType": preferences.compute_device_type, "devices": devices}


def configure_render(scene: Any, capture: dict[str, Any]) -> None:
    policy = capture["renderPolicy"]
    scene.render.resolution_x = policy["width"]
    scene.render.resolution_y = policy["height"]
    scene.render.resolution_percentage = policy["resolutionPercentage"]
    scene.render.pixel_aspect_x = policy["pixelAspectX"]
    scene.render.pixel_aspect_y = policy["pixelAspectY"]
    film = capture["film"]
    scene.render.film_transparent = film["transparent"]
    scene.cycles.film_transparent_glass = film["transparentGlass"]
    scene.cycles.film_transparent_roughness = film["transparentRoughnessThreshold"]
    options = capture["renderOptions"]
    scene.render.use_compositing = options["useCompositing"]
    scene.render.use_sequencer = options["useSequencer"]
    scene.render.use_file_extension = options["useFileExtension"]
    scene.render.use_stamp = options["useStamp"]
    scene.render.use_border = options["useBorder"]
    scene.render.use_crop_to_border = options["useCropToBorder"]
    scene.render.dither_intensity = options["ditherIntensity"]
    color = capture["colorManagement"]
    scene.display_settings.display_device = color["displayDevice"]
    scene.view_settings.view_transform = color["viewTransform"]
    scene.view_settings.look = color["look"]
    scene.view_settings.exposure = color["exposure"]
    scene.view_settings.gamma = color["gamma"]
    scene.view_settings.use_curve_mapping = color["useCurveMapping"]


def cycles_render_snapshot(scene: Any) -> dict[str, Any]:
    cycles = scene.cycles
    return {
        "engine": scene.render.engine,
        "width": scene.render.resolution_x,
        "height": scene.render.resolution_y,
        "resolutionPercentage": scene.render.resolution_percentage,
        "pixelAspectX": round_metric(scene.render.pixel_aspect_x),
        "pixelAspectY": round_metric(scene.render.pixel_aspect_y),
        "filmTransparent": bool(scene.render.film_transparent),
        "filmTransparentGlass": bool(scene.cycles.film_transparent_glass),
        "filmTransparentRoughness": round_metric(scene.cycles.film_transparent_roughness),
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
        "imageColorManagement": scene.render.image_settings.color_management,
        "compression": scene.render.image_settings.compression,
        "quality": scene.render.image_settings.quality,
        "displayDevice": scene.display_settings.display_device,
        "viewTransform": scene.view_settings.view_transform,
        "look": scene.view_settings.look,
        "exposure": round_metric(scene.view_settings.exposure),
        "gamma": round_metric(scene.view_settings.gamma),
        "useCurveMapping": bool(scene.view_settings.use_curve_mapping),
        "cycles": {
            "device": cycles.device,
            "samples": cycles.samples,
            "adaptiveSampling": bool(cycles.use_adaptive_sampling),
            "adaptiveThreshold": round_metric(cycles.adaptive_threshold),
            "adaptiveMinSamples": cycles.adaptive_min_samples,
            "samplingSeed": cycles.seed,
            "animatedSeed": bool(cycles.use_animated_seed),
            "useLightTree": bool(cycles.use_light_tree),
            "useGuiding": bool(cycles.use_guiding),
            "maxBounces": cycles.max_bounces,
            "diffuseBounces": cycles.diffuse_bounces,
            "glossyBounces": cycles.glossy_bounces,
            "transmissionBounces": cycles.transmission_bounces,
            "transparentBounces": cycles.transparent_max_bounces,
            "volumeBounces": cycles.volume_bounces,
            "reflectiveCaustics": bool(cycles.caustics_reflective),
            "refractiveCaustics": bool(cycles.caustics_refractive),
            "directClamp": round_metric(cycles.sample_clamp_direct),
            "indirectClamp": round_metric(cycles.sample_clamp_indirect),
            "filterWidth": round_metric(cycles.filter_width),
            "denoising": {
                "enabled": bool(cycles.use_denoising),
                "denoiser": cycles.denoiser,
                "inputPasses": cycles.denoising_input_passes,
                "prefilter": cycles.denoising_prefilter,
                "quality": cycles.denoising_quality,
                "useGpu": bool(cycles.denoising_use_gpu),
            },
        },
    }


def material_slot_snapshot(objects: list[Any]) -> list[dict[str, Any]]:
    return [
        {
            "objectId": obj.name,
            "materials": [material.name if material is not None else None for material in obj.data.materials],
        }
        for obj in sorted(objects, key=lambda item: item.name)
    ]


def geometry_snapshot_for_names(bpy: Any, names: list[str]) -> dict[str, str]:
    manifest = []
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is None or obj.type != "MESH":
            fail("SOURCE_GEOMETRY_MISSING", f"Missing source mesh {name}")
        manifest.append({"objectId": name, **materials.mesh_signature(obj)})
    manifest.sort(key=lambda item: item["objectId"])
    return materials.geometry_parity_snapshot({"geometryManifest": manifest})


def configure_master_image_settings(scene: Any, output: dict[str, Any]) -> None:
    settings = scene.render.image_settings
    settings.file_format = "PNG"
    settings.color_mode = output["colorMode"]
    settings.color_depth = output["colorDepth"]
    settings.color_management = output["colorManagement"]
    settings.compression = output["compression"]
    # Blender retains the WebP quality field even while PNG is active. Pin it
    # so toggling the two encoders cannot create post-render state drift.
    settings.quality = 90


def configure_webp_image_settings(scene: Any, output: dict[str, Any]) -> None:
    settings = scene.render.image_settings
    settings.file_format = "WEBP"
    settings.color_mode = output["colorMode"]
    settings.color_depth = output["colorDepth"]
    settings.color_management = output["colorManagement"]
    settings.quality = output["quality"]


def image_dimensions(bpy: Any, path: Path, label: str) -> tuple[int, int]:
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        return tuple(int(value) for value in image.size)
    finally:
        bpy.data.images.remove(image)


def assert_output_file(
    bpy: Any, path: Path, contract: dict[str, Any], maximum: int, label: str
) -> dict[str, Any]:
    if not path.is_file():
        fail("PRESENTATION_OUTPUT_MISSING", f"Blender did not write {label}")
    byte_count = path.stat().st_size
    max_bytes = min(contract["maxBytes"], maximum)
    if byte_count <= 0 or byte_count > max_bytes:
        fail("PRESENTATION_OUTPUT_SIZE_INVALID", f"{label} has invalid size {byte_count}")
    dimensions = image_dimensions(bpy, path, label)
    if dimensions != (contract["width"], contract["height"]):
        fail("PRESENTATION_OUTPUT_DIMENSIONS_MISMATCH", f"{label} dimensions are {dimensions}")
    return {
        "pass": contract["pass"],
        "mimeType": contract["mimeType"],
        "width": dimensions[0],
        "height": dimensions[1],
        "bytes": byte_count,
        "sha256": clay.file_sha256(path),
    }


def post_scene_audit(
    bpy: Any,
    presentation_data: dict[str, Any],
    source_state: dict[str, Any],
    source_geometry: dict[str, str],
    source_product_slots: list[dict[str, Any]],
    source_hero_camera: dict[str, Any],
    source_world_snapshot: dict[str, Any],
    source_shader_sha: str,
    material_data: dict[str, Any],
) -> dict[str, Any]:
    scene = bpy.context.scene
    presentation = presentation_data["presentation"]
    source_object_names = source_state["objectNames"]
    source_collection_names = source_state["collectionNames"]
    camera_name = presentation["camera"]["blenderObjectName"]
    light_names = [light["blenderObjectName"] for light in presentation["lights"]]
    expected_object_names = source_object_names + [camera_name] + light_names
    actual_object_names = [obj.name for obj in bpy.data.objects]
    if sorted(actual_object_names) != sorted(expected_object_names):
        unexpected = sorted(set(actual_object_names) - set(expected_object_names))
        missing = sorted(set(expected_object_names) - set(actual_object_names))
        fail(
            "PRESENTATION_OBJECT_DRIFT",
            f"Beauty scene object set drifted; unexpected={unexpected!r}, missing={missing!r}",
        )
    policy = presentation["collectionPolicy"]
    expected_collections = source_collection_names + [
        policy["cameraCollection"], policy["lightCollection"]
    ]
    if sorted(collection.name for collection in bpy.data.collections) != sorted(expected_collections):
        fail("PRESENTATION_COLLECTION_DRIFT", "Beauty scene collection set drifted")
    camera_collection = bpy.data.collections.get(policy["cameraCollection"])
    light_collection = bpy.data.collections.get(policy["lightCollection"])
    if camera_collection is None or [obj.name for obj in camera_collection.objects] != [camera_name]:
        fail("PRESENTATION_COLLECTION_DRIFT", "Beauty camera collection membership drifted")
    if light_collection is None or [obj.name for obj in light_collection.objects] != light_names:
        fail("PRESENTATION_COLLECTION_DRIFT", "Beauty light collection membership drifted")
    if scene.camera is None or scene.camera.name != camera_name:
        fail("PRESENTATION_CAMERA_INACTIVE", "Beauty camera is not active")
    hero = bpy.data.objects.get(materials.HERO_CAMERA_NAME)
    if hero is None or not canonical_equal(materials.camera_snapshot(hero), source_hero_camera):
        fail("SOURCE_CAMERA_MUTATION", "Phase 6 technical camera changed")
    if bpy.data.worlds.get(source_world_snapshot["name"]) is None:
        fail("SOURCE_WORLD_MUTATION", "Phase 6 world was removed")
    if not canonical_equal(
        materials.world_snapshot(bpy.data.worlds[source_world_snapshot["name"]]),
        source_world_snapshot,
    ):
        fail("SOURCE_WORLD_MUTATION", "Phase 6 world changed")
    if scene.world is None or scene.world.name != presentation["world"]["blenderWorldName"]:
        fail("PRESENTATION_WORLD_DRIFT", "Beauty world is not active")

    geometry_names = [item["objectId"] for item in source_state["geometryManifest"]]
    geometry = geometry_snapshot_for_names(bpy, geometry_names)
    if geometry != source_geometry:
        fail("PRESENTATION_GEOMETRY_MUTATION", "Geometry, topology, bounds, or transforms changed")
    product_objects = [bpy.data.objects[name] for name in source_state["productNames"]]
    if material_slot_snapshot(product_objects) != source_product_slots:
        fail("PHASE6_PRODUCT_MATERIAL_MUTATION", "Product material slots changed")
    shader_audit = materials.shader_parameter_audit(bpy, material_data)
    if shader_audit["sha256"] != source_shader_sha:
        fail("PHASE6_SHADER_MUTATION", "Phase 6 product shaders changed")
    if sum(len(obj.modifiers) for obj in scene.objects) != 0:
        fail("PRESENTATION_MODIFIER_FORBIDDEN", "Presentation path added a modifier")

    room_assignments = {}
    for descriptor in presentation["roomMaterials"]:
        obj = bpy.data.objects.get(descriptor["targetObjectId"])
        if (
            obj is None or len(obj.data.materials) != 1
            or obj.data.materials[0].name != descriptor["blenderMaterialName"]
        ):
            fail("PRESENTATION_ROOM_MATERIAL_DRIFT", f"{descriptor['targetObjectId']} room override drifted")
        material = obj.data.materials[0]
        room_assignments[obj.name] = {
            "materialName": material.name,
            "nodeTreeSha256": hash_canonical(materials.node_tree_snapshot(material.node_tree)),
        }

    camera = bpy.data.objects.get(camera_name)
    camera_snapshot = presentation_camera_snapshot(camera)
    light_snapshots = [
        presentation_light_snapshot(bpy.data.objects[name]) for name in light_names
    ]
    counts = {
        "objects": len(bpy.data.objects),
        "meshObjects": sum(obj.type == "MESH" for obj in bpy.data.objects),
        "meshes": len(bpy.data.meshes),
        "cameras": len(bpy.data.cameras),
        "lights": len(bpy.data.lights),
        "collections": len(bpy.data.collections),
        "modifiers": sum(len(obj.modifiers) for obj in scene.objects),
        "materials": len(bpy.data.materials),
    }
    if (
        counts["objects"] != EXPECTED_SCENE_OBJECT_COUNT
        or counts["meshObjects"] != EXPECTED_MESH_DATABLOCK_COUNT
        or counts["meshes"] != EXPECTED_MESH_DATABLOCK_COUNT
        or counts["cameras"] != EXPECTED_PRESENTATION_CAMERA_COUNT
        or counts["lights"] != EXPECTED_PRESENTATION_LIGHT_COUNT
        or counts["collections"] != EXPECTED_PRESENTATION_COLLECTION_COUNT
        or counts["modifiers"] != 0
        or counts["materials"] != 72
        or len(bpy.data.node_groups) != 0
    ):
        fail("PRESENTATION_COUNT_DRIFT", f"Beauty scene counts drifted: {counts}")
    return {
        "geometry": geometry,
        "camera": camera_snapshot,
        "lights": light_snapshots,
        "world": materials.world_snapshot(scene.world),
        "render": cycles_render_snapshot(scene),
        "shaderSha256": shader_audit["sha256"],
        "roomAssignments": room_assignments,
        "counts": counts,
    }


def result_document(
    presentation_package: dict[str, Any], outputs: list[dict[str, Any]]
) -> dict[str, Any]:
    base = {
        "kind": PRESENTATION_RESULT_KIND,
        "schemaVersion": PRESENTATION_RESULT_SCHEMA_VERSION,
        "presentationPackageKey": presentation_package["presentationPackageKey"],
        "captureKey": presentation_package["capture"]["captureKey"],
        "presentationPipelineVersion": PRESENTATION_PIPELINE_VERSION,
        "status": "succeeded",
        "outputs": outputs,
    }
    return {
        **base,
        "resultKey": f"jq-photoreal-beauty-result-v1-{hash_canonical(base)}",
    }


def render_presentation(
    paths: dict[str, Path],
    render_package: dict[str, Any],
    material_package: dict[str, Any],
    material_data: dict[str, Any],
    presentation_package: dict[str, Any],
    presentation_data: dict[str, Any],
    environment_path: Path,
) -> None:
    import bpy

    runtime = materials.runtime_identity(bpy)
    if runtime != presentation_package["capture"]["blenderRuntime"]:
        fail("BLENDER_RUNTIME_MISMATCH", "Actual Blender build or Metal runtime differs")
    if tuple(bpy.app.version[:3]) != (5, 2, 0):
        fail("UNSUPPORTED_BLENDER_VERSION", f"Blender 5.2.0 is required, found {bpy.app.version_string}")
    source_blend_sha = clay.file_sha256(paths["sourceBlend"])
    opened = bpy.ops.wm.open_mainfile(filepath=str(paths["sourceBlend"]))
    if "FINISHED" not in opened or Path(bpy.data.filepath).resolve() != paths["sourceBlend"]:
        fail("SOURCE_BLEND_OPEN_FAILED", "Blender did not open the exact Phase 6 source blend")

    source_state = materials.validate_scene_after_materials(
        bpy, render_package, material_data, environment_path
    )
    source_geometry = materials.geometry_parity_snapshot(source_state)
    product_objects = [bpy.data.objects[name] for name in source_state["productNames"]]
    source_product_slots = material_slot_snapshot(product_objects)
    source_hero_camera = materials.camera_snapshot(bpy.data.objects[materials.HERO_CAMERA_NAME])
    source_world = bpy.context.scene.world
    source_world_snapshot = materials.world_snapshot(source_world)
    source_shader_audit = materials.shader_parameter_audit(bpy, material_data)
    source_render_snapshot = source_state["render"]

    presentation = presentation_data["presentation"]
    policy = presentation["collectionPolicy"]
    for collection_name in (policy["cameraCollection"], policy["lightCollection"]):
        if bpy.data.collections.get(collection_name) is not None:
            fail("PRESENTATION_DATABLOCK_COLLISION", f"Collection {collection_name} already exists")
    camera_collection = bpy.data.collections.new(policy["cameraCollection"])
    light_collection = bpy.data.collections.new(policy["lightCollection"])
    bpy.context.scene.collection.children.link(camera_collection)
    bpy.context.scene.collection.children.link(light_collection)

    for descriptor in presentation["roomMaterials"]:
        material = create_principled_room_material(bpy, descriptor)
        obj = bpy.data.objects.get(descriptor["targetObjectId"])
        if obj is None or obj.type != "MESH":
            fail("PRESENTATION_ROOM_TARGET_MISSING", f"Missing room target {descriptor['targetObjectId']}")
        for source_material in obj.data.materials:
            if source_material is not None:
                source_material.use_fake_user = True
        obj.data.materials.clear()
        obj.data.materials.append(material)

    beauty_world = clone_presentation_world(bpy, source_world, presentation["world"])
    source_world.use_fake_user = True
    bpy.context.scene.world = beauty_world
    camera = create_presentation_camera(bpy, presentation["camera"], camera_collection)
    lights = [
        create_presentation_light(bpy, descriptor, light_collection)
        for descriptor in presentation["lights"]
    ]
    bpy.context.scene.camera = camera
    configure_render(bpy.context.scene, presentation_package["capture"])
    device_snapshot = configure_cycles_metal(
        bpy, presentation_package["capture"]["renderPolicy"]
    )

    master_contract, beauty_contract = presentation_package["capture"]["outputs"]
    configure_master_image_settings(bpy.context.scene, master_contract)
    bpy.context.scene.render.filepath = "//photoreal-beauty-master.png"

    before_render = post_scene_audit(
        bpy, presentation_data, source_state, source_geometry, source_product_slots,
        source_hero_camera, source_world_snapshot, source_shader_audit["sha256"], material_data,
    )
    bpy.ops.wm.save_as_mainfile(filepath=str(paths["blend"]), check_existing=False)
    if not paths["blend"].is_file() or paths["blend"].stat().st_size <= 0:
        fail("PRESENTATION_BLEND_OUTPUT_MISSING", "Blender did not save the beauty blend")

    bpy.context.scene.render.filepath = str(paths["master"])
    bpy.ops.render.render(write_still=True)
    master_output = assert_output_file(
        bpy, paths["master"], master_contract, MAX_MASTER_BYTES, "photoreal master"
    )
    render_result = bpy.data.images.get("Render Result")
    if render_result is None:
        fail("RENDER_RESULT_MISSING", "Cycles did not retain Render Result")
    configure_webp_image_settings(bpy.context.scene, beauty_contract)
    bpy.context.scene.render.filepath = str(paths["beauty"])
    render_result.save_render(filepath=str(paths["beauty"]), scene=bpy.context.scene)
    beauty_output = assert_output_file(
        bpy, paths["beauty"], beauty_contract, MAX_BEAUTY_BYTES, "photoreal beauty"
    )
    if master_output["sha256"] == beauty_output["sha256"]:
        fail("OUTPUT_ENCODING_COLLISION", "PNG master and WebP output unexpectedly match")

    # Restore the saved master-output contract before the final structural audit.
    configure_master_image_settings(bpy.context.scene, master_contract)
    bpy.context.scene.render.filepath = "//photoreal-beauty-master.png"
    after_render = post_scene_audit(
        bpy, presentation_data, source_state, source_geometry, source_product_slots,
        source_hero_camera, source_world_snapshot, source_shader_audit["sha256"], material_data,
    )
    if before_render != after_render:
        changed = {
            key: {
                "beforeSha256": hash_canonical(before_render[key]),
                "afterSha256": hash_canonical(after_render[key]),
            }
            for key in before_render
            if before_render[key] != after_render[key]
        }
        fail(
            "PRESENTATION_RENDER_MUTATION",
            f"Rendering changed audited presentation fields: {changed!r}",
        )
    reopened = bpy.ops.wm.open_mainfile(filepath=str(paths["blend"]))
    if "FINISHED" not in reopened or Path(bpy.data.filepath).resolve() != paths["blend"]:
        fail("PRESENTATION_BLEND_REOPEN_FAILED", "Blender did not reopen the saved beauty blend")
    reopened_audit = post_scene_audit(
        bpy, presentation_data, source_state, source_geometry, source_product_slots,
        source_hero_camera, source_world_snapshot, source_shader_audit["sha256"], material_data,
    )
    if reopened_audit != before_render:
        fail("PRESENTATION_BLEND_PARITY_FAILED", "Saved beauty blend differs from audited scene")
    if clay.file_sha256(paths["sourceBlend"]) != source_blend_sha:
        fail("SOURCE_BLEND_MUTATION", "Phase 6 source blend changed on disk")

    for output, contract in ((master_output, master_contract), (beauty_output, beauty_contract)):
        output["objectKey"] = (
            f"{presentation_package['capture']['captureKey']}/{contract['filename']}"
        )
    output_values = [master_output, beauty_output]
    result_value = result_document(presentation_package, output_values)
    write_json(paths["result"], result_value)
    report = {
        "kind": "jq-local-blender-photoreal-beauty-report",
        "schemaVersion": 1,
        "status": "succeeded",
        "blenderRuntime": runtime,
        "presentationPackageKey": presentation_package["presentationPackageKey"],
        "captureKey": presentation_package["capture"]["captureKey"],
        "presentationPipelineVersion": PRESENTATION_PIPELINE_VERSION,
        "resultKey": result_value["resultKey"],
        "source": {
            "materialPackageKey": material_package["materialPackageKey"],
            "materialCaptureKey": material_package["capture"]["captureKey"],
            "blendSha256": source_blend_sha,
            "geometry": source_geometry,
            "heroCameraSha256": hash_canonical(source_hero_camera),
            "worldSha256": hash_canonical(source_world_snapshot),
            "renderSettingsSha256": hash_canonical(source_render_snapshot),
            "shaderParametersSha256": source_shader_audit["sha256"],
        },
        "parity": {
            "geometry": True, "topology": True, "bounds": True,
            "transforms": True, "productMaterials": True,
            "phase6Camera": True, "phase6World": True,
            "phase6ShaderParameters": True, "sourceBlendFile": True,
        },
        "presentation": {
            "camera": reopened_audit["camera"],
            "lights": reopened_audit["lights"],
            "world": reopened_audit["world"],
            "roomAssignments": reopened_audit["roomAssignments"],
            "render": reopened_audit["render"],
            "cyclesDevices": device_snapshot,
        },
        "counts": reopened_audit["counts"],
        "outputs": output_values,
    }
    write_json(paths["report"], report)


def parse_arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render the additive TV01 photoreal presentation baseline"
    )
    parser.add_argument("--geometry-package", required=True)
    parser.add_argument("--materials-package", required=True)
    parser.add_argument("--presentation-package", required=True)
    parser.add_argument("--project-root")
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--source-blend")
    parser.add_argument("--output-dir")
    parser.add_argument("--blend")
    parser.add_argument("--master")
    parser.add_argument("--beauty")
    parser.add_argument("--result")
    parser.add_argument("--report")
    raw_arguments = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    arguments = parser.parse_args(raw_arguments)
    render_values = (
        arguments.source_blend, arguments.output_dir, arguments.blend,
        arguments.master, arguments.beauty, arguments.result, arguments.report,
    )
    if arguments.validate_only:
        if any(render_values):
            parser.error("--validate-only cannot accept render output arguments")
    elif not all(render_values):
        parser.error(
            "rendering requires source blend, output directory, blend, master, beauty, result, and report"
        )
    return arguments


def resolve_paths(arguments: argparse.Namespace) -> dict[str, Path | None]:
    def absolute(value: str, label: str) -> Path:
        candidate = Path(value).expanduser()
        if not candidate.is_absolute():
            fail("RELATIVE_CLI_PATH", f"{label} must be absolute")
        return candidate.resolve(strict=False)

    geometry_package = absolute(arguments.geometry_package, "--geometry-package")
    material_package = absolute(arguments.materials_package, "--materials-package")
    presentation_package = absolute(arguments.presentation_package, "--presentation-package")
    project_root = (
        absolute(arguments.project_root, "--project-root")
        if arguments.project_root else Path(__file__).resolve().parents[2]
    )
    if not project_root.is_dir():
        fail("INVALID_PROJECT_ROOT", "Project root is not a directory")
    input_paths = [geometry_package, material_package, presentation_package]
    if len(set(input_paths)) != 3:
        fail("INPUT_PATH_COLLISION", "All three renderer-neutral packages must be distinct")
    paths: dict[str, Path | None] = {
        "package": geometry_package,
        "materialsPackage": material_package,
        "presentationPackage": presentation_package,
        "projectRoot": project_root,
        "sourceBlend": None,
        "outputDir": None,
        **{key: None for key in EXPECTED_OUTPUT_NAMES},
    }
    if arguments.validate_only:
        return paths

    source_blend = absolute(arguments.source_blend, "--source-blend")
    output_dir = absolute(arguments.output_dir, "--output-dir")
    output_paths = {
        "blend": absolute(arguments.blend, "--blend"),
        "master": absolute(arguments.master, "--master"),
        "beauty": absolute(arguments.beauty, "--beauty"),
        "result": absolute(arguments.result, "--result"),
        "report": absolute(arguments.report, "--report"),
    }
    for key, path in output_paths.items():
        filename = EXPECTED_OUTPUT_NAMES[key]
        if path.parent != output_dir or path.name != filename:
            fail("INVALID_OUTPUT_PATH", f"Presentation output must be {output_dir / filename}")
    all_paths = input_paths + [source_blend] + list(output_paths.values())
    if len(set(all_paths)) != len(all_paths):
        fail("CLI_PATH_COLLISION", "Every presentation input/output path must be distinct")
    if source_blend.name != "TV01-materials-preview.blend" or not source_blend.is_file():
        fail("INVALID_SOURCE_BLEND", "Source must be the existing TV01-materials-preview.blend")
    if output_dir.exists() and not output_dir.is_dir():
        fail("INVALID_OUTPUT_DIRECTORY", "Output path exists but is not a directory")
    for output_path in output_paths.values():
        if output_path.exists():
            fail("STALE_OUTPUT_FORBIDDEN", f"Fresh output already exists: {output_path.name}")
    paths.update({"sourceBlend": source_blend, "outputDir": output_dir, **output_paths})
    return paths


def main(argv: list[str]) -> int:
    arguments = parse_arguments(argv)
    paths = resolve_paths(arguments)
    package_path = paths["package"]
    material_path = paths["materialsPackage"]
    presentation_path = paths["presentationPackage"]
    project_root = paths["projectRoot"]
    assert isinstance(package_path, Path)
    assert isinstance(material_path, Path)
    assert isinstance(presentation_path, Path)
    assert isinstance(project_root, Path)

    # Every renderer-neutral contract is completely validated before bpy is
    # imported or the Phase 6 source scene is opened.
    render_package, package_raw = materials.load_strict_json(package_path, "geometry package")
    validated_geometry = clay.validate_package(render_package)
    environment_path = clay.validate_assets(render_package, validated_geometry, project_root)
    material_package, material_raw = materials.load_strict_json(material_path, "material package")
    material_data = materials.validate_material_package(
        render_package, material_package, package_raw
    )
    presentation_package, _ = materials.load_strict_json(
        presentation_path, "presentation package"
    )
    presentation_data = validate_presentation_package(
        render_package, material_package, material_data,
        presentation_package, package_raw, material_raw,
    )
    if arguments.validate_only:
        print(json.dumps({
            "valid": True,
            "presentationPackageKey": presentation_package["presentationPackageKey"],
            "captureKey": presentation_package["capture"]["captureKey"],
            "lightCount": len(presentation_package["presentation"]["lights"]),
        }, separators=(",", ":")))
        return 0

    output_dir = paths["outputDir"]
    assert isinstance(output_dir, Path)
    if not output_dir.exists():
        output_dir.mkdir(parents=True, exist_ok=False)
    expected_inputs = {
        package_path.name, material_path.name, presentation_path.name
    }
    actual_entries = {path.name for path in output_dir.iterdir()}
    if actual_entries != expected_inputs:
        fail(
            "OUTPUT_DIRECTORY_NOT_FRESH",
            "Presentation output directory must contain only its three input packages",
        )
    required_paths = {key: value for key, value in paths.items() if isinstance(value, Path)}
    render_presentation(
        required_paths, render_package, material_package, material_data,
        presentation_package, presentation_data, environment_path,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv))
    except PresentationWorkerError as error:
        print(f"JQ_PRESENTATION_WORKER_ERROR [{error.code}] {error}", file=sys.stderr)
        raise SystemExit(2)
    except (materials.MaterialWorkerError, clay.WorkerError) as error:
        print(f"JQ_PRESENTATION_WORKER_ERROR [{error.code}] {error}", file=sys.stderr)
        raise SystemExit(2)
    except SystemExit:
        raise
    except Exception as error:
        print(f"JQ_PRESENTATION_WORKER_ERROR [UNEXPECTED] {error}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise SystemExit(3)
