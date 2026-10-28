//! The identifiers of new items: a base name, a dash, and characters that change with the time.

/// An id that is not in `taken`: `base`, a dash, and `suffix_length` characters from 0 to 9 and from a to z that change
/// with the time and with the process. It is the same shape as the id that the window makes.
pub(crate) fn unused_id(base: &str, suffix_length: usize, taken: &[String]) -> String {
    let mut state = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|time| time.as_nanos() as u64).unwrap_or(0)
        ^ u64::from(std::process::id());
    loop {
        let mut suffix = String::new();
        for _ in 0..suffix_length {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            suffix.push(char::from_digit(((state >> 33) % 36) as u32, 36).unwrap_or('x'));
        }
        let id = format!("{base}-{suffix}");
        if !taken.contains(&id) {
            return id;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_id_is_the_base_a_dash_and_the_asked_number_of_characters() {
        let id = unused_id("run-the-tests", 4, &[]);
        let (base, suffix) = id.rsplit_once('-').unwrap();
        assert_eq!(base, "run-the-tests");
        assert_eq!(suffix.len(), 4);
        assert!(suffix.chars().all(|character| character.is_ascii_digit() || character.is_ascii_lowercase()));
    }

    #[test]
    fn the_id_is_never_one_of_the_taken_ids() {
        let taken: Vec<String> = (0..35).map(|digit| format!("a-{}", char::from_digit(digit, 36).unwrap())).collect();
        for _ in 0..50 {
            assert_eq!(unused_id("a", 1, &taken), "a-z");
        }
    }
}
