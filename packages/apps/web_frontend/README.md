# web_frontend

The user interface of [Heidrun Code](../../../README.md), written with Vue 3, TypeScript, and Vite. The window of [`desktop_tauri`](../desktop_tauri) displays it.

## What it contains

- `src/components`: the left sidebar, the tab bar, the panes, the right sidebar, and the windows.
- `src/stores`: the state of the application.
- `src/lib`: shared logic, including `shortcuts.json`, the list of keyboard shortcuts.
- `src/i18n`: the translations.
- `src/dev`: a fake Tauri bridge with a fake Herdr session. It only runs in the development server, and only in a plain browser, so that `pnpm dev:web` shows the connected screens.
- `src/bootstrap_parts.scss`: the Bootstrap parts that the interface uses, all inside Bootstrap cascade layers (Bootstrap 6 puts each rule in its own layer), so that a rule of the interface always wins over a Bootstrap rule. It also holds the few Bootstrap utility classes that the interface uses. The base look of every button, the rule `.btn` of `src/styles.css`, is made of the Bootstrap button variables `--btn-*`, and a button that has the class `btn` leaves the global rule `button`. The Bootstrap 6 part `check` is not loaded, because the interface already uses the class name `check`; the windows of the interface use the class `window-box`, because Bootstrap 6 uses the class `dialog`. See [issue 141](https://github.com/heidrun-org/heidrun/issues/141) and [issue 299](https://github.com/heidrun-org/heidrun/issues/299).

## Commands

Run these commands from the root of the repository.

```sh
pnpm dev:web     # start the interface alone in a browser, with Vite and a fake Herdr session
pnpm build:web   # check the types and build the interface
```
