# Directory Context: `/packages/data_layers/data_layer_code_hosting/src/github`

## Purpose
Reads the issues and the pull requests of a GitHub repository, one page of 100 items at a time, and turns them into the stored shape.

## Key Exports & Entry Points
- `graphql_runner.rs`: the trait `GraphqlRunner`, the runner `GhGraphqlRunner` that runs `gh api graphql`, and `find_repository`.
- `github_reader.rs`: `GithubReader`, the two GraphQL queries `ISSUES_QUERY` and `PULL_REQUESTS_QUERY`, `ignore_log`, `ignore_progress`, the progress reports of each page (`GithubReader::with_progress`), and the conversion of each GraphQL node into an `Issue` or a `PullRequest`.
- Command to test this folder: `pnpm --filter data_layer_code_hosting test`

## Rules
- Only `graphql_runner.rs` runs the command `gh`. `github_reader.rs` only talks to a `GraphqlRunner`.
- Nothing here imports from `src/storage/`.
- The tests give a fake runner, so they need no network.
