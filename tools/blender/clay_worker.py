#!/usr/bin/env python3
"""Strict Blender 5.2 clay translator for the Drawing 4 TV01 package.

The accepted JQ package is the only geometry authority.  This worker validates
that package, translates its exact world-space bounds, and renders it.  It does
not derive, repair, resize, clamp, or substitute product geometry.
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


INCHES_TO_METERS = 0.0254
PACKAGE_KIND = "jq-guided-blender-render-package"
RESULT_KIND = "jq-guided-blender-render-result"
PACKAGE_SCHEMA_VERSION = 3
RESULT_SCHEMA_VERSION = 1
RENDER_CONTRACT_VERSION = 1
PRIMITIVE_CONTRACT_VERSION = 2
PIPELINE_VERSION = "2026.08-tv-puck-light-clay-worker-v1"
SCENE_VERSION = "clear-wall-v1"
CAMERA_VERSION = "hero-front-v1"
MATERIAL_LIBRARY_VERSION = "jq-materials-v1"
ASSET_MANIFEST_SHA256 = (
    "73b57b0ca24c4ecc6fc0af47ef5f3a47159ef9b57dcb2ba231c34492ad893284"
)
MATERIAL_SOURCE_SHA256 = (
    "299b321424bf7665f413c2740c5238bcd7f7e1b0d412ab5c1db16339e4d772cd"
)
ENVIRONMENT_SHA256 = (
    "49db5b6e13c5b5239d8aca84c055c586dfc71aeaf1e1db64487f5bf8bab66db2"
)
EXPECTED_REQUEST_KEY = (
    "jq-blender-v1-93be24a7f4d9031edef36401f38c2168907688f19065d1d04e2b466f914f2272"
)
EXPECTED_RENDER_KEY = (
    "jq-blender-package-v1-5af4ea52a32b54f80541e61d305e1ce1e4ce671c845cfce33a4980e080e6ad99"
)
EXPECTED_IDENTITY_FINGERPRINTS = {
    "geometryFingerprint": "jq-guided-geometry-v1-2J95JPTIW69O4",
    "selectionFingerprint": "jq-guided-selection-v1-0mnaift",
    "descriptorFingerprint": "jq-guided-snapshot-descriptors-v1-1vl3c3s",
    "materialFingerprint": "jq-guided-snapshot-materials-v1-1fs7psz",
    "cameraFingerprint": "jq-guided-snapshot-camera-v1-1kj9fv5",
}
EXPECTED_COMPONENT_COUNT = 46
EXPECTED_SUBMESH_OBJECT_COUNT = 80
EXPECTED_CONSTRAINT_COUNT = 7
MAX_PACKAGE_BYTES = 16 * 1024 * 1024
MAX_BEAUTY_BYTES = 32 * 1024 * 1024
BOUNDS_TOLERANCE = 1e-9

TOP_LEVEL_KEYS = {
    "kind", "schemaVersion", "contractVersion", "primitiveContractVersion",
    "pipelineVersion", "identity", "sourceUnits", "targetUnits",
    "coordinateSystem", "render", "scene", "camera", "room",
    "installation", "constraints", "components", "materials", "clayMaterials",
    "requestKey", "renderKey", "readiness", "audit",
}
IDENTITY_KEYS = {
    "productId", "layoutId", "installationMode", "engineVersion",
    "geometryFingerprint", "selectionFingerprint", "descriptorFingerprint",
    "materialFingerprint", "cameraFingerprint", "jobSchemaVersion",
    "packageSchemaVersion", "renderContractVersion", "primitiveContractVersion",
    "materialContractVersion", "pipelineVersion", "materialLibraryVersion",
    "sceneVersion", "cameraVersion", "assetManifestSha256",
    "materialSourceSha256", "outputProfile",
}
RENDER_KEYS = {
    "profileId", "engine", "blenderEngine", "materialMode", "colorManagement",
    "width", "height", "resolutionPercentage", "samples", "engineSettings",
    "film", "imageSettings", "renderOptions", "passes", "outputContracts",
    "sceneVersion", "cameraVersion", "materialCatalog", "materialLibraryVersion",
    "materialContractVersion", "assetManifest", "materialSourceSha256",
}
SCENE_KEYS = {
    "sceneVersion", "shell", "environment", "assetManifest", "decorPolicy",
}
CAMERA_KEYS = {
    "cameraVersion", "type", "lensMm", "sensorWidthMm", "fitMargin",
    "sensorFit", "depthOfField", "position", "target", "up", "clipStartM",
    "clipEndM", "framingBounds",
}
ROOM_KEYS = {
    "layoutId", "wallWidthIn", "ceilingHeightIn", "desiredDepthIn",
    "floorPlaneYIn", "rearWallPlaneZIn", "cameraIntent", "planes", "features",
    "exclusionVolumes",
}
INSTALLATION_KEYS = {"mode", "casework", "treatments", "anchors", "invariants"}
COMPONENT_KEYS = {
    "componentId", "descriptorSetId", "installationId", "zoneId", "parentId",
    "hostId", "role", "geometryVariant", "sourceMaterialSlot", "materialId",
    "sourceTransform", "sourceWorldBounds", "blenderWorldBounds", "metadata",
    "submeshes",
}
SUBMESH_KEYS = {
    "submeshId", "geometry", "grainRole", "edgeVisible", "sourceMaterialSlot",
    "materialId", "sourceLocalBounds", "sourceWorldBounds",
    "blenderWorldBounds", "profileGeometry", "primitiveGeometry",
}
CONSTRAINT_KEYS = {
    "constraintId", "kind", "sourceWorldBounds", "blenderWorldBounds",
    "clearance",
}
MATERIAL_KEYS = {
    "sourceMaterialSlot", "materialId", "clayMaterialId", "resolver", "status",
    "materialContractVersion", "sourceSha256", "definition",
}
CLAY_MATERIAL_KEYS = {"materialId", "libraryVersion", "definition"}
CROWN_PROFILE_KEYS = {
    "schemaVersion", "kind", "profileId", "contour", "outlineUnits", "outline",
    "crossSection", "extrusion",
}
CYLINDER_GEOMETRY_KEYS = {
    "schemaVersion", "kind", "axis", "center", "radius", "innerRadius",
    "depth", "segments", "capStyle", "surfaceRole",
}
SAFE_METADATA_KEYS = {
    "attachment", "backPlaneZ", "catalogVersion", "category", "derivation",
    "diagonal", "fieldKind", "finishIndependent", "frontPlaneZ", "hardware",
    "hardwareType", "latchSide", "lightType", "mountingCenter",
    "mountingCenters", "mountingMode", "nominalLength", "orientation",
    "outletLocation", "placement", "profileGeometry", "projection", "proxyMode",
    "quantityIndex", "quantityPerFront", "sectionId", "variantId",
    "visualDimensions", "warmth",
}
CASEWORK_SLOTS = {
    "back", "cabinet_finish", "cabinet_interior", "case", "front", "side", "toe",
}
SPECIAL_SLOTS = {"glass", "hardware", "led", "screen"}
SUPPORTED_MATERIAL_SLOTS = CASEWORK_SLOTS | SPECIAL_SLOTS
CLAY_BY_SOURCE_SLOT = {
    **{slot: "clay-casework" for slot in CASEWORK_SLOTS},
    "glass": "clay-glass",
    "hardware": "clay-hardware",
    "led": "clay-led",
    "screen": "clay-screen",
}
CLAY_DEFINITIONS = {
    "clay-casework": {
        "family": "principled-clay", "baseColor": [0.52, 0.47, 0.42, 1],
        "metallic": 0, "roughness": 0.68, "transmissionWeight": 0, "alpha": 1,
        "emissionColor": [0, 0, 0, 1], "emissionStrength": 0,
    },
    "clay-glass": {
        "family": "principled-clay", "baseColor": [0.72, 0.78, 0.8, 0.32],
        "metallic": 0, "roughness": 0.14, "transmissionWeight": 0.62,
        "alpha": 0.32, "emissionColor": [0, 0, 0, 1], "emissionStrength": 0,
    },
    "clay-hardware": {
        "family": "principled-clay", "baseColor": [0.055, 0.06, 0.065, 1],
        "metallic": 0.18, "roughness": 0.42, "transmissionWeight": 0,
        "alpha": 1, "emissionColor": [0, 0, 0, 1], "emissionStrength": 0,
    },
    "clay-led": {
        "family": "principled-clay", "baseColor": [1, 0.82, 0.58, 1],
        "metallic": 0, "roughness": 0.38, "transmissionWeight": 0,
        "alpha": 1, "emissionColor": [1, 0.72, 0.42, 1], "emissionStrength": 2.5,
    },
    "clay-screen": {
        "family": "principled-clay", "baseColor": [0.008, 0.01, 0.012, 1],
        "metallic": 0.04, "roughness": 0.24, "transmissionWeight": 0,
        "alpha": 1, "emissionColor": [0, 0, 0, 1], "emissionStrength": 0,
    },
}
SUPPORTED_GEOMETRY = {"box", "crown_profile_extrusion", "cylinder"}
IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/+:\-]{0,254}$")
SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
RENDER_KEY_RE = re.compile(r"^jq-blender-package-v1-[a-f0-9]{64}$")

# Reject unversioned data anywhere in the package.  Context-specific structures
# below use exact-key checks as well; this global allowlist covers sanitized JQ
# metadata whose field combinations vary by accepted component role.
KNOWN_JSON_KEYS = set().union(
    TOP_LEVEL_KEYS,
    IDENTITY_KEYS,
    RENDER_KEYS,
    SCENE_KEYS,
    CAMERA_KEYS,
    ROOM_KEYS,
    INSTALLATION_KEYS,
    COMPONENT_KEYS,
    SUBMESH_KEYS,
    CONSTRAINT_KEYS,
    MATERIAL_KEYS,
    CLAY_MATERIAL_KEYS,
    CROWN_PROFILE_KEYS,
    SAFE_METADATA_KEYS,
    {
        "source", "target", "name", "handedness", "axes", "units",
        "pointMapping", "matrix4RowMajor", "x", "y", "z", "min", "max",
        "profileId", "filename", "mimeType", "maxBytes", "path", "sha256",
        "shell", "environment", "kind", "wallWidthIn", "ceilingHeightIn",
        "rearWallPlaneZIn", "floorPlaneYIn", "strength", "decorPolicy",
        "pass", "blenderEngine", "resolutionPercentage", "imageFormat",
        "colorMode", "colorDepth", "quality", "filmTransparent",
        "pixelAspectX", "pixelAspectY", "exposure", "gamma", "dither",
        "useCompositing", "useSequencer", "useFileExtension", "taaRenderSamples",
        "useRaytracing", "useShadows", "useFastGi", "useTaaReprojection",
        "displayDevice", "viewTransform", "look", "useCurveMapping", "transparent",
        "ditherIntensity", "fileFormat", "useStamp", "useBorder",
        "useCropToBorder", "floorDepthIn", "wallSurface",
        "floorSurface", "interpolation", "colorSpace", "rotationEuler",
        "floor", "ceiling", "rearWall", "leftWall",
        "rightWall", "id", "axis", "value", "features", "planes",
        "exclusionVolumes", "cameraIntent", "desiredDepthIn", "casework",
        "treatments", "anchors", "invariants", "width", "widthStep",
        "widthQuantized", "bodyHeight", "overallHeight", "depth", "leftPlaneX",
        "rightPlaneX", "bottomPlaneY", "bodyBottomPlaneY", "topPlaneY",
        "backPlaneZ", "frontPlaneZ", "minX", "minY", "minZ", "maxX",
        "maxY", "maxZ", "size", "height", "left", "right", "base", "top",
        "bottom",
        "boundaryKind", "scribed", "selection", "floorY", "bottomY", "backZ",
        "frontZ", "centerX", "mountingHeight", "noGlobalScaling", "rootScale",
        "clearance", "serviceClearance", "ventilationClearance",
        "noDecorativeFrame", "descriptorSetCount", "physicalComponentCount",
        "renderedComponentCount", "constraintCount", "primitiveRecordCount",
        "valid", "prototypeRenderAllowed", "customerBeautyRenderApproved",
        "geometryApproval", "materialApproval", "requiredAssets", "blockers",
        "code", "message", "status", "resolver", "definition",
        "materialContractVersion", "sourceSha256", "family", "baseColor",
        "roughness", "metallic", "transmission", "ior", "repeatInches", "maps",
        "map", "normalMap", "roughnessMap", "aoMap", "label", "legacy",
        "colorTemperatureSource", "transmissionWeight", "alpha", "emissionColor",
        "emissionStrength", "libraryVersion", "clayMaterialId", "clayMaterials",
        "crossSection", "heightAxis", "projectionAxis",
        "mountingPlane", "projectionDirection", "extrusion", "outline",
        "outlineUnits", "contour", "projection", "frameWidth", "frameDepth",
        "panelDepth", "panelRecess", "minimumCenterField", "nominalFrameWidth",
        "centerFieldBounds", "solidRegions", "fieldRegion", "bounds", "style", "basis", "translation",
        "hostFace", "componentFace", "hostPlane", "hostCoordinate",
        "horizontalAnchor", "verticalAnchor", "edgeOffsetMm", "mirrored",
        "center", "radius", "innerRadius", "segments", "capStyle", "surfaceRole",
    },
)


class WorkerError(RuntimeError):
    """An expected fail-closed boundary error."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def fail(code: str, message: str) -> None:
    raise WorkerError(code, message)


