# Statistics charts source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/statistics_charts.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the bar charts of the Statistics window that every chart shares. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The words of a chart

### Source line 14

- Glossary entry: [Chart legend](../../glossary/statistics_charts.md#11-chart-legend).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Chart legend

The line above the bars of a chart of the Statistics window that names each color of the bars, in the order of the parts of a bar, from the bottom to the top. Every chart of the Statistics window has one. A click on the chart legend does nothing, because the buttons of the tab choose what the chart shows. The exception is the bar chart of the tab "Work of one person": a click on a name of its chart legend shows only the color of this name, and a second click on the same name shows every color again.

### Source line 18

- Glossary entry: [Chart information card](../../glossary/statistics_charts.md#12-chart-information-card).
- Proposed destinations: Glossary, User Interface, Behaviour, Styling.
- Inventory notes: Keep distinct from Information card and Information card tooltip. Review shared card terminology with Terminal text detection.

#### Chart information card

The small HTML card that opens beside a bar of a chart of the Statistics window while the mouse pointer is over this bar, and closes when the pointer leaves the bar. It has a title, a total when the colors can be added, and one row for each color that has a value in the bar. An arrow of the card touches the bar at the height of the pointer, so the developer sees which bar the card is about. It is not an information card of the status bar, which opens on a click and can hold buttons, and it is not an information card tooltip, which opens below an element after a delay. It never takes the pointer. Every chart of the Statistics window has one. See [status_bar.md](status_bar.md) for the information card and the information card tooltip.
