//! The word replacement list: the change of the words that Whisper writes wrongly, in the text that Whisper gave.
//!
//! This file holds one pure function. It reads no file and knows nothing about Tauri: the caller gives the list.

/// The most passes that `replace_words` makes over the text. A list that still changes the text after this number of passes
/// loops, and `replace_words` then gives the text of the first pass.
const MAXIMUM_PASSES: usize = 10;

/// After the first pass, a pass that makes the text longer than this number of times its original length, plus
/// `MINIMUM_GROWTH_LIMIT`, is stopped at once: a replacement that grows at each pass loops too. This keeps the memory small
/// even when a replacement is much longer than its entry.
const MAXIMUM_GROWTH_FACTOR: usize = 10;

/// The number of bytes that a text may grow to after the first pass, whatever its original length.
const MINIMUM_GROWTH_LIMIT: usize = 10_000;

/// One entry of the list, ready to match: the text that Whisper writes in lower case, and the text that replaces it.
struct Entry<'a> {
    /// The text that Whisper writes, folded to lower case. The spaces at its ends are part of the text.
    folded: Vec<char>,
    /// The text that Heidrun Code writes instead.
    replacement: &'a str,
    /// The entry starts with a letter or a digit, so it must not start inside a longer word.
    is_start_checked: bool,
    /// The entry ends with a letter or a digit, so it must not end inside a longer word.
    is_end_checked: bool,
}

/// Replaces each listed text by its replacement, and repeats until no entry matches any more. The text of a replacement can
/// match another entry: with the entries "hadron" to "Heidrun" and "heidrun card" to "Heidrun Code", the text "hadron card"
/// becomes "Heidrun Code".
///
/// - A pass goes from left to right, and the text that a pass just wrote is not matched again in the same pass.
/// - The passes stop when a pass changes nothing. After `MAXIMUM_PASSES` passes that still change the text, or when a pass
///   after the first one makes the text longer than `MAXIMUM_GROWTH_FACTOR` times its original length plus
///   `MINIMUM_GROWTH_LIMIT` bytes, the list loops (for example "a" to "b" and "b" to "a", or "cat" to "cat cat"). The result is
///   then the text of the first pass. The function always ends: it makes at most `MAXIMUM_PASSES` + 1 passes, and each pass
///   moves forward by at least one character.
///
/// - An entry matches a whole word or a whole group of words only. An entry that starts (or ends) with a letter or a digit
///   never matches inside a longer word. An entry that starts (or ends) with a space or a sign is cut by that space or that
///   sign, so it is not checked on that side.
/// - The matching ignores upper case and lower case.
/// - When two entries match at the same place, the longer entry wins. Between two entries of the same length, the first
///   entry of the list wins.
/// - An entry with no text, or with only spaces, is ignored.
///
/// `pairs` is the list: the text that Whisper writes, then the text that Heidrun Code writes instead.
pub fn replace_words(text: &str, pairs: &[(String, String)]) -> String {
    let entries = compile_entries(pairs);
    if entries.is_empty() {
        return text.to_string();
    }
    let growth_limit = text.len() * MAXIMUM_GROWTH_FACTOR + MINIMUM_GROWTH_LIMIT;
    let mut current = text.to_string();
    let mut first_pass: Option<String> = None;
    for _ in 0..=MAXIMUM_PASSES {
        let limit = if first_pass.is_none() { usize::MAX } else { growth_limit };
        let Some(next) = replace_once(&current, &entries, limit) else {
            break;
        };
        if next == current {
            return current;
        }
        first_pass.get_or_insert_with(|| next.clone());
        current = next;
    }
    first_pass.unwrap_or(current)
}

/// The entries of the list that can match: the ones with a text that is not empty and not only spaces.
fn compile_entries(pairs: &[(String, String)]) -> Vec<Entry<'_>> {
    pairs
        .iter()
        .filter(|(whisper_writes, _)| whisper_writes.trim().is_empty() == false)
        .map(|(whisper_writes, heidrun_writes)| {
            let characters: Vec<char> = whisper_writes.chars().collect();
            Entry {
                is_start_checked: characters.first().is_some_and(|character| is_word_character(*character)),
                is_end_checked: characters.last().is_some_and(|character| is_word_character(*character)),
                folded: characters.into_iter().map(fold).collect(),
                replacement: heidrun_writes,
            }
        })
        .collect()
}

/// One pass over the text, from left to right. The text that the pass writes is not matched again in the same pass. The pass
/// stops at once and gives `None` when the new text is longer than `limit` bytes.
fn replace_once(text: &str, entries: &[Entry], limit: usize) -> Option<String> {
    let characters: Vec<char> = text.chars().collect();
    let folded: Vec<char> = characters.iter().map(|character| fold(*character)).collect();
    let mut result = String::with_capacity(text.len());
    let mut position = 0;
    while position < characters.len() {
        match longest_match_at(&characters, &folded, position, &entries) {
            Some(entry) => {
                result.push_str(entry.replacement);
                position += entry.folded.len();
            }
            None => {
                result.push(characters[position]);
                position += 1;
            }
        }
        if result.len() > limit {
            return None;
        }
    }
    Some(result)
}

