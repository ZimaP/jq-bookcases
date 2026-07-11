import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicPages = [
  "index.html",
  "configurator.html",
  "how-it-works.html",
  "materials.html",
  "inspiration.html",
  "about.html",
  "faq.html",
  "request-quote.html",
  "privacy.html",
  "terms.html",
];

const pageSource = new Map(
  publicPages.map((file) => [file, readFileSync(path.join(rootDir, file), "utf8")]),
);
const siteSource = readFileSync(path.join(rootDir, "site.js"), "utf8");
const configuratorSource = readFileSync(
  path.join(rootDir, "configurator-3d.js"),
  "utf8",
);

function matches(text, pattern) {
  return Array.from(text.matchAll(pattern));
}

function tags(html, tagName) {
  return matches(html, new RegExp("<" + tagName + "\\b[^>]*>", "gi")).map(
    (match) => match[0],
  );
}

function attribute(tag, name) {
  const match = tag.match(
    new RegExp(
      "\\b" + name + "\\s*=\\s*(?:([\\\"'])([\\s\\S]*?)\\1|([^\\s\\\"'=<>]+))",
      "i",
    ),
  );
  return match ? match[2] ?? match[3] : null;
}

function hasClass(tag, className) {
  const value = attribute(tag, "class");
  return value ? value.split(/\s+/).includes(className) : false;
}

