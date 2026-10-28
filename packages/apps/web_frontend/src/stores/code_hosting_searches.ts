// The saved searches of the Code hosting sidebar section: a search under a name, kept with the other options of
// Heidrun Code. Each list has its own saved searches. A saved search has a level (issue #822): the user level shows in every
// workspace, and the workspace level shows only in the workspace where the developer saved it.
// - issue #374
// - issue #607
// - issue #822
import { state } from "./session";
import { settings, type SavedSearch, type SavedSearchLevel } from "./settings";
import { WorkspaceFolders } from "./workspace_folders";
import type { CodeHostingGroup } from "./code_hosting";

/** A saved search as the sidebar section shows it: the name, the search, and the level. */
export type ShownSavedSearch = SavedSearch & {
  /** The level of the saved search. */
  level: SavedSearchLevel;
};

/**
 * The folder of the selected workspace.
 * @returns the workspace folder, or null when no workspace is selected or the folder needs recovery
 */
export function currentWorkspaceFolder(): string | null {
  if (state.selectedWorkspaceId === null) {
    return null;
  }
  return WorkspaceFolders.get(state.selectedWorkspaceId);
}

/**
 * The saved searches of one level of one list, to read.
 * @param group - the list
 * @param level - the level
 * @param workspaceFolder - the folder of the workspace, for the level "workspace"
 * @returns the saved searches, in the order of their buttons. Empty when the workspace has none or has no folder.
 */
export function savedSearchesOfLevel(
  group: CodeHostingGroup,
  level: SavedSearchLevel,
  workspaceFolder: string | null,
): SavedSearch[] {
  if (level === "user") {
    return settings.codeHostingSavedSearches[group];
  }
  if (workspaceFolder === null) {
    return [];
  }
  return settings.codeHostingWorkspaceSavedSearches[workspaceFolder]?.[group] ?? [];
}

/**
 * The saved searches of one level of one list, to change. The list of a workspace is created when it does not exist.
 * @param group - the list
 * @param level - the level
 * @param workspaceFolder - the folder of the workspace, for the level "workspace"
 * @returns the saved searches, or null for the level "workspace" when there is no workspace folder
 */
function writeList(
  group: CodeHostingGroup,
  level: SavedSearchLevel,
  workspaceFolder: string | null,
): SavedSearch[] | null {
  if (level === "user") {
    return settings.codeHostingSavedSearches[group];
  }
  if (workspaceFolder === null) {
    return null;
  }
  if (settings.codeHostingWorkspaceSavedSearches[workspaceFolder] === undefined) {
    settings.codeHostingWorkspaceSavedSearches[workspaceFolder] = { issues: [], requests: [] };
  }
  return settings.codeHostingWorkspaceSavedSearches[workspaceFolder][group];
}

/**
 * The saved searches that the sidebar section shows for a list: the user level first, then the workspace level.
 * @param group - the list
 * @param workspaceFolder - the folder of the workspace that shows the list
 * @returns the saved searches with their level
 */
export function shownSavedSearches(
  group: CodeHostingGroup,
  workspaceFolder: string | null = currentWorkspaceFolder(),
): ShownSavedSearch[] {
  const levels: SavedSearchLevel[] = ["user", "workspace"];
  return levels.flatMap((level) => {
    return savedSearchesOfLevel(group, level, workspaceFolder).map((saved) => ({ name: saved.name, query: saved.query, level }));
  });
}

/**
 * Saves a search under a name. A saved search of the same list and the same level that has the same name gets the new
 * search.
 * @param group - the list that the saved search is for
 * @param name - the name of the saved search
 * @param query - the search, written in the search language of GitHub
 * @param level - the level of the saved search
 * @param workspaceFolder - the folder of the workspace, for the level "workspace"
 * @returns false when the name or the search is empty, or when the level is "workspace" and there is no workspace
 * folder. True when the saved search is kept.
 */
export function saveSearch(
  group: CodeHostingGroup,
  name: string,
  query: string,
  level: SavedSearchLevel = "user",
  workspaceFolder: string | null = currentWorkspaceFolder(),
): boolean {
  const cleanName = name.trim();
  const cleanQuery = query.trim();
  if (cleanName === "" || cleanQuery === "") {
    return false;
  }
  const list = writeList(group, level, workspaceFolder);
  if (list === null) {
    return false;
  }
  const same = list.find((saved) => saved.name === cleanName);
  if (same === undefined) {
    list.push({ name: cleanName, query: cleanQuery });
  } else {
    same.query = cleanQuery;
  }
  return true;
}

/**
 * Changes the name, the search, and the level of a saved search. A saved search that changes its level goes to the end of
 * the list of the new level.
 * @param group - the list that the saved search is for
 * @param level - the level of the saved search now
 * @param index - the place of the saved search in the list of its level
 * @param name - the new name
 * @param query - the new search
 * @param newLevel - the new level
 * @param workspaceFolder - the folder of the workspace, for the level "workspace"
 * @returns false when the saved search does not exist, when the name or the search is empty, when another saved search
 * of the same list and the new level has the name, or when the new level is "workspace" and there is no workspace
 * folder. Nothing changes then.
 */
export function updateSavedSearch(
  group: CodeHostingGroup,
  level: SavedSearchLevel,
  index: number,
  name: string,
  query: string,
  newLevel: SavedSearchLevel = level,
  workspaceFolder: string | null = currentWorkspaceFolder(),
): boolean {
  const list = writeList(group, level, workspaceFolder);
  const newList = writeList(group, newLevel, workspaceFolder);
  const saved = list?.[index];
  const cleanName = name.trim();
  const cleanQuery = query.trim();
  if (list === null || newList === null || saved === undefined || cleanName === "" || cleanQuery === "") {
    return false;
  }
  const hasOtherWithName = newList.some((other) => other !== saved && other.name === cleanName);
  if (hasOtherWithName) {
    return false;
  }
  saved.name = cleanName;
  saved.query = cleanQuery;
  if (newLevel !== level) {
    list.splice(index, 1);
    newList.push({ name: cleanName, query: cleanQuery });
  }
  return true;
}

/**
 * Deletes a saved search.
 * @param group - the list that the saved search is for
 * @param level - the level of the saved search
 * @param index - the place of the saved search in the list of its level
 * @param workspaceFolder - the folder of the workspace, for the level "workspace"
 * @returns nothing
 */
export function deleteSavedSearch(
  group: CodeHostingGroup,
  level: SavedSearchLevel,
  index: number,
  workspaceFolder: string | null = currentWorkspaceFolder(),
): void {
  writeList(group, level, workspaceFolder)?.splice(index, 1);
}
