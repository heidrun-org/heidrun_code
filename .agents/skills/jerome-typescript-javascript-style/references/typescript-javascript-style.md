---
description: This file describes the TypeScript/Javascript code style for the project.
applyTo: "**/*.{ts,tsx,js,jsx,mjs,cjs}"
---

## Coding Style

When generating TypeScript code, follow these conventions:

### Conditionals
- **Never use `!varName` in if conditions.** Always use explicit checks: `=== null`, `=== undefined`, `=== false`, `!== null`, `!== undefined`, etc.

### Control flow statements
- **Every `if`, `else`, `for`, `for...in`, `for...of`, `while`, and `do...while` must always use braces `{}` around its body, even for a single statement.** Never write the body on the same line as the statement, and never omit the braces.
  - bad example: `if (build.code !== 0) throw new Error(...);`
  - bad example: `for (const childProcess of this.children) this._stop(childProcess);`
  - bad example: `while (queue.length > 0) queue.pop();`
  - good example:
    ```ts
    if (build.code !== 0) {
    	throw new Error(...);
    }

    for (const childProcess of this.children) {
    	this._stop(childProcess);
    }

    while (queue.length > 0) {
    	queue.pop();
    }
    ```

### TypeScript
- Prefer `type` aliases and Zod schemas for data shapes
- Use `async/await` over raw Promises
- Avoid `any`; prefer `unknown` when the type is genuinely unknown
- Named exports only; no default exports
- In an ES module that needs the current file's or directory's path, always name the variables `__filename` and
  `__dirname`, matching the CommonJS globals they replace.
  - Prefer the built-in, import-free form (Node.js 20.11+/21.2+):
    ```ts
    const __filename = import.meta.filename;
    const __dirname = import.meta.dirname;
    ```
  - Only when targeting an older Node.js runtime, fall back to deriving them with `node:path`/`node:url`:
    ```ts
    import Path from 'node:path';
    import Url from 'node:url';

    const __filename = Url.fileURLToPath(import.meta.url);
    const __dirname = Path.dirname(__filename);
    ```
  Place these two lines near the top of the file, right after the imports, even if only `__dirname` is needed.

### Documentation
- Use JSDoc to document code, in both TypeScript and JavaScript
- Add a JSDoc comment to every exported type, interface, and class
- When documenting a function with JSDoc, always include `@param` for every parameter and `@returns` for the return type
- Every field of a class must be documented with JSDoc, not only the class itself
- Every TypeScript type must be documented with JSDoc, including each field within the type
- Wrap JSDoc comment lines so none exceeds 120 characters

### Naming
- `camelCase` for variables and functions
- `PascalCase` for classes, interfaces, and type aliases
- `snake_case` for file names
- `UPPER_SNAKE_CASE` for true constants
- Namespace-style import bindings — PascalCase
  - Value imports get a capitalized name: `import Fs from 'node:fs'`, `import Path from 'node:path'`, `import Chalk from 'chalk'`.
  - Import Node.js built-in modules as the whole module, never individual named functions:
    - BAD: `import { spawn } from 'node:child_process';`
    - GOOD: `import ChildProcess from 'node:child_process';` then call `ChildProcess.spawn(...)`.
- Booleans - predicate prefix is `is`:
  - `isAuthenticated`, `isJson`, plus the `jsonMode` flag.
- Private helpers in a class — leading underscore
  - `_pathExists`, `_getUserConfig`, `_parseJson`, etc.

#### Naming Suffix patterns
- `Fn` for function-valued things: type `AxTreeTestFn`, variable `testFn`.
- `Str` when a string form sits next to its parsed form: `indentStr` vs `indent`.
- prefer variable as camelCase of the type name: 
  - for variable assignment `let blueskyClient = new BlueskyClient(...)`
  - for function parameter `function doSomething(blueskyClient: BlueskyClient) { ... }`
  - for function return type `function getBlueskyClient(): BlueskyClient { ... }`
  - for function parameter destructuring `function doSomething({ blueskyClient }: { blueskyClient: BlueskyClient }) { ... }`
  - a variable holding an instance of a class must be named after the camelCase of that class name, not a shortened or unrelated word:
    - bad example: `let child: ChildProcess`
    - good example: `let childProcess: ChildProcess`
- Never drop leading qualifiers from names, even when a shorter name would be unambiguous. Always keep the full class name in camelCase for a variable holding an instance of that class.


