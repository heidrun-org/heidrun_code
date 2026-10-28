/** The shortest word that can be a topic, in letters and digits. */
const SHORTEST_WORD = 3;

/** The characters of a text that are not part of a word: a mark of an accent is removed, and the letters stay. */
const ACCENT_MARKS = /\p{M}/gu;

/** One word: a run of letters and digits of any language. */
const WORD = /[\p{L}\p{N}]+/gu;

/** The text of a word without its accents and in lower case, so that "Créer" and "creer" are the same word. */
function plainText(text: string): string {
  return text.normalize("NFD").replace(ACCENT_MARKS, "").toLowerCase();
}

/**
 * The words that never make a topic: the small words of English and of French, and the words of a request to a coding
 * agent ("please", "make", "issue"). A word of this list is dropped before and after the removal of its plural mark.
 */
const STOP_WORDS = new Set(
  `
  about above after again against all also although always among and any are aren because been before being below
  between both but can cannot could couldn did didn does doesn doing don down during each either else even ever every
  few for from further had hadn has hasn have haven having her here hers him his how however into isn its itself just
  let lets like may maybe might more most much must myself neither nor not now off once only onto other others our ours
  ourselves out over own per perhaps quite rather same shall she should shouldn since some such than that the their
  theirs them themselves then there these they this those though through thus too under until upon use used uses using
  very was wasn were weren what when whenever where whether which while who whom whose why will with within without
  won would wouldn yes yet you your yours yourself
  add added adds fix fixed fixes get gets got going give know look make makes made need needs okay please pull request
  requests say see show sure take thing things think try want wants way work works issue issues
  anywhere better blah hello little poor pound silly strange twice whole
  alors apres assez aucun aupres aussi autre autres avec avoir avons avez beaucoup bien car cela celui ceci cette ces
  chaque comme comment dans dedans dehors depuis donc dont elle elles encore entre est etre faire fait faut fois
  jamais leur leurs mais meme moins mon mes nous notre nos oui parce pas pour plus puis quand que quel quelle quels
  quelles qui quoi sans selon sera ses son sont sous tous tout toute toutes tres trop une vos votre vous
  `
    .trim()
    .split(/\s+/)
    .map((word) => plainText(word)),
);

/**
 * The word without its plural mark: "topics" gives "topic", "branches" gives "branch", "queries" gives "query", "caches" gives "cache". A word
 * that ends with "ss", "us", or "is" keeps its end, because the end is part of the word ("status", "process").
 * @param word - one word in lower case
 * @returns the word in the singular
 */
export function singularOf(word: string): string {
  if (/(ss|us|is)$/.test(word)) {
    return word;
  }
  if (word.length > 4 && word.endsWith("ies")) {
    return `${word.slice(0, -3)}y`;
  }
  if (word.endsWith("caches")) {
    return word.slice(0, -1);
  }
  if (/(x|ch|sh|ss)es$/.test(word)) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * The words of a text that can be a topic, in the order of the text, with the repeats. A word is in lower case, without
 * accents, and in the singular. An address, a number, a short word, and a word of the list of stop words are dropped. A
 * name such as `ChatsPanel` gives two words, "chat" and "panel", and a path such as `web_frontend/src` gives one word for
 * each part.
 * @param text - the text to read
 * @returns the words
 */
export function topicWordsOf(text: string): string[] {
  const withoutAddresses = text.replace(/https?:\/\/\S+/g, " ");
  const plain = plainText(withoutAddresses.replace(/([a-z])([A-Z])/g, "$1 $2"));
  const words: string[] = [];
  for (const match of plain.matchAll(WORD)) {
    const word = match[0];
    if (word.length < SHORTEST_WORD || /^\p{N}+$/u.test(word) || STOP_WORDS.has(word)) {
      continue;
    }
    const singular = singularOf(word);
    if (singular.length < SHORTEST_WORD || STOP_WORDS.has(singular)) {
      continue;
    }
    words.push(singular);
  }
  return words;
}
