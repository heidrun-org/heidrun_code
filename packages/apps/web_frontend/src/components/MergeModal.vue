<script setup lang="ts">
// The merge window of a pull request (GitHub) or of a merge request (GitLab). It reads the hosting service again when it
// opens, shows the approval state, the branches, and the reason why the merge is not possible now, and merges only after
// the click on its button "Merge". GitHub: the merge methods that the repository allows. GitLab: the method of the project
// as text, and the squash. The deletion of the source branch starts with the setting of the repository, and a permanent
// branch is never deleted.
// - issue #570
import { computed, nextTick, onMounted, ref } from "vue";
import {
  APPROVAL_KEYS,
  closeMergeWindow,
  confirmMergeWindow,
  isPermanentBranch,
  mergeBlockReason,
  pullRequestMerge,
  squashChoice,
  type MergeMethod,
} from "../stores/pull_request_merge";
import { t } from "../i18n/index";

const cancel = ref<HTMLButtonElement>();
onMounted(() => nextTick(() => cancel.value?.focus()));

const facts = computed(() => pullRequestMerge.facts);
const forgeName = computed(() => (facts.value?.forge === "gitlab" ? "GitLab" : "GitHub"));
const title = computed(() =>
  t(facts.value?.forge === "gitlab" ? "mergeModal.titleMr" : "mergeModal.titlePr", { name: pullRequestMerge.name }),
);
const blockReason = computed(() => (facts.value === null ? null : mergeBlockReason(facts.value)));
const isBranchPermanent = computed(() => isPermanentBranch(facts.value?.headBranch ?? null));
const squash = computed(() => (facts.value === null ? null : squashChoice(facts.value)));

/** The label of each merge method of GitHub. */
const METHOD_KEYS: Record<MergeMethod, string> = {
  merge: "mergeModal.methodMerge",
  squash: "mergeModal.methodSquash",
  rebase: "mergeModal.methodRebase",
};

/** The text of the method of a project of GitLab. */
const gitlabMethodText = computed(() => {
  const keys: Record<string, string> = {
    merge: "mergeModal.gitlabMethodMerge",
    rebase_merge: "mergeModal.gitlabMethodRebaseMerge",
    ff: "mergeModal.gitlabMethodFf",
  };
  const method = facts.value?.gitlabMethod ?? "merge";
  return t("mergeModal.gitlabMethod", { method: keys[method] === undefined ? method : t(keys[method]) });
});
</script>

