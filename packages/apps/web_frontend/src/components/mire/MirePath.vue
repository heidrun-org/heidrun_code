<script setup lang="ts">
import { MireStore, mireSelectedPath } from "../../stores/mire/mire_store";
import { t } from "../../i18n/index";

// The path of the selection, above the details of the right sidebar: Heidrun › workspace › tab › coding agent ›
// subagent. Each level is a button that selects it again; the last level is the selected node.
</script>

<template>
  <nav class="d-flex flex-wrap align-items-center gap-1" :aria-label="t('mire.path.label')" data-mire-path>
    <template v-for="(entry, position) in mireSelectedPath" :key="entry.nodeId">
      <span v-if="position > 0" class="text-body-secondary" aria-hidden="true">›</span>
      <button
        type="button"
        class="btn small mire-path-item"
        :aria-current="position === mireSelectedPath.length - 1 ? 'true' : undefined"
        :title="entry.node.kind === 'heidrun' ? t('mire.heidrun') : entry.label"
        :data-path-node-id="entry.nodeId"
        @click="MireStore.select(entry.nodeId)"
      >{{ entry.node.kind === "heidrun" ? t("mire.heidrun") : entry.label }}</button>
    </template>
  </nav>
</template>

<style scoped>
.mire-path-item { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; }
</style>
