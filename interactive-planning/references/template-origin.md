# Original gallery base

This skill starts from the "Streaming inline widgets" gallery that `control-ui-e2e` produced.
That skill describes how to build galleries but does not ship a fixed template.
The user chose that gallery as the reference style.

`assets/control-ui-gallery.css` is a copy of the original first stylesheet with no changes.
Its SHA-256, after trimming the surrounding whitespace, is:

```text
62e90dedd2ba1de82ca066811e8fc6356c6b9c616fe53ed681b23e77b024e4b4
```

The page keeps the original `.g-bar`, `.g-hero`, `.g-intro`, `.g-box`, `.g-section`, `.ex`, and `.g-export` structures.
Visual blocks keep the `.ex-stage`, `.ex-strip`, `.ex-canvas`, and `.ex-side` example card.
The colors, fonts, sizes, and breakpoints come from the copied stylesheet.
The renderer puts the stylesheet into each page, so the page needs no server.

Version 2 additions live in the second style block of `assets/review.html` and use the `ip-` prefix:

1. The Your input list, which shows only the points that need the user.
2. Content cards, steps with status, decision choice cards, and the Okay toggles.
3. Comment threads with agent replies.
4. Collapsed unchanged parts, word diffs, and the removed-parts history.
5. Term definitions that open on tap.

The widget examples and animation controls of the original gallery are not part of this skill.
Version 2 does not read version 1 storage or backups.

Do not change the copied stylesheet. If the user asks for a different base style, record that decision first.
