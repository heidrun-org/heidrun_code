---
name: jerome-rust-style
description: Apply Jérôme Étienne's personal Rust coding style when creating or editing Rust source files in his personal style or in a project that adopts his conventions.
---

# Jérôme Étienne’s personal Rust coding style

This skill is ready for use and is adapted from Jérôme Étienne’s personal TypeScript and JavaScript style. These are his personal preferences, not a general Rust standard.

Before creating or editing a Rust source file, read [the Rust style rules](references/rust-style.md) in full and apply the relevant rules to the requested changes.

Give particular attention to clear, explicit, complete names. Jérôme considers this requirement far more important than casing.

Never use snake_case anywhere in Rust identifiers, file names, or folder names. Use `camelCase` for names other than types and enum variants, and `PascalCase` for types and enum variants. This rule overrides Rust's usual naming guidance; never change names to satisfy a conflicting lint.

The style contains rules that clearly transfer to Rust and adaptations explicitly approved by Jérôme. Unresolved choices are recorded separately in [the adaptation review](references/adaptation-review.md); those choices are not style instructions. Read that review when discussing or extending the style, and ask Jérôme before adopting an uncertain adaptation. Do not infer additional Rust preferences from the source style.

When extending the style, transfer clear source rules directly. Ask Jérôme only when the source rule does not clearly transfer to Rust; applying an already approved casing change is not a reason to ask again.
