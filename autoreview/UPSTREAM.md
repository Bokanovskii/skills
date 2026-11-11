# Source and updates

This directory is a pinned copy of the public
[OpenClaw autoreview skill](https://github.com/openclaw/agent-skills/tree/71975d6606655911c5b4c84616b94b4bc1dca2f3/skills/autoreview).
The source commit is `71975d6606655911c5b4c84616b94b4bc1dca2f3`.
The full skill tree includes references, scripts, tests, and fixtures.
The [MIT license](LICENSE) comes from that commit's repository root.

The user requested this copy in the personal skills collection.
It does not replace the shared installation under `~/.agents/skills`.
It does not synchronize with that installation.

## Local changes

`SKILL.md` uses the personal installation path and explains other installation locations.
Its installation and update instructions point to this collection.
`references/repository-entrypoint.md` points to the same personal installation.
`AGENTS.md` records ownership of this copy instead of the upstream no-vendoring default.
`tests/test_review_harness.py` differs only by one removed blank line at the end.
The scripts, remaining tests, fixtures, and other references remain unchanged.

## Update this copy

Choose a public upstream commit and compare its complete skill tree with this copy.
Replace the imported files from that commit, then reapply the local instruction changes above.
Preserve the root license and update the source commit in this document.
Do not overwrite other installed copies.

Run the bounded helper check from the repository being reviewed:

```bash
python3 "$HOME/.copilot/skills/autoreview/scripts/autoreview" --version
```

This command does not start a review, probe authentication, or call a model.
Review execution needs a supported, authenticated engine.
Honor the user's engine and model choices before starting a review.
