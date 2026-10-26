# Contributing to Heidrun Code

Welcome to Valhalla. Every warrior who wants to help is welcome, and the mead is free.

## Before you start

1. Search the [open issues](https://github.com/heidrun-org/heidrun_code/issues). Someone may already be fighting the same battle.
2. If no issue exists, open one and describe the problem or the idea. Do this before you write code, so nobody wastes a day of mead on a change that cannot be merged.

## Set up the project

You need [Herdr](https://herdr.dev) 0.9 or later, Rust stable, Node.js 20 or later, and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

## Branches

This project uses a simplified form of Gitflow. Gitflow is a way to organize the branches of a Git repository, so that the stable version and the work in progress never mix.

- `main` holds the public stable version. Every commit on `main` is a version that users can install.
- `dev` holds the public development version. It collects the finished changes before they go to `main`.
- A feature branch holds one change. It starts from `dev`, and it comes back into `dev` with a pull request.

The full form of Gitflow also has release branches and hotfix branches. This project does not use them. The authoritative source is the original article, [A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/), by Vincent Driessen.

## Make a change

1. Create a branch for the change. Name it after the change and the issue number, for example `fix-sidebar-scroll-42`.
2. Make the change. Mention the issue number in every commit message.
3. Test the change in the running application.
4. Open a pull request. The template asks a few short questions.

The full rules of this repository, for people and for agents, are in [`AGENTS.md`](AGENTS.md). The marketing and writing rules are in [`docs/marketing`](docs/marketing).

## Writing style

- Write in plain English. Short sentences. No slang.
- Write the application name as "Heidrun Code". Write the goat as "Heiðrún", only when the text is about the mythology.
- A joke is welcome, but it never replaces an explanation. Explain first, then joke.

## Be kind

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). A merge conflict is Ragnarök, not a reason to be rude.

Skål, and thank you for your help! 🍻
