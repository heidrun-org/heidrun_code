<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { addLauncher, launcherLevel, launchersOf, updateLauncher, type LauncherLevel } from "../stores/project";
import { closeNewCustomLauncherModal, newCustomLauncherModal } from "../stores/newCustomLauncher";
import { selectedWorkspace, state, toast } from "../stores/session";
import { project } from "../stores/project";
import { effortsOf } from "../lib/coding_agent_models";
import { CUSTOM_LAUNCHER_CODING_AGENTS, findCodingAgent } from "../lib/coding_agents";
import { isLoadingModels, loadCodingAgentModels, modelsOf } from "../stores/coding_agent_models";
import { launcherAgentCommand } from "../lib/launcher_agent_command";
import { settings } from "../stores/settings";
import { t } from "../i18n/index";

type Kind = "commandLine" | "codingAgent";

/** The two kinds of custom launcher, as the radio buttons show them. */
const KINDS: { id: Kind; labelKey: string }[] = [
  { id: "commandLine", labelKey: "newCustomLauncherModal.kindCommandLine" },
  { id: "codingAgent", labelKey: "newCustomLauncherModal.kindCodingAgent" },
];


const nameField = ref<HTMLInputElement>();

/** The custom launcher that the window edits, or `undefined` when the window creates a new one. */
const editedLauncher = (() => {
  const workspaceId = state.selectedWorkspaceId;
  const id = newCustomLauncherModal.editedId;
  if (id === null || workspaceId === null || workspaceId === undefined) {
    return undefined;
  }
  return launchersOf(workspaceId).find((launcher) => launcher.id === id);
})();
const isEditing = editedLauncher !== undefined;

/** The level that the two buttons "User" and "Workspace" choose. A new custom launcher starts at the workspace level. */
const level = ref<LauncherLevel>(isEditing ? launcherLevel(editedLauncher) : "workspace");

/** The name of the workspace that was selected when the window opened. */
const workspaceName = selectedWorkspace.value?.label ?? "";

/** The sentence that tells where the custom launcher shows, for the chosen level. */
const levelHint = computed(() => {
  return level.value === "user"
    ? t("newCustomLauncherModal.levelUserHint")
    : t("newCustomLauncherModal.levelWorkspaceHint", { name: workspaceName });
});

const kind = ref<Kind>(isEditing ? (editedLauncher.agent === undefined ? "commandLine" : "codingAgent") : settings.customLauncherKind);
const name = ref(editedLauncher?.label ?? "");
const description = ref(editedLauncher?.description ?? "");
const command = ref(editedLauncher !== undefined && editedLauncher.agent === undefined ? editedLauncher.command : "");
const agentName = ref(editedLauncher?.agent?.name ?? settings.customLauncherAgent);
const folder = ref(editedLauncher?.cwd ?? "");
const model = ref(isEditing ? (editedLauncher.agent?.model ?? "") : settings.customLauncherModel);
const effort = ref(isEditing ? (editedLauncher.agent?.effort ?? "") : settings.customLauncherEffort);

// The last kind, coding agent, model, and effort are remembered, but an edit never changes them.
watch(kind, (value) => {
  if (isEditing === false) {
    settings.customLauncherKind = value;
  }
});
watch(agentName, (value) => {
  if (isEditing === false) {
    settings.customLauncherAgent = value;
  }
});
watch(model, (value) => {
  if (isEditing === false) {
    settings.customLauncherModel = value;
  }
});
watch(effort, (value) => {
  if (isEditing === false) {
    settings.customLauncherEffort = value;
  }
});
const prompt = ref(editedLauncher?.agent?.prompt ?? "");
const isWritingName = ref(false);
const isFolderValid = computed(() => relativeFolder() !== null);

/**
 * The current work directory, as a path relative to the root of the repository: an empty string for the root itself.
 * `null` when the path is outside the repository.
 */
