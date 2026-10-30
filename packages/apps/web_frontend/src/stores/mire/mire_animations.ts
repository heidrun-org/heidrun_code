import { reactive, watch, type WatchStopHandle } from 'vue';
import type { MireMessage, MireModel } from '../../lib/mire/mire_model_types';
import { MireTransitions, type MireTransitionState } from '../../lib/mire/mire_transitions';
import { mireMessages, mireModel, mireState } from './mire_store';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireAnimations — the pause and the short effects of the real transitions of the open Mire view
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The media query of the system setting that asks for reduced motion. */
export const MIRE_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** The largest number of effects shown at the same time. A new effect removes the oldest one. */
const MAXIMUM_EFFECTS = 40;

/**
 * The longest life of an effect, in milliseconds. The graph removes an effect at the end of its animation; an effect
 * that is not drawn (its node is hidden by the filter) goes away at the next model after this time.
 */
const EFFECT_LIFETIME_MS = 6_000;

/** One short effect of the graph, for one real transition. */
export type MireEffect =
	| {
		/** The identifier of the effect. */
		id: string;
		/** `completed`: a single burst. `blocked`: a single red flash. */
		kind: 'completed' | 'blocked';
		/** The node identifier of the coding agent or of the subagent. */
		nodeId: string;
		/** When the effect started, from the clock of the Mire store. */
		createdAtMs: number;
	}
	| {
		/** The identifier of the effect. */
		id: string;
		/** A new message. */
		kind: 'message';
		/** The message. */
		message: MireMessage;
		/** When the effect started, from the clock of the Mire store. */
		createdAtMs: number;
	};

/** The state of the animations of the Mire views of this window. */
export const mireAnimationState = reactive({
	/** True when every animation is stopped. The data keeps updating. */
	isPaused: false,
	/** The short effects that the graph draws now. */
	effects: [] as MireEffect[],
});

/** The state of the previous models of the open view, or null before its first model. */
let transitionState: MireTransitionState | null = null;

/** The number of effects created, to give each effect its own identifier. */
let effectCount = 0;

/** The pause and the effects of the real transitions of the Mire. */
export class MireAnimations {
	/**
	 * Starts to follow the model of the view that opens. The first model gives no effect. The view starts paused when
	 * the system asks for reduced motion.
	 * @returns The function that stops the follower and removes every effect, for the view that closes.
	 */
	static start(): WatchStopHandle {
		transitionState = null;
		mireAnimationState.effects = [];
		if (MireAnimations.prefersReducedMotion() === true) {
			mireAnimationState.isPaused = true;
		}
		const stopWatch = watch(
			[mireModel, mireMessages],
			([model, messages]) => {
				MireAnimations.observe(model, messages, mireState.nowMs);
			},
			{
				immediate: true,
			},
		);
		return () => {
			stopWatch();
			transitionState = null;
			mireAnimationState.effects = [];
		};
	}

	/**
	 * Compares a new model with the previous ones, and adds one effect for each real transition, unless the animations
	 * are paused. The seen messages and the known statuses advance also during a pause, so that a resume replays nothing.
	 * @param model The new Mire model.
	 * @param messages The messages of the same observations.
	 * @param nowMs The time of the clock of the Mire store.
	 */
	static observe(model: MireModel, messages: MireMessage[], nowMs: number): void {
		const result = MireTransitions.compare(transitionState, model, messages);
		transitionState = result.state;
		const effects = mireAnimationState.effects.filter((effect) => nowMs - effect.createdAtMs < EFFECT_LIFETIME_MS);
		if (mireAnimationState.isPaused === false) {
			for (const transition of result.transitions) {
				effectCount += 1;
				const id = `mire_effect_${effectCount}`;
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
		const isChanged = effects.length !== mireAnimationState.effects.length
			|| effects.some((effect, index) => effect !== mireAnimationState.effects[index]);
		if (isChanged === true) {
			mireAnimationState.effects = effects.slice(Math.max(0, effects.length - MAXIMUM_EFFECTS));
		}
	}

	/** Stops every animation, or starts them again. A pause removes the effects that are shown. */
	static togglePause(): void {
		mireAnimationState.isPaused = mireAnimationState.isPaused === false;
		if (mireAnimationState.isPaused === true) {
			mireAnimationState.effects = [];
		}
	}

	/**
	 * Removes one effect, at the end of its animation.
	 * @param effectId The identifier of the effect.
	 */
	static removeEffect(effectId: string): void {
		mireAnimationState.effects = mireAnimationState.effects.filter((effect) => effect.id !== effectId);
	}

	/**
	 * Tells whether the system asks for reduced motion.
	 * @returns True when the media query of reduced motion matches.
	 */
	static prefersReducedMotion(): boolean {
		if (typeof window.matchMedia !== 'function') {
			return false;
		}
		return window.matchMedia(MIRE_REDUCED_MOTION_QUERY).matches === true;
	}
}
