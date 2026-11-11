# Plan and feedback format

The renderer consumes a UTF-8 JSON file.
All prose fields contain plain text, not Markdown or HTML.
The separate `previewFile` field embeds an authored static HTML example.
Use schema version `1`.

## Plan

The plan has these fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | `1` | Format version |
| `planId` | String | Unique proposal identity, unchanged during revision |
| `revision` | Positive integer | Proposal revision |
| `title` | String | Plain task title |
| `summary` | String | Intended outcome |
| `recommendation` | String | Recommended approach and reason |
| `scope` | String | Included and excluded work |
| `changes` | String, optional | Changes since the earlier revision |
| `theme` | `dark` or `light`, optional | Gallery style, dark by default |
| `sections` | Array | At least one section |

Use lowercase letters, digits, and hyphens for IDs.
Start each ID with a letter.
Keep section and item IDs unique across the whole plan.
Use a task prefix or random suffix for `planId` to avoid collisions between repositories.

Every section contains `id`, `title`, `summary`, and `items`.
Every section needs at least one item.
The summary explains what the section helps the reader decide or understand.

Every item contains `id`, `kind`, `title`, and `body`.
Use one of these kinds: `decision`, `option`, `step`, `fact`, `assumption`, `question`, `risk`, or `design`.
Every item supports comments and a review decision.

Optional item fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `recommended` | Boolean | Mark a recommended choice |
| `dependsOn` | Array of item IDs | Required earlier work |
| `details` | Array of `{title, body}` | Expandable supporting text |
| `criteria` | Array of strings | Observable acceptance criteria |
| `evidence` | Array of strings | Source references and observed facts |
| `links` | Array of `{label, url}` | Explicit HTTP or HTTPS references |
| `preview` | String | Plain text technical sample, not the default for visual proposals |
| `previewFile` | `{path, label, height?, mobileHeight?}` | Local static HTML example in an isolated frame |
| `image` | `{path, mobilePath?, alt, caption}` | Local PNG, JPEG, or WebP image, with an optional narrow version |

Resolve image paths relative to the input JSON file.
The renderer embeds the bytes, so the resulting HTML can travel alone.
Captions must distinguish current evidence from a proposed or approximate rendering.
Use `mobilePath` for a separate capture below a viewport width of 768 pixels.
Both image versions become embedded data, so neither needs a network request.

Resolve `previewFile.path` relative to the input JSON file.
Use an explicit `label`, such as "Proposed state - static HTML recreation".
Frame heights are integers from 180 to 1800 pixels.
The default height is 400 pixels, and `mobileHeight` defaults to `height`.
Make sure that the whole example fits at both viewport sizes.

Preview files need inline CSS and embedded images.
The renderer blocks scripts, forms, network resources, and access to the parent page.
Comments, prose, and imported feedback never become preview HTML.

Dependencies must reference existing items and must not form a cycle.
Array order controls presentation, not dependency meaning.
The renderer rejects missing IDs, duplicate IDs, unsafe links, and invalid field types.

## Feedback

"Download feedback" exports JSON with `schemaVersion`, `planId`, `revision`, `exportedAt`, `entries`, and `context`.
New exports also include `overall` for general comments and `theme` for the gallery preference.
Earlier version 1 backups without these fields remain supported.
`context` includes the current title, summary, recommendation, scope, and changes.
`entries` contain all items with feedback, including removed items.

Each entry records the item ID, comment, decision, saved item snapshot, reviewed revision, timestamp, current item, and review state.
Its `context` records the title, summary, recommendation, and scope at review time.
The snapshot preserves the text against which the user recorded feedback.
The current item is `null` when that item no longer exists.
Review states are `current`, `changed`, and `removed`.

Decision values are `undecided`, `accept`, `changes`, and `discuss`.
These values record review preferences, not execution authority.
The readable export includes context and old and current item text for changed decisions.

## Revision and recovery

An item changes when its reviewable fields change.
Object key order does not change item identity.
Comments do not renew an earlier acceptance of changed content.
Changes to the plan title, summary, recommendation, or scope also require another review.

Changing the decision explicitly records a review of the current content.
The "Keep decision for this revision" action explicitly renews an earlier decision.
Removed feedback stays in history and exports.

Restoring a backup requires the same `planId` and a supported schema version.
The page rejects malformed records before writing browser storage.
Restoring feedback replaces the current feedback only after confirmation when feedback already exists.
Download a backup before moving between browsers, origins, machines, or sessions.

## Maintenance

Run `node --test "<skill-directory>/tests/render.test.mjs"` after renderer changes.
Run `node "<skill-directory>/tests/browser.mjs" "<proof-directory>"` from a directory with Playwright available after template changes.
The browser test uses an existing Playwright installation and does not install dependencies.

The browser proof covers rendering, persistence, revision handling, exports, restore, storage errors, and narrow layouts.
It creates synthetic pages and screenshots in the named proof directory.
Inspect those screenshots before sharing the template.
For a template cutover, pass a previously generated review HTML file as the final argument to `tests/browser.mjs`.
The additional flow records feedback in that page, replaces its template at the same address, and makes sure that the saved feedback survives.
