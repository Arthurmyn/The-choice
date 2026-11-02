# ECHO — Your choices leave a trace.

A cinematic, choice-driven philosophical narrative game for the browser (formerly "Who Wrote the Story?"). You face two short, fictional dilemmas, make three decisions in each, reach one of three endings per story, and then read an analysis of your choices through Kant, Mill and Aristotle. No morality score, no ranking, no "good/bad" ending labels.

Everything (story, characters, art, music, sound) is original and generated in the browser: SVG scenes and portraits, Web Audio synthesis. No external APIs, no downloads, works offline once loaded.

## Stories

| # | Title | Category | Endings |
|---|-------|----------|---------|
| 01 | **Release Today** (5–7 min) | Professional ethics | `R_E1` Postponed · `R_E2` Limited Release · `R_E3` Full Release |
| 02 | **Speak for Someone Else** (3–5 min) | Personal ethics | `L_E1` Honest and Private · `L_E2` The False Story · `L_E3` Privacy Violated |
| 03 | **The Last Journey** (25–40 min) | Survival drama | Together · The Sacrifice · Alone · Betrayal · New Home · No One Left · *Echo* (hidden) |

Stories 01 and 02 are 2 × 2 × 3 = 12 paths each. **The Last Journey** is a six-chapter campaign with 13 decisions, conditional scenes, shared resources, trust, infection and evidence systems, and seven endings (one hidden); it has far too many paths to enumerate, so it is validated by sampling (see Tests).

### The Last Journey

26 days after the outbreak, a radio message promises a last convoy 280 km north. You play Daniel Reed, a mechanic who has become the leader of six survivors. Chapters: Empty Shelves, Strangers, No Way Back, The Hospital, The Checkpoint, The Last Journey.

- **Real branching.** Decisions set flags and change numeric state; *routers* pick the next scene from that state, so branches diverge (who steals the food depends on whether you took in the boy; who is bitten depends on who you sent into the woods; who dies depends on whether you asked).
- **State (hidden):** trust per character, who is alive, who is bitten, what the player knows. **Shown:** food, medicine, ammunition and fuel in the HUD. Resources are clamped at zero and affect scenes and options.
- **Infection.** A bite is not visible at first; the bitten person is fixed by earlier choices, can hide it, and is examined (publicly, privately) or not. A test checks the story stays consistent on thousands of playthroughs.
- **Evidence.** Inspecting evidence that changes the story is recorded in the run's history (so it replays and saves); all evidence goes to the Memory Archive.
- **Endings** depend on the whole history; the **map** shows chapters, decisions and every ending, and highlights your path.

