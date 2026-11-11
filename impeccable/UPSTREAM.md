# Source and updates

This directory contains Impeccable 4.8.2 by Paul Bakaus.
It copies the public
[GitHub skill bundle](https://github.com/pbakaus/impeccable/tree/f2baa414a87d9acf1e21ccf776bfaec0262ad6df/.github/skills/impeccable)
at commit `f2baa414a87d9acf1e21ccf776bfaec0262ad6df`.
The bundle includes the entry point, references, platform launchers, browser assets, font metadata, and engine checksums.

The [Apache-2.0 license](LICENSE) and [upstream notice](NOTICE.md)
come from the same commit's repository root.
The [additional notices](THIRD-PARTY-NOTICES.md) preserve MIT licenses for included third-party material.

## Local changes

`SKILL.md` resolves commands against the loaded skill directory.
Its fallback path uses the personal Copilot installation.
It also states that host approval rules apply to software downloads and execution.
Whitespace-only cleanup affects `reference/extract.md`, `reference/harden.md`, and `reference/optimize.md`.
The other references, scripts, and assets remain unchanged.
The collection's `.gitattributes` preserves CRLF line endings for the Windows launcher, as upstream requires.

This is a public upstream copy, not a copy of the Copilot app's customized bundle.
The app-managed version remains separate and can use a different version.
Updating one installation does not update the other.

## Runtime and updates

The Unix and Windows launchers use a native engine.
They download a matching engine when no supported local binary exists.
The bundled checksum manifest verifies that download.
This repository does not include engine binaries, credentials, or app-specific installation paths.

Choose a public upstream commit when refreshing this copy.
Replace the complete `.github/skills/impeccable` bundle from that commit.
Preserve its root license and notice, then reapply the local instruction changes above.
Update this document's version and source commit.
Keep the engine version file and checksum manifest from the same source commit.
Do not overwrite the app-managed installation.
