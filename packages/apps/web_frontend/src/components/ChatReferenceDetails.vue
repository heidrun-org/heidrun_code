<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import Icon from "./Icon.vue";
import {
  chatReferenceState,
  referenceDay,
  referenceExcerpt,
  referenceLabelStyle,
  repositoryName,
  type ChatReference,
} from "../lib/chat_references";
import { searchHasLabel } from "../lib/code_hosting_search";
import type { Forge } from "../lib/refs";
import type { ChatReferenceDetails } from "../stores/chat_references";
import { chatAboutReference } from "../stores/chat_open";
import { openIssue } from "../stores/issues";
import { toast } from "../stores/session";
import { t } from "../i18n/index";

// What the forge says about one issue or one pull request, with the layout of the card that GitHub shows: the repository
// (a link to its web page) and the date, with four buttons at the right of the same line that open the description and the
// comments in Heidrun Code, open the web page on GitHub or GitLab, copy the address of this web page into the clipboard, or
// start a chat about it with a coding agent in a new tab; the
// whole title with its number, when the row above does not show them; the state; a separator; the beginning of the
// description, and the labels (or the two branches of a pull request); a separator; and the person who opened it. In the
// Code hosting sidebar section, a label is a button that adds the label to the search of its list, or removes it.
// - issue #607
// - issue #808
// - issue #851

const props = withDefaults(defineProps<{
  /** The issue or the pull request. */
  reference: ChatReference;
  /** What the forge said, `undefined` while the program reads it, and null when the forge did not answer. */
  details: ChatReferenceDetails | null | undefined;
  /** The folder of the selected workspace, where the program reads the forge. */
  folder: string;
  /** The forge of the repository. */
  forge: Forge;
  /** The address of the repository on its forge, or null. */
  webBase: string | null;
  /** The whole title, shown under the repository line, or null when the row above the card already shows it. */
  title?: string | null;
  /** The number with its mark, for example "#608", shown after the title, or null when there is no title. */
  name?: string | null;
  /**
   * The text of the search field of the list that holds the item. When it is given, each label is a button that adds the
   * label to this search, or removes it. When it is null, a label is only a pill.
   */
  search?: string | null;
}>(), {
  title: null,
  name: null,
  search: null,
});

const emit = defineEmits<{
  /** The developer clicked a label: the search of the list must get this label, or lose it. */
  toggleLabel: [name: string];
}>();

/** True when the browser could not load the picture of the author: the generic icon of a person takes its place. */
const isAvatarBroken = ref(false);

watch(
  () => props.details?.authorAvatarUrl,
  () => {
    isAvatarBroken.value = false;
  },
);

/** How long the copy button shows that the copy worked or failed, in milliseconds. */
const COPY_FEEDBACK_DURATION = 2000;

/** What the copy button shows: its clipboard icon, a check mark after a copy, or a cross after a refused copy. */
const copyState = ref<"idle" | "copied" | "failed">("idle");

/** The timer that gives the copy button its clipboard icon again, or undefined when no feedback shows. */
let copyStateTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.reference.url,
  () => {
    showCopyState("idle");
  },
);

onBeforeUnmount(() => {
  clearTimeout(copyStateTimer);
});

/** The name of the forge on the button. The names of the products are not translated. */
const forgeName = computed(() => (props.forge === "gitlab" ? "GitLab" : "GitHub"));

/** The icon of the copy button. */
const copyIcon = computed(() => {
  if (copyState.value === "copied") {
    return "clipboard-check";
  }
  if (copyState.value === "failed") {
    return "clipboard-x";
  }
  return "clipboard";
});

/** The title of the copy button, which is also its label for a screen reader. */
const copyTitle = computed(() => {
  if (copyState.value === "copied") {
    return t("chatsPanel.webAddressCopied");
  }
  if (copyState.value === "failed") {
    return t("chatsPanel.webAddressCopyFailed");
  }
  return t("chatsPanel.copyWebAddressTitle", { forge: forgeName.value });
});

/** The name of the repository on the first line, for example "heidrun-org/heidrun", or null when it is not known. */
const repository = computed(() => repositoryName(props.webBase));

/** The text after the name of the repository on the first line: the date of the creation, or an empty text. */
const createdText = computed(() => {
  const date = referenceDay(props.details?.createdAt ?? null);
  return date === "" ? "" : t("chatsPanel.referenceDetailsOn", { date });
});

