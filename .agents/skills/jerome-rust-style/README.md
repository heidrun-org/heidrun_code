# jerome-rust-style

**Status: Ready for use.**

## Purpose

Apply Jérôme Étienne’s personal Rust coding style. These are personal preferences, not a general Rust standard. The style includes clearly transferable source rules and explicitly approved adaptations from the TypeScript and JavaScript style.

Clear, explicit, complete names are the most important requirement, above casing. Use `camelCase` for values, functions, fields, modules, constants, static items, macros, files and folders; use `PascalCase` for types and enum variants. Underscore-separated names are prohibited. A leading underscore on a private helper remains permitted.

## When to use

Use before creating or editing Rust source files in a project or request adopting Jérôme Étienne’s personal style. The style covers control flow, names, documentation, formatting, code organization and section separators.

## Requirements

Read the [active Rust rules](references/rust-style.md) in full before editing Rust. Read the [adaptation review](references/adaptation-review.md) when discussing or extending the style. No companion skill or original user configuration is required. Source compilation, documentation generation and formatter checks use the receiving project's tools.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill jerome-rust-style
```

See [shared installation options](../../README.md#install-the-skills). Installation does not approve undecided adaptations or change formatter settings.

## Configuration

No configuration file is required. The project or request adopts the style. Rust naming checks can warn about the required casing; retain the personal names and use repository-approved handling. If the repository forbids a necessary exception, report the conflict. Do not silently substitute conventional Rust names or modify repository-wide formatter settings during a trial.

## Concrete example

Illustrative request:

> In `launchPolicy.rs`, apply the approved style’s explicit boolean checks and complete names while preserving behaviour.

Before, inside an existing implementation method:

```rust
if !isReady {
	return false;
}
```

After, as a method-body excerpt with tab indentation:

```rust
if isReady == false {
	return false;
}
```

The example assumes `isReady` is a boolean. The approved rules require explicit `== false` and `== true` checks. The style does not establish a preference for handling optional values.

A value of type `RemoteChildProcess` is named `remoteChildProcess`, including leading qualifiers. An operation returning that value keeps the full name, such as `getRemoteChildProcess`. A file `projectLauncher.rs` keeps its primary `ProjectLauncher` type and `impl ProjectLauncher` together. Operations without instance state are associated functions without `self`; operations with state use methods with `self`. Private helpers go last and can have names such as `_readConfig`.

## Results and review

Expect a reviewable change to the requested Rust files using only active rules. The small example illustrates control flow, not a complete source file. The full reference also requires tab indentation, multiline structure expressions, documentation comments for types and fields, and the specified section separators.

Rust documentation comments use `///` for declarations and `//!` for containing modules or libraries. Describe parameters and return behaviour in prose. The reference describes `cargo doc --no-deps`, adding `--document-private-items` for private declarations, and `cargo test --doc` for documentation examples. These commands are receiving-project checks, not checks executed for this README update.

Report compiler or formatter conflicts during a source-file trial. Language-required standalone entry points such as `main` and test functions marked `#[test]` keep their required form.

## Approval boundaries and undecided adaptations

The adaptation review records decisions; the adaptation review is not a second set of active rules. Optional-value handling, data-shape preferences, module re-exports and file-header naming without a single main type remain undecided. Do not infer those preferences from TypeScript or JavaScript rules. Ask Jérôme Étienne before adopting an uncertain adaptation. Clearly transferable rules can be carried over when extending the style; approved casing changes do not need approval again.

The approved rules are ready for use. Possible extensions recorded in the adaptation review remain undecided; readiness does not approve those extensions or authorize changing the personal style.

## Related skills and guides

No companion skill is required. [jerome-typescript-javascript-style](../jerome-typescript-javascript-style/README.md) is the source relationship and an optional skill for projects using those languages. Its full rules do not automatically apply to Rust.

## Instructions and references

- [SKILL.md](SKILL.md): activation, naming priority and approval boundaries.
- [Active Rust rules](references/rust-style.md): the rules to apply to Rust source.
- [Adaptation review](references/adaptation-review.md): approved transfers, removed language-specific rules and unresolved questions.
