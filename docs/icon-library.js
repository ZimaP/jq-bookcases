import {
  diagramManifest,
  diagramSvg,
  iconManifest,
  iconSvg
} from "../icon-system.js?v=interface-polish-20260715a";

const sizeSamples = [16, 20, 24, 32, 40];
const gallery = document.querySelector("[data-icon-gallery]");
const diagramGallery = document.querySelector("[data-diagram-gallery]");

document.querySelector("[data-icon-count]").textContent = String(Object.keys(iconManifest).length);
document.querySelector("[data-diagram-count]").textContent = String(Object.keys(diagramManifest).length);

const byCategory = new Map();
for (const [name, definition] of Object.entries(iconManifest)) {
  if (!byCategory.has(definition.category)) byCategory.set(definition.category, []);
  byCategory.get(definition.category).push([name, definition]);
}

for (const [category, icons] of byCategory) {
  const section = document.createElement("section");
  section.className = "category-section";
  section.innerHTML = `
    <div class="category-heading">
      <h2>${category}</h2>
      <p>${icons.length} icon${icons.length === 1 ? "" : "s"}</p>
    </div>
    <div class="icon-grid"></div>
  `;
  const grid = section.querySelector(".icon-grid");

  for (const [name, definition] of icons) {
    const article = document.createElement("article");
    article.className = "icon-card";
    article.dataset.reviewIcon = name;
    article.innerHTML = `
      <header>
        <strong>${definition.label}</strong>
        <code>${name}</code>
        <p>${definition.meaning}</p>
      </header>
      <div class="size-row" aria-label="${definition.label} at required sizes">
        ${sizeSamples.map((size) => `<span><i style="--sample-size:${size}px">${iconSvg(name, { size })}</i><small>${size}</small></span>`).join("")}
      </div>
      <div class="ground-row">
        <span class="ground-light" title="Light background">${iconSvg(name, { size: 24 })}</span>
        <span class="ground-dark" title="Dark background">${iconSvg(name, { size: 24 })}</span>
      </div>
      <div class="state-row" aria-label="Static state review">
        <span><i>${iconSvg(name, { size: 20 })}</i><small>Default</small></span>
        <span class="is-hover"><i>${iconSvg(name, { size: 20 })}</i><small>Hover</small></span>
        <span class="is-selected"><i>${iconSvg(name, { size: 20 })}</i><small>Selected</small></span>
        <span class="is-disabled"><i>${iconSvg(name, { size: 20 })}</i><small>Disabled</small></span>
      </div>
    `;
    grid.append(article);
  }
  gallery.append(section);
}

for (const [name, definition] of Object.entries(diagramManifest)) {
  const article = document.createElement("article");
  article.className = "profile-card";
  article.innerHTML = `
    <span>${diagramSvg(name)}</span>
    <div><strong>${definition.label}</strong><code>${name}</code><p>${definition.meaning}</p></div>
  `;
  diagramGallery.append(article);
}