def exact_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        actual = sorted(value) if isinstance(value, dict) else type(value).__name__
        fail("INVALID_PACKAGE_SHAPE", f"{label} keys are invalid: {actual!r}")
    return value


def finite_number(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        fail("NONFINITE_NUMBER", f"{label} must be a finite JSON number")
    result = float(value)
    if not math.isfinite(result):
        fail("NONFINITE_NUMBER", f"{label} must be finite")
    return result


def positive_number(value: Any, label: str) -> float:
    result = finite_number(value, label)
    if result <= 0:
        fail("INVALID_POSITIVE_NUMBER", f"{label} must be greater than zero")
    return result


def integer(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        fail("INVALID_INTEGER", f"{label} must be an integer")
    return value


def safe_identifier(value: Any, label: str) -> str:
    if not isinstance(value, str) or not IDENTIFIER_RE.fullmatch(value):
        fail("INVALID_IDENTIFIER", f"{label} is not a safe deterministic ID")
    return value


def sha256_string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not SHA256_RE.fullmatch(value):
        fail("INVALID_SHA256", f"{label} must be a lowercase SHA-256 digest")
    return value


def reject_nonfinite_and_unknown_keys(value: Any, path: str = "package") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str) or key not in KNOWN_JSON_KEYS:
                fail("UNKNOWN_PACKAGE_KEY", f"Unknown package key {path}.{key}")
            reject_nonfinite_and_unknown_keys(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_nonfinite_and_unknown_keys(child, f"{path}[{index}]")
    elif isinstance(value, float) and not math.isfinite(value):
        fail("NONFINITE_NUMBER", f"{path} is not finite")
    elif not isinstance(value, (str, int, float, bool, type(None))):
        fail("INVALID_JSON_VALUE", f"{path} has an unsupported value")


def load_strict_json(path: Path) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        fail("PACKAGE_READ_FAILED", f"Cannot read package JSON: {error}")
    if not raw or len(raw) > MAX_PACKAGE_BYTES:
        fail("INVALID_PACKAGE_SIZE", "Package JSON is empty or exceeds 16 MiB")

    def reject_constant(value: str) -> None:
        fail("NONFINITE_NUMBER", f"Package contains non-finite number {value}")

    def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                fail("DUPLICATE_JSON_KEY", f"Package repeats JSON key {key}")
            result[key] = value
        return result

    try:
        parsed = json.loads(
            raw.decode("utf-8"),
            parse_constant=reject_constant,
            object_pairs_hook=unique_object,
        )
    except UnicodeDecodeError as error:
        fail("INVALID_PACKAGE_JSON", f"Package is not UTF-8: {error}")
    except json.JSONDecodeError as error:
        fail("INVALID_PACKAGE_JSON", f"Package JSON is malformed: {error}")
    if not isinstance(parsed, dict):
        fail("INVALID_PACKAGE_JSON", "Package root must be an object")
    return parsed


def point(value: Any, label: str) -> dict[str, float]:
    item = exact_keys(value, {"x", "y", "z"}, label)
    return {axis: finite_number(item[axis], f"{label}.{axis}") for axis in "xyz"}


def bounds(value: Any, label: str) -> dict[str, dict[str, float]]:
    item = exact_keys(value, {"min", "max"}, label)
    minimum = point(item["min"], f"{label}.min")
    maximum = point(item["max"], f"{label}.max")
    for axis in "xyz":
        if maximum[axis] <= minimum[axis]:
            fail("MALFORMED_BOUNDS", f"{label}.{axis} bounds are not ordered")
    return {"min": minimum, "max": maximum}


def close(left: float, right: float, tolerance: float = BOUNDS_TOLERANCE) -> bool:
    return math.isclose(left, right, rel_tol=0.0, abs_tol=tolerance)


def same_bounds(
    left: dict[str, dict[str, float]],
    right: dict[str, dict[str, float]],
) -> bool:
    return all(
        close(left[side][axis], right[side][axis])
        for side in ("min", "max")
        for axis in "xyz"
    )


def source_point_to_blender(source: dict[str, float]) -> dict[str, float]:
    return {
        "x": source["x"] * INCHES_TO_METERS,
        "y": -source["z"] * INCHES_TO_METERS,
        "z": source["y"] * INCHES_TO_METERS,
    }


def source_bounds_to_blender(
    source: dict[str, dict[str, float]],
) -> dict[str, dict[str, float]]:
    converted = [
        source_point_to_blender({"x": x, "y": y, "z": z})
        for x in (source["min"]["x"], source["max"]["x"])
        for y in (source["min"]["y"], source["max"]["y"])
        for z in (source["min"]["z"], source["max"]["z"])
    ]
    return {
        "min": {axis: min(item[axis] for item in converted) for axis in "xyz"},
        "max": {axis: max(item[axis] for item in converted) for axis in "xyz"},
    }


def validate_bounds_pair(
    source_value: Any,
    blender_value: Any,
    label: str,
) -> tuple[dict[str, dict[str, float]], dict[str, dict[str, float]]]:
    source = bounds(source_value, f"{label}.sourceWorldBounds")
    blender = bounds(blender_value, f"{label}.blenderWorldBounds")
    if not same_bounds(source_bounds_to_blender(source), blender):
        fail("COORDINATE_BOUNDS_MISMATCH", f"{label} Blender bounds drifted from JQ bounds")
    return source, blender


def union_bounds(items: Iterable[dict[str, dict[str, float]]]) -> dict[str, dict[str, float]]:
    values = list(items)
    if not values:
        fail("EMPTY_BOUNDS_SET", "Cannot union an empty bounds set")
    return {
        "min": {axis: min(item["min"][axis] for item in values) for axis in "xyz"},
        "max": {axis: max(item["max"][axis] for item in values) for axis in "xyz"},
    }


def orientation(a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def point_on_segment(
    a: tuple[float, float], b: tuple[float, float], c: tuple[float, float]
) -> bool:
    return (
        min(a[0], c[0]) <= b[0] <= max(a[0], c[0])
        and min(a[1], c[1]) <= b[1] <= max(a[1], c[1])
        and close(orientation(a, b, c), 0.0, 1e-12)
    )


def segments_intersect(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
    d: tuple[float, float],
) -> bool:
    o1, o2 = orientation(a, b, c), orientation(a, b, d)
    o3, o4 = orientation(c, d, a), orientation(c, d, b)
    if (o1 > 0 > o2 or o1 < 0 < o2) and (o3 > 0 > o4 or o3 < 0 < o4):
        return True
    return any(
        close(o, 0.0, 1e-12) and point_on_segment(p, q, r)
        for o, p, q, r in (
            (o1, a, c, b), (o2, a, d, b), (o3, c, a, d), (o4, c, b, d)
        )
    )


def validate_crown_profile(
    profile_value: Any,
    source: dict[str, dict[str, float]],
    blender: dict[str, dict[str, float]],
    label: str,
) -> dict[str, Any]:
    profile = exact_keys(profile_value, CROWN_PROFILE_KEYS, f"{label}.profileGeometry")
    if (
        profile["schemaVersion"] != 1
        or profile["kind"] != "crown_profile_extrusion"
        or profile["outlineUnits"] != "normalized"
    ):
        fail("UNSUPPORTED_CROWN_PROFILE", f"{label} crown profile version or kind is unsupported")
    safe_identifier(profile["profileId"], f"{label}.profileId")
    safe_identifier(profile["contour"], f"{label}.contour")
    cross = exact_keys(
        profile["crossSection"],
        {"heightAxis", "projectionAxis", "mountingPlane", "projectionDirection"},
        f"{label}.crossSection",
    )
    extrusion = exact_keys(
        profile["extrusion"], {"axis", "min", "max"}, f"{label}.extrusion"
    )
    if cross["heightAxis"] != "y":
        fail("UNSUPPORTED_CROWN_PROFILE", f"{label} height axis must be source y")
    if cross["projectionAxis"] not in {"x", "z"}:
        fail("UNSUPPORTED_CROWN_PROFILE", f"{label} projection axis is unsupported")
    if extrusion["axis"] not in {"x", "z"} or extrusion["axis"] == cross["projectionAxis"]:
        fail("UNSUPPORTED_CROWN_PROFILE", f"{label} extrusion axis is unsupported")
    finite_number(cross["mountingPlane"], f"{label}.mountingPlane")
    direction = finite_number(cross["projectionDirection"], f"{label}.projectionDirection")
    if direction not in {-1.0, 1.0}:
        fail("MALFORMED_CROWN_PROFILE", f"{label} projection direction must be -1 or 1")
    extrusion_min = finite_number(extrusion["min"], f"{label}.extrusion.min")
    extrusion_max = finite_number(extrusion["max"], f"{label}.extrusion.max")
    if extrusion_max <= extrusion_min:
        fail("MALFORMED_CROWN_PROFILE", f"{label} extrusion range is degenerate")
    source_extent = source["max"][extrusion["axis"]] - source["min"][extrusion["axis"]]
    if not close(extrusion_max - extrusion_min, source_extent, 1e-8):
        fail("MALFORMED_CROWN_PROFILE", f"{label} extrusion range contradicts package bounds")

    outline_value = profile["outline"]
    if not isinstance(outline_value, list) or not 3 <= len(outline_value) <= 64:
        fail("MALFORMED_CROWN_PROFILE", f"{label} outline must contain 3 through 64 points")
    outline: list[tuple[float, float]] = []
    for index, item in enumerate(outline_value):
        item = exact_keys(item, {"height", "projection"}, f"{label}.outline[{index}]")
        height = finite_number(item["height"], f"{label}.outline[{index}].height")
        projection = finite_number(
            item["projection"], f"{label}.outline[{index}].projection"
        )
        if not (0.0 <= height <= 1.0 and 0.0 <= projection <= 1.0):
            fail("MALFORMED_CROWN_PROFILE", f"{label} outline leaves normalized bounds")
        outline.append((projection, height))
    if len(set(outline)) != len(outline):
        fail("MALFORMED_CROWN_PROFILE", f"{label} outline repeats a vertex")
    if not (
        close(min(point_[0] for point_ in outline), 0.0)
        and close(max(point_[0] for point_ in outline), 1.0)
        and close(min(point_[1] for point_ in outline), 0.0)
        and close(max(point_[1] for point_ in outline), 1.0)
    ):
        fail("MALFORMED_CROWN_PROFILE", f"{label} outline does not span exact bounds")
    area = sum(
        outline[index][0] * outline[(index + 1) % len(outline)][1]
        - outline[(index + 1) % len(outline)][0] * outline[index][1]
        for index in range(len(outline))
    ) / 2.0
    if close(area, 0.0, 1e-12):
        fail("MALFORMED_CROWN_PROFILE", f"{label} outline is degenerate")
    for first in range(len(outline)):
        first_next = (first + 1) % len(outline)
        for second in range(first + 1, len(outline)):
            second_next = (second + 1) % len(outline)
            if first in {second, second_next} or first_next in {second, second_next}:
                continue
            if segments_intersect(
                outline[first], outline[first_next], outline[second], outline[second_next]
            ):
                fail("MALFORMED_CROWN_PROFILE", f"{label} outline self-intersects")

    # Both source-space and exact Blender-space envelopes must have positive
    # extents on the authored axes.  Vertex construction uses the latter.
    blender_projection_axis = "x" if cross["projectionAxis"] == "x" else "y"
    blender_extrusion_axis = "x" if extrusion["axis"] == "x" else "y"
    if blender_projection_axis == blender_extrusion_axis:
        fail("MALFORMED_CROWN_PROFILE", f"{label} transformed axes overlap")
    for axis in (blender_projection_axis, blender_extrusion_axis, "z"):
        if blender["max"][axis] <= blender["min"][axis]:
            fail("MALFORMED_CROWN_PROFILE", f"{label} transformed profile is degenerate")
    return profile


def validate_cylinder_geometry(
    geometry_value: Any,
    blender: dict[str, dict[str, float]],
    source_material_slot: str,
    component_role: str,
    label: str,
) -> dict[str, Any]:
    geometry = exact_keys(
        geometry_value, CYLINDER_GEOMETRY_KEYS, f"{label}.primitiveGeometry"
    )
    if geometry["schemaVersion"] != 1 or geometry["kind"] != "cylinder":
        fail("UNSUPPORTED_CYLINDER", f"{label} cylinder schema or kind is unsupported")
    if geometry["axis"] != "z":
        fail("UNSUPPORTED_CYLINDER_AXIS", f"{label} cylinder axis must be Blender z")
    center = point(geometry["center"], f"{label}.primitiveGeometry.center")
    radius = positive_number(geometry["radius"], f"{label}.primitiveGeometry.radius")
    inner_radius = finite_number(
        geometry["innerRadius"], f"{label}.primitiveGeometry.innerRadius"
    )
    depth = positive_number(geometry["depth"], f"{label}.primitiveGeometry.depth")
    if inner_radius < 0 or inner_radius >= radius:
        fail("INVALID_CYLINDER_RADIUS", f"{label} inner radius must be in [0, radius)")
    if integer(geometry["segments"], f"{label}.primitiveGeometry.segments") != 32:
        fail("UNSUPPORTED_CYLINDER_SEGMENTS", f"{label} cylinder must use 32 segments")

    cap_style = geometry["capStyle"]
    surface_role = geometry["surfaceRole"]
    if inner_radius > 0:
        valid_surface = cap_style == "annular" and surface_role == "housing"
        valid_material = source_material_slot == "hardware"
    else:
        valid_surface = cap_style == "closed" and surface_role == "emissive_lens"
        valid_material = source_material_slot == "led"
    if not valid_surface:
        fail("INVALID_CYLINDER_SURFACE", f"{label} cylinder surface and cap style contradict its radius")
    if not valid_material or component_role != "light":
        fail("INVALID_CYLINDER_MATERIAL", f"{label} cylinder surface has an invalid material or host role")

    expected = {
        "min": {
            "x": center["x"] - radius,
            "y": center["y"] - radius,
            "z": center["z"] - depth / 2.0,
        },
        "max": {
            "x": center["x"] + radius,
            "y": center["y"] + radius,
            "z": center["z"] + depth / 2.0,
        },
    }
    if not same_bounds(expected, blender):
        fail("CYLINDER_BOUNDS_MISMATCH", f"{label} cylinder geometry contradicts package bounds")
    return geometry


def js_stable_stringify(value: Any) -> str:
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
            fail("NONFINITE_NUMBER", "Package hash payload contains a non-finite number")
        if value == 0.0:
            return "0"
        if value.is_integer():
            return str(int(value))
        # Python and ECMAScript use the same shortest-round-trip representation
        # for the ordinary metric values emitted by this versioned package.
        return repr(value).replace("e-0", "e-").replace("e+0", "e+")
    if isinstance(value, list):
        return "[" + ",".join(js_stable_stringify(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(
            f"{js_stable_stringify(key)}:{js_stable_stringify(value[key])}"
            for key in sorted(value)
        ) + "}"
    fail("INVALID_JSON_VALUE", "Package hash payload is not finite JSON")
    raise AssertionError("unreachable")


def validate_package_hash(package: dict[str, Any]) -> None:
    render_key = package.get("renderKey")
    if not isinstance(render_key, str) or not RENDER_KEY_RE.fullmatch(render_key):
        fail("INVALID_RENDER_KEY", "Package render key has an invalid shape")
    if render_key != EXPECTED_RENDER_KEY:
        fail(
            "UNSUPPORTED_RENDER_KEY",
            "Worker accepts only the exact committed Drawing 4 package",
        )
    payload = {key: value for key, value in package.items() if key != "renderKey"}
    digest = hashlib.sha256(js_stable_stringify(payload).encode("utf-8")).hexdigest()
    expected = f"jq-blender-package-v1-{digest}"
    if render_key != expected:
        fail("RENDER_PACKAGE_KEY_MISMATCH", "Package content does not match renderKey")


def validate_coordinate_contract(value: Any) -> None:
    item = exact_keys(
        value, {"source", "target", "pointMapping", "matrix4RowMajor"},
        "coordinateSystem",
    )
    source = exact_keys(item["source"], {"name", "handedness", "axes", "units"}, "coordinateSystem.source")
    target = exact_keys(item["target"], {"name", "handedness", "axes", "units"}, "coordinateSystem.target")
    exact_keys(source["axes"], {"x", "y", "z"}, "coordinateSystem.source.axes")
    exact_keys(target["axes"], {"x", "y", "z"}, "coordinateSystem.target.axes")
    expected_source = {
        "name": "JQ accepted world", "handedness": "right",
        "axes": {"x": "right", "y": "up", "z": "toward-rear-wall"},
        "units": "inches",
    }
    expected_target = {
        "name": "Blender world", "handedness": "right",
        "axes": {"x": "right", "y": "away-from-rear-wall", "z": "up"},
        "units": "meters",
    }
    expected_matrix = [
        0.0254, 0, 0, 0,
        0, 0, -0.0254, 0,
        0, 0.0254, 0, 0,
        0, 0, 0, 1,
    ]
    if (
        source != expected_source
        or target != expected_target
        or item["pointMapping"] != "(x, y, z) -> (x, -z, y) * 0.0254"
        or item["matrix4RowMajor"] != expected_matrix
    ):
        fail("UNSUPPORTED_COORDINATE_SYSTEM", "Package coordinate system is unsupported")


def validate_render(value: Any) -> dict[str, Any]:
    render = exact_keys(value, RENDER_KEYS, "render")
    expected_scalars = {
        "profileId": "preview",
        "engine": "BLENDER_EEVEE_NEXT",
        "blenderEngine": "BLENDER_EEVEE",
        "materialMode": "neutral-clay-v1",
        "width": 960,
        "height": 640,
        "resolutionPercentage": 100,
        "samples": 128,
        "sceneVersion": SCENE_VERSION,
        "cameraVersion": CAMERA_VERSION,
        "materialCatalog": "guided-materials.js#GUIDED_MATERIAL_MANIFEST",
        "materialLibraryVersion": MATERIAL_LIBRARY_VERSION,
        "materialContractVersion": 1,
        "materialSourceSha256": MATERIAL_SOURCE_SHA256,
    }
    if any(render.get(key) != expected for key, expected in expected_scalars.items()):
        fail("UNSUPPORTED_RENDER_PROFILE", "Package is not the exact preview render profile")
    color_management = exact_keys(
        render["colorManagement"],
        {"displayDevice", "viewTransform", "look", "exposure", "gamma", "useCurveMapping"},
        "render.colorManagement",
    )
    if color_management != {
        "displayDevice": "sRGB",
        "viewTransform": "AgX",
        "look": "AgX - Medium High Contrast",
        "exposure": 0,
        "gamma": 1,
        "useCurveMapping": False,
    }:
        fail("UNSUPPORTED_COLOR_MANAGEMENT", "Color management settings drifted")
    engine_settings = exact_keys(
        render["engineSettings"],
        {"taaRenderSamples", "useShadows", "useRaytracing", "useFastGi", "useTaaReprojection"},
        "render.engineSettings",
    )
    if engine_settings != {
        "taaRenderSamples": 128,
        "useShadows": True,
        "useRaytracing": False,
        "useFastGi": False,
        "useTaaReprojection": True,
    }:
        fail("UNSUPPORTED_ENGINE_SETTINGS", "Eevee settings drifted")
    film = exact_keys(render["film"], {"transparent"}, "render.film")
    if film != {"transparent": False}:
        fail("UNSUPPORTED_FILM_SETTINGS", "Film settings drifted")
    image_settings = exact_keys(
        render["imageSettings"],
        {"fileFormat", "colorMode", "colorDepth", "quality", "colorManagement"},
        "render.imageSettings",
    )
    if image_settings != {
        "fileFormat": "WEBP", "colorMode": "RGB", "colorDepth": "8", "quality": 90,
        "colorManagement": "FOLLOW_SCENE",
    }:
        fail("UNSUPPORTED_IMAGE_SETTINGS", "Image settings drifted")
    render_options = exact_keys(
        render["renderOptions"],
        {
            "useFileExtension", "useCompositing", "useSequencer", "ditherIntensity",
            "useStamp", "useBorder", "useCropToBorder", "pixelAspectX", "pixelAspectY",
        },
        "render.renderOptions",
    )
    if render_options != {
        "useFileExtension": True,
        "useCompositing": False,
        "useSequencer": False,
        "ditherIntensity": 1,
        "useStamp": False,
        "useBorder": False,
        "useCropToBorder": False,
        "pixelAspectX": 1,
        "pixelAspectY": 1,
    }:
        fail("UNSUPPORTED_RENDER_OPTIONS", "Render options drifted")
    if render["passes"] != ["beauty"]:
        fail("UNSUPPORTED_RENDER_PASSES", "Clay worker accepts only the beauty pass")
    if not isinstance(render["outputContracts"], list) or len(render["outputContracts"]) != 1:
        fail("INVALID_OUTPUT_CONTRACT", "Preview output contract is invalid")
    output = exact_keys(
        render["outputContracts"][0], {"pass", "filename", "mimeType", "maxBytes"},
        "render.outputContracts[0]",
    )
    if output != {
        "pass": "beauty", "filename": "beauty.webp", "mimeType": "image/webp",
        "maxBytes": MAX_BEAUTY_BYTES,
    }:
        fail("INVALID_OUTPUT_CONTRACT", "Beauty output contract drifted")
    asset = exact_keys(render["assetManifest"], {"path", "sha256"}, "render.assetManifest")
    if asset != {"path": "config/asset-manifest.json", "sha256": ASSET_MANIFEST_SHA256}:
        fail("ASSET_MANIFEST_MISMATCH", "Render asset manifest identity drifted")
    return render


def validate_scene(value: Any, room: dict[str, Any]) -> dict[str, Any]:
    scene = exact_keys(value, SCENE_KEYS, "scene")
    shell = exact_keys(
        scene["shell"],
        {
            "kind", "wallWidthIn", "ceilingHeightIn", "rearWallPlaneZIn",
            "floorPlaneYIn", "floorDepthIn", "wallSurface", "floorSurface",
        },
        "scene.shell",
    )
    environment = exact_keys(
        scene["environment"],
        {
            "path", "sha256", "strength", "projection", "interpolation",
            "colorSpace", "rotationEuler",
        },
        "scene.environment",
    )
    asset = exact_keys(scene["assetManifest"], {"path", "sha256"}, "scene.assetManifest")
    if (
        scene["sceneVersion"] != SCENE_VERSION
        or shell["kind"] != "procedural-clear-wall-room"
        or scene["decorPolicy"] != "none-in-foundation-v1"
        or environment["path"] != "assets/environments/jq-warm-interior.hdr"
        or environment["sha256"] != ENVIRONMENT_SHA256
        or finite_number(environment["strength"], "scene.environment.strength") != 0.65
        or environment["projection"] != "EQUIRECTANGULAR"
        or environment["interpolation"] != "Linear"
        or environment["colorSpace"] != "Linear Rec.709"
        or environment["rotationEuler"] != [0, 0, 0]
        or asset != {"path": "config/asset-manifest.json", "sha256": ASSET_MANIFEST_SHA256}
    ):
        fail("UNSUPPORTED_SCENE", "Package scene is not Clear Wall foundation v1")
    for key in ("wallWidthIn", "ceilingHeightIn", "rearWallPlaneZIn", "floorPlaneYIn"):
        finite_number(shell[key], f"scene.shell.{key}")
        if shell[key] != room[key]:
            fail("ROOM_SCENE_MISMATCH", f"Scene shell and room disagree on {key}")
    if finite_number(shell["floorDepthIn"], "scene.shell.floorDepthIn") != 300:
        fail("UNSUPPORTED_SCENE", "Clear Wall floor depth drifted")
    for surface_name in ("wallSurface", "floorSurface"):
        surface = exact_keys(
            shell[surface_name], {"baseColor", "metallic", "roughness"},
            f"scene.shell.{surface_name}",
        )
        if not isinstance(surface["baseColor"], list) or len(surface["baseColor"]) != 4:
            fail("MALFORMED_ROOM_SURFACE", f"{surface_name} base color is malformed")
        for index, channel in enumerate(surface["baseColor"]):
            channel_value = finite_number(channel, f"{surface_name}.baseColor[{index}]")
            if not 0 <= channel_value <= 1:
                fail("MALFORMED_ROOM_SURFACE", f"{surface_name} base color is out of range")
        for key in ("metallic", "roughness"):
            scalar = finite_number(surface[key], f"{surface_name}.{key}")
            if not 0 <= scalar <= 1:
                fail("MALFORMED_ROOM_SURFACE", f"{surface_name}.{key} is out of range")
    expected_surfaces = {
        "wallSurface": {
            "baseColor": [0.62, 0.58, 0.53, 1], "metallic": 0, "roughness": 0.82,
        },
        "floorSurface": {
            "baseColor": [0.24, 0.21, 0.19, 1], "metallic": 0, "roughness": 0.76,
        },
    }
    if any(shell[name] != expected for name, expected in expected_surfaces.items()):
        fail("UNSUPPORTED_SCENE", "Clear Wall surface definitions drifted")
    return scene


def validate_room(value: Any) -> dict[str, Any]:
    room = exact_keys(value, ROOM_KEYS, "room")
    if room["layoutId"] != "clear-wall" or room["cameraIntent"] != "front":
        fail("UNSUPPORTED_ROOM", "Worker accepts only the Clear Wall front view")
    for key in (
        "wallWidthIn", "ceilingHeightIn", "desiredDepthIn", "floorPlaneYIn",
        "rearWallPlaneZIn",
    ):
        finite_number(room[key], f"room.{key}")
    if room["wallWidthIn"] <= 0 or room["ceilingHeightIn"] <= 0:
        fail("MALFORMED_ROOM", "Room width and height must be positive")
    planes = exact_keys(
        room["planes"], {"floor", "ceiling", "rearWall", "leftWall", "rightWall"},
        "room.planes",
    )
    expected_planes = {
        "floor": ("room-floor", "y", "floor", room["floorPlaneYIn"]),
        "ceiling": ("room-ceiling", "y", "ceiling", room["floorPlaneYIn"] + room["ceilingHeightIn"]),
        "rearWall": ("room-rear-wall", "z", "wall", room["rearWallPlaneZIn"]),
        "leftWall": ("room-left-wall", "x", "wall", -room["wallWidthIn"] / 2),
        "rightWall": ("room-right-wall", "x", "wall", room["wallWidthIn"] / 2),
    }
    for plane_name, expected in expected_planes.items():
        plane = exact_keys(planes[plane_name], {"id", "axis", "value", "kind"}, f"room.planes.{plane_name}")
        actual = (plane["id"], plane["axis"], plane["kind"], finite_number(plane["value"], f"room.planes.{plane_name}.value"))
        if actual != expected:
            fail("MALFORMED_ROOM", f"Room plane {plane_name} contradicts room dimensions")
    if room["features"] != {} or room["exclusionVolumes"] != []:
        fail("UNSUPPORTED_ROOM", "Foundation room cannot add features or exclusion volumes")
    return room


def validate_camera(value: Any) -> dict[str, Any]:
    camera = exact_keys(value, CAMERA_KEYS, "camera")
    if (
        camera["cameraVersion"] != CAMERA_VERSION
        or camera["type"] != "PERSP"
        or camera["sensorFit"] != "HORIZONTAL"
        or camera["depthOfField"] is not False
    ):
        fail("UNSUPPORTED_CAMERA", "Package camera version or type is unsupported")
    for key in ("lensMm", "sensorWidthMm", "fitMargin", "clipStartM", "clipEndM"):
        positive_number(camera[key], f"camera.{key}")
    if camera["clipEndM"] <= camera["clipStartM"]:
        fail("MALFORMED_CAMERA", "Camera clipping planes are not ordered")
    position = point(camera["position"], "camera.position")
    target = point(camera["target"], "camera.target")
    if all(close(position[axis], target[axis]) for axis in "xyz"):
        fail("MALFORMED_CAMERA", "Camera position and target coincide")
    if camera["up"] != [0, 0, 1]:
        fail("UNSUPPORTED_CAMERA", "Foundation camera up vector must be Blender +Z")
    bounds(camera["framingBounds"], "camera.framingBounds")
    return camera


def validate_materials(value: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(value, list) or not value:
        fail("MISSING_MATERIAL_BINDINGS", "Package materials must be a non-empty list")
    bindings: dict[str, dict[str, Any]] = {}
    ordered_slots: list[str] = []
    for index, material_value in enumerate(value):
        material = exact_keys(material_value, MATERIAL_KEYS, f"materials[{index}]")
        slot = safe_identifier(material["sourceMaterialSlot"], f"materials[{index}].sourceMaterialSlot")
        material_id = safe_identifier(material["materialId"], f"materials[{index}].materialId")
        clay_material_id = safe_identifier(
            material["clayMaterialId"], f"materials[{index}].clayMaterialId"
        )
        if slot not in SUPPORTED_MATERIAL_SLOTS:
            fail("UNKNOWN_MATERIAL_SLOT", f"Material slot {slot} is unsupported")
        if slot in bindings:
            fail("DUPLICATE_MATERIAL_SLOT", f"Material slot {slot} is repeated")
        if clay_material_id != CLAY_BY_SOURCE_SLOT[slot]:
            fail("INVALID_CLAY_BINDING", f"Material slot {slot} has the wrong clay material")
        if (
            material["resolver"] not in {
                "embedded-guided-material-definition", "embedded-portable-recipe"
            }
            or material["status"] != "procedural-starter"
            or material["materialContractVersion"] != 1
            or material["sourceSha256"] != MATERIAL_SOURCE_SHA256
            or not isinstance(material["definition"], dict)
            or not isinstance(material["definition"].get("family"), str)
        ):
            fail("INVALID_MATERIAL_BINDING", f"Material binding for {slot} is invalid")
        if slot == "hardware" and material_id not in {"black-pull", "brass-pull", "knob"}:
            fail("INVALID_MATERIAL_BINDING", "Hardware material ID is unsupported")
        if slot == "led" and material_id not in {"warm-led", "integrated-led"}:
            fail("INVALID_MATERIAL_BINDING", "LED material ID is unsupported")
        if slot == "screen" and material_id != "tv-screen-neutral":
            fail("INVALID_MATERIAL_BINDING", "Screen material ID is unsupported")
        if slot == "glass" and material_id != "glass-clear":
            fail("INVALID_MATERIAL_BINDING", "Glass material ID is unsupported")
        bindings[slot] = material
        ordered_slots.append(slot)
    if ordered_slots != sorted(ordered_slots):
        fail("NONDETERMINISTIC_MATERIAL_ORDER", "Material bindings must be sorted by slot")
    return bindings


def validate_clay_materials(value: Any) -> dict[str, dict[str, Any]]:
    if not isinstance(value, list) or len(value) != len(CLAY_DEFINITIONS):
        fail("INVALID_CLAY_LIBRARY", "Package must contain the exact clay material library")
    clay_materials: dict[str, dict[str, Any]] = {}
    ordered_ids: list[str] = []
    definition_keys = {
        "family", "baseColor", "metallic", "roughness", "transmissionWeight",
        "alpha", "emissionColor", "emissionStrength",
    }
    for index, value_item in enumerate(value):
        item = exact_keys(value_item, CLAY_MATERIAL_KEYS, f"clayMaterials[{index}]")
        material_id = safe_identifier(item["materialId"], f"clayMaterials[{index}].materialId")
        if material_id in clay_materials:
            fail("DUPLICATE_CLAY_MATERIAL", f"Clay material {material_id} is repeated")
        if item["libraryVersion"] != "jq-neutral-clay-v1" or material_id not in CLAY_DEFINITIONS:
            fail("INVALID_CLAY_LIBRARY", f"Clay material {material_id} is unsupported")
        definition = exact_keys(
            item["definition"], definition_keys, f"clayMaterials[{index}].definition"
        )
        if definition != CLAY_DEFINITIONS[material_id]:
            fail("INVALID_CLAY_MATERIAL", f"Clay material {material_id} drifted")
        for color_key in ("baseColor", "emissionColor"):
            if not isinstance(definition[color_key], list) or len(definition[color_key]) != 4:
                fail("INVALID_CLAY_MATERIAL", f"{material_id}.{color_key} is malformed")
            for channel in definition[color_key]:
                value_channel = finite_number(channel, f"{material_id}.{color_key}")
                if not 0 <= value_channel <= 1:
                    fail("INVALID_CLAY_MATERIAL", f"{material_id}.{color_key} is out of range")
        for scalar_key in ("metallic", "roughness", "transmissionWeight", "alpha"):
            scalar = finite_number(definition[scalar_key], f"{material_id}.{scalar_key}")
            if not 0 <= scalar <= 1:
                fail("INVALID_CLAY_MATERIAL", f"{material_id}.{scalar_key} is out of range")
        if finite_number(definition["emissionStrength"], f"{material_id}.emissionStrength") < 0:
            fail("INVALID_CLAY_MATERIAL", f"{material_id}.emissionStrength is negative")
        clay_materials[material_id] = item
        ordered_ids.append(material_id)
    if ordered_ids != sorted(ordered_ids) or set(clay_materials) != set(CLAY_DEFINITIONS):
        fail("INVALID_CLAY_LIBRARY", "Clay materials must be complete and sorted")
    return clay_materials


def validate_components(
    value: Any, bindings: dict[str, dict[str, Any]]
) -> tuple[list[dict[str, Any]], int]:
    if not isinstance(value, list) or len(value) != EXPECTED_COMPONENT_COUNT:
        fail("COMPONENT_COUNT_MISMATCH", f"Drawing 4 package must contain {EXPECTED_COMPONENT_COUNT} components")
    components: list[dict[str, Any]] = []
    component_ids: set[str] = set()
    object_names: set[str] = set()
    component_order: list[str] = []
    used_slots: set[str] = set()
    submesh_count = 0
    for component_index, component_value in enumerate(value):
        label = f"components[{component_index}]"
        component = exact_keys(component_value, COMPONENT_KEYS, label)
        component_id = safe_identifier(component["componentId"], f"{label}.componentId")
        if component_id in component_ids:
            fail("DUPLICATE_COMPONENT_ID", f"Component ID {component_id} is repeated")
        component_ids.add(component_id)
        component_order.append(component_id)
        for id_key in ("descriptorSetId", "installationId", "zoneId"):
            safe_identifier(component[id_key], f"{label}.{id_key}")
        for optional_id in ("parentId", "hostId"):
            if component[optional_id] is not None:
                safe_identifier(component[optional_id], f"{label}.{optional_id}")
        safe_identifier(component["role"], f"{label}.role")
        if component["geometryVariant"] not in {"box", "slab", "framed_panel", "glass_frame", "crown_profile_extrusion", "recessed_puck_light"}:
            fail("UNKNOWN_GEOMETRY_VARIANT", f"{component_id} geometry variant is unsupported")
        slot = safe_identifier(component["sourceMaterialSlot"], f"{label}.sourceMaterialSlot")
        material_id = safe_identifier(component["materialId"], f"{label}.materialId")
        if slot not in bindings or bindings[slot]["materialId"] != material_id:
            fail("MISSING_MATERIAL_BINDING", f"{component_id} has no exact material binding")
        source, blender = validate_bounds_pair(
            component["sourceWorldBounds"], component["blenderWorldBounds"], label
        )
        del source
        exact_keys(component["sourceTransform"], {"translation", "basis"}, f"{label}.sourceTransform")
        point(component["sourceTransform"]["translation"], f"{label}.sourceTransform.translation")
        basis = exact_keys(component["sourceTransform"]["basis"], {"x", "y", "z"}, f"{label}.sourceTransform.basis")
        for axis in "xyz":
            point(basis[axis], f"{label}.sourceTransform.basis.{axis}")
        metadata = component["metadata"]
        if not isinstance(metadata, dict) or not set(metadata).issubset(SAFE_METADATA_KEYS):
            fail("UNKNOWN_METADATA_KEY", f"{component_id} metadata contains unsupported keys")
        submeshes = component["submeshes"]
        if not isinstance(submeshes, list) or not submeshes:
            fail("MISSING_SUBMESH", f"{component_id} has no renderer-neutral submeshes")
        submesh_ids: set[str] = set()
        submesh_bounds: list[dict[str, dict[str, float]]] = []
        for submesh_index, submesh_value in enumerate(submeshes):
            sublabel = f"{label}.submeshes[{submesh_index}]"
            submesh = exact_keys(submesh_value, SUBMESH_KEYS, sublabel)
            submesh_id = safe_identifier(submesh["submeshId"], f"{sublabel}.submeshId")
            if submesh_id in submesh_ids:
                fail("DUPLICATE_SUBMESH_ID", f"{component_id} repeats submesh ID {submesh_id}")
            submesh_ids.add(submesh_id)
            object_name = f"{component_id}::{submesh_id}"
            if len(object_name.encode("utf-8")) > 255 or object_name in object_names:
                fail("DUPLICATE_SUBMESH_OBJECT", f"Submesh object name {object_name} is invalid or repeated")
            object_names.add(object_name)
            geometry = submesh["geometry"]
            if geometry not in SUPPORTED_GEOMETRY:
                fail("UNKNOWN_PRIMITIVE_KIND", f"{object_name} primitive {geometry!r} is unsupported")
            if not isinstance(submesh["edgeVisible"], bool):
                fail("INVALID_SUBMESH", f"{object_name} edgeVisible must be boolean")
            safe_identifier(submesh["grainRole"], f"{sublabel}.grainRole")
            subslot = safe_identifier(submesh["sourceMaterialSlot"], f"{sublabel}.sourceMaterialSlot")
            submaterial_id = safe_identifier(submesh["materialId"], f"{sublabel}.materialId")
            if subslot not in bindings or bindings[subslot]["materialId"] != submaterial_id:
                fail("MISSING_MATERIAL_BINDING", f"{object_name} has no exact material binding")
            if subslot == "led" and component["role"] != "light":
                fail("INVALID_LED_BINDING", f"Only package light components may use LED clay")
            used_slots.add(subslot)
            bounds(submesh["sourceLocalBounds"], f"{sublabel}.sourceLocalBounds")
            subsource, subblender = validate_bounds_pair(
                submesh["sourceWorldBounds"], submesh["blenderWorldBounds"], sublabel
            )
            if geometry == "box":
                if submesh["profileGeometry"] is not None or submesh["primitiveGeometry"] is not None:
                    fail("MALFORMED_BOX", f"{object_name} box cannot carry a crown profile")
            elif geometry == "crown_profile_extrusion":
                if submesh["primitiveGeometry"] is not None:
                    fail("MALFORMED_CROWN_PROFILE", f"{object_name} crown cannot carry primitive geometry")
                validate_crown_profile(
                    submesh["profileGeometry"], subsource, subblender, object_name
                )
            else:
                if submesh["profileGeometry"] is not None:
                    fail("MALFORMED_CYLINDER", f"{object_name} cylinder cannot carry a crown profile")
                validate_cylinder_geometry(
                    submesh["primitiveGeometry"], subblender, subslot,
                    component["role"], object_name
                )
            submesh_bounds.append(subblender)
            submesh_count += 1
        if not same_bounds(union_bounds(submesh_bounds), blender):
            fail("COMPONENT_SUBMESH_BOUNDS_MISMATCH", f"{component_id} submesh union drifted")
        components.append(component)
    if component_order != sorted(component_order):
        fail("NONDETERMINISTIC_COMPONENT_ORDER", "Components must be sorted by component ID")
    if used_slots != set(bindings):
        fail("UNUSED_MATERIAL_BINDING", "Package material bindings must exactly match submesh slots")
    if submesh_count != EXPECTED_SUBMESH_OBJECT_COUNT:
        fail(
            "SUBMESH_COUNT_MISMATCH",
            f"Drawing 4 package must contain {EXPECTED_SUBMESH_OBJECT_COUNT} submesh objects",
        )
    return components, submesh_count


def validate_constraints(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) != EXPECTED_CONSTRAINT_COUNT:
        fail("CONSTRAINT_COUNT_MISMATCH", f"Drawing 4 package must contain {EXPECTED_CONSTRAINT_COUNT} constraints")
    constraints: list[dict[str, Any]] = []
    ids: set[str] = set()
    order: list[str] = []
    for index, constraint_value in enumerate(value):
        label = f"constraints[{index}]"
        constraint = exact_keys(constraint_value, CONSTRAINT_KEYS, label)
        constraint_id = safe_identifier(constraint["constraintId"], f"{label}.constraintId")
        kind = safe_identifier(constraint["kind"], f"{label}.kind")
        if constraint_id in ids:
            fail("DUPLICATE_CONSTRAINT_ID", f"Constraint ID {constraint_id} is repeated")
        ids.add(constraint_id)
        order.append(constraint_id)
        validate_bounds_pair(constraint["sourceWorldBounds"], constraint["blenderWorldBounds"], label)
        clearance = constraint["clearance"]
        if not isinstance(clearance, dict) or not set(clearance).issubset(
            {"serviceClearance", "ventilationClearance", "noDecorativeFrame"}
        ):
            fail("INVALID_CONSTRAINT", f"Constraint {constraint_id} clearance is invalid")
        if not isinstance(clearance.get("noDecorativeFrame"), bool):
            fail("INVALID_CONSTRAINT", f"Constraint {constraint_id} lacks a boolean noDecorativeFrame")
        if "ventilationClearance" in clearance:
            positive_number(clearance["ventilationClearance"], f"{label}.ventilationClearance")
        if "serviceClearance" in clearance:
            service = exact_keys(
                clearance["serviceClearance"], {"left", "right", "top", "bottom"},
                f"{label}.serviceClearance",
            )
            for side in ("left", "right", "top", "bottom"):
                positive_number(service[side], f"{label}.serviceClearance.{side}")
        constraints.append(constraint)
    if order != sorted(order):
        fail("NONDETERMINISTIC_CONSTRAINT_ORDER", "Constraints must be sorted by ID")
    return constraints


def validate_package(package: dict[str, Any]) -> dict[str, Any]:
    exact_keys(package, TOP_LEVEL_KEYS, "package")
    reject_nonfinite_and_unknown_keys(package)
    if (
        package["kind"] != PACKAGE_KIND
        or package["schemaVersion"] != PACKAGE_SCHEMA_VERSION
        or package["contractVersion"] != RENDER_CONTRACT_VERSION
        or package["primitiveContractVersion"] != PRIMITIVE_CONTRACT_VERSION
        or package["pipelineVersion"] != PIPELINE_VERSION
        or package["sourceUnits"] != "inches"
        or package["targetUnits"] != "meters"
    ):
        fail("UNSUPPORTED_PACKAGE", "Worker accepts only the foundation-v1 package")
    identity = exact_keys(package["identity"], IDENTITY_KEYS, "identity")
    identity_expected = {
        "productId": "tv-unit", "layoutId": "clear-wall", "installationMode": "fitted",
        "engineVersion": "2026.08-tv-drawing-4-v1", "jobSchemaVersion": 1,
        "packageSchemaVersion": PACKAGE_SCHEMA_VERSION, "renderContractVersion": 1,
        "primitiveContractVersion": PRIMITIVE_CONTRACT_VERSION, "materialContractVersion": 1,
        "pipelineVersion": PIPELINE_VERSION, "materialLibraryVersion": MATERIAL_LIBRARY_VERSION,
        "sceneVersion": SCENE_VERSION, "cameraVersion": CAMERA_VERSION,
        "assetManifestSha256": ASSET_MANIFEST_SHA256,
        "materialSourceSha256": MATERIAL_SOURCE_SHA256, "outputProfile": "preview",
        **EXPECTED_IDENTITY_FINGERPRINTS,
    }
    if any(identity.get(key) != expected for key, expected in identity_expected.items()):
        fail("IDENTITY_MISMATCH", "Package identity is outside the supported foundation slice")
    for key in (
        "geometryFingerprint", "selectionFingerprint", "descriptorFingerprint",
        "materialFingerprint", "cameraFingerprint",
    ):
        if not isinstance(identity[key], str) or not re.fullmatch(
            r"jq-guided-[A-Za-z0-9-]+-v[0-9]+-[A-Za-z0-9]+", identity[key]
        ):
            fail("INVALID_FINGERPRINT", f"identity.{key} is malformed")
    sha256_string(identity["assetManifestSha256"], "identity.assetManifestSha256")
    sha256_string(identity["materialSourceSha256"], "identity.materialSourceSha256")
    if package["requestKey"] != EXPECTED_REQUEST_KEY:
        fail("INVALID_REQUEST_KEY", "Package request key is not the committed Drawing 4 job")
    validate_coordinate_contract(package["coordinateSystem"])
    render = validate_render(package["render"])
    room = validate_room(package["room"])
    scene = validate_scene(package["scene"], room)
    camera = validate_camera(package["camera"])
    installation = exact_keys(package["installation"], INSTALLATION_KEYS, "installation")
    if installation["mode"] != "fitted":
        fail("UNSUPPORTED_INSTALLATION", "Worker accepts only fitted installation")
    invariants = exact_keys(installation["invariants"], {"noGlobalScaling", "rootScale"}, "installation.invariants")
    if invariants != {"noGlobalScaling": True, "rootScale": [1, 1, 1]}:
        fail("GEOMETRY_SCALING_FORBIDDEN", "Installation must prohibit global scaling")
    if not all(isinstance(installation[key], dict) for key in ("casework", "treatments", "anchors")):
        fail("INVALID_INSTALLATION", "Installation geometry envelope is malformed")
    materials = validate_materials(package["materials"])
    clay_materials = validate_clay_materials(package["clayMaterials"])
    if {binding["clayMaterialId"] for binding in materials.values()} | {"clay-glass"} != set(clay_materials):
        fail("CLAY_BINDING_MISMATCH", "Clay library does not exactly cover the package bindings")
    components, submesh_count = validate_components(package["components"], materials)
    constraints = validate_constraints(package["constraints"])
    framing = bounds(camera["framingBounds"], "camera.framingBounds")
    if not same_bounds(framing, union_bounds(
        bounds(component["blenderWorldBounds"], "component.blenderWorldBounds")
        for component in components
    )):
        fail("CAMERA_BOUNDS_MISMATCH", "Camera framing bounds do not match product bounds")
    audit = exact_keys(
        package["audit"],
        {"valid", "descriptorSetCount", "physicalComponentCount", "renderedComponentCount", "constraintCount", "primitiveRecordCount"},
        "audit",
    )
    if audit != {
        "valid": True, "descriptorSetCount": 1,
        "physicalComponentCount": EXPECTED_COMPONENT_COUNT,
        "renderedComponentCount": EXPECTED_COMPONENT_COUNT,
        "constraintCount": EXPECTED_CONSTRAINT_COUNT,
        "primitiveRecordCount": EXPECTED_COMPONENT_COUNT,
    }:
        fail("AUDIT_MISMATCH", "Package audit does not match its exact contents")
    readiness = exact_keys(
        package["readiness"],
        {"prototypeRenderAllowed", "customerBeautyRenderApproved", "geometryApproval", "materialApproval", "requiredAssets", "blockers"},
        "readiness",
    )
    if readiness["prototypeRenderAllowed"] is not True or readiness["customerBeautyRenderApproved"] is not False:
        fail("READINESS_MISMATCH", "Only prototype clay rendering may be enabled")
    if not isinstance(readiness["requiredAssets"], list) or not isinstance(readiness["blockers"], list):
        fail("READINESS_MISMATCH", "Package readiness diagnostics are malformed")
    validate_package_hash(package)
    return {
        "render": render,
        "scene": scene,
        "room": room,
        "camera": camera,
        "materials": materials,
        "clayMaterials": clay_materials,
        "components": components,
        "constraints": constraints,
        "submeshCount": submesh_count,
    }


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def resolve_asset(project_root: Path, relative_path: str, expected_sha256: str) -> Path:
    if not isinstance(relative_path, str) or not relative_path or Path(relative_path).is_absolute():
        fail("UNSAFE_ASSET_PATH", "Package asset path must be repository-relative")
    root = project_root.resolve(strict=True)
    try:
        asset = (root / relative_path).resolve(strict=True)
        asset.relative_to(root)
    except (OSError, ValueError) as error:
        fail("UNSAFE_ASSET_PATH", f"Package asset path is missing or escapes project root: {error}")
    if not asset.is_file():
        fail("MISSING_ASSET", f"Required asset is not a file: {asset}")
    actual = file_sha256(asset)
    if actual != expected_sha256:
        fail("ASSET_SHA256_MISMATCH", f"Asset {relative_path} SHA-256 is {actual}, expected {expected_sha256}")
    return asset


def validate_assets(package: dict[str, Any], validated: dict[str, Any], project_root: Path) -> Path:
    environment = validated["scene"]["environment"]
    environment_path = resolve_asset(project_root, environment["path"], environment["sha256"])
    resolve_asset(project_root, "config/asset-manifest.json", ASSET_MANIFEST_SHA256)
    resolve_asset(project_root, "guided-materials.js", MATERIAL_SOURCE_SHA256)
    return environment_path


def box_vertices_faces(
    item_bounds: dict[str, dict[str, float]],
) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
    low, high = item_bounds["min"], item_bounds["max"]
    vertices = [
        (low["x"], low["y"], low["z"]),
        (high["x"], low["y"], low["z"]),
        (high["x"], high["y"], low["z"]),
        (low["x"], high["y"], low["z"]),
        (low["x"], low["y"], high["z"]),
        (high["x"], low["y"], high["z"]),
        (high["x"], high["y"], high["z"]),
        (low["x"], high["y"], high["z"]),
    ]
    faces = [
        (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
        (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5),
    ]
    return vertices, faces


def cylinder_vertices_faces(
    geometry: dict[str, Any],
) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
    center = geometry["center"]
    radius = float(geometry["radius"])
    inner_radius = float(geometry["innerRadius"])
    depth = float(geometry["depth"])
    segments = int(geometry["segments"])
    bottom = float(center["z"]) - depth / 2.0
    top = float(center["z"]) + depth / 2.0

    def ring(ring_radius: float, z_value: float) -> list[tuple[float, float, float]]:
        return [
            (
                float(center["x"]) + ring_radius * math.cos(2.0 * math.pi * index / segments),
                float(center["y"]) + ring_radius * math.sin(2.0 * math.pi * index / segments),
                z_value,
            )
            for index in range(segments)
        ]

    outer_bottom = ring(radius, bottom)
    outer_top = ring(radius, top)
    vertices = outer_bottom + outer_top
    faces: list[tuple[int, ...]] = []
    for index in range(segments):
        following = (index + 1) % segments
        faces.append((index, following, segments + following, segments + index))

    if inner_radius == 0.0:
        bottom_center = len(vertices)
        vertices.append((float(center["x"]), float(center["y"]), bottom))
        top_center = len(vertices)
        vertices.append((float(center["x"]), float(center["y"]), top))
        for index in range(segments):
            following = (index + 1) % segments
            faces.append((bottom_center, following, index))
            faces.append((top_center, segments + index, segments + following))
        return vertices, faces

    inner_bottom_start = len(vertices)
    vertices.extend(ring(inner_radius, bottom))
    inner_top_start = len(vertices)
    vertices.extend(ring(inner_radius, top))
    for index in range(segments):
        following = (index + 1) % segments
        outer_bottom_index = index
        outer_top_index = segments + index
        inner_bottom_index = inner_bottom_start + index
        inner_top_index = inner_top_start + index
        faces.append((inner_bottom_index, inner_top_index,
                      inner_top_start + following, inner_bottom_start + following))
        faces.append((outer_bottom_index, inner_bottom_index,
                      inner_bottom_start + following, following))
        faces.append((outer_top_index, segments + following,
                      inner_top_start + following, inner_top_index))
    return vertices, faces


def crown_vertices_faces(
    item_bounds: dict[str, dict[str, float]], profile: dict[str, Any]
) -> tuple[list[tuple[float, float, float]], list[tuple[int, ...]]]:
    cross = profile["crossSection"]
    extrusion = profile["extrusion"]
    projection_source_axis = cross["projectionAxis"]
    projection_blender_axis = "x" if projection_source_axis == "x" else "y"
    extrusion_blender_axis = "x" if extrusion["axis"] == "x" else "y"
    direction = int(cross["projectionDirection"])
    low, high = item_bounds["min"], item_bounds["max"]

    if projection_source_axis == "x":
        projection_start = low["x"] if direction > 0 else high["x"]
        projection_end = high["x"] if direction > 0 else low["x"]
    else:
        # Blender Y is the negation of source Z.
        projection_start = high["y"] if direction > 0 else low["y"]
        projection_end = low["y"] if direction > 0 else high["y"]
    extrusion_values = (low[extrusion_blender_axis], high[extrusion_blender_axis])

    vertices: list[tuple[float, float, float]] = []
    for extrusion_value in extrusion_values:
        for outline_point in profile["outline"]:
            projection_value = projection_start + (
                projection_end - projection_start
            ) * float(outline_point["projection"])
            height_value = low["z"] + (high["z"] - low["z"]) * float(outline_point["height"])
            coordinate = {"x": 0.0, "y": 0.0, "z": height_value}
            coordinate[projection_blender_axis] = projection_value
            coordinate[extrusion_blender_axis] = extrusion_value
            vertices.append((coordinate["x"], coordinate["y"], coordinate["z"]))
    count = len(profile["outline"])
    faces: list[tuple[int, ...]] = [
        tuple(reversed(range(count))),
        tuple(range(count, count * 2)),
    ]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, following, count + following, count + index))
    return vertices, faces


def assert_mesh_bounds(vertices: list[tuple[float, float, float]], expected: dict[str, dict[str, float]], label: str) -> None:
    actual = {
        "min": {axis: min(vertex[index] for vertex in vertices) for index, axis in enumerate("xyz")},
        "max": {axis: max(vertex[index] for vertex in vertices) for index, axis in enumerate("xyz")},
    }
    if not same_bounds(actual, expected):
        fail("MESH_BOUNDS_MISMATCH", f"{label} did not realize exact package bounds")


def create_principled_material(bpy: Any, name: str, definition: dict[str, Any]) -> Any:
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    if set(node.bl_idname for node in nodes) != {
        "ShaderNodeBsdfPrincipled", "ShaderNodeOutputMaterial"
    }:
        fail("MATERIAL_NODE_DRIFT", f"Unexpected default nodes for {name}")
    shader = next(node for node in nodes if node.bl_idname == "ShaderNodeBsdfPrincipled")
    base_color = tuple(float(value) for value in definition["baseColor"])
    transmission = float(definition.get("transmissionWeight", 0.0))
    alpha = float(definition.get("alpha", base_color[3]))
    emission = tuple(float(value) for value in definition.get("emissionColor", [0, 0, 0, 1]))
    emission_strength = float(definition.get("emissionStrength", 0.0))
    shader.inputs["Base Color"].default_value = base_color
    shader.inputs["Roughness"].default_value = float(definition["roughness"])
    shader.inputs["Metallic"].default_value = float(definition["metallic"])
    shader.inputs["Transmission Weight"].default_value = transmission
    shader.inputs["Alpha"].default_value = alpha
    shader.inputs["Emission Color"].default_value = emission
    shader.inputs["Emission Strength"].default_value = emission_strength
    material.diffuse_color = base_color
    if transmission > 0.0 or alpha < 1.0:
        shader.inputs["IOR"].default_value = 1.45
        material.surface_render_method = "DITHERED"
    return material


def create_materials(
    bpy: Any,
    clay_library: dict[str, dict[str, Any]],
    shell: dict[str, Any],
) -> dict[str, Any]:
    materials = {
        material_id: create_principled_material(
            bpy, material_id, entry["definition"]
        )
        for material_id, entry in sorted(clay_library.items())
    }
    materials["room-wall"] = create_principled_material(
        bpy, "JQ_ROOM_WALL", shell["wallSurface"]
    )
    materials["room-floor"] = create_principled_material(
        bpy, "JQ_ROOM_FLOOR", shell["floorSurface"]
    )
    return materials


def clay_key_for_slot(slot: str) -> str:
    clay_material_id = CLAY_BY_SOURCE_SLOT.get(slot)
    if clay_material_id is None:
        fail("UNKNOWN_MATERIAL_SLOT", f"No clay resolver for material slot {slot}")
    return clay_material_id


def create_mesh_object(
    bpy: Any,
    bmesh: Any,
    name: str,
    vertices: list[tuple[float, float, float]],
    faces: list[tuple[int, ...]],
    collection: Any,
    material: Any | None,
) -> Any:
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    if mesh.validate(verbose=False, clean_customdata=False):
        fail(
            "MESH_GEOMETRY_CORRECTED",
            f"Blender attempted to repair package geometry for {name}",
        )
    mesh.update(calc_edges=True)
    normal_mesh = bmesh.new()
    normal_mesh.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(normal_mesh, faces=list(normal_mesh.faces))
    normal_mesh.to_mesh(mesh)
    normal_mesh.free()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if obj.name != name or mesh.name != name:
        fail("BLENDER_NAME_COLLISION", f"Blender could not preserve object name {name}")
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)
    if material is not None:
        mesh.materials.append(material)
    return obj


def build_product(
    bpy: Any,
    bmesh: Any,
    components: list[dict[str, Any]],
    collection: Any,
    clay_materials: dict[str, Any],
) -> list[str]:
    object_names: list[str] = []
    for component in components:
        component_id = component["componentId"]
        for submesh in component["submeshes"]:
            name = f"{component_id}::{submesh['submeshId']}"
            item_bounds = bounds(submesh["blenderWorldBounds"], f"{name}.blenderWorldBounds")
            if submesh["geometry"] == "box":
                vertices, faces = box_vertices_faces(item_bounds)
            elif submesh["geometry"] == "crown_profile_extrusion":
                vertices, faces = crown_vertices_faces(item_bounds, submesh["profileGeometry"])
            elif submesh["geometry"] == "cylinder":
                vertices, faces = cylinder_vertices_faces(submesh["primitiveGeometry"])
            else:
                fail("UNKNOWN_PRIMITIVE_KIND", f"Unknown primitive {submesh['geometry']}")
            assert_mesh_bounds(vertices, item_bounds, name)
            material = clay_materials[clay_key_for_slot(submesh["sourceMaterialSlot"])]
            obj = create_mesh_object(bpy, bmesh, name, vertices, faces, collection, material)
            obj["jq_component_id"] = component_id
            obj["jq_submesh_id"] = submesh["submeshId"]
            obj["jq_geometry"] = submesh["geometry"]
            obj["jq_material_slot"] = submesh["sourceMaterialSlot"]
            object_names.append(name)
    return object_names


def create_room(
    bpy: Any,
    bmesh: Any,
    room: dict[str, Any],
    shell: dict[str, Any],
    collection: Any,
    wall_material: Any,
    floor_material: Any,
) -> list[str]:
    planes = room["planes"]
    left = finite_number(planes["leftWall"]["value"], "room.leftWall") * INCHES_TO_METERS
    right = finite_number(planes["rightWall"]["value"], "room.rightWall") * INCHES_TO_METERS
    floor_z = finite_number(planes["floor"]["value"], "room.floor") * INCHES_TO_METERS
    ceiling_z = finite_number(planes["ceiling"]["value"], "room.ceiling") * INCHES_TO_METERS
    rear_y = -finite_number(planes["rearWall"]["value"], "room.rearWall") * INCHES_TO_METERS
    floor_front_y = rear_y + float(shell["floorDepthIn"]) * INCHES_TO_METERS
    floor_vertices = [
        (left, rear_y, floor_z), (right, rear_y, floor_z),
        (right, floor_front_y, floor_z), (left, floor_front_y, floor_z),
    ]
    wall_vertices = [
        (left, rear_y, floor_z), (left, rear_y, ceiling_z),
        (right, rear_y, ceiling_z), (right, rear_y, floor_z),
    ]
    floor = create_mesh_object(
        bpy, bmesh, "room-floor", floor_vertices, [(0, 1, 2, 3)], collection,
        floor_material,
    )
    wall = create_mesh_object(
        bpy, bmesh, "room-rear-wall", wall_vertices, [(0, 1, 2, 3)], collection,
        wall_material,
    )
    floor["jq_room_plane"] = "floor"
    wall["jq_room_plane"] = "rearWall"
    return [floor.name, wall.name]


def create_constraints(
    bpy: Any,
    bmesh: Any,
    constraints: list[dict[str, Any]],
    collection: Any,
) -> list[str]:
    names: list[str] = []
    collection.hide_render = True
    for constraint in constraints:
        name = f"{constraint['constraintId']}::{constraint['kind']}"
        item_bounds = bounds(constraint["blenderWorldBounds"], f"{name}.blenderWorldBounds")
        vertices, faces = box_vertices_faces(item_bounds)
        obj = create_mesh_object(bpy, bmesh, name, vertices, faces, collection, None)
        obj.display_type = "WIRE"
        obj.hide_render = True
        obj["jq_constraint_id"] = constraint["constraintId"]
        obj["jq_constraint_kind"] = constraint["kind"]
        names.append(name)
    return names


def create_camera(bpy: Any, camera_package: dict[str, Any], collection: Any) -> Any:
    from mathutils import Vector

    camera_data = bpy.data.cameras.new("JQ_HERO_CAMERA")
    camera_data.type = "PERSP"
    camera_data.lens = float(camera_package["lensMm"])
    camera_data.sensor_width = float(camera_package["sensorWidthMm"])
    camera_data.sensor_fit = camera_package["sensorFit"]
    camera_data.dof.use_dof = camera_package["depthOfField"]
    camera_data.clip_start = float(camera_package["clipStartM"])
    camera_data.clip_end = float(camera_package["clipEndM"])
    camera = bpy.data.objects.new("JQ_HERO_CAMERA", camera_data)
    collection.objects.link(camera)
    position = camera_package["position"]
    target = camera_package["target"]
    camera.location = (position["x"], position["y"], position["z"])
    direction = Vector((target["x"], target["y"], target["z"])) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.scale = (1.0, 1.0, 1.0)
    camera["jq_camera_version"] = camera_package["cameraVersion"]
    camera["jq_target"] = [target["x"], target["y"], target["z"]]
    if (
        camera_data.sensor_fit != camera_package["sensorFit"]
        or camera_data.dof.use_dof != camera_package["depthOfField"]
    ):
        fail("CAMERA_SETTING_DRIFT", "Blender camera defaults did not accept the package settings")
    return camera


def configure_world(
    bpy: Any,
    environment_path: Path,
    environment_contract: dict[str, Any],
) -> None:
    world = bpy.data.worlds.new("JQ_WORLD")
    world.use_nodes = True
    nodes = world.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputWorld")
    background = nodes.new("ShaderNodeBackground")
    environment = nodes.new("ShaderNodeTexEnvironment")
    environment.image = bpy.data.images.load(str(environment_path), check_existing=False)
    environment.image.colorspace_settings.name = environment_contract["colorSpace"]
    environment.projection = environment_contract["projection"]
    environment.interpolation = environment_contract["interpolation"]
    texture_coordinates = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = tuple(
        float(value) for value in environment_contract["rotationEuler"]
    )
    background.inputs["Strength"].default_value = float(environment_contract["strength"])
    world.node_tree.links.new(texture_coordinates.outputs["Generated"], mapping.inputs["Vector"])
    world.node_tree.links.new(mapping.outputs["Vector"], environment.inputs["Vector"])
    world.node_tree.links.new(environment.outputs["Color"], background.inputs["Color"])
    world.node_tree.links.new(background.outputs["Background"], output.inputs["Surface"])
    bpy.context.scene.world = world


def configure_render(bpy: Any, render: dict[str, Any], beauty_path: Path) -> None:
    scene = bpy.context.scene
    if render["engine"] != "BLENDER_EEVEE_NEXT":
        fail("UNSUPPORTED_RENDER_ENGINE", "Semantic package engine must be BLENDER_EEVEE_NEXT")
    # Blender 5.2 exposes the Eevee Next implementation under this RNA enum.
    scene.render.engine = render["blenderEngine"]
    if scene.render.engine != render["blenderEngine"]:
        fail("BLENDER_ENGINE_MAPPING_FAILED", "Blender did not accept the Eevee Next RNA engine")
    engine = render["engineSettings"]
    scene.eevee.taa_render_samples = int(engine["taaRenderSamples"])
    scene.eevee.use_shadows = engine["useShadows"]
    scene.eevee.use_raytracing = engine["useRaytracing"]
    scene.eevee.use_fast_gi = engine["useFastGi"]
    scene.eevee.use_taa_reprojection = engine["useTaaReprojection"]
    scene.render.resolution_x = int(render["width"])
    scene.render.resolution_y = int(render["height"])
    scene.render.resolution_percentage = int(render["resolutionPercentage"])
    options = render["renderOptions"]
    scene.render.pixel_aspect_x = float(options["pixelAspectX"])
    scene.render.pixel_aspect_y = float(options["pixelAspectY"])
    scene.render.film_transparent = render["film"]["transparent"]
    scene.render.use_compositing = options["useCompositing"]
    scene.render.use_sequencer = options["useSequencer"]
    scene.render.use_file_extension = options["useFileExtension"]
    scene.render.use_stamp = options["useStamp"]
    scene.render.use_border = options["useBorder"]
    scene.render.use_crop_to_border = options["useCropToBorder"]
    scene.render.filepath = str(beauty_path)
    image = render["imageSettings"]
    scene.render.image_settings.file_format = image["fileFormat"]
    scene.render.image_settings.color_mode = image["colorMode"]
    scene.render.image_settings.color_depth = image["colorDepth"]
    scene.render.image_settings.quality = int(image["quality"])
    scene.render.image_settings.color_management = image["colorManagement"]
    scene.render.dither_intensity = float(options["ditherIntensity"])
    color = render["colorManagement"]
    scene.display_settings.display_device = color["displayDevice"]
    scene.view_settings.view_transform = color["viewTransform"]
    scene.view_settings.look = color["look"]
    scene.view_settings.exposure = float(color["exposure"])
    scene.view_settings.gamma = float(color["gamma"])
    scene.view_settings.use_curve_mapping = color["useCurveMapping"]
    if (
        scene.render.pixel_aspect_x != float(options["pixelAspectX"])
        or scene.render.pixel_aspect_y != float(options["pixelAspectY"])
        or scene.render.use_stamp != options["useStamp"]
        or scene.render.use_border != options["useBorder"]
        or scene.render.use_crop_to_border != options["useCropToBorder"]
        or scene.render.image_settings.color_management != image["colorManagement"]
    ):
        fail("RENDER_SETTING_DRIFT", "Blender did not accept the explicit package defaults")
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"


def write_json(path: Path, value: dict[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    serialized = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    try:
        temporary.write_text(serialized, encoding="utf-8")
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink()


def render_worker(
    package: dict[str, Any],
    validated: dict[str, Any],
    environment_path: Path,
    output_dir: Path,
    blend_path: Path,
    beauty_path: Path,
    result_path: Path,
) -> None:
    import bpy
    import bmesh

    if tuple(bpy.app.version[:2]) != (5, 2):
        fail("UNSUPPORTED_BLENDER_VERSION", f"Blender 5.2 is required, found {bpy.app.version_string}")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    collection_names = ["JQ_CASEWORK", "JQ_ROOM", "JQ_CONSTRAINTS_DEBUG", "JQ_CAMERAS"]
    collections: dict[str, Any] = {}
    for name in collection_names:
        collection = bpy.data.collections.new(name)
        scene.collection.children.link(collection)
        collections[name] = collection
    shell = validated["scene"]["shell"]
    clay_materials = create_materials(bpy, validated["clayMaterials"], shell)
    product_names = build_product(
        bpy, bmesh, validated["components"], collections["JQ_CASEWORK"], clay_materials
    )
    room_names = create_room(
        bpy, bmesh, validated["room"], shell, collections["JQ_ROOM"],
        clay_materials["room-wall"], clay_materials["room-floor"],
    )
    constraint_names = create_constraints(
        bpy, bmesh, validated["constraints"], collections["JQ_CONSTRAINTS_DEBUG"]
    )
    camera = create_camera(bpy, validated["camera"], collections["JQ_CAMERAS"])
    scene.camera = camera
    configure_world(bpy, environment_path, validated["scene"]["environment"])
    configure_render(bpy, validated["render"], beauty_path)
    if sorted(collection.name for collection in bpy.data.collections) != sorted(collection_names):
        fail("COLLECTION_DRIFT", "Scene contains collections outside the deterministic contract")
    for name in product_names:
        obj = bpy.data.objects[name]
        if tuple(obj.scale) != (1.0, 1.0, 1.0):
            fail("PRODUCT_SCALE_DRIFT", f"Product object {name} has non-unit scale")
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    bpy.ops.render.render(write_still=True)
    if not beauty_path.is_file():
        fail("BEAUTY_OUTPUT_MISSING", f"Blender did not write {beauty_path}")
    byte_count = beauty_path.stat().st_size
    if byte_count <= 0 or byte_count > MAX_BEAUTY_BYTES:
        fail("BEAUTY_OUTPUT_SIZE_INVALID", f"Beauty output has invalid size {byte_count}")
    image = bpy.data.images.load(str(beauty_path), check_existing=False)
    try:
        actual_dimensions = tuple(image.size)
    finally:
        bpy.data.images.remove(image)
    expected_dimensions = (validated["render"]["width"], validated["render"]["height"])
    if actual_dimensions != expected_dimensions:
        fail("BEAUTY_DIMENSIONS_MISMATCH", f"Beauty is {actual_dimensions}, expected {expected_dimensions}")
    beauty_sha256 = file_sha256(beauty_path)
    result = {
        "kind": RESULT_KIND,
        "schemaVersion": RESULT_SCHEMA_VERSION,
        "renderKey": package["renderKey"],
        "pipelineVersion": package["pipelineVersion"],
        "status": "succeeded",
        "outputs": [{
            "pass": "beauty",
            "objectKey": f"{package['renderKey']}/beauty.webp",
            "mimeType": "image/webp",
            "width": validated["render"]["width"],
            "height": validated["render"]["height"],
            "bytes": byte_count,
            "sha256": beauty_sha256,
        }],
    }
    write_json(result_path, result)
    worker_report = {
        "kind": "jq-local-blender-clay-worker-report",
        "schemaVersion": 1,
        "blenderVersion": bpy.app.version_string,
        "renderKey": package["renderKey"],
        "pipelineVersion": package["pipelineVersion"],
        "componentCount": len(validated["components"]),
        "submeshObjectCount": len(product_names),
        "constraintCount": len(constraint_names),
        "collectionCount": len(collection_names),
        "collectionNames": collection_names,
        "sceneObjectNames": sorted(obj.name for obj in scene.objects),
        "componentObjectNames": product_names,
        "roomObjectNames": room_names,
        "constraintObjectNames": constraint_names,
        "outputs": {
            "blend": str(blend_path),
            "beauty": str(beauty_path),
            "result": str(result_path),
        },
    }
    write_json(output_dir / "worker-report.json", worker_report)


def parse_arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render a verified TV01 clay package")
    parser.add_argument("--package", required=True)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--output-dir")
    parser.add_argument("--project-root")
    parser.add_argument("--blend")
    parser.add_argument("--beauty")
    parser.add_argument("--result")
    raw_arguments = argv[argv.index("--") + 1 :] if "--" in argv else argv[1:]
    arguments = parser.parse_args(raw_arguments)
    if not arguments.validate_only and not all(
        (arguments.output_dir, arguments.blend, arguments.beauty, arguments.result)
    ):
        parser.error("rendering requires --output-dir, --blend, --beauty, and --result")
    return arguments


def resolve_cli_paths(arguments: argparse.Namespace) -> dict[str, Path | None]:
    def absolute(value: str, label: str) -> Path:
        path = Path(value).expanduser()
        if not path.is_absolute():
            fail("RELATIVE_CLI_PATH", f"{label} must be an absolute path")
        return path.resolve(strict=False)

    package_path = absolute(arguments.package, "--package")
    project_root = (
        absolute(arguments.project_root, "--project-root")
        if arguments.project_root
        else Path(__file__).resolve().parents[2]
    )
    if not project_root.is_dir():
        fail("INVALID_PROJECT_ROOT", "Project root is not a directory")
    if arguments.validate_only:
        return {
            "package": package_path, "projectRoot": project_root, "outputDir": None,
            "blend": None, "beauty": None, "result": None,
        }
    output_dir = absolute(arguments.output_dir, "--output-dir")
    blend_path = absolute(arguments.blend, "--blend")
    beauty_path = absolute(arguments.beauty, "--beauty")
    result_path = absolute(arguments.result, "--result")
    if output_dir.exists() and not output_dir.is_dir():
        fail("INVALID_OUTPUT_DIRECTORY", "--output-dir exists but is not a directory")
    expected_names = {
        blend_path: "TV01-clay.blend",
        beauty_path: "beauty.webp",
        result_path: "result.json",
    }
    for path, expected_name in expected_names.items():
        if path.parent != output_dir or path.name != expected_name:
            fail("INVALID_OUTPUT_PATH", f"Output must be {output_dir / expected_name}")
    if package_path.name != "render-package.json" or package_path.parent != output_dir:
        fail("INVALID_PACKAGE_PATH", "Package must be output-dir/render-package.json")
    return {
        "package": package_path, "projectRoot": project_root, "outputDir": output_dir,
        "blend": blend_path, "beauty": beauty_path, "result": result_path,
    }


def main(argv: list[str]) -> int:
    arguments = parse_arguments(argv)
    paths = resolve_cli_paths(arguments)
    package_path = paths["package"]
    project_root = paths["projectRoot"]
    assert isinstance(package_path, Path) and isinstance(project_root, Path)
    package = load_strict_json(package_path)
    validated = validate_package(package)
    environment_path = validate_assets(package, validated, project_root)
    if arguments.validate_only:
        print(json.dumps({
            "valid": True,
            "renderKey": package["renderKey"],
            "componentCount": len(validated["components"]),
            "submeshObjectCount": validated["submeshCount"],
            "constraintCount": len(validated["constraints"]),
        }, separators=(",", ":")))
        return 0
    output_dir = paths["outputDir"]
    blend_path = paths["blend"]
    beauty_path = paths["beauty"]
    result_path = paths["result"]
    assert all(isinstance(path, Path) for path in (
        output_dir, blend_path, beauty_path, result_path
    ))
    output_dir.mkdir(parents=True, exist_ok=True)
    render_worker(
        package, validated, environment_path, output_dir, blend_path, beauty_path,
        result_path,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv))
    except WorkerError as error:
        print(f"JQ_BLENDER_WORKER_ERROR [{error.code}] {error}", file=sys.stderr)
        raise SystemExit(2)
    except SystemExit:
        raise
    except Exception as error:  # Blender/RNA failures must never become success.
        print(f"JQ_BLENDER_WORKER_ERROR [UNEXPECTED] {error}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise SystemExit(3)