/** How the state looks: its text, its icon, and the class of its color. */
const state = computed(() => chatReferenceState(props.reference.kind, props.details?.rawState ?? ""));

/** The beginning of the description as plain text, or an empty text. */
const excerpt = computed(() => referenceExcerpt(props.details?.body ?? ""));

/** Opens the description and the comments of the issue or of the pull request in the window of Heidrun Code. */
function openInHeidrun() {
  const type = props.reference.kind === "issue" ? "issue" : "mr";
  openIssue(props.folder, { type, number: props.reference.number }, props.reference.url);
}

/** Opens the web page of the repository in the web browser. */
async function openRepository() {
  if (props.webBase === null) {
    return;
  }
  try {
    await openUrl(props.webBase);
  } catch (reason) {
    toast(String(reason), "error");
  }
}

async function openOnForge() {
  if (props.reference.url === null) {
    return;
  }
  try {
    await openUrl(props.reference.url);
  } catch (reason) {
    toast(String(reason), "error");
  }
}

/** The title of the chat button, which is also its label for a screen reader. */
const chatTitle = computed(() =>
  t(props.reference.kind === "issue" ? "chatsPanel.chatAboutIssueTitle" : "chatsPanel.chatAboutPullRequestTitle"),
);

/** Starts a coding agent in a new tab of the selected workspace, with the first message about the web page of the item. */
async function chatAbout() {
  if (props.reference.url === null) {
    return;
  }
  await chatAboutReference(props.reference.url, `#${props.reference.number}`, props.folder);
}

/**
 * Writes the address of the web page that the button "Open in GitHub" opens into the clipboard, then shows for a short time
 * whether the clipboard took it.
 */
async function copyWebAddress() {
  if (props.reference.url === null) {
    return;
  }
  const isCopied = await writeToClipboard(props.reference.url);
  showCopyState(isCopied ? "copied" : "failed");
  copyStateTimer = setTimeout(() => {
    copyState.value = "idle";
  }, COPY_FEEDBACK_DURATION);
}

/**
 * Writes a text into the clipboard of the computer, with the clipboard of the browser when the clipboard of Tauri refuses it.
 * @param text - The text to write.
 * @returns True when one of the two clipboards took the text.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Shows a state on the copy button, and stops the timer of the feedback that showed before.
 * @param state - The state to show.
 */
function showCopyState(state: "idle" | "copied" | "failed") {
  clearTimeout(copyStateTimer);
  copyStateTimer = undefined;
  copyState.value = state;
}
</script>

