<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Data, LegendClickEvent, Layout, PlotHoverEvent, PlotlyHTMLElement } from "plotly.js-basic-dist-min";
import ChartInformationCardPopover from "./ChartInformationCardPopover.vue";
import {
  CHART_BAR_GAP,
  CHART_LEGEND,
  CHART_MARGIN,
  ChartInformationCard,
  type ChartInformationCardAnchor,
  type ChartInformationCardContent,
} from "../lib/chart_information_card";
import { ChartTheme } from "../lib/chart_theme";
import { PlotlyLoader, type PlotlyModule } from "../lib/plotly_loader";
import { tokenUnitFor, type TokenUnit } from "../lib/chat_usage";
import type { StackedBarSeries, StackedBarUnit } from "../lib/stacked_bar_chart";
import { locale } from "../i18n/index";
import { settings } from "../stores/settings";
import { resolvedTheme } from "../stores/theme";

// A bar chart with one bar for each slot, and in each bar one color for each series, one on top of the other. The tab "Work
// of one person" uses it for the commits and the pull requests of each slot, and for the AI cost or the tokens of each slot.
// A slot is a day, or a part of a day, so two bars can have the same text: the bars sit on numbers, and the axis shows the
// text of the bars that have one. A bar with no text keeps its place and shows nothing under it.
// Like every chart of the Statistics window, it has a legend above the bars, and a chart information card that opens beside
// the bar under the pointer. A click on a name of the legend filters the chart: the chart then shows only the color of this
// name, and a second click on the same name shows every color again. The settings keep the filter of each chart, so the
// next run of Heidrun Code shows the chart with the same filter. Plotly.js is loaded only when the window opens, so the
// other windows do not pay for its size.
// Issue: https://github.com/heidrun-org/heidrun/issues/498
// Issue: https://github.com/heidrun-org/heidrun/issues/629

const props = defineProps<{
  /** The name under which the settings keep the filter of the legend of this chart. */
  memoryKey: string;
  /** The text under each bar, or `null` for a bar with no text. It has the same number of items as the values of each series. */
  labels: Array<string | null>;
  /** The colors of the bars, from the bottom of a bar to its top. */
  series: StackedBarSeries[];
  /** The first line of the chart information card of each bar, in the order of the bars. */
  titles: string[];
  /** The total of all the colors in each bar, or `null` when the colors cannot be added: the card then shows no total. */
  totals: string[] | null;
  /** The title of the chart. */
  title: string;
  /** The title of the horizontal axis. */
  horizontalAxisTitle: string;
  /** The title of the vertical axis. */
  verticalAxisTitle: string;
  /** The unit of the vertical axis: whole numbers, US dollars, or tokens. */
  verticalAxisUnit: StackedBarUnit;
  /** The text that a screen reader reads for the chart. */
  chartLabel: string;
}>();

/** The highest bar for which a vertical axis of whole numbers goes up one by one. A higher bar lets Plotly.js choose the step. */
const LAST_BAR_COUNTED_ONE_BY_ONE = 8;

const chart = ref<HTMLDivElement>();
let plotly: PlotlyModule | null = null;
let resizeObserver: ResizeObserver | null = null;
let isUnmounted = false;
let hasHoverListeners = false;

/**
 * The name of the only color that the chart shows, or `null` while the chart shows every color. The settings keep the
 * identifier of this color for the chart. A saved identifier that no color of the chart has gives `null`, and the settings
 * keep it, so that the filter comes back when the color comes back.
 */
const isolatedName = computed(() => {
  const isolatedId = settings.statisticsLegendFilters[props.memoryKey];
  return props.series.find((one) => one.id === isolatedId)?.name ?? null;
});

/** The colors that the chart shows: every color, or only the color that the legend filter kept. */
const shownSeries = computed(() =>
  isolatedName.value === null ? props.series : props.series.filter((one) => one.name === isolatedName.value),
);

/** The bar under the pointer and the place of its chart information card, or `null` while the pointer is not over a bar. */
const hovered = ref<{ index: number; anchor: ChartInformationCardAnchor } | null>(null);

/**
 * The content of the chart information card of the bar under the pointer, or `null` while the pointer is not over a bar. It
 * has the title of the bar, the total when the colors can be added, and one row for each color that has a value in the bar.
 * A chart with one color and a total has no row, because the row would repeat the total. While the chart shows only one
 * color, the card has no total, because the total would count the colors that the chart hides.
 */
const card = computed<ChartInformationCardContent | null>(() => {
  if (hovered.value === null) {
    return null;
  }
  const { index } = hovered.value;
  const total = props.totals === null || isolatedName.value !== null ? null : props.totals[index];
  const rows: ChartInformationCardContent["rows"] = [];
  if (total === null || shownSeries.value.length > 1) {
    for (const one of shownSeries.value) {
      if (one.values[index] > 0) {
        rows.push({ key: one.name, name: one.name, colorToken: one.colorToken, value: one.valueTexts[index] });
      }
    }
  }
  return { title: props.titles[index], total, rows };
});

/** Shows the chart information card of the bar under the pointer. */
function onHover(event: PlotHoverEvent): void {
  const point = event.points[0];
  const element = chart.value;
  if (point === undefined || element === undefined) {
    return;
  }
  const box = element.getBoundingClientRect();
  const pointerY = event.event.clientY - box.top;
  hovered.value = {
    index: point.pointNumber,
    anchor: ChartInformationCard.anchor(point.pointNumber, props.labels.length, pointerY, box.width, box.height),
  };
}