function relativeFolder(): string | null {
  const value = folder.value.trim().replace(/\/+$/, "");
  const workspaceId = state.selectedWorkspaceId;
  const root = workspaceId === null || workspaceId === undefined ? undefined : project.byWorkspace[workspaceId]?.root;
  if (value === "" || value === ".") {
    return "";
  }
  if (value.startsWith("/") === false) {
    return value.split("/").includes("..") ? null : value.replace(/^\.\//, "");
  }
  if (root === undefined) {
    return null;
  }
  const rootPath = root.replace(/\/+$/, "");
  if (value === rootPath) {
    return "";
  }
  return value.startsWith(`${rootPath}/`) ? value.slice(rootPath.length + 1) : null;
}

/** Opens the native folder picker, on the root of the repository, and puts the chosen folder in the field. */
async function chooseFolder() {
  const workspaceId = state.selectedWorkspaceId;
  const root = workspaceId === null || workspaceId === undefined ? undefined : project.byWorkspace[workspaceId]?.root;
  const path = await openDialog({
    directory: true,
    multiple: false,
    title: t("newCustomLauncherModal.chooseFolder"),
    defaultPath: root,
  });
  if (path === null) {
    return;
  }
  folder.value = path;
  if (relativeFolder() === null) {
    toast(t("newCustomLauncherModal.folderOutside"));
    folder.value = "";
    return;
  }
  folder.value = relativeFolder() ?? "";
}

const models = computed(() => modelsOf(agentName.value));
const efforts = computed(() => effortsOf(findCodingAgent(agentName.value)?.efforts ?? [], models.value, model.value));

/** The models of the select: the models of the coding agent, and the saved model of an edited launcher that is no longer listed. */
const modelChoices = computed(() => {
  const choices = models.value.map(({ id, label }) => ({ id, label }));
  if (isEditing && model.value !== "" && choices.some((choice) => choice.id === model.value) === false) {
    choices.push({ id: model.value, label: model.value });
  }
  return choices;
});

/** The efforts of the select: the efforts of the model, and the saved effort of an edited launcher that is no longer listed. */
const effortChoices = computed(() => {
  const choices = [...efforts.value];
  if (isEditing && effort.value !== "" && choices.includes(effort.value) === false) {
    choices.push(effort.value);
  }
  return choices;
});
const isContentFilled = computed(() => (kind.value === "commandLine" ? command.value.trim() !== "" : prompt.value.trim() !== ""));
const canCreate = computed(() => name.value.trim() !== "" && isContentFilled.value && isFolderValid.value);

watch(agentName, () => {
  model.value = "";
  effort.value = "";
});

// Asks the tool of each coding agent for its models, now, so that a remembered model is not dropped before the answer.
for (const agent of CUSTOM_LAUNCHER_CODING_AGENTS) {
  void loadCodingAgentModels(agent.id);
}

// A remembered model or effort that the coding agent does not list now is dropped, once the tool has answered. A launcher
// that is edited keeps its saved values: the selects show them.
watch(
  [models, efforts, () => isLoadingModels(agentName.value)],
  () => {
    if (isEditing || isLoadingModels(agentName.value)) {
      return;
    }
    if (model.value !== "" && models.value.some((candidate) => candidate.id === model.value) === false) {
      model.value = "";
    }
    if (effort.value !== "" && efforts.value.includes(effort.value) === false) {
      effort.value = "";
    }
  },
  { immediate: true },
);

/** Text that tells the coding agent everything that the person filled in, to write the name from it. */
function describeForm(): string {
  const lines = name.value.trim() === "" ? [] : [t("newCustomLauncherModal.descriptionName", { name: name.value.trim() })];
  if (description.value.trim() !== "") {
    lines.push(t("newCustomLauncherModal.descriptionText", { description: description.value.trim() }));
  }
  lines.push(t("newCustomLauncherModal.descriptionKind", { kind: t(kind.value === "commandLine" ? "newCustomLauncherModal.kindCommandLine" : "newCustomLauncherModal.kindCodingAgent") }));
  if (kind.value === "commandLine") {
    lines.push(t("newCustomLauncherModal.descriptionCommand", { command: command.value }));
    return lines.join("\n");
  }
  lines.push(t("newCustomLauncherModal.descriptionAgent", { agent: agentName.value }));
  if (folder.value.trim() !== "") {
    lines.push(t("newCustomLauncherModal.descriptionFolder", { folder: folder.value.trim() }));
  }
  if (model.value.trim() !== "") {
    lines.push(t("newCustomLauncherModal.descriptionModel", { model: model.value.trim() }));
  }
  if (effort.value !== "") {
    lines.push(t("newCustomLauncherModal.descriptionEffort", { effort: effort.value }));
  }
  lines.push(t("newCustomLauncherModal.descriptionPrompt", { prompt: prompt.value }));
  return lines.join("\n");
}

/** Writes the name, the description, or both, with a coding agent: only the fields that are empty. */
async function writeName() {
  if (isWritingName.value === true) {
    return;
  }
  const isNameEmpty = name.value.trim() === "";
  const isDescriptionEmpty = description.value.trim() === "";
  if (isNameEmpty === false && isDescriptionEmpty === false) {
    toast(t("newCustomLauncherModal.bothFilled"));
    return;
  }
  if (isContentFilled.value === false) {
    nextTick(() => document.getElementById(kind.value === "commandLine" ? "new-launcher-command" : "new-launcher-prompt")?.focus());
    return;
  }
  const keys = [isNameEmpty ? '"name"' : null, isDescriptionEmpty ? '"description"' : null].filter((key) => key !== null).join(", ");
  isWritingName.value = true;
  try {
    const answer = await invoke<{ text: string }>("coding_agent_ask", {
      prompt: t("newCustomLauncherModal.writePrompt", { keys, description: describeForm() }),
    });
    const written = parseWrittenFields(answer.text);
    if (isNameEmpty && written.name !== undefined && name.value.trim() === "") {
      name.value = written.name;
    }
    if (isDescriptionEmpty && written.description !== undefined && description.value.trim() === "") {
      description.value = written.description;
    }
  } catch (error) {
    const text = String(error);
    toast(text === "no_coding_agent" ? t("newCustomLauncherModal.noCodingAgent") : text);
  } finally {
    isWritingName.value = false;
  }
}

/** Reads the JSON object that the coding agent answered. A field that is missing or is not text stays undefined. */
function parseWrittenFields(text: string): { name?: string; description?: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(t("newCustomLauncherModal.badAnswer"));
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(t("newCustomLauncherModal.badAnswer"));
  }
  const record = (typeof parsed === "object" && parsed !== null ? parsed : {}) as Record<string, unknown>;
  const written: { name?: string; description?: string } = {};
  if (typeof record.name === "string" && record.name.trim() !== "") {
    written.name = record.name.trim().split("\n")[0].trim();
  }
  if (typeof record.description === "string" && record.description.trim() !== "") {
    written.description = record.description.trim();
  }
  return written;
}

