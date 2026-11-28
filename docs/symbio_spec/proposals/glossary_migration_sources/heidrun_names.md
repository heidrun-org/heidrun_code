# Heidrun names source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/heidrun_names.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each official name of the project. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

- Glossary entry: [Heidrun Organization](../../glossary/heidrun_names.md#11-heidrun-organization).
- Proposed destinations: Glossary.

#### Heidrun Organization

The whole project. It has two applications: Heidrun Code and Heidrun Notebook.

### Source line 16

- Glossary entry: [Heidrun Code](../../glossary/heidrun_names.md#12-heidrun-code).
- Proposed destinations: Glossary · Current identity and former name, Technical documentation.

#### Heidrun Code

The application for coding agents. It shows which coding agent needs the developer. This repository holds it, and its identifier is `heidrun_code`. Before the rebrand ([issue 837](https://github.com/heidrun-org/heidrun_code/issues/837)), it was called Heidrun.

### Source line 20

- Glossary entry: [Heidrun Notebook](../../glossary/heidrun_names.md#13-heidrun-notebook).
- Proposed destinations: Glossary · Related product identity, Technical documentation.

#### Heidrun Notebook

The application for project management and note taking. Its identifier is `heidrun_notebook`, and its repository is `heidrun-org/heidrun_notebook`.

### Source line 24

- Glossary entry: [Official name](../../glossary/heidrun_names.md#14-official-name).
- Proposed destinations: Glossary · Official-name convention.
- Inventory notes: Keep the product naming rule consistent with AGENTS.md.

#### Official name

The name of an application in a text for people. It is written with a space, for example "Heidrun Code". Never write "HeidrunCode".

### Source line 28

- Glossary entry: [Identifier](../../glossary/heidrun_names.md#15-identifier).
- Proposed destinations: Glossary · Meaning of Identifier, Technical documentation.

#### Identifier

The name of an application in a repository name, a package name, or a folder name. It is written in lowercase with an underscore, for example `heidrun_code`. The macOS bundle identifier of an application is the exception: it allows only letters, digits, hyphens, and periods, so Heidrun Code has the bundle identifier `dev.heidrun-org.heidrun-code` ([issue 845](https://github.com/heidrun-org/heidrun_code/issues/845)).

### Source line 32

- Glossary entry: [Former name](../../glossary/heidrun_names.md#16-former-name).
- Proposed destinations: Glossary · Former names and allowed historical use.

#### Former name

A name that the project used before the rebrand ([issue 837](https://github.com/heidrun-org/heidrun_code/issues/837)). The code and the texts use the new name. A new text never uses the former name, except in the history and in the persisted names below.

### Source line 36

- Proposed destinations: Glossary.

- "Heidrun" became "Heidrun Code".

### Source line 37

- Proposed destinations: Glossary.

- "Heidrun Mobile" became "Heidrun Code Mobile".

### Source line 38

- Proposed destinations: Glossary.

- "Heidrun Development" became "Heidrun Code Development".

### Source line 39

- Proposed destinations: Technical documentation.

- `heidrun_ctrl` became `heidrun_code_ctrl`.

### Source line 40

- Proposed destinations: Technical documentation.

- `heidrun_data` became `heidrun_code_data`. The package and the command line became `heidrun_data` again when they moved to the repository `heidrun_data` ([issue 848](https://github.com/heidrun-org/heidrun_code/issues/848)).

### Source line 41

- Proposed destinations: Technical documentation.

- The environment variables `HEIDRUN_*` became `HEIDRUN_CODE_*`. The former variable `HEIDRUN_DIR` is not read any more ([issue 881](https://github.com/heidrun-org/heidrun_code/issues/881)).

### Source line 42

- Proposed destinations: Behaviour, Technical documentation.

- The data folder `~/.config/heidrun` became `~/.config/heidrun_code`, and the development folder `~/.config/heidrun-development` became `~/.config/heidrun_code_development`. At its first start, each application moves its former folder to its new folder, once, when the new folder does not exist. No code reads a former folder ([issue 881](https://github.com/heidrun-org/heidrun_code/issues/881)).

### Source line 43

- Proposed destinations: Technical documentation.

- The installed application `Heidrun.app` became `Heidrun Code.app`, with the identifier `dev.heidrun-org.heidrun-code`. The former identifier was `dev.heidrun-org.heidrun`.

### Source line 45

- Glossary entry: [Persisted name](../../glossary/heidrun_names.md#17-persisted-name).
- Proposed destinations: Glossary · Meaning of Persisted name, Technical documentation.

#### Persisted name

A name that stays as it was, because a file, a session, or a setting of the developer already holds it, and a rename would lose that data. The history of the project (the change log, the release notes, `docs/blog_posts`, and `docs/pr_progress_reports`) also keeps the former names.

### Source line 49

- Proposed destinations: Technical documentation.

- The Herdr sessions `heidrun` and `heidrun_development`.

### Source line 50

- Proposed destinations: Technical documentation.

- The prefix `heidrun.` of the keys in the local storage of the web view.

### Source line 51

- Proposed destinations: Technical documentation.

- The folder `.heidrun` of a project and the file `.heidrun_origin.json`.

### Source line 52

- Proposed destinations: Technical documentation.

- The label `Heidrun file view:` of a file view pane, because Herdr keeps it.

### Source line 53

- Proposed destinations: Technical documentation.

- The text of a stash created by the Git commands of the application.

### Source line 54

- Proposed destinations: Technical documentation.

- The folder of the cache of the skills.

### Source line 55

- Proposed destinations: Technical documentation.

- The names of the image files, and the name drawn inside the images.

### Source line 56

- Proposed destinations: Technical documentation.

- The repository key `heidrun-org/heidrun` that the data layers store in their SQLite file.

### Source line 57

- Proposed destinations: Technical documentation.

- The name of the organization `heidrun-org`, and the goat Heiðrún.