/** Hides the chart information card when the pointer leaves a bar. */
function onUnhover(): void {
  hovered.value = null;
}

/**
 * Filters the chart by the name that was clicked in the legend: the chart shows only this color, and a click on the name of
 * the only color that shows brings every color back. The names of the hidden colors stay in the legend, faded by Plotly.js.
 *
 * @param event - The click, with the index of the trace whose name was clicked.
 * @returns False, so that Plotly.js does nothing more with the click.
 */
function onLegendClick(event: LegendClickEvent): boolean {
  const clicked = props.series[event.curveNumber];
  if (clicked === undefined) {
    return false;
  }
  if (isolatedName.value === clicked.name) {
    delete settings.statisticsLegendFilters[props.memoryKey];
  } else {
    settings.statisticsLegendFilters[props.memoryKey] = clicked.id;
  }
  return false;
}

/**
 * Gives the settings of the vertical axis that depend on its unit. With tokens, every tick has the same unit, the biggest
 * unit that does not go over the highest bar, so the ticks read "5 MT", "10 MT", and "15 MT".
 */
function unitAxis(highestBar: number, tokenUnit: TokenUnit | null): Partial<Layout["yaxis"]> {
  if (tokenUnit !== null) {
    return { ticksuffix: tokenUnit.suffix === "" ? "" : ` ${tokenUnit.suffix}`, tickformat: ",.2~f" };
  }
  if (props.verticalAxisUnit === "dollars") {
    return { tickprefix: "$", tickformat: ",.2~f" };
  }
  return { tickformat: "d", ...(highestBar <= LAST_BAR_COUNTED_ONE_BY_ONE ? { dtick: 1 } : {}) };
}

/** Draws the bars again, with the colors of the theme in use. */
function draw(): void {
  const element = chart.value;
  if (plotly === null || element === undefined) {
    return;
  }
  const textColor = ChartTheme.readColor("--fg-body", element);
  const lineColor = ChartTheme.readColor("--border-color", element);
  const highestBar = Math.max(1, ...props.labels.map((_, index) => shownSeries.value.reduce((sum, one) => sum + one.values[index], 0)));
  const labelledBars = props.labels.flatMap((text, index) => (text === null ? [] : [{ index, text }]));
  const tokenUnit = props.verticalAxisUnit === "tokens" ? tokenUnitFor(highestBar) : null;
  const unitSize = tokenUnit === null ? 1 : tokenUnit.size;
  const data: Data[] = props.series.map((one) => ({
    type: "bar",
    name: one.name,
    x: props.labels.map((_, index) => index),
    y: one.values.map((value) => value / unitSize),
    hoverinfo: "none",
    visible: isolatedName.value === null || one.name === isolatedName.value ? true : "legendonly",
    marker: { color: ChartTheme.readColor(one.colorToken, element) },
  }));
  const layout: Partial<Layout> = {
    autosize: true,
    barmode: "stack",
    title: { text: props.title },
    margin: { ...CHART_MARGIN, b: 80 },
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: textColor },
    bargap: CHART_BAR_GAP,
    legend: { ...CHART_LEGEND },
    xaxis: {
      type: "linear",
      title: { text: props.horizontalAxisTitle },
      automargin: true,
      fixedrange: true,
      range: [-0.5, props.labels.length - 0.5],
      tickmode: "array",
      tickvals: labelledBars.map((label) => label.index),
      ticktext: labelledBars.map((label) => label.text),
      linecolor: lineColor,
      gridcolor: lineColor,
    },
    yaxis: {
      title: { text: props.verticalAxisTitle },
      fixedrange: true,
      linecolor: lineColor,
      gridcolor: lineColor,
      zerolinecolor: lineColor,
      rangemode: "tozero",
      ...unitAxis(highestBar, tokenUnit),
    },
  };
  plotly.react(element, data, layout, { displayModeBar: false });
  if (hasHoverListeners === false) {
    const plotElement = element as unknown as PlotlyHTMLElement;
    plotElement.on("plotly_hover", onHover);
    plotElement.on("plotly_unhover", onUnhover);
    plotElement.on("plotly_legendclick", onLegendClick);
    hasHoverListeners = true;
  }
}

onMounted(async () => {
  const loaded = await PlotlyLoader.load();
  if (isUnmounted === true) {
    return;
  }
  plotly = loaded;
  draw();
  resizeObserver = new ResizeObserver(() => {
    if (plotly !== null && chart.value !== undefined) {
      plotly.Plots.resize(chart.value);
    }
  });
  if (chart.value !== undefined) {
    resizeObserver.observe(chart.value);
  }
});

// The theme sets its attributes on the page in its own watcher, so the colors are read on the next tick.
watch(
  [resolvedTheme, locale, () => props.labels, () => props.series, () => props.title, () => props.verticalAxisUnit, isolatedName],
  async () => {
    hovered.value = null;
    await nextTick();
    draw();
  },
);

onBeforeUnmount(() => {
  isUnmounted = true;
  resizeObserver?.disconnect();
  if (plotly !== null && chart.value !== undefined) {
    plotly.purge(chart.value);
  }
});
</script>

<template>
  <div class="stacked-bar-chart-box position-relative">
    <div ref="chart" class="stacked-bar-chart" role="img" :aria-label="chartLabel"></div>
    <ChartInformationCardPopover v-if="card !== null && hovered !== null" :content="card" :anchor="hovered.anchor" />
  </div>
</template>

<style scoped>
.stacked-bar-chart-box { width: 100%; height: 100%; }
.stacked-bar-chart { width: 100%; height: 100%; }
</style>
