<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { MireViewConnection } from "../../stores/mire/mire_store";
import MireGraph from "./MireGraph.vue";
import MireSidebar from "./MireSidebar.vue";

// One Mire view: the radial graph and its right sidebar. The modal wraps it now, and a separate window can mount the
// same component later. The view registers in the shared collector when it mounts, and leaves it when it unmounts, so
// the desktop application collects the live observations only while a view is open.

const emit = defineEmits<{
  /** The pane of a coding agent is now shown in the main window: the modal closes. */
  openedInHeidrunCode: [];
}>();

const connection = new MireViewConnection();

onMounted(() => {
  void connection.open();
});

onBeforeUnmount(() => {
  void connection.close();
});
</script>

<template>
  <div class="mire-view d-flex" data-mire-view>
    <MireGraph />
    <MireSidebar @opened-in-heidrun-code="emit('openedInHeidrunCode')" />
  </div>
</template>

<style scoped>
.mire-view { width: 100%; height: 100%; min-height: 0; background: var(--bg); }
</style>