/// The longest entry that matches at `position`, or `None`. The first of two entries of the same length wins.
fn longest_match_at<'a, 'b>(characters: &[char], folded: &[char], position: usize, entries: &'b [Entry<'a>]) -> Option<&'b Entry<'a>> {
    let mut best: Option<&Entry> = None;
    for entry in entries {
        let end = position + entry.folded.len();
        if end > folded.len() || folded[position..end] != entry.folded[..] {
            continue;
        }
        if entry.is_start_checked && position > 0 && is_word_character(characters[position - 1]) {
            continue;
        }
        if entry.is_end_checked && end < characters.len() && is_word_character(characters[end]) {
            continue;
        }
        if best.is_none_or(|current| entry.folded.len() > current.folded.len()) {
            best = Some(entry);
        }
    }
    best
}

/// A letter or a digit: the characters that a word is made of.
fn is_word_character(character: char) -> bool {
    character.is_alphanumeric()
}

/// The character in lower case. A character whose lower case is not one character stays as it is, so the folded text has the
/// same length as the original text.
fn fold(character: char) -> char {
    let mut lower = character.to_lowercase();
    match (lower.next(), lower.next()) {
        (Some(one), None) => one,
        _ => character,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pairs(list: &[(&str, &str)]) -> Vec<(String, String)> {
        list.iter().map(|(whisper_writes, heidrun_writes)| (whisper_writes.to_string(), heidrun_writes.to_string())).collect()
    }

    #[test]
    fn a_listed_word_is_replaced() {
        assert_eq!(replace_words("ask jerome today", &pairs(&[("jerome", "Jérôme")])), "ask Jérôme today");
    }

    #[test]
    fn a_group_of_words_is_replaced() {
        assert_eq!(replace_words("open the type script file", &pairs(&[("type script", "TypeScript")])), "open the TypeScript file");
    }

    #[test]
    fn an_empty_list_gives_the_same_text() {
        assert_eq!(replace_words("Hello world", &[]), "Hello world");
        assert_eq!(replace_words("", &pairs(&[("a", "b")])), "");
    }

    #[test]
    fn an_entry_never_matches_a_part_of_a_longer_word() {
        let list = pairs(&[("cat", "dog")]);
        assert_eq!(replace_words("category concat cats cat", &list), "category concat cats dog");
        assert_eq!(replace_words("scat, cat. (cat) cat's", &list), "scat, dog. (dog) dog's");
    }

    #[test]
    fn the_matching_ignores_upper_case_and_lower_case() {
        let list = pairs(&[("Jerome Etienne", "Jérôme Étienne")]);
        assert_eq!(replace_words("by JEROME etienne and jerome ETIENNE", &list), "by Jérôme Étienne and Jérôme Étienne");
        assert_eq!(replace_words("ÉCOLE école", &pairs(&[("école", "school")])), "school school");
    }

    #[test]
    fn an_entry_at_the_start_and_at_the_end_of_the_text_matches() {
        let list = pairs(&[("hello", "Hi")]);
        assert_eq!(replace_words("hello", &list), "Hi");
        assert_eq!(replace_words("hello and hello", &list), "Hi and Hi");
    }

    #[test]
    fn the_longest_entry_wins_at_the_same_place() {
        let list = pairs(&[("new", "N"), ("new york", "NYC"), ("new york city", "NYC!")]);
        assert_eq!(replace_words("in new york city and new york and new", &list), "in NYC! and NYC and N");
    }

    #[test]
    fn the_first_of_two_entries_of_the_same_length_wins() {
        assert_eq!(replace_words("word", &pairs(&[("word", "first"), ("WORD", "second")])), "first");
    }

    #[test]
    fn a_replacement_is_matched_again_until_no_entry_matches() {
        let list = pairs(&[("hadron", "Heidrun"), ("heidrun card", "Heidrun Code")]);
        assert_eq!(replace_words("hadron card", &list), "Heidrun Code");
        assert_eq!(replace_words("the Hadron Card is here", &list), "the Heidrun Code is here");
    }

    #[test]
    fn the_order_of_the_entries_does_not_change_a_chain() {
        let list = pairs(&[("heidrun card", "Heidrun Code"), ("hadron", "Heidrun")]);
        assert_eq!(replace_words("hadron card", &list), "Heidrun Code");
    }

    #[test]
    fn a_chain_of_ten_passes_is_followed_to_its_end() {
        let steps: Vec<(String, String)> = (0..10).map(|index| (format!("w{index}"), format!("w{}", index + 1))).collect();
        assert_eq!(replace_words("w0 w9", &steps), "w10 w10");
    }

    #[test]
    fn a_list_that_loops_gives_the_text_of_the_first_pass() {
        assert_eq!(replace_words("a b", &pairs(&[("a", "b"), ("b", "a")])), "b a");
        assert_eq!(replace_words("cat", &pairs(&[("cat", "cat cat")])), "cat cat");
        let too_long: Vec<(String, String)> = (0..11).map(|index| (format!("w{index}"), format!("w{}", index + 1))).collect();
        assert_eq!(replace_words("w0", &too_long), "w1");
    }

    #[test]
    fn a_replacement_that_grows_at_each_pass_is_stopped_early_and_gives_the_text_of_the_first_pass() {
        let text = "a ".repeat(2500);
        let replacement = "a ".repeat(32);
        let list = pairs(&[("a", &replacement)]);
        let result = replace_words(&text, &list);
        assert_eq!(result, text.replace('a', &replacement));
        assert_eq!(result.len(), 2500 * (64 + 1));
    }

    #[test]
    fn a_very_long_replacement_does_not_blow_up_the_memory() {
        let text = "a ".repeat(2500);
        let replacement = format!("a {}", "b".repeat(1000));
        let list = pairs(&[("a", &replacement)]);
        let result = replace_words(&text, &list);
        assert_eq!(result, text.replace('a', &replacement));
        assert_eq!(result.len(), 2500 * (2 + 1000 + 1));
    }

    #[test]
    fn two_lists_that_loop_by_pairs_end_with_the_text_of_the_first_pass() {
        let list = pairs(&[("x y", "y x"), ("y x", "x y")]);
        assert_eq!(replace_words("x y and y x", &list), "y x and x y");
    }

    #[test]
    fn every_random_list_ends_with_a_text_that_no_entry_changes_or_with_the_text_of_the_first_pass() {
        let mut state: u64 = 12345;
        let mut next = |bound: usize| -> usize {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            ((state >> 33) as usize) % bound
        };
        let alphabet = ['a', 'b', 'c', ' '];
        let word = |next: &mut dyn FnMut(usize) -> usize, longest: usize| -> String {
            (0..next(longest + 1)).map(|_| alphabet[next(alphabet.len())]).collect()
        };
        let mut settled = 0;
        let mut looping = 0;
        for _ in 0..3000 {
            let list: Vec<(String, String)> = (0..1 + next(4)).map(|_| (word(&mut next, 3), word(&mut next, 5))).collect();
            let text = word(&mut next, 24);
            let result = replace_words(&text, &list);
            let entries = compile_entries(&list);
            let first = replace_once(&text, &entries, usize::MAX).unwrap();
            let is_settled = replace_once(&result, &entries, usize::MAX).as_deref() == Some(result.as_str());
            assert!(is_settled || result == first, "list {list:?} text {text:?} result {result:?}");
            assert!(result.len() <= first.len().max(text.len() * MAXIMUM_GROWTH_FACTOR + MINIMUM_GROWTH_LIMIT));
            if is_settled {
                settled += 1;
            } else {
                looping += 1;
            }
        }
        assert!(settled > 1000 && looping > 0, "settled {settled}, looping {looping}");
    }

    #[test]
    fn a_replacement_that_matches_nothing_else_is_written_once() {
        assert_eq!(replace_words("jerome", &pairs(&[("jerome", "Jérôme")])), "Jérôme");
        assert_eq!(replace_words("name at sign example", &pairs(&[(" at sign ", "@")])), "name@example");
    }

    #[test]
    fn spaces_at_the_ends_of_an_entry_are_part_of_the_text_and_the_replacement_can_remove_them() {
        let with_spaces = pairs(&[(" at sign ", "@")]);
        assert_eq!(replace_words("name at sign example", &with_spaces), "name@example");
        let without_spaces = pairs(&[("at sign", "@")]);
        assert_eq!(replace_words("name at sign example", &without_spaces), "name @ example");
    }

    #[test]
    fn an_entry_with_a_space_at_one_end_needs_that_space_in_the_text() {
        let list = pairs(&[(" dot ", ".")]);
        assert_eq!(replace_words("file dot txt", &list), "file.txt");
        assert_eq!(replace_words("dot", &list), "dot");
        assert_eq!(replace_words("a dotted line", &list), "a dotted line");
    }

    #[test]
    fn an_entry_that_ends_with_a_sign_is_checked_only_at_its_start() {
        let list = pairs(&[("c++", "C++")]);
        assert_eq!(replace_words("write c++ code, not abc++", &list), "write C++ code, not abc++");
        assert_eq!(replace_words("c+++", &list), "C+++");
    }

    #[test]
    fn a_replacement_can_be_empty() {
        assert_eq!(replace_words("well um yes", &pairs(&[(" um", "")])), "well yes");
    }

    #[test]
    fn an_entry_with_no_text_or_only_spaces_is_ignored() {
        assert_eq!(replace_words("a b c", &pairs(&[("", "X"), ("  ", "Y")])), "a b c");
    }

    #[test]
    fn a_letter_with_accents_and_a_digit_belong_to_a_word() {
        let list = pairs(&[("a", "A"), ("3", "three")]);
        assert_eq!(replace_words("é a a1 3 b3", &list), "é A a1 three b3");
    }
}
