# Rust style adaptation review — first draft

Source: [the TypeScript and JavaScript style at the revision used for this draft](https://github.com/jeromeetienne/coding_agent_plugin/blob/9a3398bffd2de22b859ccbaa374c29661d17bd21/skills/jerome-typescript-javascript-style/references/typescript-javascript-style.md).

Tracking issue: [Heidrun Code issue #760](https://github.com/heidrun-org/heidrun/issues/760).

“Keep” means the rule is in [the Rust draft](rust-style.md). “Remove” means the source instruction depends on the source language or its tools. “Ask Jérôme” means the rule is excluded from the draft until Jérôme decides. The review itself is not a set of coding instructions.

**Current naming decision (20 October 2026):** Jérôme now explicitly prohibits underscore-separated names everywhere, including identifiers, file names, and folder names. This newer instruction supersedes earlier decisions below that retained that form. The active style uses `camelCase` for values and non-type names, and `PascalCase` for types and enum variants. It accepts Rust naming-lint warnings rather than changing names to use underscores; if a repository forbids the necessary lint exception, report the conflict.

## Rule decisions

Jérôme explicitly emphasized that clear, explicit, complete names are far more important than casing. This priority is included in the active rules and the skill entry point.

| Source rule | Decision | Reason and Rust wording where applicable |
| --- | --- | --- |
| Avoid `!varName` in conditions; use explicit checks | Keep for booleans / ask Jérôme for optional values | Jérôme approved keeping explicit boolean checks for readability: use `== false` and `== true`. This decision does not define a style for Rust optional values. See the optional-values question below. |
| Braces and multiline bodies for `if`, `else`, `for`, and `while` | Keep | Write these bodies in braces on separate lines, including single-statement bodies. |
| `for...in`, `for...of`, and `do...while` forms | Remove | These are JavaScript syntax; do not invent Rust equivalents. |
| Prefer type aliases and Zod schemas for data shapes | Ask Jérôme / remove | Remove Zod. A preference between Rust type aliases, structures, and enumerations needs a decision; see the data-shapes question below. |
| Prefer `async/await` over raw Promises | Remove | JavaScript Promises do not establish a preference for Rust asynchronous code. |
| Avoid `any`; prefer `unknown` | Remove | These are TypeScript types. Do not infer a rule about Rust dynamic types. |
| Named exports only; no default exports | Remove | These are JavaScript module forms. |
| Name path variables `__filename` and `__dirname`; use `import.meta` or Node.js fallbacks; place both after imports | Remove | These instructions depend entirely on Node.js and JavaScript modules. |
| Use JSDoc | Remove | JSDoc syntax and tooling do not apply to Rust. |
| Document every exported type, interface, and class | Keep | Use Rust documentation comments on public structures, enumerations, traits, and aliases. Documentation coverage transfers; only the comment syntax changes. |
| Include `@param` and `@returns` in function documentation | Keep / remove tags | When documenting a function, describe every parameter and the return value. Use Rust documentation prose instead of JSDoc tags. |
| Document every class field | Keep | Document every structure field with Rust documentation comments. |
| Document every TypeScript type and each field | Keep | Document every Rust type declaration and every field, including private declarations. |
| Wrap documentation lines at 120 characters | Keep | Retain the 120-character documentation line limit. |
| `camelCase` for variables and functions | Keep | Use `camelCase`, such as `isReady` and `readConfig`, as in the source style. The later blanket prohibition on underscore-separated names supersedes the earlier choice to use Rust's customary form. |
| `PascalCase` for classes, interfaces, and type aliases | Keep | Use `PascalCase` for structures, enumerations and their variants, unions, traits, and aliases. This retains type-name casing without imposing class behavior on Rust types. |
| Underscore-separated file names | Replace by later decision | Use `camelCase` for file names, such as `projectLauncher.rs`, to follow Jérôme's later prohibition on underscore-separated names. |
| Uppercase underscore-separated names for true constants | Replace by later decision | Use `camelCase` for constants declared with `const`; the declaration itself identifies the constant. |
| PascalCase namespace-style value imports; import whole Node.js modules | Remove | These rules specify JavaScript bindings and Node.js modules. Do not infer a Rust import rule. |
| Boolean prefix `is`, with the `jsonMode` flag exception | Keep | Use `isReady`, `isAuthenticated`, and `isJson`, with the specific flag exception `jsonMode`. |
| Leading underscore for private class helpers | Keep | Prefix private helper methods with an underscore, such as `_readConfig`; do not use underscores to separate words. |
| `Fn` suffix for function-valued types and variables | Keep | Retain `Fn` on function-valued types and values: `ParseFn`, `parseFn`. |
| `Str` suffix when string and parsed forms coexist | Keep | Retain the distinction as `Str`: `indentStr` alongside `indent`. This does not choose between Rust string types. |
| Variable names derived from full class names, including assignments, parameters, return functions, and destructuring | Keep | Retain full type-derived names in `camelCase`: `childProcess`, not `child`, including assignments, fields, parameters, destructuring, and function names such as `getChildProcess`. |
| Never drop leading qualifiers from class-derived names | Keep | Keep the full type-derived name, including leading qualifiers, even when a shorter name would be unambiguous: `RemoteChildProcess` becomes `remoteChildProcess`. |
| Tabs at width 8 in the listed source file types | Keep | Apply the same indentation preference to Rust: tab characters displayed at width 8. No formatter configuration is changed by drafting the rule. |
| Single quotes for strings | Remove | Rust string literals use different syntax. |
| Trailing commas in multiline structures | Keep | Retain trailing commas in multiline lists where Rust syntax permits them. |
| Semicolons required | Remove | Do not translate the JavaScript rule into a requirement that would change Rust expression values. |
| Object literals must be multiline, with one property per line and a trailing comma | Keep | Write Rust structure expressions over multiple lines, one field per line, with a trailing comma. This is a formatting preference with no change in meaning. |
| Lines no longer than 120 characters | Keep | Retain the 120-character source line limit. Existing formatter settings do not decide personal style preferences. |
| Build HTML in one marked template literal; use the marker and indentation; interpolate all values; use an `HtmlContent` variable and return it; escape user values before interpolation | Remove | These instructions concern JavaScript HTML construction. Do not infer a Rust template system or a general Rust style rule from them. |
| Exported functions belong in a file-named static class; stateful classes use instance methods | Keep with approved adaptation | Jérôme approved grouping functions through a structure and its `impl` block. Match the primary type to the file name and keep its declaration and implementation together, such as `ProjectLauncher` and `impl ProjectLauncher` in `projectLauncher.rs`. Use associated functions without `self` for operations without instance state and methods with `self` for operations with instance state. |
| No standalone functions; private helpers also belong in classes | Keep with approved adaptation | Put functions, including private helpers, in the relevant `impl` block. Language-required entry points such as `main` and functions marked `#[test]` keep their required form; the Rust compiler rejects associated functions marked `#[test]`. |
| Public methods before private methods within a class | Keep | Place public methods before private methods within an implementation block. |
| Prefer early returns over deeply nested conditions | Keep | Prefer early returns over deeply nested conditions. |
| No unnecessary comments | Keep | Do not add unnecessary comments; let code express meaning where sufficient. |
| Consider splitting source files longer than 600 lines | Keep | Retain the threshold as guidance, not a mandatory line limit. |
| Move type aliases and Zod schemas to a dedicated type file when splitting by layer | Keep / remove Zod | When splitting by layer, move type aliases to a camelCase file ending in `Types.rs`, such as `projectLauncherTypes.rs`. Remove Zod; do not select a Rust validation library. |
| Isolate network and filesystem operations from pure logic when splitting | Keep | Separate these operations from pure logic when splitting a file. |
| Extract a distinct responsibility into a separate file with its own static class | Keep with approved adaptation | Keep splitting by responsibility, giving each extracted responsibility its own file-named type and `impl` block. |
| Split large or multi-domain source folders by responsibility | Keep | Retain the source criteria for considering a folder split. |
| Read file names first; group by existing prefix or domain; avoid leftover `misc` or `utils` folders | Keep | Retain these grouping rules. |
| At least two files per new subfolder; leave lone files in the parent | Keep | Retain the minimum and lone-file rule. |
| Name domain subfolders with underscore-separated words | Replace by later decision | Use `camelCase` for folder names, such as `teamWebsite`, to follow Jérôme's later prohibition on underscore-separated names. |
| No re-export-only `index.ts` in new subfolders; import specific files | Ask Jérôme / remove | Remove `index.ts`. Ask before interpreting the intent as a Rust module or re-export rule; see the module re-exports question below. |
| Single `src/index.ts` and package.json `exports` entry for packages | Remove | JavaScript package entry points do not determine Rust library entry points or visibility. |
| Five-line separators using 79 slashes, a tabbed title, and surrounding blank lines | Keep | Retain the exact separator form; Rust supports these ordinary line comments. |
| Separator after imports naming `ClassName — responsibility`, and internal Title Case separators | Keep / ask Jérôme | Retain internal Title Case separators. For a file with a single main type, use `TypeName — one-line description` after imports. Ask only how to name a file header when no single main type exists. |
| Loose JavaScript script JSDoc map annotations and resolvable `@types/node` dependency | Remove | These rules depend entirely on JavaScript editor checks and Node.js dependencies. |

## Questions that still need a decision

Clearly transferable rules are already in the draft; these questions concern changes of meaning or a missing equivalent.

1. **Optional values:** explicit boolean checks are retained. JavaScript null and undefined checks do not establish whether Rust optional values should use comparisons, matching, or methods that test whether an option contains a value. Should this draft simply omit an optional-value rule?
2. **Data shapes:** the source prefers type aliases and Zod schemas. Rust aliases do not define distinct types, and choosing structures or a validation library would add a preference. Discard this data-shape rule, or define a specific Rust preference?
3. **Module re-exports:** the source prohibits re-export-only `index.ts` files except at package boundaries. Rust modules and visibility work differently. Discard this source-specific rule, or define a Rust module rule?
4. **File headers without a single main type:** the separator itself transfers and is retained. Ordinary function-grouping files now have a file-named type under the approved organization rule. What should replace `ClassName` in a file-header title for other files, such as files containing several type declarations? For example, use the file name or just the responsibility?

## Formatting during the source-file trial

The draft retains tabs at width 8, the 120-character limit, multiline structure expressions, and section separators. When applying the draft to a real Rust source file, inspect the result and report any conflict with that repository's formatter. Do not silently replace personal preferences with formatter defaults or change repository-wide formatter settings as part of the trial.

## Planned iteration

Choose one existing Rust source file from disk, apply only the active draft rules in a reviewable change, inspect the result together, and refine the rules. Resolve uncertain rules with Jérôme as part of that iteration; do not apply unresolved rules. No Rust application source has been changed as part of creating this draft.
