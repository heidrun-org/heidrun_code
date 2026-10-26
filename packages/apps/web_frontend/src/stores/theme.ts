import { computed, ref, watch } from "vue";
import { ThemePalette } from '../design/theme_palette';
import { settings } from "./settings";

export const THEME_OPTIONS = [
  { id: "system", labelKey: "themeMenu.system", icon: "circle-half" },
  { id: "dark", labelKey: "themeMenu.dark", icon: "moon-stars" },
  { id: "light", labelKey: "themeMenu.light", icon: "sun" },
] as const;

const query = window.matchMedia("(prefers-color-scheme: dark)");
const systemIsDark = ref(query.matches);
query.addEventListener("change", (event) => {
  systemIsDark.value = event.matches;
});

/** The theme in use: "light" or "dark" (the operating system's choice when the setting is "system"). */
export const resolvedTheme = computed<"light" | "dark">(() => {
  if (settings.theme === "system") {
    return systemIsDark.value ? "dark" : "light";
  }
  return settings.theme;
});

/** CSS class of the code colours (diff pane, file view pane): the one matching the theme of the application (issue #446). */
export const codeThemeClass = computed(() => (resolvedTheme.value === "light" ? "github-light" : "github-dark"));

/** True when the code colours are dark (the file editor uses it for its own base colours). */
export const codeIsDark = computed(() => codeThemeClass.value !== "github-light");

watch(
  resolvedTheme,
  (theme) => {
    document.documentElement.dataset.theme = theme;
    // Bootstrap reads the theme from this attribute, for the close button, the arrow of a select, and the check box.
    document.documentElement.dataset.bsTheme = theme;
    ThemePalette.activate(theme);
  },
  { immediate: true },
);
