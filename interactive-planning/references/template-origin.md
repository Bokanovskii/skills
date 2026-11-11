# Original gallery base

This skill starts from the actual "Streaming inline widgets" gallery produced with `control-ui-e2e`.
That skill describes how to build galleries but does not ship a fixed HTML template.
This copy preserves the generated gallery that the user chose as the reference.

The reusable first stylesheet is copied into `assets/control-ui-gallery.css` without changes.
Its SHA-256, after trimming surrounding whitespace, is:

```text
62e90dedd2ba1de82ca066811e8fc6356c6b9c616fe53ed681b23e77b024e4b4
```

The page retains the original `.g-bar`, `.g-hero`, `.g-intro`, `.g-section`, `.ex`, and `.g-export` structures.
Example cards retain `.ex-stage`, `.ex-strip`, `.ex-canvas`, `.ex-side`, `.ex-meta`, `.ex-label`, `.ex-desc`, and `.ex-fb`.
The original colors, font stacks, dimensions, and responsive breakpoints come from the copied stylesheet.
The renderer embeds that stylesheet into the output, so no reference server or external file is needed.

Planning additions live in the second stylesheet and the existing feedback owner in `assets/review.html`.
They add dependency links, acceptance criteria, optional decisions, changed-item warnings, backup restore, and isolated static previews.
Text-only engineering items use a full-width panel when an example adds no useful information.
Overall feedback and theme controls use the same local feedback storage as item comments.

The original gallery's widget-specific examples and animation controls are not part of this generic planning skill.
The original feedback storage key is not reused.
Existing `interactive-planning:v1:<planId>` feedback remains readable without changing its reviewed snapshots.
Older version 1 backups without overall feedback or a theme remain supported.

Keep new planning styles separate from the copied base.
Do not replace the original layout with a similar-looking custom shell.
If the user requests a different base style, record that decision before changing the copied stylesheet.
