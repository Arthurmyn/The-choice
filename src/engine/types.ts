export type Expression = 'neutral' | 'concerned' | 'angry' | 'sad' | 'confident' | 'surprised';

export type BackgroundId =
  | 'office-night'
  | 'dev-workspace'
  | 'conference'
  | 'volunteer-room'
  | 'messaging'
  | 'city-dusk'
  | 'city-night'
  | 'city-dawn'
  | 'city-alert';

export type AmbientId = 'office' | 'room' | 'city' | 'digital' | 'none';

/** Flag conditions. Flags are derived from the decision history. */
export type Condition =
  | { flag: string; is: string }
  | { flag: string; isNot: string }
  | { all: Condition[] }
  | { any: Condition[] };

export interface Conditional {
  when?: Condition;
}

export interface TextVariant extends Conditional {
  text: string;
}

export interface Line extends Conditional {
  /** Character id. Omit for narration. */
  speaker?: string;
  expression?: Expression;
  text: string;
}

export interface TitleCard {
  kicker: string;
  title: string;
  text: string;
}

export interface SceneContent {
  background: BackgroundId;
  ambient?: AmbientId;
  /** Sound caption shown when subtitles are enabled. */
  caption?: string;
  /** Characters present in the scene (shown dimmed unless speaking). */
  cast?: string[];
  card?: TitleCard;
  lines: Line[];
}

export interface HairVisual {
  style: 'short' | 'long' | 'bun' | 'curly' | 'cropped' | 'side';
  color: string;
}

export interface CharacterVisual {
  skin: string;
  hair: HairVisual;
  outfit: string;
  accent?: string;
  accessory?: 'glasses' | 'lanyard' | 'headset' | 'none';
}

export interface VoiceProfile {
  gender: 'f' | 'm' | 'n';
  pitch: number;
  rate: number;
}

export interface Character {
  id: string;
  voice?: VoiceProfile;
  name: string;
  role: string;
  visual: CharacterVisual;
}

/* ---------- Interactions ---------- */

export interface TestAccount {
  id: string;
  label: string;
  org: string;
}

export interface TestLabInteraction {
  type: 'testLab';
  title: string;
  accounts: TestAccount[];
  /** Account ids that must be chosen (in any order) for the test to run. */
  requireDistinctOrgs: boolean;
  log: string[];
  resultText: string;
}

export interface StepsInteraction {
  type: 'steps';
  title: string;
  steps: { id: string; label: string; button: string; output: string[] }[];
  doneText: string;
}

export interface ChatMessage {
  /** 'me' for the player, otherwise a character id. */
  from: string;
  parts: TextVariant[];
}

export interface ChatInteraction {
  type: 'chat';
  app: string;
  channel: string;
  messages: ChatMessage[];
  /** If set, the final message is only shown after the player taps "Send". */
  sendLabel?: string;
  /** Status line under the last outgoing message, e.g. "Seen by 6". */
  receipt?: Conditional & { text: string };
}

export interface CalendarEntry {
  id: string;
  day: string;
  time: string;
  title: string;
  assignee: string;
  note?: string;
  /** Appears in history view only. */
  history?: boolean;
}

export interface CalendarInteraction {
  type: 'calendar';
  title: string;
  entries: CalendarEntry[];
  /** Finding shown once every entry flagged `reveals` has been opened. */
  findings: { entryId: string; text: string }[];
  doneText: string;
}

export type Interaction =
  | TestLabInteraction
  | StepsInteraction
  | ChatInteraction
  | CalendarInteraction;

/* ---------- Evidence ---------- */

export interface EvidenceItem {
  id: string;
  label: string;
  kind: 'document' | 'log' | 'message' | 'card' | 'config';
  required?: boolean;
  title: string;
  body: string[];
  mono?: boolean;
  /** Table rows as [key, value]. */
  rows?: [string, string][];
  finding: string;
}

/* ---------- Nodes ---------- */

export interface Choice {
  id: string;
  label: string;
  description: string;
  /** Exact action text (e.g. the message that will be sent). */
  preview?: string;
  sets: Record<string, string>;
  /** Next node id. Falls back to the decision's `next`. */
  next?: string;
  /** Ending id. If present the story finishes after this choice. */
  ending?: string;
  /** Short, neutral wording used in the decision map and summaries. */
  mapLabel: string;
  interaction?: Interaction;
  reaction: SceneContent;
  result: string;
}

export interface SceneNode {
  type: 'scene';
  id: string;
  scene: SceneContent;
  next: string;
}

export interface InvestigationNode {
  type: 'investigation';
  id: string;
  scene: SceneContent;
  items: EvidenceItem[];
  next: string;
}

export interface DecisionNode {
  type: 'decision';
  id: string;
  /** Short stage tag, e.g. "D1". */
  stage: string;
  title: string;
  background: BackgroundId;
  situation: string;
  info: string[];
  pressures: string[];
  context?: ChatInteraction;
  choices: Choice[];
  next?: string;
}

export type StoryNode = SceneNode | InvestigationNode | DecisionNode;

export interface Ending {
  id: string;
  title: string;
  subtitle: string;
  scene: SceneContent;
  result: string;
  fragments: TextVariant[];
  consequences: TextVariant[];
  unresolved: string;
}

export interface FlagLabel {
  /** Flag name, e.g. "evidence". */
  flag: string;
  values: Record<string, string>;
}

export interface PhilosopherAnalysis {
  argument: string;
  application: {
    byEnding: Record<string, string>;
    /** Keys look like "evidence=verified". */
    byFlag: Record<string, string>;
  };
  limitation: Record<string, string>;
  reference: string;
}

export interface Story {
  id: string;
  title: string;
  category: string;
  themes: string[];
  minutes: string;
  synopsis: string;
  disclaimer: string;
  tone: BackgroundId;
  start: string;
  characters: Record<string, Character>;
  nodes: Record<string, StoryNode>;
  endings: Record<string, Ending>;
  flagLabels: FlagLabel[];
  reflection: { conflicts: Record<string, string>; questions: string[] };
  analysis: {
    kant: PhilosopherAnalysis;
    mill: PhilosopherAnalysis;
    aristotle: PhilosopherAnalysis;
  };
}

/* ---------- State ---------- */

export interface DecisionRecord {
  nodeId: string;
  choiceId: string;
  timestamp: number;
}

export interface EngineState {
  valid: boolean;
  error?: string;
  /** All nodes reached on the path, in order. */
  path: string[];
  /** The decision node waiting for an answer, or null when complete/invalid. */
  pendingDecisionId: string | null;
  flags: Record<string, string>;
  selected: Record<string, string>;
  endingId: string | null;
  complete: boolean;
}

export type BeatKind = 'scene' | 'investigation' | 'decision' | 'reaction' | 'ending';

export interface Beat {
  key: string;
  kind: BeatKind;
  nodeId: string;
}

export interface Cursor {
  key: string;
  line: number;
}

export interface CompletedRun {
  endingId: string;
  history: DecisionRecord[];
  completedAt: number;
}

export interface StoryProgress {
  version: 1;
  storyId: string;
  history: DecisionRecord[];
  cursor: Cursor | null;
  /** Keyed by path key (choice ids joined by "."). */
  completed: Record<string, CompletedRun>;
  /** Evidence/memory fragments the player has inspected (item ids). Kept across restarts. */
  fragments: string[];
  updatedAt: number;
}
