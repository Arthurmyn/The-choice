# ECHO: The Ethics of Survival

*Your choices leave a trace.*

A cinematic, choice-driven philosophical game for the browser, built as a prototype for a university course on social contract theory (Hobbes, Locke, Rousseau). Its research question:

> To what extent can collective security justify restricting individual freedom and moral rights during a social crisis?

You are one member of a small group of survivors in a fictional outbreak. You are not the leader. In three short chapters you make three decisions each, reach one of three endings, and then read what Hobbes, Locke and Rousseau (and, in chapter 3, Popper and Castells) might make of the path you took. There is no morality score, no ranking, no good or bad ending, and no correct answer.

Everything (story, characters, art, music, sound) is original and generated in the browser: SVG scenes and portraits, Web Audio synthesis. No external APIs, no personal data, works offline once loaded.

## Chapters

| # | Title | Setting | Contested question | Endings |
|---|-------|---------|--------------------|---------|
| 1 | **The Infected Survivor** (8-10 min) | Day 9, a bus depot shelter. Aida hid a bite. Nobody knows if it is infectious. | May the group restrict one person on a fear it cannot confirm? | A Single Hand · Consent Only · The Open Table |
| 2 | **The Last Medicine** (8-10 min) | Day 12. One course of antibiotic, two feverish people (Leo, Nadia). | Need against usefulness, equal chance against fair outcome. | Need First · The Draw · What the Group Needs |
| 3 | **Who Controls the Group?** (8-10 min) | Day 20. Marat holds the map and the radio; some say he abuses power, nobody can show it. | Authority, information and the right to disagree. | The Quiet Column · The Loud Column · Two Roads |

Every chapter has the same shape: an investigation (three items, none of which settles the matter), three decisions (D1: 3 options, D2: 2 options that depend on D1, D3: 3 options), so 3 x 2 x 3 = 18 paths, and three endings decided by D3 and coloured by D1 and D2. Every ending closes on an open question. No ending says who was right, and no hidden random truth decides the outcome.

The earlier stories (Release Today, Speak for Someone Else, The Last Journey) and their Kant, Mill and Aristotle analysis are kept for reference in `src/data/stories/_archive/` and `src/data/philosophy/_archive/`. They are not registered, not tested and not shown.

### Four indicators, shown as words

Each chapter tracks four hidden numbers, kept between 0 and 10: **Trust**, **Safety**, **Resources** and **Participation** (they start at 6, 5, 5 and 5). The HUD shows them only as words (Low, Strained, Stable, High) with a small arrow for the last decision (rising, falling, unchanged). There is no total and no combined score.

No option improves all four, so every choice costs something. On the ending screen, **How the system worked** lists each decision you made and the stated effect of the option on the indicators, read from the story data itself. A test checks that the listed effects add up to what the engine actually applied.

### Content notice

Before the first scene of each chapter a short notice says the story deals with death, coercion and fear (or illness, or loss of a group), that you can leave at any time, and that nothing in it is a recommendation about real events.

## Philosophy layer

