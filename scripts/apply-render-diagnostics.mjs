import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const path = "configurator-3d.js";
let source = readFileSync(path, "utf8");

source = replaceOnce(
  source,
`    this.resize();
    this.update(this.state);
    this.animate();
`,
`    this.resize();
    if (!this.update(this.state)) {
      throw new Error("The initial 3D model failed the descriptor render contract.");
    }
    this.animate();
`,
  "initial renderer contract failure"
);

source = replaceOnce(
  source,
`    this.model = nextModel;
    this.scene.add(this.model);
    this.root.dataset.renderValid = "true";
    return true;
`,
`    this.model = nextModel;
    this.scene.add(this.model);
    this.root.dataset.renderValid = "true";
    this.root.dataset.renderComponents = String(this.lastRenderAudit.renderedCount || 0);
    this.root.dataset.renderExpected = String(this.lastRenderAudit.expectedCount || 0);
    return true;
`,
  "render component diagnostics"
);

source = replaceOnce(
  source,
`  animate() {
    this.renderer.render(this.scene, this.camera);
    window.requestAnimationFrame(() => this.animate());
  }
`,
`  animate() {
    this.renderer.render(this.scene, this.camera);
    const memory = this.renderer.info.memory;
    const render = this.renderer.info.render;
    this.root.dataset.webglGeometries = String(memory.geometries || 0);
    this.root.dataset.webglTextures = String(memory.textures || 0);
    this.root.dataset.webglCalls = String(render.calls || 0);
    this.root.dataset.webglTriangles = String(render.triangles || 0);
    window.requestAnimationFrame(() => this.animate());
  }
`,
  "WebGL resource diagnostics"
);

writeFileSync(path, source);
