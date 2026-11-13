import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const renderer = fileURLToPath(new URL("../scripts/render.mjs", import.meta.url));
const examples = fileURLToPath(new URL("../examples/", import.meta.url));
const example = JSON.parse(await readFile(join(examples, "engineering.json"), "utf8"));

async function workspace() {
  const directory = await mkdtemp(join(tmpdir(), "interactive-planning-render-"));
  await mkdir(join(directory, "previews"));
  await copyFile(join(examples, "previews/search-flow.html"), join(directory, "previews/search-flow.html"));
  const input = join(directory, "plan.json");
  const output = join(directory, "review.html");
  const run = async plan => {
    await writeFile(input, JSON.stringify(plan));
    return spawnSync(process.execPath, [renderer, input, output], { encoding: "utf8" });
  };
  const page = async () => {
    const html = await readFile(output, "utf8");
    return { html, plan: JSON.parse(/<script type="application\/json" id="ip-plan">([\s\S]*?)<\/script>/.exec(html)[1]) };
  };
  return { directory, input, output, run, page };
}

const block = (plan, id) => plan.sections.flatMap(section => section.blocks).find(entry => entry.id === id);

test("the renderer rejects invalid plans and keeps the earlier page", async () => {
  const space = await workspace();
  try {
    const first = await space.run(example);
    assert.equal(first.status, 0, first.stderr);
    const { html } = await space.page();
    for (const [name, mutate, reason] of [
      ["version 1", plan => { plan.schemaVersion = 1; }, /Version 1 plans are not supported/],
      ["unknown field", plan => { plan.items = []; }, /unknown field "items"/],
      ["duplicate ID", plan => { block(plan, "why-slow").id = "current-facts"; }, /duplicate ID/],
      ["unknown step", plan => { block(plan, "build-steps").items[0].after = ["missing"]; }, /unknown step/],
      ["step cycle", plan => { block(plan, "build-steps").items[0].after = ["open-pr"]; }, /dependency cycle/],
      ["active URL", plan => { block(plan, "why-slow").links = [{ label: "Unsafe", url: "javascript:alert(1)" }]; }, /HTTP/],
      ["revision 0", plan => { plan.revision = 0; }, /positive integer/],
      ["reserved prefix", plan => { block(plan, "why-slow").id = "ip-copy"; }, /reserved/],
      ["five options", plan => { block(plan, "update-method").options.push(...["a", "b"].map(id => ({ id, label: id, benefit: "x", cost: "y" }))); }, /at most 4/],
      ["two recommended", plan => { block(plan, "update-method").options[1].recommended = true; }, /at most one/],
      ["see a non-visual", plan => { block(plan, "update-method").options[0].see = "why-slow"; }, /visual block/],
      ["bad reply target", plan => { plan.replies = [{ to: "why-slow", comment: "x", status: "answered", text: "y" }]; }, /comment ID/],
      ["other without note", plan => { block(plan, "update-method").answer = { option: "other" }; }, /note/]
    ]) {
      const plan = structuredClone(example);
      mutate(plan);
      const result = await space.run(plan);
      assert.equal(result.status, 1, name);
      assert.match(result.stderr, reason, name);
      assert.equal(await readFile(space.output, "utf8"), html, `${name} kept the earlier page`);
    }
    const sameFile = spawnSync(process.execPath, [renderer, space.input, space.input], { encoding: "utf8" });
    assert.equal(sameFile.status, 1);
    assert.match(sameFile.stderr, /Refusing to overwrite/);
  } finally {
    await rm(space.directory, { recursive: true, force: true });
  }
});

test("a new revision marks changed, new, and removed parts and resets approval when the steps change", async () => {
  const space = await workspace();
  try {
    const approved = structuredClone(example);
    approved.approval.approvedIn = 1;
    assert.equal((await space.run(approved)).status, 0);
    const second = structuredClone(approved);
    second.revision = 2;
    block(second, "why-slow").body += " The wait grows with each new document.";
    second.sections[0].blocks = second.sections[0].blocks.filter(entry => entry.id !== "current-facts");
    block(second, "build-steps").items.push({ id: "alarm", title: "Add a drift alarm", after: ["recovery"] });
    const result = await space.run(second);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Approval was reset because steps were added or removed/);
    const { plan } = await space.page();
    assert.equal(plan._history, true);
    assert.equal(block(plan, "why-slow")._track.changedIn, 2);
    assert.match(block(plan, "why-slow")._track.previous, /second rebuild waits for the first one\.$/);
    assert.equal(block(plan, "update-method")._track.changedIn, 1);
    assert.equal(block(plan, "build-steps").items.at(-1)._track.added, true);
    assert.deepEqual(plan._removed.map(entry => entry.id), ["current-facts"]);
    assert.equal(plan.approval.approvedIn, undefined);
    const again = await space.run(second);
    assert.equal(again.status, 0, again.stderr);
    assert.equal((await space.page()).plan.approval.approvedIn, undefined, "a second render keeps the reset");
    const reapproved = structuredClone(second);
    reapproved.approval.approvedIn = 2;
    assert.equal((await space.run(reapproved)).status, 0);
    assert.equal((await space.page()).plan.approval.approvedIn, 2);
  } finally {
    await rm(space.directory, { recursive: true, force: true });
  }
});

test("status changes and answers do not count as plan changes", async () => {
  const space = await workspace();
  try {
    assert.equal((await space.run(example)).status, 0);
    const second = structuredClone(example);
    second.revision = 2;
    block(second, "build-steps").items[0].status = "done";
    block(second, "update-method").answer = { option: "incremental" };
    assert.equal((await space.run(second)).status, 0);
    const { plan } = await space.page();
    assert.equal(block(plan, "update-method")._track.changedIn, 1);
    assert.equal(block(plan, "build-steps").items[0]._track.changedIn, 1);
    const older = structuredClone(example);
    const result = await space.run(older);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /earlier page is revision 2/);
  } finally {
    await rm(space.directory, { recursive: true, force: true });
  }
});