async function create() {
  const workspaceId = state.selectedWorkspaceId;
  if (canCreate.value === false || workspaceId === null || workspaceId === undefined) {
    return;
  }
  const cwd = relativeFolder() ?? "";
  if (kind.value === "commandLine") {
    if (editedLauncher !== undefined) {
      await updateLauncher(workspaceId, editedLauncher.id, {
        label: name.value.trim(),
        command: command.value.trim(),
        ...(description.value.trim() !== "" ? { description: description.value.trim() } : {}),
        ...(cwd !== "" ? { cwd } : {}),
      }, level.value);
    } else {
      await addLauncher(workspaceId, name.value, command.value, undefined, cwd, description.value, level.value);
    }
  } else {
    const agent = {
      name: agentName.value,
      prompt: prompt.value.trim(),
      ...(model.value.trim() !== "" ? { model: model.value.trim() } : {}),
      ...(effort.value !== "" ? { effort: effort.value } : {}),
    };
    if (editedLauncher !== undefined) {
      await updateLauncher(workspaceId, editedLauncher.id, {
        label: name.value.trim(),
        command: launcherAgentCommand(agent),
        agent,
        ...(description.value.trim() !== "" ? { description: description.value.trim() } : {}),
        ...(cwd !== "" ? { cwd } : {}),
      }, level.value);
    } else {
      await addLauncher(workspaceId, name.value, launcherAgentCommand(agent), agent, cwd, description.value, level.value);
    }
  }
  closeNewCustomLauncherModal();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    closeNewCustomLauncherModal();
  }
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  nextTick(() => nameField.value?.focus());
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="overlay" @mousedown.self="closeNewCustomLauncherModal()">
    <form class="window-box" role="dialog" :aria-label="t(isEditing ? 'newCustomLauncherModal.editDialogLabel' : 'newCustomLauncherModal.dialogLabel')" @submit.prevent="create">
      <header>
        <h2>{{ t(isEditing ? "newCustomLauncherModal.editTitle" : "newCustomLauncherModal.title") }}</h2>
        <button type="button" :title="t('newCustomLauncherModal.closeTitle')" class="btn icon close" :aria-label="t('newCustomLauncherModal.closeLabel')" @click="closeNewCustomLauncherModal()"><Icon name="x-lg" /></button>
      </header>

      <div class="content">
        <div>
          <div class="form-label">{{ t("newCustomLauncherModal.kind") }}</div>
          <div class="btn-group d-flex" role="group" :aria-label="t('newCustomLauncherModal.kind')">
            <label v-for="choice in KINDS" :key="choice.id" class="btn btn-check btn-outline theme-secondary choice justify-content-center">
              <input v-model="kind" type="radio" name="new-launcher-kind" autocomplete="off" :value="choice.id" />
              {{ t(choice.labelKey) }}
            </label>
          </div>
        </div>

        <div>
          <div class="form-label">{{ t("newCustomLauncherModal.level") }}</div>
          <div class="btn-group d-flex" role="group" :aria-label="t('newCustomLauncherModal.level')">
            <label class="btn btn-check btn-outline theme-secondary choice justify-content-center">
              <input v-model="level" type="radio" name="new-launcher-level" autocomplete="off" value="user" data-launcher-level="user" />
              {{ t("newCustomLauncherModal.levelUser") }}
            </label>
            <label class="btn btn-check btn-outline theme-secondary choice justify-content-center">
              <input v-model="level" type="radio" name="new-launcher-level" autocomplete="off" value="workspace" data-launcher-level="workspace" />
              {{ t("newCustomLauncherModal.levelWorkspace") }}
            </label>
          </div>
          <div class="form-text" data-launcher-level-hint>{{ levelHint }}</div>
        </div>

        <div>
          <label class="form-label" for="new-launcher-name">{{ t("newCustomLauncherModal.name") }}</label>
          <div class="d-flex gap-2">
            <input
              id="new-launcher-name"
              ref="nameField"
              v-model="name"
              class="form-control flex-fill"
              :placeholder="t('newCustomLauncherModal.namePlaceholder')"
              spellcheck="false"
            />
            <button
              type="button"
              class="btn write-name"
              :aria-label="t('newCustomLauncherModal.writeName')"
              :title="t('newCustomLauncherModal.writeName')"
              :disabled="isWritingName"
              @click="writeName()"
            >
              <span v-if="isWritingName" class="spinner-border spinner-border-sm" role="status"></span>
              <Icon v-else name="stars" />
            </button>
          </div>
        </div>

        <div>
          <label class="form-label" for="new-launcher-description">{{ t("newCustomLauncherModal.description") }}</label>
          <textarea
            id="new-launcher-description"
            v-model="description"
            class="form-control"
            rows="3"
            :placeholder="t('newCustomLauncherModal.descriptionPlaceholder')"
          ></textarea>
        </div>

        <div>
          <label class="form-label" for="new-launcher-folder">{{ t("newCustomLauncherModal.folder") }}</label>
          <div class="d-flex gap-2">
            <input
              id="new-launcher-folder"
              v-model="folder"
              class="form-control flex-fill"
              :class="{ 'is-invalid': isFolderValid === false }"
              :placeholder="t('newCustomLauncherModal.folderPlaceholder')"
              spellcheck="false"
            />
            <button type="button" class="btn write-name" :aria-label="t('newCustomLauncherModal.chooseFolder')" :title="t('newCustomLauncherModal.chooseFolder')" @click="chooseFolder()">
              <Icon name="folder2-open" />
            </button>
          </div>
        </div>

        <div v-if="kind === 'commandLine'">
          <label class="form-label" for="new-launcher-command">{{ t("newCustomLauncherModal.command") }}</label>
          <textarea
            id="new-launcher-command"
            v-model="command"
            class="form-control mono"
            rows="5"
            placeholder="make dev"
            spellcheck="false"
            @keydown.meta.enter.prevent="create"
            @keydown.ctrl.enter.prevent="create"
          ></textarea>
        </div>

        <template v-else>
          <div>
            <div class="form-label">{{ t("newCustomLauncherModal.codingAgent") }}</div>
            <div class="btn-group d-flex" role="group" :aria-label="t('newCustomLauncherModal.codingAgent')">
              <label v-for="choice in CUSTOM_LAUNCHER_CODING_AGENTS" :key="choice.id" class="btn btn-check btn-outline theme-secondary choice justify-content-center">
                <input v-model="agentName" type="radio" name="new-launcher-agent" autocomplete="off" :value="choice.id" />
                <Icon :name="choice.icon" />
                {{ choice.label }}
              </label>
            </div>
          </div>
          <div class="d-flex gap-2">
            <div v-if="modelChoices.length > 0" class="field">
              <label class="form-label" for="new-launcher-model">{{ t("newCustomLauncherModal.model") }}</label>
              <select id="new-launcher-model" v-model="model" class="form-control">
                <option value="">{{ t("newCustomLauncherModal.modelDefault") }}</option>
                <option v-for="choice in modelChoices" :key="choice.id" :value="choice.id">{{ choice.label }}</option>
              </select>
            </div>
            <div v-if="effortChoices.length > 0" class="field">
              <label class="form-label" for="new-launcher-effort">{{ t("newCustomLauncherModal.effort") }}</label>
              <select id="new-launcher-effort" v-model="effort" class="form-control">
                <option value="">{{ t("newCustomLauncherModal.effortDefault") }}</option>
                <option v-for="level in effortChoices" :key="level" :value="level">{{ level }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="form-label" for="new-launcher-prompt">{{ t("newCustomLauncherModal.prompt") }}</label>
            <textarea
              id="new-launcher-prompt"
              v-model="prompt"
              class="form-control"
              rows="5"
              :placeholder="t('newCustomLauncherModal.promptPlaceholder')"
              @keydown.meta.enter.prevent="create"
              @keydown.ctrl.enter.prevent="create"
            ></textarea>
          </div>
        </template>

        <div class="buttons">
          <button :title="t(isEditing ? 'newCustomLauncherModal.cancelEditTitle' : 'newCustomLauncherModal.cancelTitle')" class="btn" type="button" @click="closeNewCustomLauncherModal()">{{ t("newCustomLauncherModal.cancel") }}</button>
          <button :title="t(isEditing ? 'newCustomLauncherModal.saveTitle' : 'newCustomLauncherModal.createTitle')" class="btn primary" type="submit" :disabled="canCreate === false">{{ t(isEditing ? "newCustomLauncherModal.save" : "newCustomLauncherModal.create") }}</button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button:not(.btn)) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 57; background: var(--shadow); display: flex; align-items: center; justify-content: center; padding: 32px; }
.window-box {
  width: min(520px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; outline: none;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px var(--shadow);
}
header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
h2 { flex: 1; margin: 0; font-size: var(--font-size); font-weight: 600; }
.content { overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.form-label { margin-bottom: 4px; font-size: calc(var(--font-size) * 0.9); color: var(--muted); }
textarea.mono { font-family: var(--mono); }
.choice { flex: 1 1 0; min-width: 0; }
.field { flex: 1 1 0; min-width: 0; }
.field .form-control { width: 100%; }
.buttons { display: flex; justify-content: flex-end; gap: 6px; }
.btn-group i { margin-right: 4px; }
</style>
