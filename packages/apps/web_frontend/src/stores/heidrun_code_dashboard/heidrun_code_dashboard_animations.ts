import { reactive, watch, type WatchStopHandle } from 'vue';
import type { HeidrunCodeDashboardMessage, HeidrunCodeDashboardModel } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types';
import { HeidrunCodeDashboardTransitions, type HeidrunCodeDashboardTransitionState } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_transitions';
import { heidrunCodeDashboardMessages, heidrunCodeDashboardModel, heidrunCodeDashboardState } from './heidrun_code_dashboard_store';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardAnimations — the pause and the short effects of the real transitions of the open Heidrun Code Dashboard view
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The media query of the system setting that asks for reduced motion. */
export const HEIDRUN_CODE_DASHBOARD_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The largest number of effects shown at the same time. A new effect removes the oldest one. */
const MAXIMUM_EFFECTS = 40;

/**
 * The longest life of an effect, in milliseconds. The graph removes an effect at the end of its animation; an effect
 * that is not drawn (its node is hidden by the filter) goes away at the next model after this time.
 */
const EFFECT_LIFETIME_MS = 6_000;

/** One short effect of the graph, for one real transition. */
export type HeidrunCodeDashboardEffect =
	| {
		/** The identifier of the effect. */
		id: string;
		/** `completed`: a single burst. `blocked`: a single red flash. */
		kind: 'completed' | 'blocked';
		/** The node identifier of the coding agent or of the subagent. */
		nodeId: string;
		/** When the effect started, from the clock of the Heidrun Code Dashboard store. */
		createdAtMs: number;
	}
	| {
		/** The identifier of the effect. */
		id: string;
		/** A new message. */
		kind: 'message';
		/** The message. */
		message: HeidrunCodeDashboardMessage;
		/** When the effect started, from the clock of the Heidrun Code Dashboard store. */
		createdAtMs: number;
	};

/** The state of the animations of the Heidrun Code Dashboard views of this window. */
export const heidrunCodeDashboardAnimationState = reactive({
	/** True when every animation is stopped. The data keeps updating. */
	isPaused: false,
	/** The short effects that the graph draws now. */
	effects: [] as HeidrunCodeDashboardEffect[],
});

/** The state of the previous models of the open view, or null before its first model. */
let transitionState: HeidrunCodeDashboardTransitionState | null = null;

/** The number of effects created, to give each effect its own identifier. */
let effectCount = 0;

/** The pause and the effects of the real transitions of the Heidrun Code Dashboard. */
export class HeidrunCodeDashboardAnimations {
	/**
	 * Starts to follow the model of the view that opens. The first model gives no effect. The view starts paused when
	 * the system asks for reduced motion.
	 * @returns The function that stops the follower and removes every effect, for the view that closes.
	 */
	static start(): WatchStopHandle {
		transitionState = null;
		heidrunCodeDashboardAnimationState.effects = [];
		if (HeidrunCodeDashboardAnimations.prefersReducedMotion() === true) {
			heidrunCodeDashboardAnimationState.isPaused = true;
		}
		const stopWatch = watch(
			[heidrunCodeDashboardModel, heidrunCodeDashboardMessages],
			([model, messages]) => {
				HeidrunCodeDashboardAnimations.observe(model, messages, heidrunCodeDashboardState.nowMs);
			},
			{
				immediate: true,
			},
		);
		return () => {
			stopWatch();
			transitionState = null;
			heidrunCodeDashboardAnimationState.effects = [];
		};
	}

	/**
	 * Compares a new model with the previous ones, and adds one effect for each real transition, unless the animations
	 * are paused. The seen messages and the known statuses advance also during a pause, so that a resume replays nothing.
	 * @param model The new Heidrun Code Dashboard model.
	 * @param messages The messages of the same observations.
	 * @param nowMs The time of the clock of the Heidrun Code Dashboard store.
	 */
	static observe(model: HeidrunCodeDashboardModel, messages: HeidrunCodeDashboardMessage[], nowMs: number): void {
		const result = HeidrunCodeDashboardTransitions.compare(transitionState, model, messages);
		transitionState = result.state;
		const effects = heidrunCodeDashboardAnimationState.effects.filter((effect) => nowMs - effect.createdAtMs < EFFECT_LIFETIME_MS);
		if (heidrunCodeDashboardAnimationState.isPaused === false) {
			for (const transition of result.transitions) {
				effectCount += 1;
				const id = `heidrun_code_dashboard_effect_${effectCount}`;
				if (transition.kind === 'message') {
					const toNodeId = transition.message.to === null ? null : transition.message.to.nodeId;
					if (transition.message.from.nodeId === null && toNodeId === null) {
						continue;
					}
					effects.push({
						id,
						kind: 'message',
						message: transition.message,
						createdAtMs: nowMs,
					});
					continue;
				}
				effects.push({
					id,
					kind: transition.kind,
					nodeId: transition.nodeId,
					createdAtMs: nowMs,
				});
			}
		}
		const isChanged = effects.length !== heidrunCodeDashboardAnimationState.effects.length
			|| effects.some((effect, index) => effect !== heidrunCodeDashboardAnimationState.effects[index]);
		if (isChanged === true) {
			heidrunCodeDashboardAnimationState.effects = effects.slice(Math.max(0, effects.length - MAXIMUM_EFFECTS));
		}
	}

	/** Stops every animation, or starts them again. A pause removes the effects that are shown. */
	static togglePause(): void {
		heidrunCodeDashboardAnimationState.isPaused = heidrunCodeDashboardAnimationState.isPaused === false;
		if (heidrunCodeDashboardAnimationState.isPaused === true) {
			heidrunCodeDashboardAnimationState.effects = [];
		}
	}

	/**
	 * Removes one effect, at the end of its animation.
	 * @param effectId The identifier of the effect.
	 */
	static removeEffect(effectId: string): void {
		heidrunCodeDashboardAnimationState.effects = heidrunCodeDashboardAnimationState.effects.filter((effect) => effect.id !== effectId);
	}

	/**
	 * Tells whether the system asks for reduced motion.
	 * @returns True when the media query of reduced motion matches.
	 */
	static prefersReducedMotion(): boolean {
		if (typeof window.matchMedia !== 'function') {
			return false;
		}
		return window.matchMedia(HEIDRUN_CODE_DASHBOARD_REDUCED_MOTION_QUERY).matches === true;
	}
}
