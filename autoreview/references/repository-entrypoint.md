---
name: autoreview
description: Structured code review through the personal Copilot skills installation.
---

# Auto Review

- Use the [personal autoreview copy](https://github.com/Bokanovskii/skills/tree/main/autoreview).
- Before reviewing: read complete installed `~/.copilot/skills/autoreview/SKILL.md`
  + required references. Another operator-selected location: use that installation.
- Repository entrypoint contains no review implementation.

- Skill missing: follow the installation instructions at
  `https://github.com/Bokanovskii/skills#install-on-another-machine`.
- The helper needs Python 3.10 or later. Windows can use `scripts/autoreview.ps1`.

- Run shared `scripts/autoreview` helper with Python from reviewed repository;
  preserve working directory. Follow repository review requirements + canonical skill.
- Codex CLI unavailable: follow the canonical skill's Copilot subagent route,
  preferring an accessible Codex model or a comparable model. Preserve repository
  scope and severity requirements; disclose host/model and limitations. This is
  not a helper engine and does not provide helper isolation or validated status.

- Keep shared fixes upstream in `openclaw/agent-skills`.
- Follow the installed copy's `UPSTREAM.md` when updating the personal collection.
- Never add repository-local helpers or test copies.
