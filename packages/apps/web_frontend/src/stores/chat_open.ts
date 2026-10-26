import { openUrl } from "@tauri-apps/plugin-opener";
import { chatAppUrl } from "../lib/chat_links";
import { launchAgent } from "./agents";
import type { Chat, ChatAgent } from "./chats";
import { state, toast } from "./session";
import { settings } from "./settings";

/**
 * Opens a chat in the desktop application of its coding agent, with the address of the application.
 * @param agent - the coding agent of the chat
 * @param chat - the chat to open
 */
export async function openChatInApp(agent: ChatAgent, chat: Chat) {
  try {
    await openUrl(chatAppUrl(agent, chat.id));
  } catch (reason) {
    toast(String(reason), "error");
  }
}

/**
 * Opens a chat in a new tab of the selected workspace: the coding agent starts there with its command to resume the chat.
 * @param agent - the coding agent of the chat
 * @param chat - the chat to open
 * @param folder - the folder whose chats the list shows, where the new tab starts
 */
export async function openChatInHeidrun(agent: ChatAgent, chat: Chat, folder: string | null) {
  if (state.selectedWorkspaceId === null) {
    return;
  }
  await launchAgent({
    workspaceId: state.selectedWorkspaceId,
    cwd: folder,
    tool: agent,
    agent: null,
    model: null,
    label: chat.title,
    prompt: "",
    resumeId: chat.id,
  });
}

/**
 * Starts a chat about an issue or a pull request: a new tab of the selected workspace starts a coding agent, then the coding
 * agent gets the first message "Let's chat about <web address>". The coding agent is the one of the setting "New tab", or
 * Claude when this setting is a terminal (issue #851).
 * @param url - the web address of the issue or of the pull request
 * @param label - the name of the new tab, for example "#851"
 * @param folder - the folder of the selected workspace, where the new tab starts
 */
export async function chatAboutReference(url: string, label: string, folder: string | null) {
  await startChatAbout(url, label, folder);
}

/**
 * Starts a chat about a file: a new tab of the selected workspace starts a coding agent, then the coding agent gets the
 * first message "Let's chat about <absolute path>". The coding agent is the one of the setting "New tab", or Claude when
 * this setting is a terminal (issue #854).
 * @param absolutePath - the absolute path of the file, or of the folder
 * @param label - the name of the new tab, for example "main.ts"
 * @param folder - the folder of the selected workspace, where the new tab starts
 */
export async function chatAboutFile(absolutePath: string, label: string, folder: string | null) {
  await startChatAbout(absolutePath, label, folder);
}

/**
 * Starts a new tab of the selected workspace with a coding agent, then sends the coding agent the first message
 * "Let's chat about <subject>". Nothing starts when no workspace is selected.
 * @param subject - the web address or the absolute path that the chat is about
 * @param label - the name of the new tab
 * @param folder - the folder of the selected workspace, where the new tab starts
 */
async function startChatAbout(subject: string, label: string, folder: string | null) {
  if (state.selectedWorkspaceId === null) {
    return;
  }
  await launchAgent({
    workspaceId: state.selectedWorkspaceId,
    cwd: folder,
    tool: settings.newTabCommand === "terminal" ? "claude" : settings.newTabCommand,
    agent: null,
    model: null,
    label,
    prompt: `Let's chat about ${subject}`,
  });
}
