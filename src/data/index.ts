import infectedSurvivor from './stories/infectedSurvivor.json';
import infectedSurvivorRu from './stories/infectedSurvivor.ru.json';
import lastMedicine from './stories/lastMedicine.json';
import lastMedicineRu from './stories/lastMedicine.ru.json';
import whoControls from './stories/whoControls.json';
import whoControlsRu from './stories/whoControls.ru.json';
import philosophers from './philosophy/philosophers.json';
import philosophersRu from './philosophy/philosophers.ru.json';
import references from './philosophy/references.json';
import referencesRu from './philosophy/references.ru.json';
import type { Story } from '../engine/types';

export type Lang = 'en' | 'ru';
export const LANGS: Lang[] = ['en', 'ru'];

/** JSON is structurally checked by storyValidator (see tests) rather than by the compiler. */
const asStory = (raw: object): Story => raw as unknown as Story;

const STORIES: Record<Lang, Story[]> = {
  en: [asStory(infectedSurvivor), asStory(lastMedicine), asStory(whoControls)],
  ru: [asStory(infectedSurvivorRu), asStory(lastMedicineRu), asStory(whoControlsRu)],
};

/** English stories. Ids, nodes and choices are identical in every language. */
export const stories: Story[] = STORIES.en;

export const getStories = (lang: Lang): Story[] => STORIES[lang];
export const storyById = (id: string, lang: Lang = 'en'): Story | undefined => STORIES[lang].find((s) => s.id === id);

export type PhilosopherId = 'hobbes' | 'locke' | 'rousseau' | 'popper' | 'castells';

export interface PhilosopherInfo {
  id: PhilosopherId;
  name: string;
  years: string;
  section: string;
  question: string;
  concepts: string[];
}

export interface Reference {
  author: string;
  work: string;
  location: string;
  note: string;
}

export interface PhilosophyMeta {
  centralQuestion: string;
  note: string;
  order: PhilosopherId[];
  philosophers: Record<PhilosopherId, PhilosopherInfo>;
}

const meta = (p: typeof philosophers): PhilosophyMeta => ({
  centralQuestion: p.centralQuestion,
  note: p.note,
  order: ['hobbes', 'locke', 'rousseau', 'popper', 'castells'],
  philosophers: p.philosophers as Record<PhilosopherId, PhilosopherInfo>,
});

const META: Record<Lang, PhilosophyMeta> = { en: meta(philosophers), ru: meta(philosophersRu) };
const REFS: Record<Lang, Record<PhilosopherId, Reference>> = {
  en: references as Record<PhilosopherId, Reference>,
  ru: referencesRu as Record<PhilosopherId, Reference>,
};

export const getPhilosophy = (lang: Lang): PhilosophyMeta => META[lang];
export const getReferences = (lang: Lang): Record<PhilosopherId, Reference> => REFS[lang];

/** English defaults, kept for callers that do not need a language. */
export const philosophyMeta = META.en;
export const sourceReferences = REFS.en;
