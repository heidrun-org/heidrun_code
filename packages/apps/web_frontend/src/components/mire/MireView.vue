<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { MireViewConnection, mireIsOnLocalNetwork } from "../../stores/mire/mire_store";
import {
  MIRE_SIDEBAR_DEFAULT_WIDTH,
  MIRE_SIDEBAR_MINIMUM_WIDTH,
  MireSidebarWidth,
  mireSidebarWidth,
} from "../../stores/mire/mire_sidebar_width";
import Resizer from "../Resizer.vue";
import MireGraph from "./MireGraph.vue";
import MireSidebar from "./MireSidebar.vue";

// One Mire view: the radial graph and its right sidebar. The modal wraps it now, and a separate window can mount the
// same component later. The view registers in the shared collector when it mounts, and leaves it when it unmounts, so
// the desktop application collects the live observations only while a view is open. The developer drags the left edge
// of the right sidebar to change its width, in the modal and in the separate Mire window. On a device of the local
// network, the sidebar keeps the width of its page.

const emit = defineEmits<{
  /** A workspace, a tab, or the pane of a coding agent is now shown in the main window: the modal closes. */
  openedInHeidrunCode: [];
}>();

const connection = new MireViewConnection();

onMounted(() => {
  MireSidebarWidth.load();
  void connection.open();
});

onBeforeUnmount(() => {
  void connection.close();
});
</script>

<template>
  <div class="mire-view d-flex" data-mire-view>
    <MireGraph @opened-in-heidrun-code="emit('openedInHeidrunCode')" />
    <Resizer
      v-if="mireIsOnLocalNetwork === false"
      :width="mireSidebarWidth"
      side="right"
      :min="MIRE_SIDEBAR_MINIMUM_WIDTH"
      :default-width="MIRE_SIDEBAR_DEFAULT_WIDTH"
      :inside="true"
      data-mire-sidebar-resizer
      @update:width="MireSidebarWidth.set($event)"
    />
    <MireSidebar
      :style="mireIsOnLocalNetwork ? undefined : { width: `${mireSidebarWidth}px` }"
      @opened-in-heidrun-code="emit('openedInHeidrunCode')"
    />
  </div>
</template>

<style scoped>
.mire-view { width: 100%; height: 100%; min-height: 0; background: var(--bg); }
</style>
