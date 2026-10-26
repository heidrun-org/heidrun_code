<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { state } from "../stores/session";
import LaunchersPanel from "./LaunchersPanel.vue";
import SidebarIconBar from "./SidebarIconBar.vue";
import FilesPanel from "./FilesPanel.vue";
import SourceControlPanel from "./SourceControlPanel.vue";
import CodeHostingPanel from "./CodeHostingPanel.vue";
import type { Forge } from "../lib/refs";
import { readCodeHostingForge } from "../stores/code_hosting";
import { currentGit } from "../stores/git";
import { launcherStatus, launchersOf, currentProject } from "../stores/project";
import { settings } from "../stores/settings";
import { clickSidebarSectionIcon, COLLAPSED_SIDEBAR_WIDTH, type SidebarSectionButton } from "../stores/sidebar_sections";
import { t } from "../i18n/index";

/** The number of launchers of the selected workspace that are running. */
const runningLaunchers = computed(() => {
  const workspaceId = state.selectedWorkspaceId;
  const project = currentProject.value;
  if (workspaceId === null || !project) {
    return 0;
  }
  return launchersOf(workspaceId).filter((launcher) => launcherStatus(workspaceId, launcher) === "running").length;
});

/**
 * The hosting service of the repository of the selected workspace, for the icon of the Code hosting sidebar section. It
 * is null while it is not known: no workspace, no Git repository, no remote address, or the answer is not there yet.
 */
const codeHostingForge = ref<Forge | null>(null);

/** The number of the last reading of the hosting service: an older reading that ends later is dropped. */
let lastForgeReading = 0;

watch(
  () => currentGit.value?.root ?? null,
  async (folder) => {
    const thisReading = ++lastForgeReading;
    const forge = await readCodeHostingForge(folder);
    if (thisReading === lastForgeReading) {
      codeHostingForge.value = forge;
    }
  },
  { immediate: true },
);

/** The icon of the Code hosting sidebar section: the logo of GitHub or of GitLab, or a cloud when it is not known. */
const codeHostingIcon = computed(() => codeHostingForge.value ?? "cloud");

/**
 * The buttons of the sidebar icon bar of the left sidebar: the Files, Launchers, Source control, and Code hosting sidebar
 * sections, in this order.
 */
const sidebarSections = computed((): SidebarSectionButton[] => [
  { id: "files", label: t("filesPanel.sidebarSection"), icon: "folder2", badge: 0 },
  { id: "launchers", label: t("sidebar.sidebarSection.launchers"), icon: "play-circle", badge: runningLaunchers.value, isLive: true },
  {
    id: "sourceControl",
    label: t("sourceControlPanel.sidebarSection"),
    icon: "git",
    badge: (currentGit.value?.changed ?? 0) + (currentGit.value?.untracked ?? 0),
  },
  { id: "codeHosting", label: t("codeHostingPanel.sidebarSection"), icon: codeHostingIcon.value, badge: 0 },
]);

function selectSidebarSection(id: string) {
  if (id === "sourceControl" || id === "files" || id === "codeHosting") {
    clickSidebarSectionIcon(id);
    return;
  }
  clickSidebarSectionIcon("launchers");
}
</script>

<template>
  <aside class="side" :style="{ width: `${settings.leftCollapsed ? COLLAPSED_SIDEBAR_WIDTH : settings.leftWidth}px` }">
    <SidebarIconBar
      :sidebar-sections="sidebarSections"
      :selected-id="settings.leftCollapsed ? null : settings.leftSidebarSection"
      :label="t('sidebar.navigationBarLabel')"
      side="left"
      :is-collapsed="settings.leftCollapsed"
      @select="selectSidebarSection"
      @toggle="settings.leftCollapsed = !settings.leftCollapsed"
    />
    <div v-if="settings.leftCollapsed === false" class="sidebar-section-body">
      <LaunchersPanel v-if="settings.leftSidebarSection === 'launchers'" />
      <SourceControlPanel v-else-if="settings.leftSidebarSection === 'sourceControl'" />
      <CodeHostingPanel v-else-if="settings.leftSidebarSection === 'codeHosting'" />
      <FilesPanel v-else />
    </div>
  </aside>
</template>

<style scoped>
.side {
  flex-shrink: 0; min-width: 0; border: 1px solid var(--line); border-radius: var(--pane-radius); background: var(--side); overflow: hidden;
  display: flex;
}
.sidebar-section-body {
  flex: 1 1 auto; min-width: 0; border-left: 1px solid var(--line); padding: 5px 0 16px; overflow-y: auto;
  display: flex; flex-direction: column;
}
</style>
