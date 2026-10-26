# Guards

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained reference of the guards
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [The Guards section of the Settings window](../agents_rules/user_interface/window/settings_guards.md)
- Related issue: [issue 589](https://github.com/heidrun-org/heidrun/issues/589), [issue 596](https://github.com/heidrun-org/heidrun/issues/596)

Heidrun Code checks a command before it types the command in a terminal. This check is called the guards. A command that a guard stops is never sent on a single click: Heidrun Code opens a confirmation window that shows the command and the reason, and the developer confirms or cancels. The confirmation window also has a button "Change this guard", which opens the Guards section of the Settings window on the guard that stopped the command. See the section "The Guards section of the Settings window" below.

## Which commands pass the guards

- A launcher of the Launchers sidebar section.
- A prompt that starts with `!`, which a coding agent runs in a shell.
- The answer to a menu of a coding agent that runs a command.
- A command sent from the phone, and a command typed in a plain terminal from the phone. The phone shows its own confirmation.

## The built-in guards

The list of the built-in guards is in the file [guards.ts](../../packages/apps/web_frontend/src/lib/guards.ts). Each built-in guard asks the developer to confirm. A built-in guard never blocks a command, and a project cannot change it, but a project can turn it off. The test [guards_document.test.ts](../../packages/apps/web_frontend/src/lib/guards_document.test.ts) fails when a built-in guard is missing from this table, or when the reason in this table is not the reason that Heidrun Code shows.

| Key | Reason that Heidrun Code shows | Commands that the guard stops |
| --- | --- | --- |
| `guards.why.deleteFiles` | deleting files (rm -r / -f) | `rm` with the option `-r`, `-R`, `-f`, `--recursive`, or `--force`. Example: `rm -rf node_modules`. |
| `guards.why.deleteFilesAsRoot` | deleting files as root (sudo rm) | `sudo rm`, with or without an option. |
| `guards.why.findDelete` | deleting files (find -delete) | `find` with the option `-delete`, or with `-exec rm`. |
| `guards.why.shred` | erasing files for good | `shred` and `srm`. |
| `guards.why.dockerPrune` | Docker cleanup (prune) | `prune` with `-a`, `-af`, or `--all`, and `system prune`. Example: `docker system prune -af`. |
| `guards.why.dockerForceRemove` | forced Docker removal | `docker rm`, `docker rmi`, or `docker volume rm` with the option `-f`. |
| `guards.why.forcePush` | force push or deletion of a remote branch | `git push` with `--force`, `-f`, `--force-with-lease`, a branch that starts with `+`, `--delete`, `-d`, or a refspec of the form `:branch`. |
| `guards.why.gitResetHard` | git reset --hard (changes lost) | `git reset --hard`. |
| `guards.why.gitClean` | git clean -f (untracked files deleted) | `git clean` with the option `-f`, alone or with other letters, for example `-fd`. |
| `guards.why.deleteBranch` | deleting a branch | `git branch -D`. |
| `guards.why.discardChanges` | local changes discarded | `git checkout -f`, `git checkout -- .`, `git restore .`, `git stash clear`, and `git stash drop`. |
| `guards.why.sqlDrop` | SQL deletion (DROP / TRUNCATE) | `DROP` or `TRUNCATE` of a `TABLE`, a `DATABASE`, or a `SCHEMA`, in upper case or in lower case. |
| `guards.why.sqlDeleteWithoutWhere` | DELETE without WHERE | `DELETE FROM` a table with no `WHERE` clause. Example: `DELETE FROM users;`. |
| `guards.why.formatDisk` | formatting a disk | `mkfs`, `fdisk`, and `diskutil erase`. |
| `guards.why.rawDiskWrite` | raw write to a disk (dd) | `dd` with the option `of=`. |
| `guards.why.deviceWrite` | writing to a device | A redirection `>` to `/dev/disk`, `/dev/sd`, or `/dev/nvme`. |
| `guards.why.recursivePermissions` | permissions changed recursively | `chmod 777`, `chmod -R 777`, and `chown -R`. |
| `guards.why.kubernetesDelete` | Kubernetes deletion | `kubectl delete`, `kubectl uninstall`, `helm delete`, and `helm uninstall`. |
| `guards.why.terraformDestroy` | destructive terraform | `terraform destroy`, and `terraform apply` with `-auto-approve`. |
| `guards.why.mergeRequest` | merging a merge request / pull request | `gh pr merge` and `glab mr merge`. |
| `guards.why.production` | action on production | A command that has the word `prod` or `production` and one of the words `rm`, `drop`, `delete`, `restart`, `stop`, or `down`, in any order. |

A `git` command with the option `-C <folder>` or `-c <setting>` before the subcommand is stopped in the same way. Example: `git -C ../other push --force`.

## The key `guards` of the file `.heidrun/config.json`

A project adds its own guards in the file `.heidrun/config.json` at the root of the repository, under the key `guards`. The key has two lists.

- `projectGuards`: the guards of the project. Each guard has a `name` (unique in the project), an optional `description` that the confirmation window shows, an `action`, and `matches`, a list of one or more lines. The `action` is `confirm` (a command that matches asks the developer to confirm) or `block` (a command that matches never runs from Heidrun Code, and the confirmation window has no button to confirm). Each line has a `type` and a `text`. The `type` is `contains`, `startsWith`, `endsWith`, or `regex`. A command matches the guard when it matches at least one line. The types `contains`, `startsWith`, and `endsWith` ignore the case and the number of spaces. The type `regex` is a regular expression of JavaScript that ignores the case.
- `disabled`: the keys of the built-in guards that are turned off for this project, for example `guards.why.gitClean`. The keys are the keys of the first column of the table above. A key that is not the key of a built-in guard is ignored. When the list is absent, every built-in guard is on.

The files written before the key `projectGuards` have the lists `confirm` and `block`, with one regular expression in each item. Heidrun Code still reads them: each item is a project guard that is named after the item, with one line of the type `regex`. The first change from the Guards section moves them to the key `projectGuards`.

Example:

```json
{
	"version": 1,
	"launchers": [],
	"guards": {
		"projectGuards": [
			{
				"name": "Publish to npm",
				"description": "Publishing cannot be undone.",
				"action": "confirm",
				"matches": [
					{ "type": "startsWith", "text": "npm publish" }
				]
			},
			{
				"name": "Deploy to production",
				"action": "block",
				"matches": [
					{ "type": "contains", "text": "deploy.sh" },
					{ "type": "regex", "text": "\\bkubectl\\s+apply\\b.*--prod" }
				]
			}
		],
		"disabled": [
			"guards.why.gitClean"
		]
	}
}
```

### The order of the checks

1. Heidrun Code replaces each run of spaces in the command with one space, and removes the spaces at the start and at the end.
2. When the file `.heidrun/config.json` exists but is not valid JSON, or does not follow the schema, every command asks for a confirmation, because the guards that forbid cannot be read.
3. The project guards with the action `block`. The first guard that matches blocks the command.
4. The project guards with the action `confirm`. The first guard that matches asks for a confirmation.
5. The built-in guards, in the order of the table above, without the guards whose key is in the list `disabled`. The first guard that matches asks for a confirmation.
6. When nothing matches, the command is sent.

So a project guard that forbids wins over a project guard that confirms, and both win over the built-in guards. A built-in guard that is turned off never stops a command, but a project guard still does. A line of the type `regex` that is not a valid regular expression matches nothing. Heidrun Code reads the key again at most one minute after a change of the file.

## The Guards section of the Settings window

The developer sees and changes the guards of one project in the section "Guards" of the Settings window, without a hand edit of the file. The section shows the guards of the project of the selected workspace. A guard is never changed for all projects at once. The rules of the section are in [settings_guards.md](../agents_rules/user_interface/window/settings_guards.md).

- One list shows the project guards first, then the built-in guards, in the same way: the name, the action, the description, and the lines. A built-in guard also has the label "Hardcoded". Its description is the text of the third column of the table above, and its line is its regular expression.
- A project guard has a button to edit and a button to remove. The button "Add a guard" opens the guard window. A built-in guard has a button to read, which opens the same window with every field read only, and a switch. A switch that is off adds the key of the guard to the list `disabled`. A switch that is on removes it.
- The guard window has the fields name, description, action (two radio buttons), the lines, and "Try a command". "Try a command" tells which line matches the command that the developer types, for a project guard and for a built-in guard.
- Each change writes the file `.heidrun/config.json` at once, and the next command reads the new guards, without the delay of one minute. Heidrun Code writes no empty list, and no empty key `guards`.
- The button "Change this guard" of the confirmation window opens this section, and the row of the guard that stopped the command has a highlight. The button is absent when the file `.heidrun/config.json` is not valid, because then no single guard stopped the command.