<template>
  <div class="overlay" @mousedown.self="closeMergeWindow" @keydown.esc.stop.prevent="closeMergeWindow">
    <div class="window-box" role="alertdialog" aria-labelledby="merge-title" data-merge-window>
      <div class="eyebrow">{{ t("mergeModal.eyebrow") }}</div>
      <h2 id="merge-title">{{ title }}</h2>
      <p v-if="pullRequestMerge.loading" class="hint">{{ t("mergeModal.loading", { forge: forgeName }) }}</p>
      <template v-else-if="facts !== null">
        <p class="branches mono">{{ facts.headBranch }} → {{ facts.baseBranch }}</p>
        <div v-if="facts.approval !== null || facts.approvers.length > 0" class="chips">
          <span v-if="facts.approval !== null" class="chip" :class="facts.approval === 'approved' ? 'ok' : 'warn'" data-merge-approval>
            {{ t(APPROVAL_KEYS[facts.approval]) }}<template v-if="facts.approvalsLeft !== null && facts.approvalsLeft > 0">
              · {{ t("mergeModal.approvalsLeft", { count: facts.approvalsLeft }) }}</template>
          </span>
          <span v-if="facts.approvers.length > 0" class="hint">{{ t("mergeModal.approvedBy", { names: facts.approvers.join(", ") }) }}</span>
        </div>
        <p v-if="blockReason !== null" class="warn" data-merge-block>{{ blockReason }}</p>
        <div class="opts">
          <template v-if="facts.forge === 'github'">
            <label class="hint" for="merge-method">{{ t("mergeModal.method") }}</label>
            <select id="merge-method" v-model="pullRequestMerge.method" class="form-control" :disabled="pullRequestMerge.busy">
              <option v-for="method in facts.methods" :key="method" :value="method">{{ t(METHOD_KEYS[method]) }}</option>
            </select>
          </template>
          <template v-else>
            <span class="hint" data-merge-gitlab-method>{{ gitlabMethodText }}</span>
            <label class="check">
              <input v-model="pullRequestMerge.isSquashed" type="checkbox" data-merge-squash :disabled="pullRequestMerge.busy || squash?.isForced" />
              {{ t("mergeModal.squash") }}
            </label>
            <p v-if="squash?.isForced" class="hint">
              {{ t(squash.isChecked ? "mergeModal.squashForcedOn" : "mergeModal.squashForcedOff") }}
            </p>
          </template>
        </div>
        <label class="check">
          <input
            v-model="pullRequestMerge.isBranchDeleted"
            type="checkbox"
            data-merge-delete
            :disabled="pullRequestMerge.busy || isBranchPermanent || facts.isDeletedByRepository"
          />
          {{ t("mergeModal.deleteBranch", { branch: facts.headBranch ?? "" }) }}
        </label>
        <p v-if="isBranchPermanent" class="hint" data-merge-permanent>{{ t("mergeModal.deleteBranchPermanent", { branch: facts.headBranch ?? "" }) }}</p>
        <p v-else-if="facts.isDeletedByRepository" class="hint">{{ t("mergeModal.deleteBranchByRepository") }}</p>
        <p v-if="facts.headSha" class="hint">{{ t("mergeModal.shaHint", { sha: facts.headSha.slice(0, 8), forge: forgeName }) }}</p>
      </template>
      <p v-if="pullRequestMerge.error !== ''" class="err" data-merge-error>{{ pullRequestMerge.error }}</p>
      <div class="row">
        <button ref="cancel" :title="t('mergeModal.cancelTitle')" class="btn lg" :disabled="pullRequestMerge.busy" @click="closeMergeWindow">{{ t("mergeModal.cancel") }}</button>
        <button
          :title="blockReason ?? t('mergeModal.mergeTitle')"
          class="btn lg go"
          data-merge-confirm
          :disabled="pullRequestMerge.busy || facts === null || blockReason !== null"
          @click="confirmMergeWindow"
        >
          {{ pullRequestMerge.busy ? t("mergeModal.merging") : t("mergeModal.merge", { name: pullRequestMerge.name }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; background: var(--overlay); display: flex; align-items: center; justify-content: center; padding: 24px; }
.window-box {
  width: min(560px, 100%); padding: 22px; border-radius: 14px; background: var(--panel); border: 1px solid var(--line-modal);
  box-shadow: 0 24px 64px var(--shadow); display: flex; flex-direction: column; gap: 10px;
}
.eyebrow { color: var(--question); }
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; }
.title { margin: 0; font-size: var(--font-size); color: var(--text); }
.branches { margin: 0; font-size: var(--font-size); color: var(--text-2); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { height: 22px; padding: 0 8px; border-radius: 11px; display: inline-flex; align-items: center; font-size: var(--font-size); font-weight: 600; background: var(--chip); color: var(--text-2); }
.chip.ok { background: var(--tint-ok); color: var(--ok); } .chip.warn { background: var(--tint-warn); color: var(--accent); }
.chip.crit { background: var(--tint-crit); color: var(--blocked-text); } .chip.pending { background: var(--tint-working); color: var(--working-text); }
.chip.muted { color: var(--muted); }
.warn { margin: 0; font-size: var(--font-size); color: var(--accent); }
.opts { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 4px; }
select { height: 32px; }
.check { display: flex; align-items: center; gap: 6px; font-size: var(--font-size); color: var(--text-2); }
.check input { accent-color: var(--question); }
.hint { margin: 0; font-size: var(--font-size); color: var(--muted); }
.err { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--tint-err); color: var(--fail); font-size: var(--font-size); white-space: pre-wrap; }
.row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
