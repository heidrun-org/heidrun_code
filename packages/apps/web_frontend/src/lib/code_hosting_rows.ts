import { t } from "../i18n/index";
import { agoText } from "./chat_dates";
import type { ChatReferenceLabel } from "../stores/chat_references";
import type { CodeHostingGroup, CodeHostingItem } from "../stores/code_hosting";

/** The two small detail lines under the title of a row of the Code hosting sidebar section. */
export type CodeHostingDetailLines = {
  /**
   * Who opened the item, and how long ago. A draft pull request or merge request adds "Draft", and its approval state, for
   * example "Approved" (issue #570). It can be empty.
   */
  opened: string;
  /** The labels of an issue, which the row shows in their colors. It is empty for a pull request and a merge request. */
  labels: ChatReferenceLabel[];
  /** The text of the last line when it holds no label: "No label" for an issue, or the two branches of a request. */
  extra: string;
};

/** The translation key of each approval state on the second line of a row (issue #570). */
const ROW_APPROVAL_KEYS = {
  approved: "mergeModal.approved",
  changesRequested: "mergeModal.changesRequested",
  reviewRequired: "mergeModal.reviewRequired",
} as const;

/**
 * The two small detail lines of a row.
 * @param group - the list that holds the item
 * @param item - the issue, the pull request, or the merge request
 * @param now - the present time in milliseconds since 1970
 * @returns the two lines
 */
export function codeHostingDetailLines(group: CodeHostingGroup, item: CodeHostingItem, now: number): CodeHostingDetailLines {
  const when = item.createdAt === null ? null : agoText(item.createdAt, now);
  let opened = "";
  if (item.author !== null && when !== null) {
    opened = t("codeHostingPanel.openedBy", { author: item.author, when });
  } else if (when !== null) {
    opened = t("codeHostingPanel.opened", { when });
  } else if (item.author !== null) {
    opened = item.author;
  }
  const marks: string[] = [];
  if (item.isDraft === true) {
    marks.push(t("codeHostingPanel.draft"));
  }
  if (item.approval !== null && item.approval !== undefined) {
    marks.push(t(ROW_APPROVAL_KEYS[item.approval]));
  }
  for (const mark of marks) {
    opened = opened === "" ? mark : `${opened} · ${mark}`;
  }
  if (group === "issues") {
    return { opened, labels: item.labels, extra: item.labels.length > 0 ? "" : t("codeHostingPanel.noLabel") };
  }
  const hasBranches = item.headBranch !== null && item.baseBranch !== null;
  return { opened, labels: [], extra: hasBranches ? `${item.headBranch} → ${item.baseBranch}` : "" };
}
