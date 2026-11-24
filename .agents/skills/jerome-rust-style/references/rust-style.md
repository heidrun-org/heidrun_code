# Jérôme Étienne’s personal Rust style rules

These rules are conservatively adapted from Jérôme Étienne’s personal TypeScript and JavaScript coding style. The style includes clearly transferable rules and adaptations explicitly approved by Jérôme. Rules whose meaning does not clearly transfer remain in the separate adaptation review.

## Priority

Clear, explicit, complete names are a central requirement of this style and are far more important than casing. A name with the correct casing still fails this requirement if the name is shortened or unclear. Always preserve the full meaning and leading qualifiers of a name.

Never use snake_case anywhere in Rust identifiers, file names, or folder names. Do not separate words with underscores. Use `camelCase` for values, fields, functions, modules, constants, static items, macros, file names, and folder names. Use `PascalCase` for types and enum variants. A leading underscore on a private helper remains permitted by the private-helper rule below; it does not separate words. This personal rule overrides Rust's usual naming guidance. Rust's `non_snake_case` lint warns on many of these names, and `non_upper_case_globals` warns on constant and static names. Keep the required names and use the repository-approved lint handling; if the repository forbids the needed exception, report the conflict rather than renaming a name to use underscores.

## Control flow

- Use explicit boolean comparisons in conditions: write `isReady == false` instead of `!isReady`, and `isReady == true` instead of a bare `isReady`. Jérôme prefers these checks for readability.
- Write the bodies of `if`, `else`, `for`, and `while` in braces on separate lines, even when the body contains only one statement.
- Prefer early returns over deeply nested conditions.

## Naming

- Always use clear, explicit names.
- Use `camelCase` for variables, fields, functions, modules, constants, static items, macros, file names, and folder names. For example, use `isReady`, `readConfig`, and `projectLauncher.rs`.
- Use the `is` prefix for booleans: `isReady`, `isAuthenticated`, and `isJson`. Preserve the source rule's specific `jsonMode` flag exception.
- Name a value after its full type name, including in assignments, fields, function parameters, and destructuring. For a value of type `ChildProcess`, use `childProcess`, not `child`.
- Never drop leading qualifiers from type-derived names, even when a shorter name would be unambiguous. For example, use `remoteChildProcess` for a value of type `RemoteChildProcess`.
- Keep the full type-derived name in a function that returns that value, such as `getChildProcess`.
- Use `PascalCase` for structures, enumerations and their variants, unions, traits, and type aliases.
- Prefix private helper methods with an underscore, such as `_readConfig`.
- Use the `Fn` suffix for function-valued types and values, such as `ParseFn` and `parseFn`.
- When a string form sits next to its parsed form, use the `Str` suffix for the string form, such as `indentStr` alongside `indent`.

## Documentation

- Use **rustdoc**, Rust's standard documentation system. Follow the [official rustdoc guide](https://doc.rust-lang.org/rustdoc/how-to-write-documentation.html).
- Write `///` comments above functions, types, and fields, and `//!` comments for the containing module or library. Write the content as Markdown.
- Document every public structure, enumeration, trait, and type alias.
- Document every type declaration, including private type declarations, and every field within a type.
- When documenting a function, describe every parameter and the return value. Express these descriptions in Rust documentation rather than copying JSDoc tags.
- Start with a short summary. Describe parameter meanings and return behavior in prose or Markdown sections; do not repeat types already visible in the signature. Use headings such as `# Examples`, `# Errors`, and `# Panics` when relevant, without inventing JSDoc-style tags.
- Rustdoc has no built-in structured parameter-description tag. A heading such as `# Arguments` is ordinary Markdown for readers; tools do not treat its contents as parameter metadata.
- Wrap documentation comment lines so none exceeds 120 characters.

Generate documentation with `cargo doc --no-deps`; add `--document-private-items` when reviewing the private declarations covered by this style. Rust examples in documentation can be checked with `cargo test --doc`.

## Formatting

- Indent Rust source files with tab characters, displayed at a width of 8.
- Lines should not exceed 120 characters.
- Use trailing commas in multiline lists where Rust permits trailing commas.
- Write structure expressions over multiple lines, even when there is only one field. Put each field on its own line and include a trailing comma after the last field.

## Comments

- Do not add unnecessary comments. Let the code express its meaning where the code is sufficient.

## Code organization

- Group functions in a type's `impl` block. Name the type after the file in `PascalCase`: `aiClient.rs` uses `AiClient`.
- Keep a primary type declaration and its `impl` blocks in the same file, with matching names: `projectLauncher.rs` contains `ProjectLauncher` and `impl ProjectLauncher`.
- Supporting types may appear in the same file when they serve the primary type's responsibility. A data-only type needs no empty `impl` block.
- For operations without instance state, use associated functions without a `self` parameter. A structure without fields can group these functions.
- For operations with instance state, store the state in the structure and use methods with a `self` parameter.
- Do not write standalone functions, including private helpers; put the functions in the relevant `impl` block. Rust-required entry points such as `main` and test functions marked `#[test]` retain their required form. Rust requires `#[test]` functions to be standalone functions.
- Within an implementation block, place public methods before private methods.
- If a source file is longer than 600 lines, consider splitting the file into smaller files. This is guidance to consider a split, not a mandatory line limit.
- When splitting by layer, move type aliases to a dedicated camelCase file ending in `Types.rs`, such as `projectLauncherTypes.rs`.
- When splitting a file, separate network and filesystem operations from pure logic, or extract code with a distinct responsibility, such as parsing, validation, or formatting. Give an extracted responsibility its own file-named type and `impl` block.
- When a `src` folder or one of its subfolders has grown large enough that you can no longer name its files from memory, or contains two or more distinct domains, split the folder into subfolders by responsibility:
  - Read the existing file names first. Group files that already share a naming prefix or an obvious domain.
  - Do not create a generic `misc` or `utils` folder merely to hold a leftover file.
  - Each new subfolder needs at least two files. Keep a lone file in the parent folder instead of creating a subfolder for that file.
  - Name each subfolder after its shared domain in `camelCase`, for example `connection`, `registry`, or `teamWebsite`.

## Section separators

- Mark a section boundary with a five-line block: two lines of exactly 79 `/` characters, a title line, then two more lines of exactly 79 `/` characters. Leave one blank line before and after the block.
- The title line is `//` followed by a tab and the title text, with no trailing punctuation.
- Use internal separators to divide a file into logical parts, with short Title Case labels such as `Types` or `Helpers`.
- When a file has a single main type, put a file-header separator after the imports, using `TypeName — one-line description` as the title. File-header naming for a file without a single main type remains undecided.
