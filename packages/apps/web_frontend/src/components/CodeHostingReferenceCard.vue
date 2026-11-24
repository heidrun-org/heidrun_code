<script setup lang="ts">
import ChatReferenceDetails from "./ChatReferenceDetails.vue";
import PullRequestMergeBar from "./PullRequestMergeBar.vue";
import type { ChatReference } from "../lib/chat_references";
import type { Forge, RefTarget } from "../lib/refs";
import type { ChatReferenceDetails as ReferenceDetails } from "../stores/chat_references";
import type { MergeFacts } from "../stores/pull_request_merge";

defineProps<{
  /** The issue or request shown in the information card. */
  reference: ChatReference;
  /** Details from the hosting service. */
  details: ReferenceDetails | null | undefined;
  /** The workspace repository folder and hosting service. */
  folder: string;
  forge: Forge;
  /** The repository web address. */
  webBase: string | null;
  /** The item's title and display number. */
  title: string | null;
  name: string;
  /** The current sidebar search, when labels can be applied as filters. */
  search?: string | null;
  /** The repository named in a terminal reference. */
  target?: RefTarget;
  /** Merge controls, when the request can be managed from this workspace. */
  facts?: MergeFacts | null;
  /** The expected request address when opening the merge window from the terminal. */
  expectedUrl?: string | null;
}>();

const emit = defineEmits<{ toggleLabel: [name: string] }>();
</script>

<template>
  <div class="card-content">
    <ChatReferenceDetails
      :reference="reference"
      :details="details"
      :folder="folder"
      :forge="forge"
      :web-base="webBase"
      :title="title"
      :name="name"
      :search="search"
      :target="target"
      @toggle-label="emit('toggleLabel', $event)"
    />
    <PullRequestMergeBar
      v-if="facts"
      class="mt-3"
      :facts="facts"
      :folder="folder"
      :forge="forge"
      :name="name"
      :web-base="webBase ?? ''"
      :expected-url="expectedUrl"
    />
  </div>
</template>

<style scoped>
.card-content { padding: 12px 16px; }
</style>
