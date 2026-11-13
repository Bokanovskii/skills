import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const idPattern = /^[a-z][a-z0-9-]{0,63}$/;
const blockTypes = new Set(["facts", "steps", "risks", "comparison", "visual", "code", "note", "decision", "question"]);
const stepStatuses = new Set(["todo", "working", "done", "blocked"]);
const replyStatuses = new Set(["answered", "changed", "not-changed"]);
const common = ["id", "type", "title", "body", "details", "evidence", "links"];
const blockKeys = {
  facts: ["items"],
  steps: ["items"],
  risks: ["items"],
  comparison: ["columns", "rows"],
  visual: ["image", "previewFile"],
  code: ["code", "language"],
  note: [],
  decision: ["options", "answer"],
  question: ["placeholder", "answer"]
};
// These fields record progress or answers. They do not change the proposal itself.
const progressKeys = new Set(["_track", "status", "statusNote", "answer", "granted"]);

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}
function object(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "expected an object");
}
function keys(value, allowed, path) {
  object(value, path);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(path, `unknown field "${key}". Allowed fields: ${allowed.join(", ")}`);
}
function text(value, path) {
  if (typeof value !== "string" || !value.trim()) fail(path, "expected nonempty text");
}
function optionalText(value, path) {
  if (value !== undefined) text(value, path);
}
function array(value, path, min = 0, max = Infinity) {
  if (!Array.isArray(value)) fail(path, "expected an array");
  if (value.length < min) fail(path, `include at least ${min} entr${min === 1 ? "y" : "ies"}`);
  if (value.length > max) fail(path, `include at most ${max} entries`);
}
function texts(value, path) {
  if (value === undefined) return;
  array(value, path);
  value.forEach((entry, index) => text(entry, `${path}[${index}]`));
}
function id(value, path) {
  if (typeof value !== "string" || !idPattern.test(value)) fail(path, "use lowercase letters, digits, and hyphens, start with a letter, and use at most 64 characters");
  if (value.startsWith("ip-")) fail(path, "IDs that start with ip- are reserved for the page");
}
function hash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
function content(unit) {
  const copy = JSON.parse(JSON.stringify(unit, (key, value) => progressKeys.has(key) ? undefined : value));
  // Each step has its own change record, so a steps block compares only its own text.
  if (unit.type === "steps") delete copy.items;
  return copy;
}
function flatten(unit) {
  const lines = [];
  const walk = (value, key) => {
    if (["id", "type", "path", "mobilePath", "data", "mobileData", "html", "height", "mobileHeight", "see", "after", "recommended", "url"].includes(key)) return;
    if (typeof value === "string") lines.push(value);
    else if (Array.isArray(value)) value.forEach(entry => walk(entry));
    else if (value && typeof value === "object") for (const [name, entry] of Object.entries(value)) walk(entry, name);
  };
  walk(content(unit));
  return lines.join("\n");
}

function shared(block, path) {
  optionalText(block.title, `${path}.title`);
  optionalText(block.body, `${path}.body`);
  texts(block.evidence, `${path}.evidence`);
  if (block.details !== undefined) {
    array(block.details, `${path}.details`);
    block.details.forEach((detail, index) => {
      keys(detail, ["title", "body"], `${path}.details[${index}]`);
      text(detail.title, `${path}.details[${index}].title`);
      text(detail.body, `${path}.details[${index}].body`);
    });
  }
  if (block.links !== undefined) {
    array(block.links, `${path}.links`);
    block.links.forEach((link, index) => {
      const where = `${path}.links[${index}]`;
      keys(link, ["label", "url"], where);
      text(link.label, `${where}.label`);
      text(link.url, `${where}.url`);
      let url;
      try { url = new URL(link.url); } catch { fail(where, "expected an absolute HTTP(S) URL"); }
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) fail(where, "links require HTTP(S) without credentials");
    });
  }
}

