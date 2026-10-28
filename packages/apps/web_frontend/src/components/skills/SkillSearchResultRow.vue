<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Icon from "../Icon.vue";
import InformationCard from "../InformationCard.vue";
import InformationCardContent from "../InformationCardContent.vue";
import { settings } from "../../stores/settings";
import {
  comparisonKey,
  comparisonOf,
  compareWithInstalled,
  inspectResult,
  installSkill,
  isInstalledAtLevel,
  isSkillBusy,
  readResultText,
  resultKey,
  resultOrigin,
  type SearchResult,
} from "../../stores/skills";
import { splitSkillText } from "../../lib/skill_text";
import { t } from "../../i18n/index";

// One result of the window Find new skills. The first line has the name of the skill and a circled question mark. A click on
// it opens a card that tells the name, the description, and the place of the skill; the pointer over it opens nothing. The second line has the place of the skill: when it is too long
// for the row, it scrolls from the right to the left while the pointer is over the row (a CSS transition on `transform`, so
// that the move is smooth, below one pixel). At the right of the row, the small
// badge "Different" (when the skill is installed with another SKILL.md file) stands at the left of the buttons, at their
// height. The buttons are one button group of fixed width, cut in two equal halves, so the rows line up: "Inspect", then
// "Install", or "Installed" when the installed skill has the same SKILL.md file.

/** The time that the path needs for each pixel of its scroll, in milliseconds. The delay before it starts is in the style. */
const SCROLL_MS_PER_PIXEL = 12;

const props = defineProps<{ result: SearchResult }>();

// A result that is installed at the chosen level is compared with the installed skill of the same name, now and each time
// that the level changes or the installation ends.
watch(
  () => (isInstalledAtLevel(props.result) ? comparisonKey(props.result) : ""),
  (key) => {
    if (key !== "") {
      compareWithInstalled(props.result);
    }
  },
  { immediate: true },
);

/** The SKILL.md text of the result for the card: `undefined` while it is not read, `null` when it cannot be read. */
const skillText = ref<string | null | undefined>(undefined);
let isReadStarted = false;

/** Reads the SKILL.md text once, when the developer clicks the circled question mark: the card opens when the text is read. */
async function readSkillText() {
  if (isReadStarted) {
    return;
  }
  isReadStarted = true;
  try {
    skillText.value = await readResultText(props.result);
  } catch {
    skillText.value = null;
  }
}

/** The line of the place of the skill, and the state of its scroll. */
const placeLine = ref<HTMLElement | null>(null);
const isPlaceScrolling = ref(false);
const placeScrollStyle = ref<Record<string, string>>({});

/**
 * Starts the scroll of the place line from the right to the left, to its end, when it is too long for the row. The line
 * only gets the class `scrolling` and the two CSS variables: the move is a CSS transition of `transform`.
 */
function startPlaceScroll() {
  const line = placeLine.value;
  if (line === null) {
    return;
  }
  const distance = line.scrollWidth - line.clientWidth;
  if (distance <= 0) {
    return;
  }
  placeScrollStyle.value = {
    "--scroll-distance": `${-distance}px`,
    "--scroll-duration": `${distance * SCROLL_MS_PER_PIXEL}ms`,
  };
  isPlaceScrolling.value = true;
}

/** Puts the place line back at its start, with its ellipsis. */
function stopPlaceScroll() {
  isPlaceScrolling.value = false;
}

const isInstalled = computed(() => isInstalledAtLevel(props.result));
const isDifferent = computed(() => comparisonOf(props.result) === "different");
const fields = computed(() => (typeof skillText.value === "string" ? splitSkillText(skillText.value).fields : []));
const cardTitle = computed(() => fields.value.find((field) => field.key === "name")?.value ?? props.result.name);

const place = computed(() => {
  const origin = resultOrigin(props.result);
  if (origin === "localFolder") {
    return props.result.folderPath ?? "";
  }
  return origin === "skillsSh" ? props.result.source : (props.result.folderUrl ?? props.result.source);
});

const placeLabel = computed(() => {
  const origin = resultOrigin(props.result);
  if (origin === "skillsSh") {
    return `${props.result.source} · ${t("settingsSkills.installs", { total: props.result.installs.toLocaleString() })}`;
  }
  if (origin === "localFolder") {
    return `${props.result.folderPath} · ${t("settingsSkills.originLocalFolder")}`;
  }
  return `${props.result.source} · ${t(origin === "gitlab" ? "settingsSkills.gitlabFolder" : "settingsSkills.githubFolder")}`;
});

const cardBlocks = computed(() => {
  let descriptionText = fields.value.find((field) => field.key === "description")?.value ?? "";
  if (descriptionText === "") {
    if (skillText.value === undefined) {
      descriptionText = t("settingsSkills.loading");
    } else {
      descriptionText = t(skillText.value === null ? "settingsSkills.infoUnreadable" : "settingsSkills.infoNoDescription");
    }
  }
  const blocks = [
    { title: t("settingsSkills.infoDescription"), text: descriptionText },
    { title: t("settingsSkills.infoPlace"), text: place.value },
  ];
  if (isInstalled.value) {
    blocks.push({
      title: t("settingsSkills.infoState"),
      text: t(isDifferent.value ? "settingsSkills.infoInstalledDifferent" : "settingsSkills.infoInstalled"),
    });
  }
  return blocks;
});
</script>

<template>
  <div class="row" @pointerenter="startPlaceScroll" @pointerleave="stopPlaceScroll">
    <div class="meta">
      <div class="nameLine d-flex align-items-center gap-2">
        <span class="name">{{ result.name }}</span>
        <InformationCard :label="t('settingsSkills.infoLabel', { name: result.name })" placement="bottom-center" :prepare="readSkillText">
          <span class="infoPart text-body-secondary" role="img" :aria-label="t('settingsSkills.infoLabel', { name: result.name })">
            <Icon name="question-circle" />
          </span>
          <template #card>
            <InformationCardContent :title="cardTitle" :blocks="cardBlocks" />
          </template>
        </InformationCard>
      </div>
      <div ref="placeLine" class="sub" :class="{ scrolling: isPlaceScrolling }" :style="placeScrollStyle"><span class="subText">{{ placeLabel }}</span></div>
    </div>
    <span v-if="isDifferent" class="differentBadge" :title="t('settingsSkills.differentTitle')">{{ t("settingsSkills.different") }}</span>
    <div class="btn-group rowActions" role="group" :aria-label="result.name">
      <button type="button" class="btn btn-outline theme-secondary" @click="inspectResult(result)">
        <Icon name="eye" /> {{ t("settingsSkills.inspect") }}
      </button>
      <button v-if="isInstalled && isDifferent === false" type="button" class="btn btn-outline theme-secondary" disabled>
        <Icon name="check-lg" /> {{ t("settingsSkills.installed") }}
      </button>
      <button
        v-else
        type="button"
        class="btn btn-outline theme-secondary"
        :disabled="isSkillBusy(resultKey(result))"
        :aria-busy="isSkillBusy(resultKey(result))"
        :title="t(isInstalled ? 'settingsSkills.installTitleReplace' : settings.skillsLevel === 'workspace' ? 'settingsSkills.installTitleWorkspace' : 'settingsSkills.installTitleUser')"
        @click="installSkill(result)"
      >
        <span v-if="isSkillBusy(resultKey(result))" class="spinner" aria-hidden="true"></span><Icon v-else name="download" />
        {{ t("settingsSkills.install") }}
      </button>
    </div>
  </div>
</template>
