# Directory Context: `/packages/auxiliary/mobile_website`

## Purpose
The mobile website of Heidrun Code Mobile: the page that the phone opens to keep the coding agents working when the developer is away from the desk. The mobile server serves the built page from the computer, and the page talks only to the mobile server.

## Key Exports & Entry Points
- `index.html`: the entry of Vite. It names `src/main.ts` and `public/manifest.webmanifest`.
- `src/mobile_app.ts`: the class `MobileApp`. It holds the open screen, refreshes the data, and handles the taps.
- `src/mobile_api.ts`: the pairing key of the phone, and the calls to the mobile server.
- `src/output_text.ts`: turns the output of a pane into short HTML.
- `src/ansi_parser.ts`, `src/ansi_palette.ts`: read the color codes of a terminal screen, and give the color of each code.
- `src/screen_address.ts`: writes and reads the screen that is open in the part of the address after "#".
- `src/color_painter.ts`: sets the colors of the output after its HTML is in the page.
- `src/voice_input.ts`: the microphone, with the Web Speech API of the browser. No Web Speech API: no microphone button.
- `build_tools/`: the Vite plugin that copies into `dist` only the files of a build that changed. See its own CONTEXT.md.
- `dev/`: the development server with a fake computer, and the proxy to the real desktop application. See its own CONTEXT.md.
- `public/`: the files that Vite copies as they are: the manifest, the service worker `sw.js` (for notifications; no cache), and `favicon.svg`, the same image as `data/images/heidrun_favicon.svg`.
- `src/screens/`: one class for each screen. See its own CONTEXT.md.
- `src/assets/`: the pictures that the screens import. See its own CONTEXT.md.
- `src/components/`: the parts that several screens share. See its own CONTEXT.md.
- `tests/`: the Vitest tests, which run the whole page against a fake computer.
- `dist/`: the built website. Git ignores it, and `dist_staging/`, where Vite writes before the copy. The package `mobile_server` holds this folder inside its program at build time.
- Command to work on this folder with a page that reloads by itself: `pnpm --filter mobile_website dev`
- Command to build this folder: `pnpm --filter mobile_website build`
- Command to test this folder: `pnpm --filter mobile_website test`

## Rules
- This package has no `src/index.ts` and no `exports` entry. No package imports it. The package `mobile_server` reads only the folder `dist`.
- This package imports nothing from `web_frontend`, and nothing from `desktop_tauri`.
- A refresh never moves what the developer reads: a new HTML keeps the scroll, and the output follows its end only when the developer already looks at the end. A test checks it.
- The address of the page always names the screen that is open (`#/welcome`, `#/dashboard`, `#/needs-you`, `#/panes`, `#/launchers`, `#/panes/<pane>`), and an empty or wrong address leads to the welcome page. A test checks it.
- The page has no framework, no inline script, no inline style, and no event attribute in its HTML. The header `Content-Security-Policy` of the mobile server allows only files of its own address, and a test checks every screen.
- The output carries each color in the attribute `data-fg` or `data-bg`, always as `#rrggbb` from `AnsiPalette`, and `ColorPainter.paint` turns it into a style that the content security policy allows.
- Every text that comes from the computer or from a coding agent goes through `HtmlEscape.escape` before it enters a template. A test with hostile text checks it.
- The page calls only the closed list of methods of the mobile server (`state`, `read`, `answer`, `prompt`, `keys`, `macros`, `launchers`, `launch`, `pushKey`, `subscribe`, `unsubscribe`), with the header `x-herdr-token`. The method `macros` gives the macros of one pane with their variables replaced by the computer, and the page writes the text into the field for a prompt, so a macro passes the same guards as a typed prompt.
- The pairing key comes in the address after `#t=`, and the phone keeps it in `localStorage` under the name `hd-token`.
- Every control icon comes from Bootstrap Icons, and the branding icon comes from `data/images/heidrun_icon_goat_only.svg`; `src/components/icon.ts` puts both in the page as inline SVG. The page loads no icon font and no file from another address.
- The texts of the page are in English. A text says "coding agent", never "agent" alone.
- A change of this package needs a new build of the package `mobile_server`.

## Background
- The page moved here from `packages/apps/desktop_tauri/mobile` in step 1 of [issue #525](https://github.com/heidrun-org/heidrun/issues/525). Step 2 replaced the single file with this Vite and TypeScript package, with the layout of three screens and a bottom bar. [Issue #581](https://github.com/heidrun-org/heidrun/issues/581) added the Launchers screen, the macro button of a pane, and the microphone.
