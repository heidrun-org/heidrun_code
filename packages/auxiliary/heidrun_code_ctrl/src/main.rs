//! The command line for Heidrun Code macros, launchers, voice words, and workspaces.

mod command_line;
mod workspaces;

use command_line::{find_format, parse, CommonOptions, Parsed, TextInput, HELP};
use heidrun_code_ctrl::{
    add_launcher, add_macro, add_voice_word, changed_text, delete_launcher, delete_macro, delete_voice_word, deleted_text,
    error_text, find_project_root, launcher_changed_text, launcher_deleted_text, launcher_list_text, list_launchers, list_macros,
    list_text, list_voice_words, personal_macros_path, update_launcher, update_macro, update_voice_word, voice_word_changed_text,
    voice_word_deleted_text, voice_word_list_text, voice_words_path, Format, LauncherChanges, MacroChanges, MacroPlaces, NewLauncher,
    NewMacro, NewVoiceWord, VoiceWordChanges,
};
use std::io::Read;
use std::process::ExitCode;

/// The root of the project that holds the folder of the options, or else the current folder.
fn project_root_of(common: &CommonOptions) -> Result<std::path::PathBuf, String> {
    let folder = match &common.folder {
        Some(folder) => std::path::PathBuf::from(folder),
        None => std::env::current_dir().map_err(|error| format!("The current folder cannot be read: {error}"))?,
    };
    let absolute =
        std::path::absolute(&folder).map_err(|error| format!("The path {} cannot be made absolute: {error}", folder.display()))?;
    Ok(find_project_root(&absolute))
}

/// The two files that the orders on the macros read and change: the file of the personal macros, and the file of the
/// project.
fn places_of(common: &CommonOptions) -> Result<MacroPlaces, String> {
    Ok(MacroPlaces { personal_file: personal_macros_path(), project_root: project_root_of(common)? })
}

/// A text: the argument, or the standard input with one new line at its end removed.
fn text_of(input: TextInput) -> Result<String, String> {
    match input {
        TextInput::Given(text) => Ok(text),
        TextInput::StandardInput => {
            let mut text = String::new();
            std::io::stdin().read_to_string(&mut text).map_err(|error| format!("The standard input cannot be read: {error}"))?;
            if text.ends_with("\r\n") {
                text.truncate(text.len() - 2);
            } else if text.ends_with('\n') {
                text.truncate(text.len() - 1);
            }
            Ok(text)
        }
    }
}

/// Runs the order that the arguments ask for, and gives the text to print on the standard output.
fn run(arguments: &[String]) -> Result<String, String> {
    match parse(arguments)? {
        Parsed::Help => Ok(HELP.to_string()),
        Parsed::Workspace { common, session, command } => workspaces::run(command, session.as_deref(), common.format),
        Parsed::List { common, kind } => {
            let places = places_of(&common)?;
            let listed: Vec<_> = list_macros(&places)?.into_iter().filter(|item| kind.is_none_or(|wanted| wanted == item.kind)).collect();
            Ok(list_text(&listed, &places, kind, common.format))
        }
        Parsed::Add { common, kind, id, label, description, text } => {
            let places = places_of(&common)?;
            let new = NewMacro { id, label, description, text: text_of(text)? };
            Ok(changed_text("Added", &add_macro(&places, kind, new)?, common.format))
        }
        Parsed::Update { common, id, kind, label, description, text } => {
            let places = places_of(&common)?;
            let text = text.map(text_of).transpose()?;
            let updated = update_macro(&places, &id, kind, MacroChanges { label, description, text })?;
            Ok(changed_text("Updated", &updated, common.format))
        }
        Parsed::Delete { common, id, kind } => {
            let places = places_of(&common)?;
            Ok(deleted_text(&delete_macro(&places, &id, kind)?, common.format))
        }
        Parsed::LauncherList { common } => {
            let root = project_root_of(&common)?;
            Ok(launcher_list_text(&list_launchers(&root)?, &root, common.format))
        }
        Parsed::LauncherAdd { common, id, label, command, description, cwd } => {
            let root = project_root_of(&common)?;
            let new = NewLauncher { id, label, command: text_of(command)?, description, cwd };
            Ok(launcher_changed_text("Added", &add_launcher(&root, new)?, &root, common.format))
        }
        Parsed::LauncherUpdate { common, id, label, command, description, cwd } => {
            let root = project_root_of(&common)?;
            let command = command.map(text_of).transpose()?;
            let updated = update_launcher(&root, &id, LauncherChanges { label, command, description, cwd })?;
            Ok(launcher_changed_text("Updated", &updated, &root, common.format))
        }
        Parsed::LauncherDelete { common, id } => {
            let root = project_root_of(&common)?;
            Ok(launcher_deleted_text(&delete_launcher(&root, &id)?, common.format))
        }
        Parsed::VoiceWordList { common } => {
            let file = voice_words_path();
            Ok(voice_word_list_text(&list_voice_words(&file)?, &file, common.format))
        }
        Parsed::VoiceWordAdd { common, id, whisper_writes, heidrun_writes } => {
            let file = voice_words_path();
            let added = add_voice_word(&file, NewVoiceWord { id, whisper_writes, heidrun_writes })?;
            Ok(voice_word_changed_text("Added", &added, &file, common.format))
        }
        Parsed::VoiceWordUpdate { common, id, whisper_writes, heidrun_writes } => {
            let file = voice_words_path();
            let updated = update_voice_word(&file, &id, VoiceWordChanges { whisper_writes, heidrun_writes })?;
            Ok(voice_word_changed_text("Updated", &updated, &file, common.format))
        }
        Parsed::VoiceWordDelete { common, id } => {
            let file = voice_words_path();
            Ok(voice_word_deleted_text(&delete_voice_word(&file, &id)?, common.format))
        }
    }
}

fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let format =
        if command_line::is_workspace_command(&arguments) { Format::Json } else { find_format(&arguments).unwrap_or(Format::Markdown) };
    match run(&arguments) {
        Ok(text) => {
            print!("{text}");
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("{}", error_text(&message, format));
            ExitCode::FAILURE
        }
    }
}
