//! The frontmatter of a SKILL.md file.


/// The `name` of the frontmatter of a `SKILL.md` text: the identifier of the skill on skills.sh.
pub(super) fn parse_name(text: &str) -> Option<String> {
    let rest = text.trim_start_matches('\u{feff}').strip_prefix("---")?;
    let end = rest.find("\n---")?;
    rest[..end].lines().find_map(|line| {
        let (key, value) = line.split_once(':')?;
        let value = value.trim().trim_matches(|c| c == '"' || c == '\'');
        (key.trim() == "name" && value.is_empty() == false).then(|| value.to_string())
    })
}

/// The `description` of the frontmatter of a `SKILL.md` text (simple YAML only: one line).
pub(super) fn parse_description(text: &str) -> String {
    let Some(rest) = text.trim_start_matches('\u{feff}').strip_prefix("---") else {
        return String::new();
    };
    let Some(end) = rest.find("\n---") else {
        return String::new();
    };
    for line in rest[..end].lines() {
        if let Some(("description", value)) = line.split_once(':').map(|(k, v)| (k.trim(), v)) {
            return value.trim().trim_matches(|c| c == '"' || c == '\'').replace("\\n", " ");
        }
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_name_of_the_frontmatter() {
        assert_eq!(parse_name("---\nname: ai-sdk\ndescription: x\n---\n"), Some("ai-sdk".into()));
        assert_eq!(parse_name("---\nname: \"quoted\"\n---\n"), Some("quoted".into()));
        assert_eq!(parse_name("---\ndescription: x\n---\n"), None);
        assert_eq!(parse_name("# no frontmatter"), None);
    }

    #[test]
    fn reads_the_description_of_the_frontmatter() {
        let text = "---\nname: pdf\ndescription: \"Read, merge, and split PDF files.\"\n---\n# PDF";
        assert_eq!(parse_description(text), "Read, merge, and split PDF files.");
        assert_eq!(parse_description("# no frontmatter"), "");
    }
}
