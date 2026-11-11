import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const kinds = new Set(["decision", "option", "step", "fact", "assumption", "question", "risk", "design"]);
const idPattern = /^[a-z][a-z0-9-]{0,99}$/;

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected an object");
}

function text(value, path) {
  if (typeof value !== "string" || !value.trim()) fail(path, "expected nonempty text");
}

function array(value, path) {
  if (!Array.isArray(value)) fail(path, "expected an array");
}

function id(value, path) {
  if (typeof value !== "string" || !idPattern.test(value)) fail(path, "use lowercase letters, digits, and hyphens, starting with a letter");
}

function texts(value, path) {
  array(value, path);
  value.forEach((entry, index) => text(entry, `${path}[${index}]`));
}

async function render(input, output) {
  const plan = JSON.parse(await readFile(input, "utf8"));
  object(plan, "plan");
  if (plan.schemaVersion !== 1) fail("schemaVersion", "expected 1");
  id(plan.planId, "planId");
  if (!Number.isSafeInteger(plan.revision) || plan.revision < 1) fail("revision", "expected a positive integer");
  for (const key of ["title", "summary", "recommendation", "scope"]) text(plan[key], key);
  if (plan.theme !== undefined && !["dark", "light"].includes(plan.theme)) fail("theme", "expected dark or light");
  if (plan.changes !== undefined) text(plan.changes, "changes");
  array(plan.sections, "sections");
  if (!plan.sections.length) fail("sections", "include at least one section");
  const ids = new Set(["overview", "history", "exports", "content", "navigation", "plan-meta", "plan-details", "review-count", "copy", "copy-2", "copy-status", "download", "plan-download", "storage-warning", "save-status", "sections", "history-items", "transfer", "restore", "feedback-text", "action-status", "overall", "overall-section"]);
  const items = new Map();
  function register(value, path) {
    id(value, path);
    if (ids.has(value)) fail(path, `duplicate or reserved ID: ${value}`);
    ids.add(value);
  }
  for (const [sectionIndex, section] of plan.sections.entries()) {
    const path = `sections[${sectionIndex}]`;
    object(section, path);
    register(section.id, `${path}.id`);
    text(section.title, `${path}.title`);
    text(section.summary, `${path}.summary`);
    array(section.items, `${path}.items`);
    if (!section.items.length) fail(path, "include at least one item");
    for (const [itemIndex, item] of section.items.entries()) {
      const location = `${path}.items[${itemIndex}]`;
      object(item, location);
      register(item.id, `${location}.id`);
      if (!kinds.has(item.kind)) fail(`${location}.kind`, "unknown item kind");
      text(item.title, `${location}.title`);
      text(item.body, `${location}.body`);
      if (item.recommended !== undefined && typeof item.recommended !== "boolean") fail(location, "recommended must be a boolean");
      for (const key of ["criteria", "evidence", "dependsOn"]) {
        if (item[key] !== undefined) texts(item[key], `${location}.${key}`);
      }
      if (item.preview !== undefined) text(item.preview, `${location}.preview`);
      if (item.previewFile !== undefined) {
        const preview = item.previewFile;
        object(preview, `${location}.previewFile`);
        text(preview.path, `${location}.previewFile.path`);
        text(preview.label, `${location}.previewFile.label`);
        const height = preview.height ?? 400;
        if (!Number.isSafeInteger(height) || height < 180 || height > 1800) fail(location, "preview height must be an integer from 180 to 1800");
        const mobileHeight = preview.mobileHeight ?? height;
        if (!Number.isSafeInteger(mobileHeight) || mobileHeight < 180 || mobileHeight > 1800) fail(location, "mobile preview height must be an integer from 180 to 1800");
        const path = resolve(dirname(input), preview.path);
        if (![".html", ".htm"].includes(extname(path).toLowerCase())) fail(location, "preview files must be local HTML");
        const source = await readFile(path, "utf8");
        const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">`;
        item.previewFile = { label: preview.label, height, mobileHeight, html: `<!doctype html>${policy}<meta name="viewport" content="width=device-width, initial-scale=1">${source}` };
      }
      if (item.details !== undefined) {
        array(item.details, `${location}.details`);
        item.details.forEach((detail) => {
          object(detail, `${location}.details`);
          text(detail.title, `${location}.details.title`);
          text(detail.body, `${location}.details.body`);
        });
      }
      if (item.links !== undefined) {
        array(item.links, `${location}.links`);
        item.links.forEach((link) => {
          object(link, `${location}.links`);
          text(link.label, `${location}.links.label`);
          text(link.url, `${location}.links.url`);
          const url = new URL(link.url);
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) fail(location, "links require HTTP(S) without credentials");
        });
      }
      if (item.image !== undefined) {
        object(item.image, `${location}.image`);
        for (const key of ["path", "alt", "caption"]) text(item.image[key], `${location}.image.${key}`);
        const image = { alt: item.image.alt, caption: item.image.caption };
        for (const [pathKey, dataKey] of [["path", "data"], ["mobilePath", "mobileData"]]) {
          if (item.image[pathKey] === undefined) continue;
          text(item.image[pathKey], `${location}.image.${pathKey}`);
          const path = resolve(dirname(input), item.image[pathKey]);
          const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(path).toLowerCase()];
          if (!mime) fail(location, "images must be local PNG, JPEG, or WebP files");
          const bytes = await readFile(path);
          image[dataKey] = `data:${mime};base64,${bytes.toString("base64")}`;
        }
        item.image = image;
      }
      items.set(item.id, item);
    }
  }
  for (const itemId of items.keys()) {
    for (const control of [`decision-${itemId}`, `comment-${itemId}`, `${itemId}-label`, `comment-${itemId}-status`]) {
      if (ids.has(control)) fail("id", `item ID conflicts with a review control: ${control}`);
      ids.add(control);
    }
  }
  const visited = new Set();
  const active = new Set();
  function visit(itemId) {
    if (!items.has(itemId)) fail("dependsOn", `unknown item: ${itemId}`);
    if (active.has(itemId)) fail("dependsOn", `dependency cycle at ${itemId}`);
    if (visited.has(itemId)) return;
    active.add(itemId);
    for (const dependency of items.get(itemId).dependsOn ?? []) visit(dependency);
    active.delete(itemId);
    visited.add(itemId);
  }
  for (const itemId of items.keys()) visit(itemId);
  const template = await readFile(new URL("../assets/review.html", import.meta.url), "utf8");
  const gallery = await readFile(new URL("../assets/control-ui-gallery.css", import.meta.url), "utf8");
  const payload = JSON.stringify(plan).replace(/[<>&\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  const html = template.replace("/*__GALLERY_CSS__*/", () => gallery).replace("/*__PLAN__*/", () => payload);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  console.log(output);
}

if (process.argv.length !== 4) {
  console.error("Usage: node render.mjs <plan.json> <review.html>");
  process.exitCode = 1;
} else {
  const input = resolve(process.argv[2]);
  const output = resolve(process.argv[3]);
  if (input === output || ["../assets/review.html", "../assets/control-ui-gallery.css"].some(path => output === fileURLToPath(new URL(path, import.meta.url)))) {
    console.error("Refusing to overwrite the input plan or the skill template. Choose a separate HTML output path.");
    process.exitCode = 1;
  } else {
    try {
      await render(input, output);
    } catch (error) {
      console.error(`Cannot create review page: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
