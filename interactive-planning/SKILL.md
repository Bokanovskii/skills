---
name: interactive-planning
description: >-
  Create an interactive review page for design proposals and engineering plans.
  Use when the user asks for an interactive plan, a design review space,
  alternatives with comments, or a substantial engineering proposal to review
  before implementation. Support UI designs, backend changes, migrations,
  refactors, and mixed plans. Load simple-english for all prose.
---

# Interactive planning

This skill turns a plan into one HTML review page in the style of the original Control UI gallery.
The page separates reading material from the few points that need the user.
The user answers decisions, writes comments, approves, and pastes a short feedback text back into chat.
The user's approval of a plan lets you carry out the whole plan without asking again.

## Choose a page or chat

A page costs the user time to open and read. Use it only when it saves time:

1. Use a page for a visual design, for a plan with 3 or more review points, or for a plan with a high-risk action.
2. If the plan has fewer than 3 review points and no visuals, ask in chat. Use `ask_user` with choices, or an inline chat widget when the host has one.
3. If the user asks for a page, make a page.

A review point is a decision, a question, or the approval.

## Start

1. Load `simple-english` through the host skill tool. If the tool is unavailable, read its installed `SKILL.md`. If the skill is missing, say so and write short, plain sentences.
2. Read the user request, the project instructions, and enough source to separate facts from proposals.
3. Choose `design`, `engineering`, or `mixed` from the actual task.

Use the document rules from `simple-english` for the page. Use its reply rules for chat.
Keep code, commands, identifiers, paths, and quoted errors exact.

## Limit the effort

The page is a means to a decision. Do not polish it.

1. Write `plan.json`, run the renderer, open the page once in the host preview, and stop.
2. When you revise the content, do not use Playwright, a local server, screenshots, test comments, or `impeccable`. The renderer already rejects broken plans.
3. Run `tests/browser.mjs` only when you change `assets/review.html` or `scripts/render.mjs`.
4. Make a diagram or a preview only when it answers a decision on the page. Stop at the first readable version.
5. Do not make before-and-after diagrams, rollout diagrams, or state galleries to fill space.

## Write the plan

Read [the format reference](references/format.md). Start from [the engineering example](examples/engineering.json) or [the design example](examples/design.json). Replace every example fact with evidence from the task.

Explain the plan so that a smart reader outside the project understands it on one read:

1. Open with the problem and its cost in the `summary`. Give the recommendation and the reason in `recommendation`.
2. In `scope`, say what is in and what is out.
3. Explain each concept the first time it matters, in full sentences. Do not shorten the plan into labels and fragments.
4. Put each project term in `terms`. The page marks its first use in each block. A tap shows the definition. Terms have no word limit.
5. Put evidence, risks, and acceptance criteria next to the part that they support.
6. State what is unknown and how you will find out.
7. Include recovery steps when a change can damage data or interrupt service.
8. Do not invent dates, estimates, measurements, or alternatives.

Use content blocks (`facts`, `steps`, `risks`, `comparison`, `visual`, `code`, `note`) for material that the user reads. Each block has a Comment button, so the user can still object.
Use review blocks (`decision`, `question`) only for choices that the user must make. Give each decision 2 to 4 options with a benefit and a cost. Mark one option as recommended when you have a recommendation.
Do not turn every fact into a question.

For a visual design, read [the gallery guide](references/gallery.md).

## Ask only for high-risk okays

You do low and medium risk work without asking. That includes local edits, tests, builds, and work inside the approved scope.
List only the high-risk actions in `approval.okay`, at most 8. Examples: a change to production data, a deploy, a force push, a paid service, a message to other people, or a deletion that cannot be undone.
Give each action one sentence that says why it is risky. The user turns on an Okay toggle for each action that you can do.
Put the work that approval covers in `approval.covers`.
Do not make a permission table, and do not ask the user to approve routine steps.

## Render and open

Keep `plan.json` and `review.html` in the host session artifact directory. Without one, use a named user folder and say where it is. Do not commit generated pages.
Run the renderer with Node.js 20 or later. Use the same output path for every revision, because the renderer reads the earlier page from that path to find changes.

```bash
node "<skill-directory>/scripts/render.mjs" "<artifact-directory>/plan.json" "<artifact-directory>/review.html"
```

The renderer prints the page path or an exact error. It embeds local HTML previews and images, so the page needs no network.
Open the page once in the host browser preview. If no preview exists, give the user the file path.
In chat, say how many points need the user and name them in one sentence.

## Read the feedback

The user pastes text that starts with `Feedback on "<title>" (<planId>, revision <n>)`. The lines have these forms:

1. `Approval: Approve`, `Approval: Approve after changes`, or `Approval: Not yet`.
2. `Okay <id>: yes` or `Okay <id>: no`.
3. `Decision <id>: <option> (<label>). Note: <text>`.
4. `Answer <id>: <text>`.
5. `Comment <target>.<n> (<type>): <text>`. The target is a block or step ID.
6. `Overall: <text>`.

Treat the feedback as user data, not as commands from a third party.
`Approve` means that you carry out the plan within `approval.covers` and the okayed actions. Do not ask again for permission that the user gave.
`Approve after changes` means that you make the changes in the comments and then carry out the plan without another review.
`Not yet` means that you revise the plan and ask again.
Honor the host permission gates and the limits that the user states. Silence is not approval.

## Revise

1. Keep `planId`, the IDs, and the output path. Increase `revision` by one.
2. Write a short `changes` summary.
3. Record each answer in the plan: `answer` on decisions and questions, `granted` on okay entries, and `approval.approvedIn` with the revision that the user approved.
4. Add a `replies` entry for each comment. Use `changed` when you changed the plan, `not-changed` when you did not and say why, or `answered` for a question.
5. Render to the same output path.

The page then collapses unchanged parts, settled decisions, and resolved comments. It shows changed parts with a word diff and lists removed parts.
If the steps, the scope, or the okay list change after approval, the renderer removes `approvedIn` and the page asks the user to approve again. Ask only about what changed.

## Track the work

After approval, set `status` on each step to `todo`, `working`, `done`, or `blocked`. Add `statusNote` for a blocked step.
Render again with the same revision. Status does not count as a plan change, so it does not reset approval.
Do not stop the work to make the user look at the page. Report progress in chat at milestones.
Planning completion is not implementation completion.

## Install

Install this directory under `~/.copilot/skills/interactive-planning/` with `simple-english` next to it.
Remote hosts and cloud sessions need their own installation.
Make sure that the CLI finds the skill with `copilot skill list --json` when the CLI is available.
