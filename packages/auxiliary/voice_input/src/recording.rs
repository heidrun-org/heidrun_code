//! The recording of the microphone. The audio stays in memory: no file is written.

use crate::audio;
use crate::error::VoiceError;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, Sample, SizedSample};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

/// A recording never grows beyond this length, in seconds. It protects the memory when the developer forgets to stop a recording
/// that a click started. Fifteen minutes of audio at 48 kilohertz take about 173 megabytes.
pub const MAXIMUM_SECONDS: usize = 15 * 60;

/// The time between two level values, in milliseconds.
pub const LEVEL_INTERVAL_MILLISECONDS: u64 = 50;

/// A recording shorter than this has no speech: it is a click, in seconds.
pub const MINIMUM_SECONDS: f32 = 0.3;

/// A finished recording, in the format that Whisper reads.
#[derive(Debug, Clone, PartialEq)]
pub struct Recording {
    /// The audio at 16 kilohertz, in one channel.
    pub samples: Vec<f32>,
}

impl Recording {
    /// The length of the recording, in seconds.
    pub fn seconds(&self) -> f32 {
        self.samples.len() as f32 / audio::WHISPER_RATE as f32
    }
}

/// A recording that runs. The stream of the microphone lives in its own thread, because the stream of macOS cannot move from
/// one thread to another. `stop` ends the recording and gives the audio. Dropping the recorder cancels the recording.
pub struct Recorder {
    /// Tells the thread to stop. Dropping it tells the thread to stop too.
    stop_sender: mpsc::Sender<()>,
    /// The thread that holds the stream. It gives the recording when it ends.
    thread: JoinHandle<Result<Recording, VoiceError>>,
}

impl Recorder {
    /// Opens the default microphone and starts to record. It returns when the microphone runs, or with the reason why it does not.
    pub fn start() -> Result<Recorder, VoiceError> {
        Recorder::start_with_levels(|_| {})
    }

    /// Like `start`, and `on_level` runs every 50 milliseconds with the level of the voice since the last call, from 0 to 1, for
    /// the level bars of the window. It runs in the thread of the recorder, never in the audio thread of the microphone.
    pub fn start_with_levels(on_level: impl Fn(f32) + Send + 'static) -> Result<Recorder, VoiceError> {
        Recorder::start_limited(MAXIMUM_SECONDS, on_level)
    }

    /// Records for at most the selected duration, bounded by the recorder's memory limit.
    pub fn start_limited(maximum_seconds: usize, on_level: impl Fn(f32) + Send + 'static) -> Result<Recorder, VoiceError> {
        let maximum_seconds = maximum_seconds.clamp(1, MAXIMUM_SECONDS);
        let (ready_sender, ready_receiver) = mpsc::channel::<Result<(), VoiceError>>();
        let (stop_sender, stop_receiver) = mpsc::channel::<()>();
        let thread = std::thread::spawn(move || Recorder::run(ready_sender, stop_receiver, maximum_seconds, on_level));
        match ready_receiver.recv() {
            Ok(Ok(())) => Ok(Recorder { stop_sender, thread }),
            Ok(Err(error)) => {
                let _ = thread.join();
                Err(error)
            }
            Err(_) => Err(VoiceError::RecordingFailed("the recording thread ended at once".to_string())),
        }
    }

    /// Ends the recording and gives the audio. It fails with `NoSignal` when the microphone gave only exact zeros.
    pub fn stop(self) -> Result<Recording, VoiceError> {
        let _ = self.stop_sender.send(());
        match self.thread.join() {
            Ok(result) => result,
            Err(_) => Err(VoiceError::RecordingFailed("the recording thread panicked".to_string())),
        }
    }

