# User interface of Heidrun Code: folders of the File explorer read from the disk

- Created: 27 October 2026
- Last updated: 27 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [files.md](files.md)
- Related issue: [issue 430](https://github.com/heidrun-org/heidrun/issues/430), [issue 923](https://github.com/heidrun-org/heidrun_code/issues/923)

This file is a part of the rules of the File explorer sidebar section, in [files.md](files.md). It gives the rules of the folders whose content Git does not list, so the program reads the content from the disk: a folder that Git ignores, and a symbolic link to a folder.

## A folder that Git ignores

- A folder that Git ignores unfolds with a click, as any other folder. Git does not list the files of such a folder, so the program reads from the disk only the first level of the folder, the files and the folders directly inside it, when the developer unfolds it. A folder inside it unfolds in the same way. A click on a file inside it opens the file in a file view pane. The button "Refresh", and every other reading of the tree, read again each unfolded folder that Git ignores. When a folder cannot be read, it stays folded and a toast tells the reason. The read keeps the protections of the other reads: a known root, a relative path, and nothing inside `.git`. A symbolic link inside a folder that Git ignores is not listed.
- A new file or a new folder inside a folder that Git ignores shows from the disk at the next reading of that folder, so the tree does not remember it in the list of the new empty folders. When the developer turns the option off while the selected row is inside a folder that Git ignores, the selection is cleared.

## A symbolic link to a folder

- Git lists a symbolic link as a file, even when its target is a folder. When the target is a folder inside the project, the File explorer sidebar section shows the symbolic link as a folder, with the arrow and the icon of a folder, in the normal color, and not as a file ([issue 923](https://github.com/heidrun-org/heidrun_code/issues/923)).
- The symbolic link unfolds with a click, as a folder that Git ignores: the program reads from the disk only the first level of the target folder, and a folder inside it unfolds in the same way. A click on a file inside it opens the file in a file view pane. The button "Refresh" reads again each unfolded symbolic link.
- A new file or a new folder inside a symbolic link to a folder shows from the disk at the next reading, so the tree does not remember it in the list of the new empty folders.
- The protections stay. A symbolic link whose target is outside the project, inside `.git`, or the root of the project itself, stays a file row, and the program refuses to read it as a folder.
- A symbolic link to a file shows as a file, and a click on it opens the target file in a file view pane, when the target is inside the project.
- The error messages of the backend of the File explorer sidebar section are in English.
