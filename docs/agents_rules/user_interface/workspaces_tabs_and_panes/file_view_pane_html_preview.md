# User interface of Heidrun Code: HTML preview of the file view pane

- Created: 26 October 2026
- Last updated: 27 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [File view pane](file_view_pane.md)
- Related issue: [issue 925](https://github.com/heidrun-org/heidrun_code/issues/925), [issue 930](https://github.com/heidrun-org/heidrun_code/issues/930)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the rules of the HTML preview: the file view pane shows an HTML file as a rendered web page, for example a report that a coding agent made with the skill heidrun-data.

## What the developer sees

- A file with the extension `.html` or `.htm` has the button group "Preview" and "Raw", as a Markdown file. The two kinds of file share the setting `filesMdRead`.
- The group of an HTML file has the label "HTML display", and the title of "Preview" is "Preview: show the rendered web page". The title of "Raw" is the same as for a Markdown file.
- In Preview, the web page fills the body of the pane, on a white background, as in a browser. In Raw, the code editor shows the source code, and the developer can change it.
- The web page loads the images, the style sheets, the scripts, and the other files of the project next to it, so a report with charts shows correctly.
- The web page has an `http://` address and its own web origin, as if a local web server served it: `fetch()` of a file next to it, a script with `type="module"`, `localStorage`, and `sessionStorage` work ([issue 930](https://github.com/heidrun-org/heidrun_code/issues/930)).
- A click on a link to a web site (HTTP or HTTPS) opens the web site in the browser. A link to another file of the project opens in the frame.
- The web page shows the file on the disk: unsaved changes of the file show only in Raw.

## Isolation from the application

- The web page is in a frame with the attribute `sandbox="allow-scripts allow-same-origin"`. Its scripts run, and the page keeps its own origin `http://127.0.0.1:<port>`, which is not the origin of the window of Heidrun Code. So the page cannot read the window of Heidrun Code, cannot open a window, and cannot send a form.
- Tauri gives its scripts and its invoke key to the main frame only, and the capabilities of the application allow no remote address, so a script of the web page has no `__TAURI_INTERNALS__` and cannot call a Tauri command.
- Every answer has a content security policy: the page loads the files of its own origin, `data:` and `blob:` addresses, and web sites in HTTPS. The policy has no `ipc:` address.

## The web server on the loopback address

- The desktop application starts a small web server on `127.0.0.1`, on a free port, when the first HTML preview opens, and stops it when the last HTML preview closes. A preview closes when the developer chooses Raw, when the file of the pane changes, and when the pane closes.
- The address is `http://127.0.0.1:<port>/<secret key>/<path inside the project>`. Each preview gets its own random secret key of 32 hexadecimal characters, and the key gives the project folder, so another program on the computer cannot read the files of the project, and a relative address of the page never leaves the project.
- The server serves only a project that the file view pane resolved, with the checks of the other file commands: no symbolic link, no path out of the project, and nothing inside `.git`. A file larger than 50 MB is refused. A request with another host name than `127.0.0.1:<port>` is refused, so a web site cannot reach the server through its own domain name. Only the methods GET and HEAD are accepted.
- HTTP is enough: a web browser treats `http://127.0.0.1` as a secure context, so the server has no certificate.
- Every answer has `Cache-Control: no-store`, so the page shows the file of the disk each time that the pane opens it.
- At the end of every HTML page, the server adds a small script. The script sends a click on a link to a web site of another origin to the file view pane with a message, and the file view pane opens it with the opener plugin. The file view pane accepts the message only from its own frame.

## Where the code is

- `html_preview.rs` in the desktop application runs the web server, with the commands `html_preview_open` and `html_preview_close`, and `lib.rs` registers them.
- `HtmlPreview` in `lib/html_preview.ts` writes the address of a file and reads the message of a link.
- `FileView.vue` opens and closes the preview, shows the frame, and opens the links.
- The tests are `html_preview.rs` (its `#[cfg(test)]` module), `html_preview.test.ts`, and `FileView.test.ts`.

## Background

- The isolation was tested live in Heidrun Code Development: the style sheet, the script, and the image next to the page loaded, the frame had no `__TAURI_INTERNALS__`, the access to the parent window was refused, and the requests to `ipc://localhost` and `http://ipc.localhost` failed ([issue 925](https://github.com/heidrun-org/heidrun_code/issues/925)).
- The web server was tested live in Heidrun Code Development built with its bundled page, so the window had the address `tauri://localhost`: the frame showed the page from `http://127.0.0.1`, the page was a secure context, the module script, `fetch()` of a JSON file and of a CSV file, `localStorage`, and `sessionStorage` worked, the frame had no `__TAURI_INTERNALS__`, the access to the parent window was refused, the requests to `ipc://localhost` and `http://ipc.localhost` failed, and the server refused `.git`, a wrong key, and a wrong host name ([issue 930](https://github.com/heidrun-org/heidrun_code/issues/930)).