function normalizedText(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function attributeCount(html, name) {
  const attributePattern = new RegExp(
    "\\b" + name + "(?=\\s*=|\\s|/?>)",
    "i",
  );
  return matches(html, /<[a-z][^>]*>/gi).filter((match) =>
    attributePattern.test(match[0]),
  ).length;
}

function sharedAssetUrl(html, tagName, attrName, assetName) {
  return tags(html, tagName)
    .map((tag) => attribute(tag, attrName))
    .filter(Boolean)
    .filter((url) => url.split(/[?#]/, 1)[0] === assetName);
}

function cacheToken(url) {
  return new URL(url, "https://jq-bookcases.test/").searchParams.get("v");
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'");
}

function collectReferences(sourceName, source) {
  const references = [];
  const tagPattern = /<[a-z][^>]*>/gi;

  for (const match of source.matchAll(tagPattern)) {
    for (const attrName of ["href", "src"]) {
      const rawValue = attribute(match[0], attrName);
      if (!rawValue || rawValue.includes("${")) continue;
      references.push({
        sourceName,
        attrName,
        value: decodeHtmlAttribute(rawValue.trim()),
      });
    }
  }

  return references;
}

function collectScriptReferences(sourceName, source) {
  const references = collectReferences(sourceName, source);
  const literalPatterns = [
    /\bhref\s*:\s*([\"'])([^\"']+)\1/gi,
    /\b(?:const|let|var)\s+\w*(?:Href|Src)\s*=\s*([\"'])([^\"']+)\1/gi,
    /\.(?:href|src)\s*=\s*([\"'])([^\"']+)\1/gi,
    /setAttribute\(\s*([\"'])(?:href|src)\1\s*,\s*([\"'])([^\"']+)\2\s*\)/gi,
  ];

  for (const pattern of literalPatterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match.at(-1);
      references.push({ sourceName, attrName: "injected href/src", value });
    }
  }

  return references;
}

function localReference(reference) {
  const value = reference.value;
  if (
    !value ||
    value.startsWith("//") ||
    /^(?:data|javascript|mailto|sms|tel):/i.test(value) ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return null;
  }

  const hashIndex = value.indexOf("#");
  const fragment = hashIndex === -1 ? "" : value.slice(hashIndex + 1);
  const beforeHash = hashIndex === -1 ? value : value.slice(0, hashIndex);
  const pathname = beforeHash.split("?", 1)[0];
  const sourceDirectory = path.dirname(path.join(rootDir, reference.sourceName));
  const targetPath = pathname
    ? pathname.startsWith("/")
      ? path.resolve(rootDir, "." + pathname)
      : path.resolve(sourceDirectory, pathname)
    : path.join(rootDir, reference.sourceName);

  return { fragment: decodeURIComponent(fragment), targetPath };
}

test("the root exposes exactly the canonical public page set", () => {
  const actualPages = readdirSync(rootDir)
    .filter((file) => file.endsWith(".html"))
    .sort();
  const expectedPages = [...publicPages].sort();

  assert.deepEqual(actualPages, expectedPages);
  assert.equal(existsSync(path.join(rootDir, "contact.html")), false);
});

test("every canonical page satisfies the shared accessibility and metadata contract", async (t) => {
  const titles = [];
  const descriptions = [];
  const pageNames = [];

  for (const file of publicPages) {
    await t.test(file, () => {
      const html = pageSource.get(file);
      const htmlTag = tags(html, "html");
      const titleTags = matches(html, /<title\b[^>]*>([\s\S]*?)<\/title>/gi);
      const descriptionTags = tags(html, "meta").filter(
        (tag) => (attribute(tag, "name") || "").toLowerCase() === "description",
      );
      const bodyTags = tags(html, "body");
      const anchors = tags(html, "a");
      const mainTags = tags(html, "main").filter(
        (tag) => attribute(tag, "id") === "main",
      );

      assert.match(html, /^\s*<!doctype html>/i, file + " must start with an HTML doctype");
      assert.equal(htmlTag.length, 1, file + " must have one html element");
      assert.ok(attribute(htmlTag[0], "lang")?.trim(), file + " must declare a language");

      assert.equal(titleTags.length, 1, file + " must have one title");
      const title = normalizedText(titleTags[0][1]);
      assert.ok(title, file + " must have a non-empty title");
      titles.push([file, title]);

      assert.equal(descriptionTags.length, 1, file + " must have one meta description");
      const description = attribute(descriptionTags[0], "content")?.trim();
      assert.ok(description, file + " must have a non-empty meta description");
      descriptions.push([file, description]);

      assert.equal(bodyTags.length, 1, file + " must have one body element");
      const pageName = attribute(bodyTags[0], "data-page")?.trim();
      assert.ok(pageName, file + " must identify itself with body[data-page]");
      pageNames.push([file, pageName]);

      const skipLinks = anchors.filter(
        (tag) => hasClass(tag, "skip-link") && attribute(tag, "href") === "#main",
      );
      assert.equal(skipLinks.length, 1, file + " must have one skip link to #main");
      assert.equal(mainTags.length, 1, file + " must have one main#main landmark");
      assert.equal(
        attributeCount(html, "data-site-header"),
        1,
        file + " must have one shared header host",
      );
      assert.equal(
        attributeCount(html, "data-site-footer"),
        1,
        file + " must have one shared footer host; it may be visually hidden on the configurator",
      );

      const ids = matches(html, /\bid\s*=\s*([\"'])([^\"']+)\1/gi).map(
        (match) => match[2],
      );
      const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
      assert.deepEqual(
        [...new Set(duplicateIds)],
        [],
        file + " must not contain duplicate static IDs",
      );

      for (const imageTag of tags(html, "img")) {
        assert.ok(
          attribute(imageTag, "alt")?.trim(),
          file + " contains an image without meaningful alt text: " + imageTag,
        );
      }

      const staticHeadingCount = matches(html, /<h1\b[^>]*>/gi).length;
      if (file === "configurator.html" && staticHeadingCount === 0) {
        assert.equal(
          attributeCount(html, "data-bookcase-builder"),
          1,
          "configurator.html must provide one dynamic builder host when its h1 is rendered by JavaScript",
        );
        assert.match(
          configuratorSource,
          /<h1\b/i,
          "configurator-3d.js must document the configurator's dynamic h1 in its rendered template",
        );
      } else {
        assert.equal(staticHeadingCount, 1, file + " must have exactly one h1");
      }
    });
  }

  function assertUnique(values, label) {
    const byValue = new Map();
    for (const [file, value] of values) {
      const key = normalizedText(value).toLowerCase();
      byValue.set(key, [...(byValue.get(key) || []), file]);
    }
    const duplicates = [...byValue.values()].filter((files) => files.length > 1);
    assert.deepEqual(duplicates, [], label + " must be unique across canonical pages");
  }

  assertUnique(titles, "Titles");
  assertUnique(descriptions, "Meta descriptions");
  assertUnique(pageNames, "data-page values");
});

test("all pages load the shared stylesheet and site script with one cache token", () => {
  const tokens = [];

  for (const file of publicPages) {
    const html = pageSource.get(file);
    const stylesheetUrls = sharedAssetUrl(html, "link", "href", "styles.css");
    const scriptUrls = sharedAssetUrl(html, "script", "src", "site.js");

    assert.equal(stylesheetUrls.length, 1, file + " must include styles.css exactly once");
    assert.equal(scriptUrls.length, 1, file + " must include site.js exactly once");

    const stylesheetToken = cacheToken(stylesheetUrls[0]);
    const scriptToken = cacheToken(scriptUrls[0]);
    assert.ok(stylesheetToken, file + " styles.css must have a cache token");
    assert.ok(scriptToken, file + " site.js must have a cache token");
    assert.equal(
      stylesheetToken,
      scriptToken,
      file + " must use the same cache token for styles.css and site.js",
    );
    tokens.push(stylesheetToken);
  }

  assert.equal(new Set(tokens).size, 1, "all canonical pages must use the same shared cache token");
});

test("every static local href, src, and HTML fragment resolves", () => {
  const references = [
    ...[...pageSource].flatMap(([file, html]) => collectReferences(file, html)),
    ...collectScriptReferences("site.js", siteSource),
  ];

  for (const reference of references) {
    const local = localReference(reference);
    if (!local) continue;

    assert.ok(
      local.targetPath === rootDir || local.targetPath.startsWith(rootDir + path.sep),
      reference.sourceName + " contains a local reference outside the project: " + reference.value,
    );
    assert.ok(
      existsSync(local.targetPath),
      reference.sourceName + " contains a missing " + reference.attrName + ": " + reference.value,
    );

    if (local.fragment && path.extname(local.targetPath).toLowerCase() === ".html") {
      const targetHtml = readFileSync(local.targetPath, "utf8");
      const targetIds = new Set(
        matches(targetHtml, /\bid\s*=\s*([\"'])([^\"']+)\1/gi).map(
          (match) => match[2],
        ),
      );
      assert.ok(
        targetIds.has(local.fragment),
        reference.sourceName + " contains an unresolved fragment: " + reference.value,
      );
    }
  }
});

test("public sources contain no retired routes, newsletter UI, or fake backend copy", () => {
  const publicSource = [...pageSource.values(), siteSource].join("\n");
  const forbidden = [
    [/#design-builder/i, "the retired design-builder fragment"],
    [/contact\.html/i, "the retired contact page"],
    [/newsletter/i, "newsletter UI or behavior"],
    [/final submission connection/i, "placeholder submission copy"],
    [/\bbackend\b/i, "placeholder backend copy"],
    [/fake backend/i, "fake-backend copy"],
  ];

  for (const [pattern, label] of forbidden) {
    assert.doesNotMatch(publicSource, pattern, "public sources still contain " + label);
  }
});

test("public branding and product vocabulary use the canonical John Quinn Bookcases names", () => {
  const publicSource = [...pageSource.values(), siteSource, configuratorSource].join("\n");

  for (const [file, html] of pageSource) {
    const title = normalizedText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
    assert.match(title, /John Quinn Bookcases/, file + " title must use the canonical brand name");
  }

  assert.match(pageSource.get("configurator.html"), /3D Bookcase Configurator/);
  assert.match(siteSource, /JOHN QUINN/);
  assert.match(siteSource, /BOOKCASES · BUILT-INS & MILLWORK/);

  const retiredVocabulary = [
    [/\bJQ Bookcases\b/i, "JQ Bookcases"],
    [/\bJQ Woodworking\b/i, "JQ Woodworking"],
    [/\bBookcase Builder\b/i, "Bookcase Builder"],
    [/\bBookcase Specifier\b/i, "Bookcase Specifier"],
    [/\bDesign Yours\b/i, "Design Yours"],
  ];

  for (const [pattern, label] of retiredVocabulary) {
    assert.doesNotMatch(publicSource, pattern, "public sources still contain noncanonical wording: " + label);
  }
});

test("canonical design and quote routes have inbound links", () => {
  const references = [
    ...[...pageSource].flatMap(([file, html]) => collectReferences(file, html)),
    ...collectScriptReferences("site.js", siteSource),
  ];

  for (const route of ["configurator.html", "request-quote.html"]) {
    const inbound = references.filter((reference) => {
      const local = localReference(reference);
      if (!local) return false;
      return (
        path.basename(local.targetPath) === route &&
        path.basename(reference.sourceName) !== route
      );
    });

    assert.ok(inbound.length > 0, route + " must have an inbound link from another public source");
  }
});
