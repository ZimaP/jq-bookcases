const PLACEMENT_MODE_KEY = "jqCabinetArPlacementMode";
const ENHANCED_ATTRIBUTE = "data-jq-placement-enhanced";

const placementModes = Object.freeze({
  fixed: {
    arScale: "fixed",
    heading: "Place your cabinet at true scale",
    launchLabel: "Start true-size AR",
    note: "Scale is locked to your configured dimensions. Move and rotate the cabinet without resizing it."
  },
  auto: {
    arScale: "auto",
    heading: "Place and adjust your cabinet",
    launchLabel: "Start adjustable AR",
    note: "Pinch to resize for easier visualization. Adjustable mode is not measurement-accurate."
  }
});

let placementObserver;

document.addEventListener("DOMContentLoaded", initializePlacementEnhancements);

function initializePlacementEnhancements() {
  enhanceAvailableViewers();
  placementObserver = new MutationObserver(enhanceAvailableViewers);
  placementObserver.observe(document.body, { childList: true, subtree: true });
}

function enhanceAvailableViewers() {
  if (!isTouchDevice()) return;
  document.querySelectorAll(`.cabinet-ar-content model-viewer:not([${ENHANCED_ATTRIBUTE}])`).forEach(enhanceViewer);
}

function enhanceViewer(viewer) {
  const layout = viewer.closest(".cabinet-ar-layout");
  const guidance = layout?.querySelector(".cabinet-ar-guidance");
  if (!guidance) return;

  viewer.setAttribute(ENHANCED_ATTRIBUTE, "true");
  const controls = document.createElement("section");
  controls.className = "cabinet-ar-placement-coach";
  controls.setAttribute("aria-label", "AR placement controls and stability guidance");
  controls.innerHTML = `
    <span class="section-kicker">Placement mode</span>
    <div class="cabinet-ar-placement-modes" role="group" aria-label="Choose AR placement mode">
      <button type="button" data-ar-placement-mode="fixed" aria-pressed="true">
        <strong>True Size</strong><small>Accurate scale</small>
      </button>
      <button type="button" data-ar-placement-mode="auto" aria-pressed="false">
        <strong>Easy Placement</strong><small>Resizable</small>
      </button>
    </div>
    <p class="cabinet-ar-placement-note" data-ar-placement-note></p>
    <div class="cabinet-ar-stability-guide">
      <strong>For steadier placement</strong>
      <ul>
        <li>Use a bright, evenly lit room and avoid reflections.</li>
        <li>Start several feet back with the floor and wall edge visible.</li>
        <li>Sweep the device slowly for 5–10 seconds before placing.</li>
        <li>If the cabinet jumps, exit AR and rescan from a lower angle.</li>
      </ul>
    </div>
    <p class="cabinet-ar-tracking-status" data-ar-tracking-status role="status" aria-live="polite">Ready to scan your room.</p>
  `;
  guidance.prepend(controls);

  const initialMode = readPlacementMode();
  applyPlacementMode(viewer, controls, initialMode);

  controls.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-ar-placement-mode]");
    if (!button) return;
    applyPlacementMode(viewer, controls, button.dataset.arPlacementMode);
  });

  viewer.addEventListener("ar-status", (event) => {
    updateTrackingStatus(viewer, controls, event.detail?.status || "");
  });
}

function applyPlacementMode(viewer, controls, requestedMode) {
  const mode = placementModes[requestedMode] ? requestedMode : "fixed";
  const definition = placementModes[mode];
  viewer.setAttribute("ar-scale", definition.arScale);
  viewer.dataset.jqPlacementMode = mode;

  controls.querySelectorAll("[data-ar-placement-mode]").forEach((button) => {
    const active = button.dataset.arPlacementMode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const note = controls.querySelector("[data-ar-placement-note]");
  if (note) note.textContent = definition.note;

  const heading = viewer.closest("dialog")?.querySelector("#cabinet-ar-title");
  if (heading) heading.textContent = definition.heading;

  const launchButton = viewer.querySelector("[data-ar-launch]");
  if (launchButton) {
    launchButton.textContent = definition.launchLabel;
    launchButton.dataset.arMode = mode === "fixed" ? "true-scale" : "adjustable";
  }

  try {
    localStorage.setItem(PLACEMENT_MODE_KEY, mode);
  } catch (error) {
    // Placement mode persistence is optional when storage is restricted.
  }
}

function updateTrackingStatus(viewer, controls, status) {
  const message = controls.querySelector("[data-ar-tracking-status]");
  const scanPrompt = viewer.querySelector(".cabinet-ar-scan-prompt");
  if (!message) return;

  if (status === "session-started") {
    const text = "Scan slowly and keep the floor-to-wall edge in view until tracking settles.";
    message.textContent = text;
    if (scanPrompt) scanPrompt.textContent = text;
    return;
  }
  if (status === "object-placed") {
    const adjustable = viewer.dataset.jqPlacementMode === "auto";
    message.textContent = adjustable
      ? "Placed. Drag to move, use two fingers to rotate, and pinch only when resizing is intentional."
      : "Placed at true size. Drag to move and use two fingers to rotate it against the wall.";
    return;
  }
  if (status === "failed") {
    message.textContent = "Tracking was lost. Improve lighting, include more floor texture, and scan again slowly.";
    return;
  }
  if (status === "not-presenting") {
    message.textContent = "Ready to scan your room.";
  }
}

function readPlacementMode() {
  try {
    const saved = localStorage.getItem(PLACEMENT_MODE_KEY);
    return placementModes[saved] ? saved : "fixed";
  } catch (error) {
    return "fixed";
  }
}

function isTouchDevice() {
  return Boolean(
    navigator.maxTouchPoints > 0
    || window.matchMedia?.("(pointer: coarse)")?.matches
    || /Android|iPad|iPhone|iPod/i.test(navigator.userAgent)
  );
}