async function embed(block, input, path) {
  const sources = ["image", "previewFile"].filter(key => block[key] !== undefined);
  if (sources.length !== 1) fail(path, "a visual block needs exactly one of image or previewFile");
  text(block.title, `${path}.title`);
  if (block.previewFile) {
    const preview = block.previewFile;
    keys(preview, ["path", "label", "height", "mobileHeight"], `${path}.previewFile`);
    text(preview.path, `${path}.previewFile.path`);
    text(preview.label, `${path}.previewFile.label`);
    const height = preview.height ?? 400;
    const mobileHeight = preview.mobileHeight ?? height;
    for (const value of [height, mobileHeight]) {
      if (!Number.isSafeInteger(value) || value < 180 || value > 1800) fail(`${path}.previewFile`, "preview height must be an integer from 180 to 1800");
    }
    const file = resolve(dirname(input), preview.path);
    if (![".html", ".htm"].includes(extname(file).toLowerCase())) fail(`${path}.previewFile.path`, "preview files must be local HTML");
    const source = await readFile(file, "utf8");
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">`;
    block.previewFile = { label: preview.label, height, mobileHeight, path: preview.path, html: `<!doctype html>${policy}<meta name="viewport" content="width=device-width, initial-scale=1">${source}` };
  }
  if (block.image) {
    keys(block.image, ["path", "mobilePath", "alt", "caption"], `${path}.image`);
    for (const key of ["path", "alt", "caption"]) text(block.image[key], `${path}.image.${key}`);
    const image = { alt: block.image.alt, caption: block.image.caption, path: block.image.path };
    for (const [pathKey, dataKey] of [["path", "data"], ["mobilePath", "mobileData"]]) {
      if (block.image[pathKey] === undefined) continue;
      text(block.image[pathKey], `${path}.image.${pathKey}`);
      const file = resolve(dirname(input), block.image[pathKey]);
      const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extname(file).toLowerCase()];
      if (!mime) fail(`${path}.image.${pathKey}`, "images must be local PNG, JPEG, or WebP files");
      image[dataKey] = `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
      if (pathKey === "mobilePath") image.mobilePath = block.image.mobilePath;
    }
    block.image = image;
  }
}

export async function validate(plan, input) {
  keys(plan, ["schemaVersion", "planId", "revision", "kind", "title", "summary", "recommendation", "scope", "changes", "theme", "terms", "approval", "sections", "replies"], "plan");
  if (plan.schemaVersion !== 2) fail("schemaVersion", "expected 2. Version 1 plans are not supported. Write a new version 2 plan");
  id(plan.planId, "planId");
  if (!Number.isSafeInteger(plan.revision) || plan.revision < 1) fail("revision", "expected a positive integer");
  for (const key of ["title", "summary", "recommendation", "scope"]) text(plan[key], key);
  optionalText(plan.changes, "changes");
  if (plan.kind !== undefined && !["design", "engineering", "mixed"].includes(plan.kind)) fail("kind", "expected design, engineering, or mixed");
  if (plan.theme !== undefined && !["dark", "light"].includes(plan.theme)) fail("theme", "expected dark or light");
  if (plan.terms !== undefined) {
    object(plan.terms, "terms");
    const entries = Object.entries(plan.terms);
    if (entries.length > 80) fail("terms", "include at most 80 terms");
    for (const [term, definition] of entries) {
      if (!term.trim() || term.length > 60) fail(`terms.${term}`, "a term needs 1 to 60 characters");
      text(definition, `terms.${term}`);
      if (definition.length > 600) fail(`terms.${term}`, "keep a definition under 600 characters");
    }
  }
  const ids = new Set();
  const register = (value, path) => {
    id(value, path);
    if (ids.has(value)) fail(path, `duplicate ID: ${value}`);
    ids.add(value);
  };
  const units = new Map();
  const steps = new Map();
  const visuals = new Set();
  if (plan.approval !== undefined) {
    keys(plan.approval, ["covers", "okay", "approvedIn"], "approval");
    optionalText(plan.approval.covers, "approval.covers");
    if (plan.approval.approvedIn !== undefined && (!Number.isSafeInteger(plan.approval.approvedIn) || plan.approval.approvedIn < 1 || plan.approval.approvedIn > plan.revision)) fail("approval.approvedIn", "expected a revision from 1 to the current revision");
    if (plan.approval.okay !== undefined) {
      array(plan.approval.okay, "approval.okay", 0, 8);
      plan.approval.okay.forEach((entry, index) => {
        const path = `approval.okay[${index}]`;
        keys(entry, ["id", "action", "why", "granted"], path);
        register(entry.id, `${path}.id`);
        text(entry.action, `${path}.action`);
        text(entry.why, `${path}.why`);
        if (entry.granted !== undefined && typeof entry.granted !== "boolean") fail(`${path}.granted`, "expected true or false");
      });
    }
  }
  array(plan.sections, "sections", 1);
  for (const [sectionIndex, section] of plan.sections.entries()) {
    const path = `sections[${sectionIndex}]`;
    keys(section, ["id", "title", "summary", "blocks"], path);
    register(section.id, `${path}.id`);
    text(section.title, `${path}.title`);
    optionalText(section.summary, `${path}.summary`);
    array(section.blocks, `${path}.blocks`, 1);
    for (const [blockIndex, block] of section.blocks.entries()) {
      const where = `${path}.blocks[${blockIndex}]`;
      object(block, where);
      if (!blockTypes.has(block.type)) fail(`${where}.type`, `expected one of ${[...blockTypes].join(", ")}`);
      keys(block, [...common, ...blockKeys[block.type]], where);
      register(block.id, `${where}.id`);
      shared(block, where);
      units.set(block.id, block);
      if (block.type === "facts") {
        array(block.items, `${where}.items`, 1);
        block.items.forEach((item, index) => {
          keys(item, ["label", "value"], `${where}.items[${index}]`);
          text(item.label, `${where}.items[${index}].label`);
          text(item.value, `${where}.items[${index}].value`);
        });
      } else if (block.type === "steps") {
        array(block.items, `${where}.items`, 1);
        block.items.forEach((step, index) => {
          const at = `${where}.items[${index}]`;
          keys(step, ["id", "title", "body", "after", "status", "statusNote", "criteria", "evidence", "details", "links"], at);
          register(step.id, `${at}.id`);
          text(step.title, `${at}.title`);
          shared(step, at);
          texts(step.criteria, `${at}.criteria`);
          texts(step.after, `${at}.after`);
          if (step.status !== undefined && !stepStatuses.has(step.status)) fail(`${at}.status`, "expected todo, working, done, or blocked");
          optionalText(step.statusNote, `${at}.statusNote`);
          steps.set(step.id, step);
          units.set(step.id, step);
        });
      } else if (block.type === "risks") {
        array(block.items, `${where}.items`, 1);
        block.items.forEach((item, index) => {
          keys(item, ["title", "effect", "response"], `${where}.items[${index}]`);
          for (const key of ["title", "effect", "response"]) text(item[key], `${where}.items[${index}].${key}`);
        });
      } else if (block.type === "comparison") {
        texts(block.columns, `${where}.columns`);
        array(block.columns, `${where}.columns`, 1, 6);
        array(block.rows, `${where}.rows`, 2);
        block.rows.forEach((row, index) => {
          keys(row, ["option", "cells"], `${where}.rows[${index}]`);
          text(row.option, `${where}.rows[${index}].option`);
          texts(row.cells, `${where}.rows[${index}].cells`);
          if (row.cells?.length !== block.columns.length) fail(`${where}.rows[${index}].cells`, `expected ${block.columns.length} cells, one for each column`);
        });
      } else if (block.type === "visual") {
        await embed(block, input, where);
        visuals.add(block.id);
      } else if (block.type === "code") {
        text(block.code, `${where}.code`);
        optionalText(block.language, `${where}.language`);
      } else if (block.type === "note") {
        text(block.body, `${where}.body`);
      } else if (block.type === "decision") {
        text(block.title, `${where}.title`);
        array(block.options, `${where}.options`, 2, 4);
        const optionIds = new Set();
        let recommended = 0;
        block.options.forEach((option, index) => {
          const at = `${where}.options[${index}]`;
          keys(option, ["id", "label", "benefit", "cost", "recommended", "see"], at);
          id(option.id, `${at}.id`);
          if (optionIds.has(option.id) || option.id === "other") fail(`${at}.id`, `duplicate or reserved option ID: ${option.id}`);
          optionIds.add(option.id);
          for (const key of ["label", "benefit", "cost"]) text(option[key], `${at}.${key}`);
          if (option.recommended !== undefined && typeof option.recommended !== "boolean") fail(`${at}.recommended`, "expected true or false");
          if (option.recommended) recommended++;
          optionalText(option.see, `${at}.see`);
        });
        if (recommended > 1) fail(`${where}.options`, "recommend at most one option");
        if (block.answer !== undefined) {
          keys(block.answer, ["option", "note"], `${where}.answer`);
          text(block.answer.option, `${where}.answer.option`);
          if (block.answer.option !== "other" && !optionIds.has(block.answer.option)) fail(`${where}.answer.option`, `unknown option: ${block.answer.option}`);
          if (block.answer.option === "other") text(block.answer.note, `${where}.answer.note`);
          else optionalText(block.answer.note, `${where}.answer.note`);
        }
      } else if (block.type === "question") {
        text(block.title, `${where}.title`);
        optionalText(block.placeholder, `${where}.placeholder`);
        optionalText(block.answer, `${where}.answer`);
      }
    }
  }
  for (const block of units.values()) {
    for (const option of block.type === "decision" ? block.options : []) {
      if (option.see !== undefined && !visuals.has(option.see)) fail(`${block.id}.options.${option.id}.see`, `expected the ID of a visual block, not ${option.see}`);
    }
  }
  const done = new Set();
  const active = new Set();
  const visit = stepId => {
    if (active.has(stepId)) fail(`${stepId}.after`, `dependency cycle at ${stepId}`);
    if (done.has(stepId)) return;
    active.add(stepId);
    for (const dependency of steps.get(stepId).after ?? []) {
      if (!steps.has(dependency)) fail(`${stepId}.after`, `unknown step: ${dependency}`);
      visit(dependency);
    }
    active.delete(stepId);
    done.add(stepId);
  };
  for (const stepId of steps.keys()) visit(stepId);
  if (plan.replies !== undefined) {
    array(plan.replies, "replies");
    const seen = new Set();
    plan.replies.forEach((reply, index) => {
      const path = `replies[${index}]`;
      keys(reply, ["to", "comment", "status", "text", "revision"], path);
      if (typeof reply.to !== "string" || !/^[a-z][a-z0-9-]{0,63}\.[1-9][0-9]{0,3}$/.test(reply.to)) fail(`${path}.to`, "expected a comment ID from the feedback, such as stage-restore.1");
      if (seen.has(reply.to)) fail(`${path}.to`, `two replies to ${reply.to}`);
      seen.add(reply.to);
      text(reply.comment, `${path}.comment`);
      if (!replyStatuses.has(reply.status)) fail(`${path}.status`, "expected answered, changed, or not-changed");
      text(reply.text, `${path}.text`);
      reply.revision ??= plan.revision;
      if (!Number.isSafeInteger(reply.revision) || reply.revision < 1 || reply.revision > plan.revision) fail(`${path}.revision`, "expected a revision from 1 to the current revision");
    });
  }
  return { units, steps };
}

function approvalParts(plan, steps) {
  return {
    steps: hash([...steps.keys()].sort()),
    scope: hash(plan.scope),
    okay: hash((plan.approval?.okay ?? []).map(entry => [entry.id, entry.action]))
  };
}

function priorPlan(html) {
  const match = /<script type="application\/json" id="ip-plan">([\s\S]*?)<\/script>/.exec(html);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

// Compare each block and step with the page from the earlier render so that the review shows only what changed.
function track(plan, units, steps, prior, notices) {
  const parts = approvalParts(plan, steps);
  plan._approvalParts = parts;
  if (!prior || prior.schemaVersion !== 2 || prior.planId !== plan.planId) {
    if (prior) notices.push(`The earlier page at this path belongs to another plan (${prior.planId ?? "unknown"}). Change tracking starts again.`);
    for (const unit of units.values()) unit._track = { changedIn: plan.revision, fp: hash(content(unit)) };
    plan._history = false;
    return;
  }
  if (prior.revision > plan.revision) throw new Error(`revision: the earlier page is revision ${prior.revision}. Use ${prior.revision} or higher`);
  const before = new Map();
  for (const section of prior.sections ?? []) {
    for (const block of section.blocks ?? []) {
      before.set(block.id, block);
      if (block.type === "steps") for (const step of block.items ?? []) before.set(step.id, step);
    }
  }
  const sameRevision = prior.revision === plan.revision;
  for (const [unitId, unit] of units) {
    const fp = hash(content(unit));
    const old = before.get(unitId);
    if (!old?._track) unit._track = { changedIn: plan.revision, fp, added: true };
    else if (old._track.fp === fp) unit._track = old._track;
    else if (sameRevision && old._track.changedIn === plan.revision) unit._track = { ...old._track, fp, ...(old._track.previous !== undefined ? { current: flatten(unit) } : {}) };
    else unit._track = { changedIn: plan.revision, fp, previous: flatten(old), current: flatten(unit) };
  }
  const removed = [];
  for (const [unitId, old] of before) {
    if (!units.has(unitId)) removed.push({ id: unitId, title: old.title ?? unitId, text: flatten(old) });
  }
  plan._removed = sameRevision ? [...(prior._removed ?? []).filter(entry => !units.has(entry.id) && !removed.some(item => item.id === entry.id)), ...removed] : removed;
  plan._history = sameRevision ? Boolean(prior._history) : true;
  if (plan.approval?.approvedIn !== undefined && prior._approvalResetFrom === plan.approval.approvedIn) {
    // The earlier render already reset this approval. Keep it reset until the agent records a new approval revision.
    delete plan.approval.approvedIn;
    plan._approvalReset = prior._approvalReset;
    plan._approvalResetFrom = prior._approvalResetFrom;
    notices.push("Approval is still reset from an earlier render. Record a new approvedIn only after the user approves again.");
  } else if (plan.approval?.approvedIn !== undefined && plan.approval.approvedIn <= prior.revision && prior._approvalParts) {
    const reasons = [];
    if (prior._approvalParts.steps !== parts.steps) reasons.push("steps were added or removed");
    if (prior._approvalParts.scope !== parts.scope) reasons.push("the scope changed");
    if (prior._approvalParts.okay !== parts.okay) reasons.push("the list of actions that need your okay changed");
    if (reasons.length) {
      plan._approvalResetFrom = plan.approval.approvedIn;
      delete plan.approval.approvedIn;
      plan._approvalReset = reasons;
      notices.push(`Approval was reset because ${reasons.join(", ")}. Ask the user to approve again.`);
    }
  }
}

async function render(input, output) {
  const plan = JSON.parse(await readFile(input, "utf8"));
  const { units, steps } = await validate(plan, input);
  let prior = null;
  try { prior = priorPlan(await readFile(output, "utf8")); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const notices = [];
  track(plan, units, steps, prior, notices);
  const template = await readFile(new URL("../assets/review.html", import.meta.url), "utf8");
  const gallery = await readFile(new URL("../assets/control-ui-gallery.css", import.meta.url), "utf8");
  const payload = JSON.stringify(plan).replace(/[<>&\u2028\u2029]/g, char => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
  const html = template.replace("/*__GALLERY_CSS__*/", () => gallery).replace("/*__PLAN__*/", () => payload);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
  for (const notice of notices) console.error(`Note: ${notice}`);
  const changed = [...units.values()].filter(unit => plan._history && unit._track.changedIn === plan.revision).length;
  console.log(`${output}${plan._history ? ` (revision ${plan.revision}: ${changed} changed or new, ${plan._removed.length} removed)` : ""}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
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
}
