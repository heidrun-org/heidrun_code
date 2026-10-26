# User interface of Heidrun Code: drop of image files on a composition bar

- Created: 21 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [User interface of Heidrun Code: composition bar](composition_bar.md), [Shared design rules](../../web_styling/shared_design.md)
- Related issue: [issue 785](https://github.com/heidrun-org/heidrun/issues/785)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Where a drop goes

- A drop of image files is accepted only on an open composition bar, and adds the images to that composition bar, whichever pane has the focus. A drop on any other part of the window, including a pane with a closed composition bar, does nothing: it never opens a composition bar, never goes to the focused pane, and never changes the focus.
- A drop never pastes at once: it only adds the images to the composition bar under the pointer. A file that is not an image, dropped on a composition bar, gets the message "This file is not an image". The same file is never added twice to one composition bar.

## Finding the composition bar under the pointer

- The class `DropTarget` (the file `drop_target.ts`) finds the composition bar. Each open composition bar carries the attribute `data-composition-bar-pane-id` with the identifier of its pane, and `DropTarget` asks the document for the element at the point, then for the nearest such attribute.
- The desktop application reports the point in points of the window, counted from the top edge of the window, including the title bar. The page starts below the title bar. At the start of each drag, `DropTarget` measures the height of the title bar (the height of the window minus the height of the page, in points), removes it from the height of the point, then divides both coordinates by the zoom factor of the window.

## What the window shows during a drag

- A layer covers the whole composition bar under the pointer. How the layer looks is in [panes_appearance.md](../../web_styling/panes_appearance.md).
- The layer goes away when the drag leaves the window or the files drop.
- The page draws nothing at the pointer: the system draws the dragged picture above the page, so a mark drawn by the page stays hidden behind it. The cursor is the job of the system, as the next section says.

## The cursor of the system

- The page cannot change the cursor during a drag of files: the CSS property `cursor` has no effect, and the web view of the window answers every drag with the operation "copy", so the system shows the green plus badge on the whole window, over a closed composition bar and over a terminal too. The layer above is the only sign that a drop is accepted. A drop outside an open composition bar does nothing.
- Heidrun Code does not replace the cursor: a test in the real window showed that the replacement of the drag messages of the web view changed the cursor for a very short time only, so it was removed.

## Tests

- `drop_target.test.ts`, `app_image_drop.test.ts`, and `CompositionBar.test.ts` in `packages/apps/web_frontend/src` test the finding, the title bar, the zoom, and the layer.
- The layer in the real window needs a person: drag an image over an open composition bar (the orange layer shows), then over a terminal (no layer).