## Setup

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm test           # vitest: engine + full UI playthroughs
npm run typecheck
```

## Visual design

Direction, palette and type live in [DESIGN.md](DESIGN.md); product truth in [PRODUCT.md](PRODUCT.md). In short: a dark, cinematic world lit by blue; amber is reserved for memories the player has found; display type is light, wide-tracked Space Grotesk and body text is Manrope (both self-hosted via `@fontsource`, so the game stays offline-capable). Signature motif: concentric "echo" rings around a point of light.

- **Menu / chapters:** full-screen scene with echo rings and rain; stories are film chapters that widen on hover.
- **Player:** parallax scene + portraits (pointer-driven, off with reduced motion), film grain, light sweep, dialogue overlay, HUD with mute and volume.
- **Decisions:** background calms and blurs; large panels stagger in; selection is shown with corner brackets, never good/bad colour.
- **Memory fragments:** inspected evidence is saved per story (kept across restarts) and collected in the **Memory Archive** (Fragments / Decision paths).
- **Decision map:** left-to-right, pan/zoom (drag, wheel, pinch, buttons, arrow keys, `+`/`-`/`0`), animated nodes and a drawn-on blue path.
- **Analysis:** philosopher list with illustrated portraits, source/application/limit per philosopher, where the principles collide, questions for the player.

## Languages and voice-over

The game is fully available in **English and Russian** (switch on the menu or in Settings; the default follows the browser language). Story data lives in `src/data/stories/*.json` (EN) and `*.ru.json` (RU) with identical ids, logic and conditions, so progress and endings are language independent. A test checks that the two stay structurally identical. Interface strings use the English phrase as the key (`t('...')`) with Russian in `src/i18n/ru.ts`; a test fails if a used key has no translation.

**Voices** are pre-rendered neural speech (open-source [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) for English and [Silero](https://github.com/snakers4/silero-models) v4 for Russian, one voice per character plus a narrator; Silero's license is CC BY-NC-SA, non-commercial) stored as `public/voice/<lang>/*.m4a` (~34 MB). If a clip is missing the game falls back to the browser's own speech synthesis, preferring natural voices. Regenerate with `scripts/generate-voice.py` (see its header; needs the Kokoro and Silero models). A test verifies every spoken line has a clip.

**Portraits** are vector, semi-realistic busts. To use your own cut-out images, put them in `src/assets/characters/<id>/<expression>.png` (see the README there); missing files fall back to the vector portrait.

## Playing

- **Click / Space / Enter / →** advance dialogue (press once to finish the typing, again to continue). **←** goes back a line.
- **1 / 2 / 3** select a decision card; every decision has a confirmation step.
- Progress autosaves after every confirmed decision (LocalStorage). **Continue** resumes the last story; refreshing the page returns to the same screen and scene.
- After an ending: **Philosophical analysis**, **Decision map** (click any node, including branches you didn't take; reviewing never changes your save), and **Play another path** (restarts that story only; endings you've found are kept).
- Settings and HUD: mute, music and effects volume, text size, subtitles (captions for ambient sound), reduced motion, text reveal, camera drift, fullscreen.

## Architecture

```
src/
  app/            App.tsx (providers, screens), GameScreen.tsx (beat flow), routes.tsx (hash router)
  engine/         types, narrativeEngine, decisionResolver, endingResolver,
                  storyValidator, progressManager, flowchart (map layout)
  data/           stories/*.json, philosophy/{philosophers,references}.json, index.ts
  components/     cinematic/ decisions/ investigation/ navigation/ flowchart/ endings/ philosophy/
  hooks/          useGameState (settings + progress context), useProgress, useAudio (Web Audio)
  styles/         variables.css, global.css, animations.css
  tests/          engine.test.ts, ui.test.tsx
```

**One source of truth.** The only stored game state is the ordered decision history `{ nodeId, choiceId, timestamp }[]`. Flags, the current decision, visited nodes, the ending and the map highlight are all *derived* by replaying it over the story graph (`deriveState`). The ending is a property of the D3 choice, never random.

**Engine extensions** for large stories: numeric stats and conditional `apply` entries (flags that start with `#` are numbers), conditional choices (`when`), `router` nodes that choose the next scene from state and can end the story, and evidence that applies state changes. Old stories do not use these and behave exactly as before.

**Engine rules** (`narrativeEngine.ts`): every transition is validated; submitting an out-of-order, invalid or duplicate decision, or one after the ending, is rejected; tampered or corrupt saves are detected and discarded (a backup copy is kept under `…:corrupt`).

**Stories are data.** Adding a story means adding a JSON file with the same shape and registering it in `src/data/index.ts`; no component changes. `storyValidator.validateStory` checks graph integrity, that every conditional flag can be set, and that every one of the story's paths ends in a defined ending with philosophical text for each flag. A story JSON contains:

- `nodes`: `scene`, `investigation` (evidence items), `decision` (2–3 `choices`).
- A choice has `sets` (flags), optional `ending`, optional `interaction`, a `reaction` scene and a `result`.
- Conditional content: any `Line`, `TextVariant`, or consequence can carry `when: { flag, is } | { flag, isNot } | { all } | { any }`.
- Interactions: `testLab`, `steps` (console), `chat` (messages with conditional parts), `calendar`.
- `endings`, `flagLabels`, and `analysis` (Kant/Mill/Aristotle text per ending and per flag).

**Flow.** `buildTimeline` turns the derived state into beats (`intro → … → d1 → d1:reaction → … → ending`). The saved cursor is `{ beat key, line }`, so a reload resumes the same line. A decision that is already answered is never shown again.

## Philosophy

Sources: Kant, *Fundamental Principles of the Metaphysic of Morals*, Section II; Mill, *Utilitarianism*, Chapter II; Aristotle, *Nicomachean Ethics* VI.5, VI.7 and VIII.3. Each of the three sections (Rule of Action / Consequences for People / Relationships and Practical Wisdom) has: a paraphrase of the argument ("From the source"), an application to your actual choices (labelled as this game's interpretation), a limit or open question, and a source reference. There are no invented quotations, and the game never claims that a philosopher would choose a particular option.

## Tests and results

`npm test` runs the suite below. **The Last Journey** has far too many paths to enumerate, so `lastJourney.test.ts` validates it by *sampling* (thousands of seeded random playthroughs must always finish, keep consistent state and have analysis for the ending reached), replays a stored path to each of the seven endings in both languages, and checks resources, infection, relationships, branching dialogue, evidence recording, saving and the map:

- **Engine (42):** both story files validate; all 12 + 12 paths: correct history, ending, flags, conditional text, timeline, philosophical text, map highlight, save round trip; exact conditional strings from the brief; duplicate/out-of-order/invalid submissions; corrupted/outdated saves; restart keeps completed runs.
- **UI (38):** the **real app is driven through all 24 paths** (title cards, evidence gating, test lab, console steps, chat, calendar, confirmation dialogs) and checks the ending screen, saved progress, analysis, and decision map (8 nodes / 7 edges highlighted, alternative nodes reviewable, save unchanged); plus menu, story list, reload after a decision, double-submit prevention, per-story restart, continuing a finished story, corrupted save recovery, settings persistence, keyboard navigation, and caption toggling.

Last run: see the final line of `npm test`; `tsc --noEmit` clean; `vite build` succeeds. I also loaded the production build in Chrome at 1440×900 and 390×844 and captured menu, dialogue, evidence, every interaction, decisions, endings, map, and analysis screens with no console errors or warnings.

## Known limitations

- Voice-over uses Kokoro and Silero: much more natural than classic TTS but not studio actors, and I could not listen to them in this environment. Music and effects are synthesized (a soft pad, noise-based ambience, simple tones). It is deliberately modest; it was verified to initialize, but its sound quality was not evaluated by ear in this environment.
- Art is procedural SVG (scenes and portraits, six expressions), not rendered or photographic. Scene backgrounds accept an optional `image` URL that falls back to the SVG if it fails to load, but no image or video assets ship.
- In `The False Story` and `Privacy Violated` the story deliberately ends on an unresolved question rather than adding a fourth decision, as specified (3 decisions, 3 endings).
- Saves are per browser (LocalStorage); private browsing or full storage shows a warning and the game stays playable without persistence.
- On narrow phones the decision map starts at a readable 50% zoom and is panned, rather than shrunk to fit.
- Characters are stylised vector portraits, not photographs, and are not a likeness of any game character. Six reference mockups in `src/stylesimages/` were used as art direction only (they are UI comps with baked-in Russian text, not usable assets). 
- Not tested: real screen readers, Safari/Firefox, touch hardware. Keyboard flow and focus states are exercised in tests/Chrome only. Playwright is used only for ad-hoc screenshots (`playwright-core`, system Chrome); there is no checked-in e2e suite.
