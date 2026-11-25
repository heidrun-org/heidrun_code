# jerome-typescript-javascript-style

## Purpose

Apply Jérôme Étienne’s personal TypeScript and JavaScript coding style. These rules express personal preferences, not a general language standard. The complete rules are bundled with the skill; access to Jérôme Étienne’s user configuration is unnecessary, and installation does not change that configuration.

## When to use

Use before creating or editing `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` or `.cjs` files in a project or request adopting Jérôme Étienne’s personal style. Apply relevant rules to requested changes.

The rules cover explicit condition checks, braces, types, documentation comments, complete names, tab indentation, single quotes, semicolons, HTML construction, file organization, section separators and standalone JavaScript scripts.

## Requirements

Read the [full personal style reference](references/typescript-javascript-style.md) before creating or editing a matching source file. No companion skill or access to the original Claude Code configuration is required. Project-specific compiler, validation and check tools remain receiving-project responsibilities; this skill does not install dependencies.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill jerome-typescript-javascript-style
```

See [shared installation options](../../README.md#install-the-skills). Installation does not adopt the style on behalf of a project or approve wider changes.

## Configuration

No configuration file is needed. The project or request adopts the personal style; the bundled reference supplies the rules. The reference's original source was Jérôme Étienne’s user configuration, but the installed skill is self-contained.

## Concrete example

Illustrative request:

> In `launch_policy.ts`, make the boolean check explicit and keep the body on separate lines, following Jérôme Étienne’s personal style.

Before, inside an existing class method:

```typescript
if (!isReady) return false;
```

After, as a method-body excerpt with tab indentation:

```typescript
if (isReady === false) {
	return false;
}
```

The example assumes `isReady` is a boolean, so the explicit comparison preserves the intended condition. Nullable or unknown values need their appropriate explicit checks; replacing every negation with `=== false` would not preserve all JavaScript behaviour.

A second representative naming correction changes a value of type `RemoteChildProcess` from `child` to `remoteChildProcess`. Keep the complete type-derived name, including leading qualifiers. File names use `snake_case`; classes and type aliases use `PascalCase`.

## Results and review

Expect requested source changes to follow the full reference, with behaviour preserved unless a behaviour change was requested. The small example illustrates conditionals and braces; the example is not a complete module or a substitute for the other rules.

Review documentation on exported classes and every type and field, parameter and return documentation when documenting functions, named exports, multiline object literals and class-based function organization. Exported operations without instance state belong in a static class named after the file; stateful classes use instance methods. Standalone JavaScript scripts also have editor type-checking requirements in the reference.

## Approval boundaries

Personal style rules remain unchanged unless Jérôme Étienne explicitly instructs a rule change. Applying the skill to requested code does not authorize rewriting unrelated files or modifying the original user configuration. The reference is the authority for the exact preferences.

## Related skills and guides

No companion skill is required. [jerome-rust-style](../jerome-rust-style/README.md) is an optional, separate ready-to-use adaptation; TypeScript and JavaScript rules do not automatically become Rust rules. [rules_of_the_repo](../rules_of_the_repo/README.md) can select coding rules when a project adopts that system.

## Instructions and references

- [SKILL.md](SKILL.md): activation, source and rule-change boundary.
- [Personal TypeScript and JavaScript rules](references/typescript-javascript-style.md): full authoritative style, including code examples and section separators.