### Formatting
- Indent `.ts`/`.js`/`.tsx`/`.jsx` files with tab characters, not spaces, set to a width of 8
- Single quotes for strings
- Trailing commas in multi-line structures
- Semicolons required
- Object literals must never be written on a single line, even with only one property — spread each property onto its own line, with a trailing comma on the last one.
- Lines should not exceed 120 characters

### Building HTML

Build HTML in one template literal marked with an inline `/* html */` comment, never by adding strings together with `+`, which hides the shape of the markup and stops the editor colouring and formatting it.

- Write `/* html */` between the `=` and the opening backquote, with no space before the backquote.
- Indent the markup the way HTML is normally indented, one element per line, children one level deeper than their parent.
- Put every value coming from JavaScript or TypeScript inside `${...}`, including the markup returned by another function.
- Assign the template literal to a variable whose name ends in `HtmlContent`, and return that variable on the next line.
- Escape every value a person supplied before it reaches the `${...}`: a template literal escapes nothing on its own.

```ts
const htmlContent = /* html */`
    <div class="dropdown">
      <button class="btn btn-link" type="button">
        <span>${fullName}</span>
      </button>
    </div>
  `;
return htmlContent;
```

### Code Organization
- All exported functions in a module must live in a static class named after the file (snake_case → PascalCase). Example: `ai_client.ts` → `class AiClient { static … }`. Classes with internal state use instance methods instead.
- No standalone functions in a `.ts`/`.js` file — every function belongs inside a class, including private helpers that are not exported.
- Within a class, order methods with private methods last, after the public ones.
- Early returns over deeply nested conditions
- No unnecessary comments — let code speak for itself
- If a source file is longer than 600 lines, consider splitting it into smaller files:
  - By layer: move type aliases and Zod schemas to a dedicated `*_types.ts` file, and isolate I/O (network, filesystem) from pure logic.
  - By responsibility: if a subset of the code forms its own distinct concern (parsing, validation, formatting, internal helpers, etc.), extract it into its own file with its own static class.
- When a `./src` folder (or a subfolder such as `./src/libs`) has grown large enough that you can no longer name
  its files from memory, or that two or more distinct domains are clearly present, split it into subfolders by
  responsibility:
  - Read the existing file names first and group ones that already share a naming prefix or an obvious domain —
    do not invent a generic bucket (`misc/`, `utils/`) just to have somewhere to put a leftover file.
  - Each subfolder needs at least 2 files; a lone file stays at the parent level rather than becoming its own
    folder.
  - Name each subfolder after its shared domain in `snake_case`, e.g. `libs/connection/`, `libs/registry/`,
    `libs/scheduling/`.
  - Do not add an `index.ts` file that only re-exports the other files of the folder to one of these new subfolders — import from the specific file directly.
- A package is the one exception to the line above: every package has a single `src/index.ts` that names everything the package offers to the outside, and the `package.json` of the package has a single `".": "./src/index.ts"` entry under `exports`. Never write a list of separate files under `exports`.

### Section separators
- Mark a section boundary with a 5-line block: two lines of exactly 79 `/` characters, a title line, then two more 79-`/` lines. Leave one blank line before and after the block.
- The title line is `//` followed by a tab, then the title text — no trailing punctuation.
- Two uses:
  - **File header** — once, right after the imports, naming the file's single responsibility: `ClassName — one-line description`.
  - **Internal divider** — inside a single file, to split it into its logical parts (e.g. types, groups of related functions, distinct concerns): a short Title Case label, e.g. `Types`, `Helpers`, `Post Commands`.

```ts
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WriteThrottlePaths — resolves where the on-disk ledger lives
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

export class WriteThrottlePaths {
	// ...
  
  ///////////////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////
  //	Helpers
  ///////////////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////////
  private static _emitResult(value: unknown): void {
	  // ...
  }
}
```

```ts
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

type SourceResult = {
	// ...
};
```

### Loose JS/MJS scripts
- Standalone `.js`/`.mjs` scripts with no local tsconfig/jsconfig (e.g. a repo-root `scripts/` tool) get full-type-checked by VSCode's implicit project config, so:
  - Add JSDoc type annotations for object literals used as dynamically-keyed maps/records (e.g. `/** @type {Record<string, T>} */`), otherwise indexing with a computed string key is flagged as implicit `any`.
  - Make sure `@types/node` is resolvable by walking up `node_modules/@types` from the file's location, otherwise `node:fs`/`node:path`/etc. imports and globals like `process` are flagged as unresolvable. For a repo-root script, add `@types/node` as a root-level devDependency.
