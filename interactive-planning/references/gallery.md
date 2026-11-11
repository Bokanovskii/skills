# Visual review gallery

Make the proposed experience tangible before asking for feedback.
The base comes from the actual Control UI review gallery, not a generic planning application.
Read [the template origin](template-origin.md) for its source and permitted additions.
Use the bundled template through the renderer instead of designing another gallery shell.

## Page structure

Preserve the original theme tokens, fonts, spacing, borders, and responsive layout in `assets/control-ui-gallery.css`.
Keep section links and the red "Copy feedback" action in the original sticky horizontal bar.
Keep backup actions in the Export section.
Do not add a permanent sidebar or a row of unrelated metrics.

Keep the original hero, theme controls, review notice, and paired introduction boxes.
Use one introduction box for recommendation and scope, and one for review instructions.
Keep supporting evidence expandable.
Put the first concrete example after that introduction.

At widths of 1100 pixels or more, keep the example beside its 320-pixel feedback panel.
Below that width, stack the feedback panel below the example.
Do not force all viewports into the stacked layout.
The main content retains the original 1200-pixel maximum width.

Every example follows this order:

1. Show the visual example at a useful scale.
2. Label whether it shows current behavior, a proposal, a static recreation, or verified evidence.
3. Give it a stable ID and a short title.
4. Explain the decision or state in plain English.
5. Add the comment field in the original feedback panel.
6. Keep the optional decision control secondary to comments.

## Design proposals

Use real components and deterministic data when feasible.
Match the affected product, not an imagined generic interface.
If components are unavailable, write a faithful static recreation and label its limits.

Show separate examples for mutually exclusive states.
Include long text, dense content, errors, empty states, and permission limits only when relevant.
Do not fill a required visual example with an ASCII sketch.

Use `previewFile` to embed a local HTML recreation.
Inline its CSS and any required image bytes.
Do not reference external fonts, styles, scripts, or network images.

Static frames have no scripts, parent access, forms, or network connections.
Their controls can illustrate appearance but do not implement a product flow.
Link a real running UI when interaction itself needs review.
If the host cannot display isolated frames, use captured images of those same examples.
Use `image.path` for the desktop capture and `image.mobilePath` for the narrow capture.
Keep the HTML source with the proposal artifacts and label the captures as static recreations.

## Engineering proposals

Show the affected boundary, not decorative boxes.
Use a before-and-after flow when ownership changes.
Label the real actors and the data that moves between them.

Make failure and recovery visible when they change the design.
Use sample API results, migration stages, request traces, or rollout diagrams when they answer the review question.
Keep source evidence separate from proposed behavior.

Do not invent measurements or claim that a diagram proves runtime behavior.
Label illustrative data and synthetic examples.
Use text-only items when a visual adds no information.

## Fit and revision

Give each frame enough height for its content.
Use `mobileHeight` when the narrow layout needs more space.
Inspect both widths and make sure that nothing important is clipped.

Keep the same item IDs and artifact paths during revision.
A change to a rendered example requires another review of that item.
Keep existing comments and export backups before moving browser origins.
