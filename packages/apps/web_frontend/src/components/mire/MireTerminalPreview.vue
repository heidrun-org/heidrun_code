<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as api from "../../lib/api";
import { t } from "../../i18n/index";

// The terminal preview of a coding agent: the last lines of its pane, read with the Herdr request `pane.read` every two
// seconds. It is plain text: it never attaches to the terminal, so it never resizes the terminal of the main window and
// never takes the input focus.

const props = defineProps<{
  /** The pane of the coding agent. */
  paneId: string;
}>();

/** How often the preview reads the pane again, in milliseconds. */
const READ_INTERVAL_MS = 2_000;

/** The number of lines that the preview reads. */
const LINE_COUNT = 30;

const text = ref<string | null>(null);
const isUnavailable = ref(false);
let timer: number | null = null;
let isReading = false;

async function read() {
  if (isReading) {
    return;
  }
  isReading = true;
  const paneId = props.paneId;
  try {
    const lines = await api.read(paneId, LINE_COUNT);
    if (paneId === props.paneId) {
      text.value = lines.replace(/\s+$/, "");
      isUnavailable.value = false;
    }
  } catch {
    if (paneId === props.paneId) {
      isUnavailable.value = true;
    }
  } finally {
    isReading = false;
  }
}

watch(
  () => props.paneId,
  () => {
    text.value = null;
    void read();
  },
);

onMounted(() => {
  void read();
  timer = window.setInterval(() => void read(), READ_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (timer !== null) {
    window.clearInterval(timer);
  }
});
</script>

<template>
  <p v-if="isUnavailable" class="m-0 text-body-secondary" data-terminal-unavailable>{{ t("mire.details.terminalUnavailable") }}</p>
  <pre v-else class="mire-terminal-preview m-0 p-2 font-monospace" :aria-label="t('mire.details.terminal')" data-terminal-preview>{{ text ?? t("mire.details.terminalLoading") }}</pre>
</template>

<style scoped>
/* A read-only block of terminal text: it scrolls inside the sidebar and keeps the lines as the terminal wrote them. */
.mire-terminal-preview {
  max-height: 260px; overflow: auto; white-space: pre-wrap; word-break: break-all;
  background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 6px;
  font-size: calc(var(--font-size) * 0.85);
}
</style>
