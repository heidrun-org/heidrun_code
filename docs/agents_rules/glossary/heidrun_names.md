# Glossary of Heidrun Code: the names of the project

- Created: 23 October 2026
- Last updated: 26 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md)
- Related issue: [issue 837](https://github.com/heidrun-org/heidrun_code/issues/837), [issue 843](https://github.com/heidrun-org/heidrun_code/issues/843)

This document gives one short definition for each official name of the project. The other words of Heidrun Code are in [index.md](index.md).

### Heidrun Organization

The whole project. It has two applications: Heidrun Code and Heidrun Notebook.

### Heidrun Code

The application for coding agents. It shows which coding agent needs the developer. This repository holds it, and its identifier is `heidrun_code`. Before the rebrand ([issue 837](https://github.com/heidrun-org/heidrun_code/issues/837)), it was called Heidrun.

### Heidrun Notebook

The application for project management and note taking. Its identifier is `heidrun_notebook`, and its repository is `heidrun-org/heidrun_notebook`.

### Official name

The name of an application in a text for people. It is written with a space, for example "Heidrun Code". Never write "HeidrunCode".

### Identifier

The name of an application in a repository name, a package name, or a folder name. It is written in lowercase with an underscore, for example `heidrun_code`. The macOS bundle identifier of an application is the exception: it allows only letters, digits, hyphens, and periods, so Heidrun Code has the bundle identifier `dev.heidrun-org.heidrun-code` ([issue 845](https://github.com/heidrun-org/heidrun_code/issues/845)).

### Former name

A name that the project used before the rebrand ([issue 837](https://github.com/heidrun-org/heidrun_code/issues/837)). The code and the texts use the new name. A new text never uses the former name, except in the history and in the persisted names below.

- "Heidrun" became "Heidrun Code".
- "Heidrun Mobile" became "Heidrun Code Mobile".
- "Heidrun Development" became "Heidrun Code Development".
- `heidrun_ctrl` became `heidrun_code_ctrl`.
- `heidrun_data` became `heidrun_code_data`. The package and the command line became `heidrun_data` again when they moved to the repository `heidrun_data` ([issue 848](https://github.com/heidrun-org/heidrun_code/issues/848)).
- The environment variables `HEIDRUN_*` became `HEIDRUN_CODE_*`. The former variable `HEIDRUN_DIR` still works when `HEIDRUN_CODE_DIR` is not set.
- The data folder `~/.config/heidrun` became `~/.config/heidrun_code`. The former folder is used while the new folder does not exist, so no data moves. The development folder `~/.config/heidrun-development` became `~/.config/heidrun_code_development` in the same way.
- The installed application `Heidrun.app` became `Heidrun Code.app`, with the identifier `dev.heidrun-org.heidrun-code`. The former identifier was `dev.heidrun-org.heidrun`.

### Persisted name

A name that stays as it was, because a file, a session, or a setting of the developer already holds it, and a rename would lose that data. The history of the project (the change log, the release notes, `docs/blog_posts`, and `docs/pr_progress_reports`) also keeps the former names.

- The Herdr sessions `heidrun` and `heidrun_development`.
- The prefix `heidrun.` of the keys in the local storage of the web view.
- The folder `.heidrun` of a project and the file `.heidrun_origin.json`.
- The label `Heidrun file view:` of a file view pane, because Herdr keeps it.
- The text of a stash created by the Git commands of the application.
- The folder of the cache of the skills.
- The names of the image files, and the name drawn inside the images.
- The repository key `heidrun-org/heidrun` that the data layers store in their SQLite file.
- The name of the organization `heidrun-org`, and the goat Heiðrún.
