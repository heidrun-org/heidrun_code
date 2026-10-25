//! The data shapes of the configuration of the coding agent: the memory files, the subagents, and the skills that the
//! developer, or a chat session, added to Claude Code and to Codex.

use crate::model::types::CodingAgent;
use serde::{Deserialize, Serialize};

/// One of the three kinds of the configuration of the coding agent. Each kind has its own table and its own JSON schema.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigurationKind {
    /// A memory file of Claude Code, in the folder `memory` of the project folder of Claude Code. The table `memory_files`.
    MemoryFile,
    /// A subagent of Claude Code, a file of a folder `.claude/agents`. The table `subagents`.
    Subagent,
    /// A skill, a folder with a file `SKILL.md` in a folder `skills`. The table `skills`.
    Skill,
}

impl ConfigurationKind {
    /// The three kinds, in the order of their tables.
    pub const ALL: [ConfigurationKind; 3] =
        [ConfigurationKind::MemoryFile, ConfigurationKind::Subagent, ConfigurationKind::Skill];

    /// The name of the table of the kind in the SQLite file.
    pub fn table_name(self) -> &'static str {
        match self {
            ConfigurationKind::MemoryFile => "memory_files",
            ConfigurationKind::Subagent => "subagents",
            ConfigurationKind::Skill => "skills",
        }
    }

    /// The kind in words, for the messages.
    pub fn description(self) -> &'static str {
        match self {
            ConfigurationKind::MemoryFile => "memory file",
            ConfigurationKind::Subagent => "subagent",
            ConfigurationKind::Skill => "skill",
        }
    }
}

/// Where a configuration item applies.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConfigurationScope {
    /// The item applies to the repository only: it is in a folder of the repository, or it is the memory of its folder.
    Project,
    /// The item applies to every repository of the developer: it is in the home folder of a coding agent.
    User,
}

/// The facts of one memory file, subagent, or skill, as the database stores them in the column `data` of its table. The files
/// `schemas/memory_file.schema.json`, `schemas/subagent.schema.json`, and `schemas/skill.schema.json` describe the same shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigurationItem {
    /// The absolute path of the file, or of the folder of a skill. It is the same text as the column `path` of the link table
    /// `chat_session_files`, so the chat sessions that wrote the file join on it.
    pub id: String,
    /// The coding agent that reads the item, or `None` for a folder `.agents` that several coding agents read.
    pub coding_agent: Option<CodingAgent>,
    /// Where the item applies.
    pub scope: ConfigurationScope,
    /// The absolute path of the folder that holds the item, for example `/work/app/.claude/skills`.
    pub folder: String,
    /// The field `name` of the header of the file, else the name of the file or of the folder.
    pub name: String,
    /// The field `description` of the header of the file, or `None` when the file has none.
    pub description: Option<String>,
    /// The date of the creation of the file, in the format ISO 8601. It is the date of the last change when the system does
    /// not give the date of the creation.
    pub created_at: String,
    /// The date of the last change of the file, in the format ISO 8601.
    pub updated_at: String,
    /// The date of the first synchronization that did not find the file any more, in the format ISO 8601, or `None` when the
    /// file is there.
    pub removed_at: Option<String>,
    /// The field `type` of the header of a memory file: `user`, `feedback`, `project`, or `reference`. Only a memory file has
    /// this field, and the file `MEMORY.md`, which is the index, has none.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub memory_type: Option<String>,
    /// The field `originSessionId` of the header of a memory file: the id of the chat session that wrote it. Only a memory
    /// file has this field.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin_chat_session_id: Option<String>,
}

/// The configuration items of one kind that a read found.
#[derive(Debug, Clone, PartialEq)]
pub struct ConfigurationRead {
    /// The kind of the items.
    pub kind: ConfigurationKind,
    /// The items, sorted by id.
    pub items: Vec<ConfigurationItem>,
}

/// What the write of the items of one kind did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigurationWriteCount {
    /// The kind of the items.
    pub kind: ConfigurationKind,
    /// The number of items that the write wrote: every item that the read found in the mode initialize, and only the new
    /// items and the items whose row changed in the mode update.
    pub written_count: usize,
    /// The number of rows that the write marked as removed, because the read did not find their file any more.
    pub removed_count: usize,
}
