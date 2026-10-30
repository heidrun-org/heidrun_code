<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { MireSubagentNode } from "../../lib/mire/mire_model_types";
import { MireStore, mireIndex } from "../../stores/mire/mire_store";
import { t } from "../../i18n/index";

// The transcript preview of a subagent: the last lines of its transcript file. A subagent has no terminal of its own,
// so this block is always called "Transcript". Claude Code writes a transcript file for each subagent, read every five
// seconds. Codex gives no transcript of a child chat to Heidrun Code, so the block says that it is not available.

const props = defineProps<{
  /** The subagent. */
  subagent: MireSubagentNode;
}>();

/** How often the preview reads the transcript again, in milliseconds. */
const READ_INTERVAL_MS = 5_000;

/** The Claude Code session of the coding agent of the subagent, or null. */
const sessionId = computed(() => {
  const node = mireIndex.value.get(props.subagent.codingAgentNodeId)?.node;
  if (node === undefined || node.kind !== "coding_agent" || node.chat.state !== "matched") {
    return null;
  }
  return node.chat.chatId;
});

const lines = ref<string[] | null>(null);
const state = ref<"loading" | "ready" | "missing">("loading");
let timer: number | null = null;

async function read() {
  if (props.subagent.source !== "claude_observer" || sessionId.value === null) {
    return;
  }
  const subagentId = props.subagent.nativeId;
  try {
    const found = await MireStore.readClaudeSubagentTranscript(sessionId.value, subagentId);
    if (subagentId !== props.subagent.nativeId) {
      return;
    }
    lines.value = found;
    state.value = found === null ? "missing" : "ready";
  } catch {
    state.value = "missing";
  }
}

watch(
  () => props.subagent.nodeId,
  () => {
    lines.value = null;
    state.value = "loading";
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
  <p v-if="subagent.source === 'codex_server'" class="m-0 text-body-secondary" data-transcript-unavailable>{{ t("mire.details.transcriptNotExposedByCodex") }}</p>
  <p v-else-if="sessionId === null || state === 'missing'" class="m-0 text-body-secondary" data-transcript-unavailable>{{ t("mire.details.transcriptUnavailable") }}</p>
  <pre v-else class="mire-transcript-preview m-0 p-2 font-monospace" :aria-label="t('mire.details.transcript')" data-transcript-preview>{{ lines === null ? t("mire.details.transcriptLoading") : lines.join("\n") }}</pre>
</template>

<style scoped>
/* A read-only block of transcript text, with the look of the terminal preview. */
.mire-transcript-preview {
  max-height: 260px; overflow: auto; white-space: pre-wrap; word-break: break-word;
  background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 6px;
  font-size: calc(var(--font-size) * 0.85);
}
</style>
