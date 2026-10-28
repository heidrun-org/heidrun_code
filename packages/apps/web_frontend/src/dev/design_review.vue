<script setup lang="ts">
import { ref, watchEffect } from 'vue';
import DesignReviewSamples from '../design/design_review_samples.vue';
const isLight = ref(false);
watchEffect(() => {
	document.documentElement.dataset.theme = isLight.value ? 'light' : 'dark';
	document.documentElement.dataset.bsTheme = isLight.value ? 'light' : 'dark';
});
</script>

<template>
  <main class="h-100 overflow-auto p-4">
    <h1>Heidrun Code shared design review</h1>
    <button class="btn mb-3" :aria-pressed="isLight" @click="isLight = !isLight">{{ isLight ? 'Light theme' : 'Dark theme' }}</button>
    <DesignReviewSamples />
  </main>
</template>
