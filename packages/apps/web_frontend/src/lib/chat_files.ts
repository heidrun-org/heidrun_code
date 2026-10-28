import type { Forge } from "./refs";

/** A file that a chat wrote, ready for the summary and for the information card. */
export type ChatFile = {
  /** The path below the root of the repository, or null when the file is not below the root. */
  relativePath: string | null;
  /** The text that names the file: the path below the root, or the absolute path when the file is not below the root. */
  label: string;
  /** The absolute path that the button "VS Code" opens: the file at the root of the repository, or the absolute path. */
  openPath: string;
};

/** A worktree that Claude Code or Heidrun Code made inside the repository, for example `.claude/worktrees/fix-tab-35/`. */
const WORKTREE_PREFIX = /^\.claude\/worktrees\/[^/]+\//;

/**
 * The path of a file below the root of a repository, with forward slashes and no start slash. A file in a worktree that
 * lies inside the repository gives the path of the same file at the root, because the worktree is usually deleted after
 * its merge.
 * @param root - the root of the repository, or null when it is not known
 * @param path - the absolute path of the file
 * @returns the path below the root, or null when the root is not known or the file is not below the root
 */
export function relativeFilePath(root: string | null, path: string): string | null {
  if (root === null) {
    return null;
  }
  const prefix = root.endsWith("/") ? root : `${root}/`;
  if (path.startsWith(prefix) === false) {
    return null;
  }
  const relativePath = path.slice(prefix.length).replace(WORKTREE_PREFIX, "");
  return relativePath === "" ? null : relativePath;
}

/**
 * The files that a chat wrote, each one once: a file written in a worktree and the same file at the root count as one.
 * @param root - the root of the repository, or null when it is not known
 * @param paths - the absolute paths of the files, in the order of the scan
 * @returns one entry for each different file, in the order of the first path
 */
export function chatFiles(root: string | null, paths: string[]): ChatFile[] {
  const rootPrefix = root === null ? "" : root.replace(/\/$/, "");
  const seen = new Set<string>();
  const files: ChatFile[] = [];
  for (const path of paths) {
    const relativePath = relativeFilePath(root, path);
    const label = relativePath ?? path;
    if (seen.has(label)) {
      continue;
    }
    seen.add(label);
    files.push({ relativePath, label, openPath: relativePath === null ? path : `${rootPrefix}/${relativePath}` });
  }
  return files;
}

/**
 * The address of a file on the web page of its repository, on the default branch of the repository.
 * @param base - the address of the repository on its forge, for example https://github.com/heidrun-org/heidrun, or null
 * @param forge - the forge of the repository, or null
 * @param relativePath - the path of the file below the root of the repository
 * @returns the address, or null when the repository has no address or no forge
 */
export function fileWebUrl(base: string | null, forge: Forge | null, relativePath: string): string | null {
  if (base === null || forge === null) {
    return null;
  }
  const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");
  return forge === "github" ? `${base}/blob/HEAD/${encodedPath}` : `${base}/-/blob/HEAD/${encodedPath}`;
}

/** The name of a file without its folders. */
export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** The folders of a path, without the name of the file and without the last slash. It is empty for a file at the root. */
export function fileFolder(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash <= 0 ? "" : path.slice(0, slash);
}

/** The extensions of the files that hold code, for the icon of a file. */
const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "vue", "rs", "py", "go", "java", "kt", "swift", "c", "h", "cpp", "css", "scss",
  "html", "sh", "zsh", "sql",
]);

/** The extensions of the files that hold plain text. */
const TEXT_EXTENSIONS = new Set(["md", "mdx", "txt", "rst"]);

/** The extensions of the files that hold settings or data. */
const DATA_EXTENSIONS = new Set(["json", "jsonc", "toml", "yaml", "yml", "lock", "csv", "xml", "ini", "env"]);

/** The extensions of the images. */
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"]);

/**
 * The Bootstrap Icons name that shows the kind of a file, from the extension of its name.
 * @param name - the name of the file
 * @returns the name of the icon, without the prefix `bi-`
 */
export function fileIconName(name: string): string {
  const extension = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
  if (CODE_EXTENSIONS.has(extension)) {
    return "file-earmark-code";
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    return "file-earmark-text";
  }
  if (DATA_EXTENSIONS.has(extension)) {
    return "file-earmark-ruled";
  }
  if (IMAGE_EXTENSIONS.has(extension)) {
    return "file-earmark-image";
  }
  return "file-earmark";
}