    fn run(
        ready_sender: mpsc::Sender<Result<(), VoiceError>>,
        stop_receiver: mpsc::Receiver<()>,
        maximum_seconds: usize,
        on_level: impl Fn(f32),
    ) -> Result<Recording, VoiceError> {
        let captured: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let (stream, rate) = match Recorder::open(captured.clone(), maximum_seconds) {
            Ok(opened) => opened,
            Err(error) => {
                let _ = ready_sender.send(Err(error.clone()));
                return Err(error);
            }
        };
        let deadline = Instant::now() + Duration::from_secs(maximum_seconds as u64);
        let _ = ready_sender.send(Ok(()));
        let mut reported_samples = 0;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                break;
            }
            let interval = Duration::from_millis(LEVEL_INTERVAL_MILLISECONDS).min(remaining);
            if !matches!(stop_receiver.recv_timeout(interval), Err(mpsc::RecvTimeoutError::Timeout)) {
                break;
            }
            if let Ok(guard) = captured.lock() {
                on_level(audio::display_level(&guard[reported_samples.min(guard.len())..]));
                reported_samples = guard.len();
            }
        }
        drop(stream);
        let mono = match captured.lock() {
            Ok(guard) => guard.clone(),
            Err(_) => return Err(VoiceError::RecordingFailed("the audio buffer is broken".to_string())),
        };
        finish(&mono, rate)
    }

    fn open(captured: Arc<Mutex<Vec<f32>>>, maximum_seconds: usize) -> Result<(cpal::Stream, u32), VoiceError> {
        let host = cpal::default_host();
        let device = host.default_input_device().ok_or(VoiceError::NoMicrophone)?;
        let supported = device.default_input_config().map_err(map_error)?;
        let rate = supported.sample_rate();
        let format = supported.sample_format();
        let config: cpal::StreamConfig = supported.into();
        let maximum_samples = rate as usize * maximum_seconds;
        let stream = match format {
            cpal::SampleFormat::F32 => Recorder::build::<f32>(&device, config, captured, maximum_samples),
            cpal::SampleFormat::I16 => Recorder::build::<i16>(&device, config, captured, maximum_samples),
            cpal::SampleFormat::U16 => Recorder::build::<u16>(&device, config, captured, maximum_samples),
            cpal::SampleFormat::I32 => Recorder::build::<i32>(&device, config, captured, maximum_samples),
            other => return Err(VoiceError::RecordingFailed(format!("sample format {other:?}"))),
        }
        .map_err(map_error)?;
        stream.play().map_err(map_error)?;
        Ok((stream, rate))
    }

    fn build<T>(
        device: &cpal::Device,
        config: cpal::StreamConfig,
        captured: Arc<Mutex<Vec<f32>>>,
        maximum_samples: usize,
    ) -> Result<cpal::Stream, cpal::Error>
    where
        T: SizedSample,
        f32: FromSample<T>,
    {
        let channels = config.channels as usize;
        device.build_input_stream(
            config,
            move |data: &[T], _| {
                let floats: Vec<f32> = data.iter().map(|sample| f32::from_sample(*sample)).collect();
                let mono = audio::mix_to_mono(&floats, channels);
                if let Ok(mut guard) = captured.lock() {
                    let remaining = maximum_samples.saturating_sub(guard.len());
                    guard.extend(mono.into_iter().take(remaining));
                }
            },
            |error| eprintln!("voice input: the microphone stream reported {error}"),
            None,
        )
    }
}

/// Changes the audio of the microphone (one channel, at the rate of the microphone) into a recording for Whisper. A recording
/// of exact zeros is a failure: the permission is refused, or the microphone is off.
pub fn finish(mono: &[f32], rate: u32) -> Result<Recording, VoiceError> {
    if audio::is_digital_silence(mono) {
        return Err(VoiceError::NoSignal);
    }
    Ok(Recording { samples: audio::resample(mono, rate, audio::WHISPER_RATE) })
}

/// Changes an error of the audio library into an error of the voice input.
pub fn map_error(error: cpal::Error) -> VoiceError {
    match error.kind() {
        cpal::ErrorKind::PermissionDenied => VoiceError::MicrophoneDenied,
        cpal::ErrorKind::DeviceNotAvailable | cpal::ErrorKind::HostUnavailable => VoiceError::NoMicrophone,
        _ => VoiceError::RecordingFailed(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_recording_of_exact_zeros_is_a_failure_without_signal() {
        assert_eq!(finish(&vec![0.0; 48_000], 48_000), Err(VoiceError::NoSignal));
    }

    #[test]
    fn a_recording_with_a_little_noise_is_converted_to_16_kilohertz() {
        let mono: Vec<f32> = (0..48_000).map(|index| 0.001 * ((index % 7) as f32 - 3.0)).collect();
        let recording = finish(&mono, 48_000).unwrap();
        assert_eq!(recording.samples.len(), 16_000);
        assert!((recording.seconds() - 1.0).abs() < 0.001);
    }

    #[test]
    fn an_empty_recording_is_not_a_failure() {
        assert_eq!(finish(&[], 48_000).unwrap().samples.len(), 0);
    }

    /// Records one second of the real microphone. It asks the permission of macOS for the program that runs the test, so it runs
    /// only by hand: `cargo test live_ -- --ignored`.
    #[test]
    #[ignore]
    fn live_recording_of_one_second_has_a_signal() {
        let levels: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let sink = levels.clone();
        let recorder = Recorder::start_with_levels(move |level| sink.lock().unwrap().push(level)).unwrap();
        std::thread::sleep(std::time::Duration::from_secs(1));
        let recording = recorder.stop().unwrap();
        let levels = levels.lock().unwrap();
        assert!(levels.len() >= 15 && levels.len() <= 25, "{} levels in one second", levels.len());
        assert!(levels.iter().all(|level| (0.0..=1.0).contains(level)));
        assert!(recording.seconds() > 0.8 && recording.seconds() < 1.5, "{}", recording.seconds());
        assert!(audio::is_digital_silence(&recording.samples) == false);
    }
}
