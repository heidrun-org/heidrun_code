# How to release Heidrun Code

This file lists every step of a release of Heidrun Code, in order, so that no step is forgotten. The file `README_DEV.md` describes each command in detail. The steps come from the release 0.2.5, where several steps were forgotten. The source of this list is the issue [#245](https://github.com/heidrun-org/heidrun/issues/245).

Replace `<version>` with the new version in every command and file name, for example `0.3.0`.

## Where the release happens

A release is made on the branch `main`. No other branch carries a release.

- `main` holds the released versions. Every commit on `main` is a version that users can install.
- `dev` collects the finished changes of all the developers, without releasing them, as [CONTRIBUTING.md](CONTRIBUTING.md) says.
- A personal development branch, for example `dev_jerome` or `dev_eric`, holds the work of one developer before the work goes to `dev`. A personal development branch has no special role in a release.

The command `pnpm release:dmg` creates the git tag `v<version>` on the current commit of the branch that is checked out, and it does not check the name of the branch. For this reason, you check out `main` yourself before you run the command, as Step 6 says.

## What the command `pnpm release:dmg` does for you

The command builds the disk image, creates the git tag `v<version>` on the current commit, and creates the GitHub release with the disk image attached. Do not create the git tag by hand.

## Part 1: Prepare the release

Part 1 changes files. The changes reach `main` through `dev`, in Step 5.

### Step 1: Run the tests

Run `pnpm test:full`. The command runs the fast tests, then the slow tests. The command `pnpm test` runs only the fast tests, so it is not enough before a release. The repository has no workflow files in the folder `.github`, so nothing on GitHub runs the tests.

### Step 2: Set the version in the four main files

Set the new version in the four files that `README_DEV.md` lists:

- the root `package.json`
- `packages/apps/desktop_tauri/package.json`
- `packages/apps/desktop_tauri/tauri.conf.json`
- `packages/apps/desktop_tauri/Cargo.toml`

### Step 3: Set the version in every other package

The file `README_DEV.md` does not list these files, and the number of packages grows. Find the files with the previous version, for example `0.2.7`:

```bash
git grep -l '"version": "<previous version>"' -- '*package.json'
git grep -l '^version = "<previous version>"' -- '*Cargo.toml'
```

Set the new version in every file that the two commands print. Do not change a package that the commands do not print: a package can keep its own version, as `packages/dev_tools/agents_rules_checker` and `packages/dev_tools/data_layer_boundary_checker` keep `0.2.0`.

The file `Cargo.lock` at the root holds the versions of the packages of the Cargo workspace, and each experiment keeps its own `Cargo.lock`. Update them without a build, then commit them:

```bash
for lockFile in $(git ls-files '*Cargo.lock' ':!tmp'); do (cd "$(dirname "$lockFile")" && cargo update --workspace --offline); done
```

Run `git diff` on the files `Cargo.lock`. The only changed lines must be lines `version`.

### Step 4: Write the release notes

No tool writes this file. The person who makes the release, or a coding agent, writes it by hand.

First, list the pull requests of the release. This command prints the number and the title of each pull request that is in the new release and is not in the last one. It reads only Git, with the range from the last tag:

```bash
git log v<last version>..HEAD --merges --pretty='%s | %b' | grep '^Merge pull request' | sed -E 's/^Merge pull request (#[0-9]+) from [^ ]+ \| /\1 /'
```

Do not make this list with `gh pr list --search "merged:>=<date>"`: a search by date also shows pull requests that were already in the last release.

Then write the file `docs/release_notes/v<version>.md`, with these rules:

1. Group the features by topic, with one heading for each topic.
2. Write one sentence for each feature, from the point of view of the user: what the user sees or can do. Do not copy the title of a pull request, and do not write a number.
3. Skip the internal pull requests: tests, documents, agent rules, and release scripts. Also skip the pull requests whose title starts with "Merge" or "Release".
4. Run the command above again on `main` just before the tag, as Step 6 says, and add each feature that is missing.

The file has this form:

- The first line is the heading `## What is new in <version>`.
- Each topic has its own heading `### <topic>`, for example `### Voice input`.
- Under each heading, each feature is one short bullet with one sentence.
- After the topics, one line says that the complete list of changes is in the file `CHANGELOG.md`, and one line says that the disk image is not signed, not notarized, and built only for the architecture of the machine that builds it.

Do not write a section about the message "Heidrun Code is damaged": the text of the release gives the installation command, and macOS opens Heidrun Code with no message after this command. The file [docs/release_notes/v0.3.0.md](docs/release_notes/v0.3.0.md) is an example. Step 7 gives this file to the command with `--notes-file`.

### Step 5: Move the work to `main`

Commit and push the work of Step 1 to Step 4. Then make the work reach `main`, with two pull requests:

1. Open a pull request from the branch that holds the work to `dev`, and merge it.
2. Open a pull request from `dev` to `main`, and merge it.

Before the second pull request, check that `dev` holds every finished change that must be in the release, from every personal development branch.

## Part 2: Release on `main`

### Step 6: Check out `main`

Run these commands in the main checkout:

```bash
git switch main
git pull
git status
```

The command `git status` must say that the branch `main` is up to date with `origin/main` and that the working tree is clean. The last commit must be the merge of the pull request of Step 5.

Then run the command of Step 4 again. On `main`, `HEAD` is the commit that the tag will hold. A pull request can land between Step 4 and Step 5, for example while the tests run. For each pull request that the notes do not cover, add one bullet to the file `docs/release_notes/v<version>.md`. Then commit and push on `main`, before Step 7.

### Step 7: Build the disk image and publish the release

Run this command on `main`:

```bash
pnpm release:dmg --notes-file docs/release_notes/v<version>.md
```

The command always exits with code 0, because the script `release:dmg` in `package.json` ends with `|| true`. Read the output and look for red text.

### Step 8: Write the change log

Run this command after Step 7, because the command needs the git tag:

```bash
pnpm release:change_log --ai --to v<version>
```

Always use `--ai` for a release, so that a coding agent sorts the pull requests into the categories of Keep a Changelog. Read the new section of `CHANGELOG.md`, then commit it on `main` and push. The git tag stays on the release commit, and the change log commit comes after the git tag.

For the release 0.2.5, the section `[Unreleased]` was out of date: it stopped at [pull request 119](https://github.com/heidrun-org/heidrun/pull/119), while the last merged pull request was [pull request 244](https://github.com/heidrun-org/heidrun/pull/244).

### Step 9: Know where the text of the release page comes from

The text of the GitHub release page does not come from `CHANGELOG.md`. The text is the file `docs/release_notes/prefix.md`, then the notes file of Step 4, then the list of pull requests that GitHub generates. To publish the change log, push `CHANGELOG.md`.

To fix only the text of a release that exists, do not run `pnpm release:dmg` again: the command builds a new disk image from the current commit, and the disk image no longer matches the git tag. Write the three parts in this order in one file, then run `gh release edit v<version> --notes-file <file>`.

## Part 3: Check the release

### Step 10: Open the release page and the disk image

1. Open the release page on GitHub. Check that the disk image is attached and that the release is marked Latest.
2. Download the disk image with a web browser, drag Heidrun Code to the Applications folder, and open it once.
3. macOS shows the message "“Heidrun Code” is damaged and can't be opened", because the disk image is not notarized. Run this command in a terminal, then open Heidrun Code again:

```bash
xattr -dr com.apple.quarantine "/Applications/Heidrun Code.app"
```

The text of the release does not give this command, because the installation command in the text avoids the message.

## Part 4: Bring `main` back into `dev`

### Step 11: Merge `main` into `dev`

Open a pull request from `main` to `dev`, and merge it. Then `dev` holds the change log commit of Step 8, and the next work does not start from a state that lacks it. Never delete the branches `dev`, `dev_jerome`, or `dev_eric`.

## Open points

- The command `pnpm release:dmg` does not check the name of the branch. A test that stops the command when the branch is not `main` can be added. Create a separate issue if this is wanted.
- The list of files in Step 2 and Step 3 can be replaced by one command that sets the version everywhere. Create a separate issue if this is wanted.
