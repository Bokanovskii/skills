# Visual proposals

Read this guide only when the plan has a visual design or a diagram that answers a decision.
The page uses the original Control UI gallery style. Do not restyle it, and do not build another page shell.
Read [the template origin](template-origin.md) for the source of the style.

## When to add a visual

Add a `visual` block when the user must see something to decide.
Examples: two layouts for the same screen, a state that is hard to describe, or a flow where ownership changes.
Do not add a visual that repeats the text.
Link the visual from the decision option that it supports with `see`.

## Static previews

Use `previewFile` for an HTML copy of a proposed screen. Inline its CSS and any image bytes.
Do not use external fonts, styles, scripts, or network images. The frame blocks them.
Label each preview as a proposal in `previewFile.label`.
The frame has no scripts, so the controls in a preview do not work. If the review needs a working interaction, link the running product.

Show one preview for each state that the user must judge, such as ready, empty, loading, and failed.
Do not add states that no decision needs.

## Sizes

Set `height` to the height of the preview content at about 900 pixels wide.
Set `mobileHeight` when the content needs more space at phone width.
Estimate both values from the content. Do not open a test browser to measure them during a content revision.
If the user reports clipped content, increase the value and render again.

## Images

Use `image` with `path` and `alt` for a supplied screenshot or a capture that already exists.
Add `mobilePath` only when a phone-width capture already exists.
Write `caption` to say what the image shows and whether it is current behavior or a proposal.

## Engineering diagrams

Show the real actors and the data that moves between them. Do not draw decorative boxes.
Make one diagram for the decision that needs it. Stop at the first version that a reader can follow.
Label sample data as sample data. A diagram does not prove runtime behavior.