<template>
  <div class="reference-details d-flex flex-column gap-3" data-reference-details>
    <div class="d-flex align-items-center gap-3">
      <div class="flex-fill heading text-body-secondary small-text" data-reference-repository-line>
        <a v-if="repository !== null" class="repository" :href="webBase ?? undefined" @click.prevent="openRepository">{{ repository }}</a>{{ createdText }}
      </div>
      <div class="btn-group" role="group" :aria-label="t('chatsPanel.openReferenceLabel')">
        <button
          type="button"
          class="btn"
          :title="t('chatsPanel.heidrunTitle')"
          :aria-label="t('chatsPanel.heidrunTitle')"
          @click="openInHeidrun"
        >
          <Icon name="heidrun-goat-only" />
        </button>
        <button
          type="button"
          class="btn"
          :disabled="reference.url === null"
          :title="t('chatsPanel.forgeTitle', { forge: forgeName })"
          :aria-label="t('chatsPanel.forgeTitle', { forge: forgeName })"
          @click="openOnForge"
        >
          <Icon :name="forge" />
        </button>
        <button
          type="button"
          class="btn"
          data-reference-copy
          :disabled="reference.url === null"
          :title="copyTitle"
          :aria-label="copyTitle"
          @click="copyWebAddress"
        >
          <Icon :name="copyIcon" />
        </button>
        <button
          type="button"
          class="btn"
          data-reference-chat
          :disabled="reference.url === null"
          :title="chatTitle"
          :aria-label="chatTitle"
          @click="chatAbout"
        >
          <Icon name="chat-dots" />
        </button>
      </div>
    </div>
    <div v-if="title !== null" class="reference-title" data-reference-title>
      <span class="fw-semibold">{{ title }}</span> <span v-if="name !== null" class="text-body-secondary">{{ name }}</span>
    </div>
    <span v-if="details" class="badge state d-inline-flex align-items-center gap-2 align-self-start" :class="state.look">
      <Icon :name="state.icon" />
      {{ state.text }}
    </span>
    <div class="separator" role="separator"></div>
    <div v-if="details === undefined" class="text-body-secondary">
      {{ t("chatsPanel.referenceLoading", { forge: forgeName }) }}
    </div>
    <div v-else-if="details === null" class="text-body-secondary">
      {{ t("chatsPanel.referenceUnknown", { forge: forgeName }) }}
    </div>
    <template v-else>
      <div v-if="excerpt !== ''" class="excerpt text-body-secondary">{{ excerpt }}</div>
      <div v-else class="text-body-secondary fst-italic">{{ t("chatsPanel.referenceNoDescription") }}</div>
      <div v-if="details.headBranch !== null" class="d-flex align-items-center gap-2">
        <span class="branch" :title="details.baseBranch ?? ''">{{ details.baseBranch }}</span>
        <Icon name="arrow-left" />
        <span class="branch" :title="details.headBranch">{{ details.headBranch }}</span>
      </div>
      <div v-else-if="details.labels.length > 0" class="d-flex flex-wrap gap-2">
        <template v-for="label in details.labels" :key="label.name">
          <button
            v-if="search !== null"
            type="button"
            class="badge label label-button"
            data-reference-label
            :style="referenceLabelStyle(label.color)"
            :title="t('chatsPanel.labelToggleTitle')"
            :aria-pressed="searchHasLabel(search, label.name)"
            @click="emit('toggleLabel', label.name)"
          >
            {{ label.name }}
          </button>
          <span v-else class="badge label" data-reference-label :style="referenceLabelStyle(label.color)">
            {{ label.name }}
          </span>
        </template>
      </div>
      <div v-if="details.author !== null" class="separator" role="separator"></div>
      <div v-if="details.author !== null" class="d-flex align-items-center gap-2 text-body-secondary">
        <img
          v-if="details.authorAvatarUrl !== null && isAvatarBroken === false"
          class="avatar"
          :src="details.authorAvatarUrl"
          alt=""
          referrerpolicy="no-referrer"
          @error="isAvatarBroken = true"
        />
        <Icon v-else name="person-circle" />
        {{
          t(reference.kind === "issue" ? "chatsPanel.referenceOpenedIssue" : "chatsPanel.referenceOpenedPullRequest", {
            author: details.author,
          })
        }}
      </div>
    </template>
  </div>
</template>

<style scoped>
.heading { min-width: 0; }
.small-text { font-size: 0.85em; }
/* The name of the repository is a link, as on the card of GitHub: it keeps the color of its line and is underlined. */
.repository { color: inherit; text-decoration: underline; cursor: pointer; }
.repository:hover { color: var(--fg-body); }
/* The whole title shows, on as many lines as it needs, and a very long word breaks. */
.reference-title { overflow-wrap: anywhere; }
/* The pill of the state has a strong color and white bold text, so that the text reads on the dark background. */
.state { color: var(--on-solid); font-weight: 600; }
.state-open { background-color: var(--reference-open); }
.state-done { background-color: var(--reference-merged); }
.state-closed { background-color: var(--reference-closed); }
.state-other { background-color: var(--bg-2); color: var(--fg-body); font-weight: 400; }
.separator { border-top: 1px solid var(--line); }
.excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 5; overflow: hidden; white-space: pre-line; }
.branch { max-width: 45%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 0.15rem 0.5rem; border-radius: var(--radius-5); background-color: var(--bg-1); font-family: var(--font-mono, monospace); font-size: 0.85em; }
/* A label is a small pill: a font of 0.75em and a little padding, so that it does not weigh more than the text above it. */
.label { border: 1px solid; font-size: 0.75em; padding: 0.15em 0.6em; line-height: 1.4; }
/* A label that is a button keeps the look of the pill, and shows with the pointer that it can be clicked. */
.label-button { cursor: pointer; font-family: inherit; }
.label-button:hover { filter: brightness(1.2); }
.avatar { width: 1.25em; height: 1.25em; flex-shrink: 0; border-radius: 50%; object-fit: cover; }
</style>
