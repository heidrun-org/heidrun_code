# Mire animations and message links

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Mire graph and sidebar](mire_graph_and_sidebar.md), [Mire data and statuses](mire_data_and_statuses.md), [Glossary of Heidrun Code: Mire](../../glossary/mire.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 974](https://github.com/heidrun-org/heidrun_code/issues/974), [issue 982](https://github.com/heidrun-org/heidrun_code/issues/982)

This file gives the rules of the animations of the radial graph of the Mire, and of the links of the messages. The code is in `packages/apps/web_frontend/src/components/mire` (`MireGraph.vue`, `MireGraphEffects.vue`, `mire_graph_animations.css`, `mire_message_arcs.ts`), `packages/apps/web_frontend/src/stores/mire/mire_animations.ts`, and `packages/apps/web_frontend/src/lib/mire/mire_transitions.ts`.

## Statuses

The colors are the status colors of Heidrun Code: `--working` purple, `--blocked` red, `--done` green, and `--idle` gray. The glow of a blocked element is red.

- Working: the dot breathes, a small dot turns around it in 1 second, and drops of mead climb the line from the node to its parent. The drops are 50 units of the drawing apart, and move 50 units in 0.5 second (100 units each second), so they have the same spacing and the same speed on every line ([issue 982](https://github.com/heidrun-org/heidrun_code/issues/982)). The small dot (radius 2.5 around a coding agent, 2 around a subagent) and the drops (4 units wide) are gold (`--heidrun-gold`), with a strong gold glow: an SVG filter of two blurs made 4 and 8 times more opaque, because a CSS drop-shadow on an SVG element did not show in the web view of macOS; the line and the dot of the node keep the color of the status ([issue 982](https://github.com/heidrun-org/heidrun_code/issues/982)).
- Blocked: waves leave the dot, and the hexagon of the workspace has a red glow.
- Finished: a single burst for each real completion, then the still Finished look.
- Idle and unknown: no animation.

## Heidrun at the centre

- Heidrun has a golden glow behind the goat, and a golden sight ring with the marks of a dial that turns slowly, as in the proposal of issue 955. The gold is the theme variable `--heidrun-gold`, the gold of the horns, never `--accent`, which the theme can change to another color.
- The keys of the keyboard of Heidrun light up faster when more coding agents work: one key lights up every 1600 milliseconds for one working coding agent, divided by the number of working coding agents, and never faster than every 250 milliseconds. With no working coding agent, the keyboard is still.
- Heidrun shows no status: no colored ring and no red glow. The lines and the nodes show the statuses.

## Real transitions

- `MireTransitions.compare` compares each new model with the state of the previous models of the open view, and gives a completion, a new blocked item, or a new message only for a real change.
- The first model of a view gives no transition. Each opening of a view starts again from no state, so a reconnection replays nothing.
- A completion is a change from a known status that is not Finished to Finished. The status `unknown` never replaces a known status, and a node that disappears keeps its last known status, so a stale period or a restart of the collector does not give a second burst. A node that first appears Finished gives no burst.
- The new messages come from `MireMessages.newSince`. The seen identifiers start with the first observation of the view, and are forgotten when no observation is left, so the next observation gives no new message.

## Messages

- A new message travels on an arc only between two drawn nodes that its explicit identifiers resolve. A queued message travels on a dashed arc and does not flash the destination, because queued does not prove that the destination read it. A received message travels on a solid arc and flashes the destination. A failed message stops half way.
- Inside one workspace, the arc bulges outwards, past the subagents, or to the side when the two ends sit on one ray from the centre. Across workspaces, the arc bends towards Heidrun. An answer travels back on the same arc.
- A message with only one drawn end shows a marker with a question mark on that end. A message with no drawn end shows nothing in the graph, and stays in the lists of the sidebar.
- The title of a message gives the two ends, the delivery, and the text. A Codex message gives "Content not exposed by Codex", never an invented text.
- A name never links two nodes. Two subagents with the same name in two workspaces stay separate, with no line between them.

## Pause, reduced motion, and performance

- The pause button at the top left of the graph stops every animation and removes the effects that show. The data keeps updating during the pause, and the resume replays nothing.
- The Mire starts paused when the system asks for reduced motion (`prefers-reduced-motion: reduce`).
- The animations are CSS animations of a transform, an opacity, a color, or a stroke offset. None moves a node, none changes the layout, and the graph is not built again for each frame.
- No timer of the animations runs. Each effect leaves the store at the end of its own animation, or at the next model after 6 seconds when it is not drawn. The follower of the transitions stops, and every effect goes away, when the graph unmounts.

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/mire/mire_transitions.test.ts src/stores/mire/mire_animations.test.ts src/components/mire/MireGraphAnimations.test.ts src/components/mire/mire_message_arcs.test.ts` runs the tests of the transitions, the effects, the pause, the reduced motion, the message links, and the unmount.
