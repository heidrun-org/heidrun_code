import { settings, type LeftSidebarSection, type RightSidebarSection } from "./settings";

/** The sidebar sections of the left sidebar. The other sidebar sections belong to the right sidebar. */
const LEFT_SIDEBAR_SECTIONS: readonly string[] = ["launchers", "sourceControl", "files", "fileSearch", "codeHosting"];

/** True when the sidebar section belongs to the left sidebar, false when it belongs to the right sidebar. */
function isLeftSidebarSection(sidebarSection: string): sidebarSection is LeftSidebarSection {
  return LEFT_SIDEBAR_SECTIONS.includes(sidebarSection);
}

/** The width of a collapsed sidebar, in px, borders included: the sidebar icon bar alone. */
export const COLLAPSED_SIDEBAR_WIDTH = 48;

/** One button of the sidebar icon bar of a sidebar: one sidebar section. */
export type SidebarSectionButton = {
  /** The identifier of the sidebar section. */
  id: string;
  /** The title of the sidebar section. */
  label: string;
  /** The name of the Bootstrap icon of the sidebar section, without the prefix `bi-`. */
  icon: string;
  /** The number on the button. A badge of 0 shows no number. */
  badge: number;
  /** The number has the color of the working status. */
  isLive?: boolean;
  /** The number has the color of the blocked status. */
  isAlert?: boolean;
};

/**
 * Shows a sidebar section. The sidebar that holds the sidebar section expands if it is collapsed to the sidebar icon
 * bar, and shows the sidebar section. The Launchers, Source control, Code hosting, File explorer, and Search in files
 * sidebar sections belong to the left sidebar. The Needs you, Clipboard, Past chats, and User activity sidebar sections belong to the right
 * sidebar.
 */
export function openSidebarSection(sidebarSection: LeftSidebarSection | RightSidebarSection) {
  if (isLeftSidebarSection(sidebarSection)) {
    settings.leftCollapsed = false;
    settings.leftSidebarSection = sidebarSection;
    return;
  }
  settings.rightCollapsed = false;
  settings.rightSidebarSection = sidebarSection;
}

/**
 * Answers a click on the icon of a sidebar section in the sidebar icon bar. A click on the icon of the sidebar section
 * that an expanded sidebar shows collapses the sidebar. A click on any other icon shows that sidebar section.
 */
export function clickSidebarSectionIcon(sidebarSection: LeftSidebarSection | RightSidebarSection) {
  const isLeft = isLeftSidebarSection(sidebarSection);
  if (isLeft && settings.leftCollapsed === false && settings.leftSidebarSection === sidebarSection) {
    settings.leftCollapsed = true;
    return;
  }
  if (isLeft === false && settings.rightCollapsed === false && settings.rightSidebarSection === sidebarSection) {
    settings.rightCollapsed = true;
    return;
  }
  openSidebarSection(sidebarSection);
}
