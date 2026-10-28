# Heidrun Code and the developer with artificial intelligence

- Created: 11 October 2026
- Last updated: 13 October 2026
- Status: Maintained reference for the public texts
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [The jokes](jokes.md) and [The name of Heidrun Code](name_of_heidrun.md)

This document links the Norse mythology of Heidrun Code to the situation of developers who work with artificial intelligence today. It defines six words that the public texts use: Vikings, Valhalla, mead, the einherjar, Ragnarök, and "Skål!". The rules for the jokes are in [jokes.md](jokes.md). Every statement about the mythology in this document comes from the *Poetic Edda* and the *Prose Edda*.

## The situation of developers today

A developer used to write every line of code, in one editor and one terminal. A developer now starts several artificial intelligence agents at the same time. An agent is a program that reads code, writes code, and runs commands in a terminal.

- Each agent works alone in its own terminal, for a long time.
- Each agent stops often to ask for a decision, a permission, or a code review.
- Two agents can change the same lines of the same file, and the two changes collide. This is a merge conflict.
- Every agent uses a quota of tokens. When the quota is empty, the agent stops.

The work of the developer changes. The developer writes fewer lines, and gives more answers. The slow part is no longer the agent. The slow part is the developer, who must find which agent waits, and must answer it. Herdr runs the agents in one session. Heidrun Code shows the agents and the terminals of that session in one work window, and shows which agent needs the developer now.

This is the same picture as the myth. The warriors do the fighting, and the goat keeps the supply flowing. The motto says it: "With AI, every developer is THE GOAT!"

## The six words

### Vikings

**Meaning.** The Vikings were Norse people from Scandinavia, today Denmark, Norway, and Sweden. They sailed to raid, to trade, to explore, and to settle in Europe and the North Atlantic. The Viking Age is the period from about 793 to about 1066. The Old Norse word *víkingr* first named a person who goes on a sea raid. It named an activity, not a whole people. Most Norse people were farmers. Real Vikings did not wear helmets with horns. That picture comes from stage costumes and paintings of the nineteenth century.

**Link to developers.** A developer who works with agents sails into land without a map. The tools are new, the habits are new, and nobody has done this before. The developer sets out with a crew of agents, like a Viking with a ship. This is why the README says that Heidrun Code is "forged for Vikings".

**Joke.** Real Vikings wore no horns. Only the goat needs them.

### Valhalla

**Meaning.** Valhalla (Old Norse *Valhöll*, "hall of the slain") is the hall of the god Odin. Odin receives half of the warriors who die in battle. The goddess Freyja receives the other half, in her hall Fólkvangr. The rafters of Valhalla are spears, and the roof is made of shields. The hall has 540 doors. Through each door, 800 warriors can walk out at the same time, when they go to fight the wolf Fenrir at Ragnarök. The goat Heiðrún stands on top of the hall. Sources: *Grímnismál* stanzas 9, 14, 23, and 25.

**Link to developers.** Valhalla is the work window. All the agents and all the terminals of the session are inside one hall, and the developer sees all of them together.

**Joke.** Valhalla has 540 doors, so there is always room for one more terminal.

### Mead

**Meaning.** Mead is an alcoholic drink that people make by fermenting honey with water. It is one of the oldest alcoholic drinks in the world. In the myth, the mead of Heiðrún flows from her udders. It fills a vessel every day, and the drink never fails. There is enough for all the einherjar. Sources: *Grímnismál* stanza 25, and *Gylfaginning* in the *Prose Edda*.

**Link to developers.** Mead is what keeps the agents working. It has two parts: the answers of the developer (decisions, permissions, and code reviews), and the quota of tokens. The goat turns the leaves of a tree into mead. The developer turns attention into answers.

**Joke.** In the myth, the mead never runs out. In real life, the quota runs out. Heidrun Code shows the level in the status bar, so there is no surprise.

### The einherjar

**Meaning.** The einherjar (Old Norse *einherjar*, singular *einherji*) are the warriors who died in battle and live in Valhalla. The name is often explained as "lone fighters", or "those who fight alone". Every day they go out to fight and they fall. Before the feast they rise again, whole. At the feast they eat the meat of the boar Sæhrímnir, and they drink the mead of Heiðrún. They wait for Ragnarök, because they will fight next to the gods. Sources: *Grímnismál* stanza 23, and *Gylfaginning*.

**Link to developers.** The einherjar are the agents. Each agent fights alone in its own terminal. An agent that ends its session starts again, whole, with a clean context. Between two prompts, an agent waits, like a warrior who waits for the feast.

**Joke.** The einherjar wait for the feast. Your agents wait for you.

### Ragnarök

**Meaning.** Ragnarök (Old Norse *Ragnarǫk*, "the fate of the gods") is the final battle at the end of the world. The *Poetic Edda* poem *Völuspá* and the *Prose Edda* describe it. A long winter comes. The wolf Fenrir breaks free, and the serpent Jörmungandr rises from the sea. The fire giant Surtr burns the world. The gods and the einherjar fight, and many gods die: Fenrir kills Odin, and Thor kills Jörmungandr and then dies from its venom. The world sinks into the sea. Then the world rises again, green and fertile, and a new generation of gods and two human survivors live in it.

**Link to developers.** Ragnarök is a merge conflict: many agents fight on the same ground, and the two changes of the same lines collide. The README also uses the word for an issue, in the link "Report a Ragnarök". After Ragnarök, the world comes back green. After the developer resolves the merge conflict, the tests come back green.

**Joke.** We do not talk about Ragnarök before breakfast.

### Skål!

**Meaning.** "Skål" is the word that people say in Denmark, Norway, and Sweden when they raise a glass. It means "cheers". The word comes from the Old Norse word *skál*, which means "bowl". A popular story says that Vikings drank from the skulls of their enemies, and that "skål" comes from "skull". The story is false. The word means a bowl.

**Link to developers.** "Skål!" is the toast at the end of the work: the agents finished, the tests pass, and the developer merges the pull request. The README ends with it, and so does the page About of the website.

**Joke.** Say "Skål!" after the merge, not before.

## The map

| Myth | Developer with artificial intelligence | Heidrun Code |
| --- | --- | --- |
| The Vikings | The developers who sail into new land with a crew of agents | The people who use Heidrun Code |
| Valhalla | The place where all the agents work together | The work window |
| The mead | The answers of the developer, and the quota of tokens | The "Needs you" queue, the inspector, and the quotas in the status bar |
| The einherjar | The agents | The panes and the terminals of the session |
| The goat Heiðrún | The developer who keeps the agents supplied | The motto: "With AI, every developer is THE GOAT!" |
| Ragnarök | A merge conflict | The words "Report a Ragnarök" on the link to the issues |
| "Skål!" | The merge of the pull request | The last line of the README and of the page About |
