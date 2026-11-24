# User interface of Heidrun Code: the references in the text of the terminals

- Created: 22 October 2026
- Last updated: 24 November 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [The detection in the text of the terminals](terminal_text_detection.md), [Glossary of Heidrun Code: terminal text detection](../../glossary/terminal_text_detection.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638), [issue 1083](https://github.com/heidrun-org/heidrun_code/issues/1083)

The terminal starts with the following references.

| Hosting service | Workspace shorthand | Full address examples |
| --- | --- | --- |
| GitHub | `#123` for an issue or a pull request | `https://github.com/org/app/issues/123`, `https://github.com/org/app/pull/123` |
| GitLab | `#123` for an issue and `!123` for a merge request | `https://gitlab.com/group/app/-/issues/123`, `https://gitlab.com/group/app/-/work_items/123`, `https://gitlab.com/group/app/-/merge_requests/123` |

A full address uses the repository named in the address. The configured host also supports full addresses for a self-managed hosting service. A shorthand reference needs the workspace repository, which comes from the Git remote or the project reference configuration. The project can turn reference detection off with `references.enabled` in `.heidrun/config.json`.

GitHub issue lookup can resolve a shared number to a pull request. The terminal uses the canonical pull request address in that case, then loads its details and available merge options. The same item shows the same card for shorthand and full addresses.

The parser ignores number signs inside web addresses and leaves chat image markers available to the image preview. The parsing rules are tested in `lib/refs.test.ts`.
