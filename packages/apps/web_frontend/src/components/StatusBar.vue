<script setup lang="ts">
import { computed } from "vue";
import { quotas, state } from "../stores/session";
import { settings } from "../stores/settings";
import GitStatusSummary from "./GitStatusSummary.vue";
import QuotaSummary from "./QuotaSummary.vue";
import WorkspaceStatusSummary from "./WorkspaceStatusSummary.vue";
import { t } from "../i18n/index";

// Quotas show only when quota monitoring and the matching coding agent are on in Settings.
const ownedQuotas = computed(() => settings.quotaMonitoring ? quotas.value.filter((q) => settings.ownedAgents.includes(q.provider)) : []);
const isClaudeQuotaUnspecified = computed(
  () =>
    settings.quotaMonitoring &&
    settings.ownedAgents.includes('claude') &&
    ownedQuotas.value.some((quota) => quota.provider === 'claude') === false,
);
</script>

<template>
  <footer class="status">
    <WorkspaceStatusSummary />
    <span class="sep workspace-sep"></span>
    <template v-for="(q, index) in ownedQuotas" :key="q.label">
      <span v-if="index > 0" class="sep"></span>
      <QuotaSummary :quota="q" />
    </template>
    <span v-if="isClaudeQuotaUnspecified && ownedQuotas.length > 0" class="sep"></span>
    <span
      v-if="isClaudeQuotaUnspecified"
      class="quota-unspecified"
      :title="t('statusBar.claudeQuotaUnspecifiedTitle')"
    >{{ t("statusBar.claudeQuotaUnspecified") }}</span>
    <span v-if="ownedQuotas.length > 0 || isClaudeQuotaUnspecified" class="sep"></span>
    <GitStatusSummary />
    <span class="grow"></span>
    <span class="machine" :title="state.error || t('statusBar.connectedTitle')">
      <span class="dot" :class="state.connected ? 'connection-ok' : 'offline'"></span>
      {{ t("statusBar.local") }} · {{ state.snapshot ? `Herdr ${state.snapshot.version}` : t("statusBar.offline") }}
    </span>
  </footer>
</template>

<style scoped>
.status {
  --status-bar-height: 40px;
  height: var(--status-bar-height); flex-shrink: 0; display: flex; align-items: center; gap: 22px; padding: 0 16px;
  background: var(--shell); font-size: var(--font-size); color: var(--muted-2);
  white-space: nowrap; position: relative;
}
.sep { width: 1px; height: 14px; background: var(--line-strong); }
.quota-unspecified { color: var(--muted); }
/* The workspace section has more room than the other sections: 6 more pixels on each side of the line after it. */
.workspace-sep { margin: 0 6px; }
.grow { flex: 1; }
.machine { display: flex; align-items: center; gap: 8px; color: var(--muted); }
.connection-ok { background: var(--done); }
.offline { background: var(--fail); }
</style>
