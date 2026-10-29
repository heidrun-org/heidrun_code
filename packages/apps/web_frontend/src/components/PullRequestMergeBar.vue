<script setup lang="ts">
// The approval state of a pull request or of a merge request, the people who approved it, and the button "Merge" that
// opens the merge window. The button is disabled, with the reason in its title, when the hosting service refuses the
// merge now. Two places show it: the information card of a row of the Code hosting sidebar section, and the issue
// preview window.
// - issue #570
import { computed } from "vue";
import Icon from "./Icon.vue";
import { APPROVAL_KEYS, mergeBlockReason, openMergeWindow, type MergeFacts } from "../stores/pull_request_merge";
import type { Forge } from "../lib/refs";
import { t } from "../i18n/index";

const props = defineProps<{
  /** The merge facts, or null when the hosting service did not answer. */
  facts: MergeFacts | null;
  /** The folder of the repository, where `gh` or `glab` runs. */
  folder: string;
  /** The hosting service. */
  forge: Forge;
  /** The number with its mark, for example "#12" or "!7". */
  name: string;
  /** The address of the repository on its hosting service. */
  webBase: string;
}>();

const blockReason = computed(() => (props.facts === null ? null : mergeBlockReason(props.facts)));
const isOpen = computed(() => props.facts?.isOpen === true);

/** The text of the approval pill, for example "Review required · 1 approval left", or an empty text. */
const approval = computed(() => {
  const facts = props.facts;
  if (facts === null || facts.approval === null) {
    return "";
  }
  const left = facts.approvalsLeft !== null && facts.approvalsLeft > 0 ? ` · ${t("mergeModal.approvalsLeft", { count: facts.approvalsLeft })}` : "";
  return `${t(APPROVAL_KEYS[facts.approval])}${left}`;
});

function openWindow() {
  if (props.facts !== null) {
    void openMergeWindow(props.folder, props.forge, props.facts.number, props.name, props.webBase);
  }
}
</script>

<template>
  <div v-if="facts !== null && isOpen" class="merge-bar d-flex flex-wrap align-items-center gap-2" data-merge-bar>
    <span v-if="approval !== ''" class="badge approval" :class="facts.approval === 'approved' ? 'approval-ok' : 'approval-wait'" data-merge-approval>
      {{ approval }}
    </span>
    <span v-if="facts.approvers.length > 0" class="text-body-secondary approvers">{{ t("mergeModal.approvedBy", { names: facts.approvers.join(", ") }) }}</span>
    <button
      type="button"
      class="btn merge-button ms-auto"
      data-merge-button
      :disabled="blockReason !== null"
      :title="blockReason ?? t('mergeModal.buttonTitle')"
      @click="openWindow"
    >
      <Icon name="sign-merge-right" />
      {{ t("mergeModal.button") }}
    </button>
  </div>
</template>

<style scoped>
.approval { color: var(--on-solid); font-weight: 600; }
.approval-ok { background-color: var(--reference-open); }
.approval-wait { background-color: var(--bg-2); color: var(--fg-body); font-weight: 400; }
.approvers { font-size: 0.85em; }
.merge-button { display: inline-flex; align-items: center; gap: 0.4em; }
</style>
