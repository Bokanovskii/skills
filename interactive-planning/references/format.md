# Plan format

The renderer reads one UTF-8 JSON file with `schemaVersion: 2`. Version 1 plans are not supported.
All prose fields are plain text, not Markdown or HTML. The page never runs plan text as HTML.
The renderer rejects unknown fields and names the field and the fix in its error.

## Plan fields

| Field | Type | Meaning |
| --- | --- | --- |
| `schemaVersion` | `2` | Format version |
| `planId` | ID | Plan identity. It stays the same for every revision. |
| `revision` | Positive integer | Plan revision. Increase it by one when the content changes. |
| `kind` | `design`, `engineering`, or `mixed`, optional | Page label |
| `title` | Text | Plain task title |
| `summary` | Text | The problem, its cost, and the outcome |
| `recommendation` | Text | The recommended approach and the reason |
| `scope` | Text | The work that is in and the work that is out |
| `changes` | Text, optional | What changed since the earlier revision |
| `theme` | `dark` or `light`, optional | Default page theme |
| `terms` | Object, optional | Up to 80 terms. A key has up to 60 characters. A definition has fewer than 600 characters. |
| `approval` | Object, optional | What approval covers and the high-risk okay list |
| `sections` | Array | At least one section |
| `replies` | Array, optional | Your replies to the user's comments |

An ID uses lowercase letters, digits, and hyphens, starts with a letter, and has at most 64 characters.
IDs that start with `ip-` belong to the page.
Section, block, step, and okay IDs are unique across the whole plan.
Add a task word or a short random suffix to `planId`, because the browser stores feedback under that ID.

## Approval

| Field | Type | Meaning |
| --- | --- | --- |
| `covers` | Text, optional | The work that approval lets you do |
| `okay` | Array, optional | At most 8 high-risk actions |
| `approvedIn` | Revision, optional | The revision that the user approved |

Each okay entry has `id`, `action`, and `why`. Set `granted: true` after the user turns on the toggle.
Put only high-risk actions in the list. Low and medium risk work inside `covers` needs no okay.

The renderer removes `approvedIn` when the steps, the scope, or the okay list change after approval. The page then asks the user to approve again. The reset stays until you set `approvedIn` to a newer revision.

## Sections and blocks

A section has `id`, `title`, optional `summary`, and `blocks`.
Every block has `id` and `type`. These fields are optional on every block:

| Field | Meaning |
| --- | --- |
| `title` | Block heading. A visual, a decision, and a question need one. |
| `body` | Plain explanation |
| `details` | List of `{title, body}` entries that start closed |
| `evidence` | List of text entries, such as a source or a measurement |
| `links` | List of `{label, url}`. A URL must use HTTP or HTTPS without credentials. |

## Content blocks

The user reads content blocks. Each one has a Comment button.

| Type | Fields |
| --- | --- |
| `facts` | `items`: list of `{label, value}` |
| `steps` | `items`: list of steps |
| `risks` | `items`: list of `{title, effect, response}` |
| `comparison` | `columns`: 1 to 6 headings. `rows`: 2 or more `{option, cells}` entries with one cell for each column. |
| `visual` | Exactly one of `image` or `previewFile` |
| `code` | `code` and optional `language` |
| `note` | `body` is required |

A step has `id` and `title`. It can also have `body`, `after` (a list of step IDs that come first), `criteria`, `evidence`, `details`, `links`, `status`, and `statusNote`.
`status` is `todo`, `working`, `done`, or `blocked`. The renderer rejects an unknown step in `after` and a cycle.
The page hides the "After" line when a step waits only for the step directly above it.
The user can comment on each step and on the whole steps block.

An `image` has `path`, `alt`, `caption`, and optional `mobilePath`. Use a local PNG, JPEG, or WebP file.
A `previewFile` has `path`, `label`, and optional `height` and `mobileHeight` from 180 to 1800 pixels. The default is 400.
The page shows the preview in a sandboxed frame with no scripts, forms, or network access.
A relative path starts at the directory of `plan.json`.

## Review blocks

The user answers review blocks. They appear in the Your input list at the top of the page.

A `decision` has `title` and 2 to 4 `options`. An option has `id`, `label`, `benefit`, and `cost`. It can also have `recommended: true` on one option and `see` with the ID of a visual block.
The page adds a "Something else" option with the ID `other`, so do not use that ID.
After the user decides, set `answer` to `{option}` or `{option, note}`. An `other` answer needs a note.

A `question` has `title` and an optional `placeholder`. It is optional for the user. After the user answers, set `answer` to the text.

A decision that has an answer shows one "Chosen" row. The user can change it.

## Replies

Each reply answers one comment from the feedback:

```json
{ "to": "why-slow.1", "comment": "Show the wait time for two saves.", "status": "changed", "text": "Added the wait time for two saves." }
```

`to` is the comment ID from the feedback. `status` is `answered`, `changed`, or `not-changed`. `revision` is optional and defaults to the current revision.
The page shows a replied comment as a closed thread and removes it from the feedback. The user can open it, reply, or reopen it.

## Change tracking

The renderer reads the earlier page at the output path. It marks each block and step that is new or changed in this revision.
The page collapses unchanged blocks, settled decisions, and resolved comments. A Show full plan button shows everything.
Status, answers, and okay grants do not count as changes.
The renderer fails if the earlier page has a higher revision. It never overwrites the input plan or the skill template.

## Browser storage

The page saves input under `interactive-planning:v2:<planId>` in browser storage for the page origin.
Another browser, private browsing, or a different preview address does not see that copy.
If storage fails, the page keeps input in memory and shows a warning.
Download backup saves the input as JSON. Restore a backup loads it after the user confirms.
Download plan saves the plan as Markdown.
