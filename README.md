# Personal Copilot skills

Personal skills for GitHub Copilot across repositories and standalone chats.
This repository is also the local `~/.copilot/skills` directory.
Each skill lives in its own folder with a `SKILL.md` entry point.

| Skill | Purpose |
| --- | --- |
| [interactive-planning](interactive-planning/SKILL.md) | Create review pages for design proposals and engineering plans. The user answers decisions, comments, approves, and copies short feedback. |
| [simple-english](simple-english/SKILL.md) | Write plans, documentation, and replies in plain English. |
| [autoreview](autoreview/SKILL.md) | Run structured, independent code reviews with explicit scope and severity. |
| [impeccable](impeccable/SKILL.md) | Plan, review, and improve frontend design, usability, and visual details. |

`interactive-planning` uses `simple-english` for its prose.
Its gallery starts from the original Control UI gallery source.
The [template origin](interactive-planning/references/template-origin.md) describes the base and the planning additions.

## Install on another machine

Install Git and the GitHub CLI before running the clone command.
If `~/.copilot/skills` does not exist, clone this repository into that location:

```bash
gh repo clone Bokanovskii/skills "$HOME/.copilot/skills"
```

If that directory already contains skills, preserve them before combining the two collections.
Do not delete an existing skills directory to make room for the clone.
Start a fresh Copilot session after installation.

When the Copilot CLI is available, make sure that it discovers the skills:

```bash
copilot skill list --json
```

Personal discovery depends on the Copilot host.
Remote hosts and cloud sessions need their own supported installation.
Publishing this repository does not automatically install or update skills on other machines.

## Review and design requirements

`autoreview` needs Python 3.10 or later and a supported, authenticated review engine.
Its Windows launcher finds a supported Python installation.
Run its installation check without starting a review:

```bash
python3 "$HOME/.copilot/skills/autoreview/scripts/autoreview" --version
```

`impeccable` includes Unix and Windows launchers, references, and browser assets.
Its launcher downloads a native engine on first use when no supported local binary exists.
The bundled checksums verify the download.
Follow the host's approval rules before downloading or running software.
No engine binaries or credentials are stored here.

Both skills are pinned copies of public upstream sources.
Their [autoreview source notes](autoreview/UPSTREAM.md) and
[Impeccable source notes](impeccable/UPSTREAM.md) record the exact commits and local changes.
Existing shared or app-managed copies remain separate.
Repository-specific skills and host discovery rules can select a different copy.
This collection does not remove, replace, or automatically synchronize those installations.

## Update and maintain

The installed directory is the Git checkout, so edits do not need a separate copy step.
Use normal Git commits and pushes to publish changes.
Keep local changes safe before pulling updates:

```bash
git -C "$HOME/.copilot/skills" pull --ff-only
```

This repository is public.
Keep credentials, personal plans, review comments, and task screenshots outside it.
Store generated review pages in the host session artifact directory.

## Run the renderer checks

The interactive planning renderer needs Node.js 20 or later.
From this repository, run its dependency-free checks:

```bash
node --test interactive-planning/tests/render.test.mjs
```

Run the browser checks only after a change to the page template or the renderer.
They need an existing Playwright installation, so run them from a project directory whose `node_modules` has Playwright.
Pass a proof directory outside this public repository:

```bash
node "$HOME/.copilot/skills/interactive-planning/tests/browser.mjs" /tmp/interactive-planning-proof
```

## Third-party material

`simple-english` retains its [upstream MIT license](simple-english/LICENSE).
The gallery stylesheet includes material derived from OpenClaw.
Its [third-party notice](interactive-planning/THIRD-PARTY-NOTICES.md) preserves the applicable MIT notice.
`autoreview` retains its [upstream MIT license](autoreview/LICENSE).
`impeccable` retains its [Apache-2.0 license](impeccable/LICENSE),
[upstream notice](impeccable/NOTICE.md), and
[additional MIT notices](impeccable/THIRD-PARTY-NOTICES.md).
