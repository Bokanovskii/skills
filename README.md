# Personal Copilot skills

Personal skills for GitHub Copilot across repositories and standalone chats.
This repository is also the local `~/.copilot/skills` directory.
Each skill lives in its own folder with a `SKILL.md` entry point.

| Skill | Purpose |
| --- | --- |
| [interactive-planning](interactive-planning/SKILL.md) | Create interactive galleries for design proposals and engineering plans, with comments and feedback exports. |
| [simple-english](simple-english/SKILL.md) | Write plans, documentation, and replies in plain English. |

`interactive-planning` uses `simple-english` for its prose.
Its gallery starts from the original Control UI gallery source.
The [template origin](interactive-planning/references/template-origin.md) describes the base and the planning additions.

## Install on another machine

Install Git and the GitHub CLI before running the clone command.
If `~/.copilot/skills` does not exist, clone this repository into that location:

```bash
gh repo clone Bokanovskii/copilot-skills "$HOME/.copilot/skills"
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

The [format reference](interactive-planning/references/format.md) also explains browser checks.
Those checks use an existing Playwright installation.
Keep their generated evidence outside this public repository.

## Third-party material

`simple-english` retains its [upstream MIT license](simple-english/LICENSE).
The gallery stylesheet includes material derived from OpenClaw.
Its [third-party notice](interactive-planning/THIRD-PARTY-NOTICES.md) preserves the applicable MIT notice.
