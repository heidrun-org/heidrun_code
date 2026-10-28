import Fs from 'node:fs';
import Path from 'node:path';
import { MusicAnalyzer } from './music_analyzer.ts';
import { ProgramRunner } from './program_runner.ts';
import { PromotionalPictures } from './promotional_pictures.ts';
import type { RecordingTimeline } from './dino_run_types.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * What the filter graph of the program `ffmpeg` needs to know about the video.
 */
export type ComposeLayout = {
	/** The length of the gameplay video, in seconds. */
	gameSeconds: number;
	/** The times of the comic words in the gameplay video, in seconds after its start. */
	comicWordSeconds: number[];
	/** The time when the recorded sound starts, in seconds after the start of the gameplay video, or null for no sound. */
	soundStartSeconds: number | null;
	/** True when the intro has music. Its file is an input of the program `ffmpeg`, after the recorded sound. */
	hasIntroMusic: boolean;
	/**
	 * The time when the sound of the outro music ends, in seconds after the start of its file, or null when the outro
	 * has no music. The music file is an input of the program `ffmpeg`, after the intro music. The video ends when this
	 * sound ends.
	 */
	outroMusicSoundEndSeconds: number | null;
};

/**
 * The paths of the music files. A null path means no music in this part.
 */
export type MusicPaths = {
	/** The music of the intro. It fades out while the splash screen fades out. */
	intro: string | null;
	/** The music of the outro. It fades in with the outro card, and its last silence starts at the end of the video. */
	outro: string | null;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VideoComposer — puts the intro, the comic words, and the outro around the gameplay with ffmpeg
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Makes the final video from the video of the browser. The video has four parts: the real splash screen of the application for three seconds,
 * a crossfade to the start card of the game, the gameplay with a comic word at each shot, and, three seconds after the
 * hit, a fade to the outro card with the baby goat, the motto, and the address of the website.
 */
export class VideoComposer {
	/** The folder of the repository that holds the images and the identity texts. */
	private static readonly _REPOSITORY_FOLDER = Path.resolve(__dirname, '../../../..');

	/** The address of the website of Heidrun Code. The configuration of the website, `config.ts`, holds the same address. */
	private static readonly _WEBSITE_ADDRESS = 'https://heidrun-org.github.io/heidrun_code/';

	/** The width of the video, in pixels. */
	private static readonly _WIDTH = 1280;

	/** The height of the video, in pixels. */
	private static readonly _HEIGHT = 720;

	/** The number of pictures in each second. */
	private static readonly _FRAME_RATE = 25;

	/** The length of the intro, in seconds. The crossfade to the gameplay is inside this length. */
	private static readonly _INTRO_SECONDS = 3;

	/** The length of the crossfade from the splash image to the start card, in seconds. */
	private static readonly _INTRO_CROSSFADE_SECONDS = 1;

	/** The length of the outro, in seconds. The fade from the gameplay is inside this length. */
	private static readonly _OUTRO_SECONDS = 3;

	/** The length of the fade from the game over card to the outro card, in seconds. */
	private static readonly _OUTRO_CROSSFADE_SECONDS = 0.5;

	/** The time that a comic word stays on the video, in seconds. */
	private static readonly _COMIC_WORD_SECONDS = 0.45;

	/** The width of a comic word on the video, in pixels. */
	private static readonly _COMIC_WORD_WIDTH = 340;

	/** The gain of the recorded sound of the game. The game plays its sounds quietly, with a peak near -15 dB. */
	private static readonly _GAME_SOUND_VOLUME = 3;

	/** The volume of the intro music, from 0 to 1. */
	private static readonly _INTRO_MUSIC_VOLUME = 0.8;

	/** The volume of the outro music, from 0 to 1. The track is louder than the intro track, so the volume is lower. */
	private static readonly _OUTRO_MUSIC_VOLUME = 0.4;

	/** The word that shows at each shot. */
	private static readonly _COMIC_WORD = 'POW!';

	/**
	 * Makes the final video.
	 * @param timeline What the recorder gave back.
	 * @param outputFolder The folder that receives the final video and the pictures.
	 * @param videoName The name of the final video, without the extension.
	 * @param musicPaths The music files of the intro and of the outro.
	 * @returns The path of the final video.
	 */
	static async compose(
		timeline: RecordingTimeline,
		outputFolder: string,
		videoName: string,
		musicPaths: MusicPaths,
	): Promise<string> {
		const imagesFolder = Path.join(VideoComposer._REPOSITORY_FOLDER, 'data/images');
		const splashPath = Path.join(outputFolder, 'splash_screen.png');
		const identity = JSON.parse(Fs.readFileSync(Path.join(VideoComposer._REPOSITORY_FOLDER, 'data/identity.json'), 'utf8'));
		const comicWordPath = Path.join(outputFolder, 'comic_word.png');
		const outroCardPath = Path.join(outputFolder, 'outro_card.png');
		await PromotionalPictures.renderSplashScreen(VideoComposer._WIDTH, VideoComposer._HEIGHT, splashPath);
		await PromotionalPictures.renderComicWord(VideoComposer._COMIC_WORD, comicWordPath);
		await PromotionalPictures.renderOutroCard({
			babyGoatPath: Path.join(imagesFolder, 'baby_goat.png'),
			motto: identity.motto.en,
			address: VideoComposer._WEBSITE_ADDRESS,
			width: VideoComposer._WIDTH,
			height: VideoComposer._HEIGHT,
			outputPath: outroCardPath,
		});

		const gameplayPath = Path.join(outputFolder, 'gameplay.mp4');
		await ProgramRunner.run('ffmpeg', [
			...['-y', '-loglevel', 'error', '-ss', String(timeline.gameStartSeconds), '-i', timeline.rawVideoPath],
			...['-t', String(timeline.gameEndSeconds - timeline.gameStartSeconds)],
			...['-r', String(VideoComposer._FRAME_RATE), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', gameplayPath],
		]);
		const gameSeconds = await VideoComposer._readDuration(gameplayPath);
		const layout: ComposeLayout = {
			gameSeconds,
			comicWordSeconds: timeline.commandPresses
				.filter((commandPress) => commandPress.command === 'shoot')
				.map((commandPress) => commandPress.videoSeconds - timeline.gameStartSeconds),
			soundStartSeconds:
				timeline.recordedSound === null ? null : timeline.recordedSound.startSeconds - timeline.gameStartSeconds,
			hasIntroMusic: musicPaths.intro !== null,
			outroMusicSoundEndSeconds:
				musicPaths.outro === null ? null : await MusicAnalyzer.findSoundEndSeconds(musicPaths.outro),
		};
		const hasAudio = timeline.recordedSound !== null || musicPaths.intro !== null || musicPaths.outro !== null;

		const finalPath = Path.join(outputFolder, `${videoName}.mp4`);
		await ProgramRunner.run('ffmpeg', [
			...['-y', '-loglevel', 'error'],
			...VideoComposer._loopedInput(splashPath, VideoComposer._INTRO_SECONDS),
			...['-i', gameplayPath],
			...VideoComposer._loopedInput(comicWordPath, gameSeconds),
			...VideoComposer._loopedInput(outroCardPath, VideoComposer._OUTRO_SECONDS),
			...(timeline.recordedSound === null ? [] : ['-i', timeline.recordedSound.path]),
			...(musicPaths.intro === null ? [] : ['-i', musicPaths.intro]),
			...(musicPaths.outro === null ? [] : ['-i', musicPaths.outro]),
			...['-filter_complex', VideoComposer.buildFilterGraph(layout)],
			...['-map', '[video]', ...(hasAudio === false ? [] : ['-map', '[audio]', '-c:a', 'aac', '-b:a', '160k'])],
			...['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', finalPath],
		]);
		return finalPath;
	}

	/**
	 * Builds the filter graph of the program `ffmpeg`. The inputs are, in order: the splash screen picture, the gameplay video,
	 * the comic word, the outro card, and, when the scenario has sound, the recorded sound.
	 * @param layout The length of the gameplay video, the times of the comic words, and the start of the sound.
	 * @returns The filter graph.
	 */
	static buildFilterGraph(layout: ComposeLayout): string {
		const width = VideoComposer._WIDTH;
		const height = VideoComposer._HEIGHT;
		const frameRate = VideoComposer._FRAME_RATE;
		const introFadeOffset = VideoComposer._INTRO_SECONDS - VideoComposer._INTRO_CROSSFADE_SECONDS;
		const outroFadeOffset =
			introFadeOffset + layout.gameSeconds - VideoComposer._OUTRO_CROSSFADE_SECONDS;
		const lines: string[] = [
			// Intro: the picture of the real splash screen of the application.
			`[0:v]scale=${width}:${height},setsar=1,fps=${frameRate},format=yuv420p[intro]`,
			// Gameplay with one comic word at each shot.
			`[2:v]scale=${VideoComposer._COMIC_WORD_WIDTH}:-1,format=rgba,split=${Math.max(1, layout.comicWordSeconds.length)}${VideoComposer._labels('comicWord', layout.comicWordSeconds.length)}`,
			`[1:v]setsar=1,fps=${frameRate},format=yuv420p[gameplay0]`,
		];
		layout.comicWordSeconds.forEach((startSeconds, index) => {
			const x = 230 + (index % 2) * 40;
			const y = 330 - (index % 3) * 25;
			const endSeconds = startSeconds + VideoComposer._COMIC_WORD_SECONDS;
			lines.push(
				`[gameplay${index}][comicWord${index}]overlay=${x}:${y}:format=auto:enable='between(t,${startSeconds.toFixed(3)},${endSeconds.toFixed(3)})'[gameplay${index + 1}]`,
			);
		});
		lines.push(
			`[gameplay${layout.comicWordSeconds.length}]null[gameplay]`,
			`[3:v]setsar=1,fps=${frameRate},format=yuv420p[outro]`,
			`[intro][gameplay]xfade=transition=fade:duration=${VideoComposer._INTRO_CROSSFADE_SECONDS}:offset=${introFadeOffset}[introAndGameplay]`,
			`[introAndGameplay][outro]xfade=transition=fade:duration=${VideoComposer._OUTRO_CROSSFADE_SECONDS}:offset=${outroFadeOffset.toFixed(3)}[video]`,
		);
		const totalSeconds = outroFadeOffset + VideoComposer._OUTRO_SECONDS;
		// A silent track of the exact length of the video is the base of the mix: it never ends early, as a padded input can.
		const audioLabels: string[] = ['[silence]'];
		let nextInputIndex = 4;
		if (layout.soundStartSeconds !== null) {
			const delayMilliseconds = Math.max(0, Math.round((introFadeOffset + layout.soundStartSeconds) * 1000));
			// The browser writes no audio packet while the page is silent, so the option async=1 fills each gap with silence.
			lines.push(
				`[${nextInputIndex}:a]aresample=48000:async=1:first_pts=0,volume=${VideoComposer._GAME_SOUND_VOLUME},` +
					`adelay=${delayMilliseconds}:all=1[gameSound]`,
			);
			audioLabels.push('[gameSound]');
			nextInputIndex++;
		}
		if (layout.hasIntroMusic === true) {
			// The music fades out during the crossfade of the picture, so both end together.
			lines.push(
				`[${nextInputIndex}:a]aresample=48000,atrim=0:${VideoComposer._INTRO_SECONDS},` +
					`afade=t=out:st=${introFadeOffset}:d=${VideoComposer._INTRO_CROSSFADE_SECONDS},` +
					`volume=${VideoComposer._INTRO_MUSIC_VOLUME}[introMusic]`,
			);
			audioLabels.push('[introMusic]');
			nextInputIndex++;
		}
		if (layout.outroMusicSoundEndSeconds !== null) {
			// The last seconds of the music play in the outro, and the end of the sound is the end of the video. A track
			// that ends with a silence ends in its own way, so this music has no fade-out.
			const musicSeconds = Math.min(layout.outroMusicSoundEndSeconds, VideoComposer._OUTRO_SECONDS);
			const trimStartSeconds = layout.outroMusicSoundEndSeconds - musicSeconds;
			const delayMilliseconds = Math.round((outroFadeOffset + VideoComposer._OUTRO_SECONDS - musicSeconds) * 1000);
			const fadeInSeconds = Math.min(VideoComposer._OUTRO_CROSSFADE_SECONDS, musicSeconds);
			lines.push(
				`[${nextInputIndex}:a]aresample=48000,` +
					`atrim=start=${trimStartSeconds.toFixed(3)}:end=${layout.outroMusicSoundEndSeconds.toFixed(3)},asetpts=PTS-STARTPTS,` +
					`afade=t=in:st=0:d=${fadeInSeconds},volume=${VideoComposer._OUTRO_MUSIC_VOLUME},` +
					`adelay=${delayMilliseconds}:all=1[outroMusic]`,
			);
			audioLabels.push('[outroMusic]');
			nextInputIndex++;
		}
		if (audioLabels.length > 1) {
			lines.push(
				`anullsrc=channel_layout=stereo:sample_rate=48000:duration=${totalSeconds.toFixed(3)}[silence]`,
				`${audioLabels.join('')}amix=inputs=${audioLabels.length}:duration=first:normalize=0[audio]`,
			);
		}
		return lines.join(';\n');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Makes the input arguments that repeat a picture for a time.
	 * @param path The path of the picture.
	 * @param seconds The time, in seconds.
	 * @returns The arguments of the program `ffmpeg`.
	 */
	private static _loopedInput(path: string, seconds: number): string[] {
		return ['-loop', '1', '-framerate', String(VideoComposer._FRAME_RATE), '-t', String(seconds), '-i', path];
	}

	/**
	 * Writes the output labels of a `split` filter.
	 * @param prefix The start of each label.
	 * @param count The number of outputs. With no output, the split still has one output, which nothing uses.
	 * @returns The labels, for example `[comicWord0][comicWord1]`.
	 */
	private static _labels(prefix: string, count: number): string {
		const labels: string[] = [];
		for (let index = 0; index < Math.max(1, count); index++) {
			labels.push(`[${prefix}${index}]`);
		}
		return labels.join('');
	}

	/**
	 * Reads the length of a video file with the program `ffprobe`.
	 * @param path The path of the video file.
	 * @returns The length, in seconds.
	 */
	private static async _readDuration(path: string): Promise<number> {
		const { standardOutput: output } = await ProgramRunner.run('ffprobe', [
			...['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
		]);
		return Number.parseFloat(output.trim());
	}
}