Each ending screen links to an analysis. For every thinker it shows **From the source** (a paraphrase, labelled as such), **Applied to your choices** (labelled as this game's interpretation), **Limit or open question**, and a source reference. After that: **Where the principles collide** (one paragraph that names the tension without choosing a side) and three **Questions for you**.

| Thinker | Source | Used in |
|---------|--------|---------|
| Thomas Hobbes | *Leviathan*, chapters 13, 14, 17, 21 | all chapters |
| John Locke | *Second Treatise of Government*, chapters 2, 9, 14, 19 | all chapters |
| Jean-Jacques Rousseau | *The Social Contract*, book I ch. 6, book II ch. 3, book IV ch. 6 | all chapters |
| Karl Popper | *The Open Society and Its Enemies* | chapter 3 (section), chapter 1 (short lens) |
| Manuel Castells | *Communication Power* | chapter 3 (section), chapter 1 (short lens) |
| Immanuel Kant, John Stuart Mill | *Groundwork*, *Utilitarianism* | chapter 2 (short secondary note only) |

Chapter 1 also carries a neutral card on the declaration of a nationwide state of emergency in Kazakhstan in March 2020 (source: Amangeldinova et al., 2020), with no opinion on the real events.

Rules the project keeps: paraphrase only, no invented quotations, the game never claims a philosopher "would choose" an option, and the text is checked by tests for verdict language and for em and en dashes.

## Setup

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # vitest: engine, languages, content rules, full UI playthroughs
npm run typecheck
```

## Languages and voice

The game is fully available in **English and Russian** (menu or Settings; the default follows the browser). Story data lives in `src/data/stories/<name>.json` (EN) and `<name>.ru.json` (RU) with identical ids, logic and conditions, so progress and endings do not depend on the language. A test checks that the files stay structurally identical. Interface strings use the English phrase as the key (`t('...')`) with Russian in `src/i18n/ru.ts`; a test fails if a used key has no translation.

**Voice-over.** The three ECHO chapters have no pre-rendered clips: they are marked `voice: false` and read by the browser's own speech synthesis, preferring natural voices and giving each character a distinct one. The earlier Kokoro (English) and Silero (Russian) clips in `public/voice/` belong to the archived stories and are kept. `scripts/generate-voice.py` can regenerate clips; its header says which models it needs. Silero's licence is CC BY-NC-SA (non-commercial).

**Portraits** are vector, semi-realistic busts. To use your own cut-out images, put them in `src/assets/characters/<id>/<expression>.png` (see the README there); missing files fall back to the vector portrait.

## Playing

- **Click / Space / Enter / right arrow** advance dialogue; **left arrow** goes back a line.
- **1 / 2 / 3** select a decision card; every decision has a confirmation step.
- Progress autosaves after every confirmed decision (LocalStorage). **Continue** resumes the last chapter; refreshing returns to the same screen and line.
- After an ending: **Philosophical analysis**, **Decision map** (click any node, including branches you did not take; reviewing never changes your save), and **Play another path** (restarts that chapter only; endings you found are kept).
- Items you inspect during an investigation go to the **Memory Archive**.

## Architecture

```
src/
  app/            App.tsx, GameScreen.tsx (beat flow, content notice, HUD), routes.tsx (hash router)
  engine/         types, narrativeEngine, decisionResolver, endingResolver, indicators,
                  storyValidator, progressManager, flowchart (map layout)
  data/           stories/*.json (+ .ru.json), stories/_archive, philosophy/*.json, index.ts
  components/     cinematic/ decisions/ investigation/ navigation/ flowchart/ endings/ philosophy/ ui/
  hooks/          useGameState, useProgress, useAudio (Web Audio), voice
  styles/         variables.css, global.css, animations.css, screens.css
  tests/          engine, ui, i18n, voice, content
```

**One source of truth.** The only stored game state is the ordered decision history `{ nodeId, choiceId, timestamp }[]`. Flags, indicators, the current decision, visited nodes, the ending and the map highlight are all derived by replaying it over the story graph (`deriveState`). The ending is a property of the D3 choice, never random.

**Engine features** used by these chapters: numeric stats under `#` keys with effects per choice, clamped to 0 to 10 for the declared `indicators`; conditional lines, fragments and consequences (`when`); conditional choices; routers; per-node state snapshots so the HUD never shows what has not happened yet; investigation items that go to the archive. Every transition is validated, out-of-order, invalid or duplicate submissions are rejected, and corrupt or tampered saves are discarded (a backup is kept under `...:corrupt`).

**Stories are data.** A story JSON holds `nodes` (scene, investigation, decision), `endings`, `flagLabels`, `analysis` (one entry per thinker, with text per ending and per flag), `lenses`, `context`, `reflection`, `indicators`, `initial`, `notice` and `voice`. Adding a story means adding the file and registering it in `src/data/index.ts`. `storyValidator` checks graph integrity, that every conditional flag can be set, and that every path ends in a defined ending with analysis text for each flag.

## Tests

`npm test` runs the whole suite (240 tests at the time of writing, all passing):

- **Engine:** every chapter validates in both languages; all 18 paths of each chapter in EN and RU (correct history, ending, flags, indicators inside 0 to 10, conditional text, timeline, analysis for every ending and flag, map highlight, "How the system worked" adds up, save round trip); indicator words and clamping; exact conditional ending text; ending length (80 to 110 words) and open final question; submission safety; saves.
- **UI:** the real app is driven through all 54 paths (content notice, evidence, decisions with confirmation, ending, system panel with no score words, analysis tabs, map with 8 nodes and 7 edges highlighted), plus menu, three chapter cards, Russian switch, HUD indicators (words and arrows, never digits), reload and resume, double-submit prevention, restart, corrupted save, settings, keyboard, captions.
- **Content rules:** no em or en dashes in story, philosophy, interface text, code or project documents; no verdict language; Hobbes, Locke and Rousseau each with source; Popper and Castells in chapter 3; the Kazakhstan card; chapter 2 never decides on gender, ethnicity or disability.
- **Languages and voice:** RU and EN structurally identical; no untranslated lines; every `t()` key translated; every character has a voice profile and stories without clips are marked `voice: false`.

## Known limitations

- **Text needs a human check before submission.** The philosophy paraphrases (all five thinkers), the Russian translations (stories, philosophy, interface) and the Kazakhstan sentence and its citation were written here and not reviewed by an expert or a native editor. The source locations for Popper and Castells are descriptions of the argument, not chapter numbers, and need to be filled in from the editions you cite.
- Voice is the browser's speech synthesis for the new chapters, so quality depends on the voices installed on the device. It was not listened to in this environment.
- Music and effects are synthesized and deliberately modest; their sound quality was not evaluated by ear.
- Art is procedural SVG (scenes, portraits, philosopher busts), not rendered or photographic. The busts are stylised illustrations, not likenesses.
- The indicator effects are a small, hand-set model: they are chosen so that no option improves all four, and they are not calibrated against any data. They illustrate trade-offs and are not a measurement of anything.
- Each chapter is independent: indicators reset per chapter and the outcome of one chapter does not carry into the next. Chapter 2 has no standing rule option that simply hands the decision to the group (that appears as D1 and D2 options instead), because each chapter has exactly three endings.
- Saves are per browser (LocalStorage); private browsing or full storage shows a warning and the game stays playable without persistence.
- Not tested: real screen readers, Safari, Firefox, touch hardware. Playwright (`playwright-core`, system Chrome) is used only for ad-hoc screenshots; there is no checked-in e2e suite.
- Six reference mockups in `src/stylesimages/` were used as art direction only; they are not usable assets.
