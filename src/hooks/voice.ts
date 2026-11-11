import type { VoiceProfile } from '../engine/types';
import type { Lang } from '../data';

export const NARRATOR: VoiceProfile = { gender: 'n', pitch: 0.95, rate: 0.93 };
const NARRATOR_ID = 'narrator';

/* Old robotic or novelty system voices. Never used. */
const BAD = /(fred|ralph|kathy|junior|albert|bad news|good news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|princess|agnes|bruce|vicki|victoria|grandma|grandpa|rocko|shelley|sandy|flo\b|eddy|reed)/i;
const PREMIUM = /(premium|enhanced|natural|neural|online|siri)/i;
const GOOD = /(milena|yuri|pavel|irina|svetlana|dmitry|samantha|alex\b|daniel|karen|moira|tessa|ava\b|allison|susan|tom\b|evan|nathan|oliver|serena|kate|fiona|aaron|google (us|uk))/i;
const FEMALE = /(milena|irina|svetlana|katya|tatyana|alena|anna\b|female|woman|samantha|karen|moira|tessa|victoria|fiona|allison|ava\b|susan|zira|hazel|serena|kate|veena|joanna|salli|kimberly|ivy|amy|emma|libby|sonia|jenny|aria|natasha|sara)/i;
const MALE = /(yuri|pavel|dmitry|maxim|\bmale\b|daniel|alex\b|tom\b|oliver|aaron|arthur|david|mark\b|george|ryan|guy|brian|matthew|joey|justin|eric|rishi|ravi|james|liam|thomas|evan|nathan|gordon)/i;

export type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang'>;

/** Higher is more natural-sounding. */
export function voiceScore(v: VoiceLike): number {
  return (PREMIUM.test(v.name) ? 4 : 0) + (GOOD.test(v.name) ? 2 : 0) + (/^en[-_](us|gb|au|ie)/i.test(v.lang) ? 1 : 0);
}

export interface CastMember {
  id: string;
  role?: string;
  voice?: VoiceProfile;
}

/**
 * Gives every cast member (and the narrator) the best remaining natural voice
 * of the right gender, so no two characters share a voice when avoidable.
 * Deterministic: depends only on the installed voices and the cast.
 */
export function assignVoices<T extends VoiceLike>(voices: readonly T[], cast: readonly CastMember[], lang = 'en'): Map<string, T> {
  const out = new Map<string, T>();
  const ok = voices.filter((v) => v.lang.toLowerCase().startsWith(lang) && !BAD.test(v.name));
  const pool = ok.length ? ok : voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  if (!pool.length) return out;
  const ranked = [...pool].sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
  const used = new Set<T>();
  const take = (candidates: readonly T[]): T => {
    const t = candidates.find((v) => !used.has(v)) ?? ranked.find((v) => !used.has(v)) ?? candidates[0] ?? ranked[0];
    used.add(t);
    return t;
  };
  // The protagonist is assigned first and gets the best voice of their gender,
  // then everyone else; the narrator takes the best voice that is left.
  const lead = (c: CastMember): number => (/\(you\)/i.test(c.role ?? '') || c.id === 'player' ? 0 : 1);
  const people = [...cast].sort((a, b) => lead(a) - lead(b) || a.id.localeCompare(b.id));
  for (const c of people) {
    const g = c.voice?.gender ?? 'n';
    const matches = ranked.filter((v) => (g === 'f' ? FEMALE.test(v.name) : g === 'm' ? MALE.test(v.name) && !FEMALE.test(v.name) : true));
    out.set(c.id, take(matches.length ? matches : ranked));
  }
  out.set(NARRATOR_ID, take(ranked));
  return out;
}

type Manifest = Record<string, string>;

class VoiceEngine {
  private enabled = true;
  private volume = 0.9;
  private lang: Lang = 'en';
  private voices: SpeechSynthesisVoice[] = [];
  private cast: CastMember[] = [];
  private map = new Map<string, SpeechSynthesisVoice>();
  private timer = 0;
  private listening = false;
  private manifests = new Map<Lang, Manifest | null>();
  private pending = new Map<Lang, Promise<Manifest | null>>();
  private audio: HTMLAudioElement | null = null;
  private token = 0;
  /** False for stories that have no recorded clips. */
  private recorded = true;

  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  private refresh(): void {
    this.voices = window.speechSynthesis.getVoices();
    this.map = assignVoices(this.voices, this.cast, this.lang);
  }

  /** Register the characters of the story being played. */
  setCast(cast: CastMember[]): void {
    this.cast = cast;
    if (!this.supported) return;
    if (!this.listening) {
      this.listening = true;
      window.speechSynthesis.addEventListener?.('voiceschanged', () => this.refresh());
    }
    this.refresh();
  }

  setRecorded(on: boolean): void {
    this.recorded = on;
  }

  configure(enabled: boolean, volume: number, lang: Lang = this.lang): void {
    const langChanged = lang !== this.lang;
    this.enabled = enabled;
    this.volume = volume;
    this.lang = lang;
    if (this.audio) this.audio.volume = volume;
    if (langChanged && this.supported && this.cast.length) this.refresh();
    if (!enabled || volume === 0) this.cancel();
  }

  private manifest(lang: Lang): Promise<Manifest | null> {
    const have = this.manifests.get(lang);
    if (have !== undefined) return Promise.resolve(have);
    let p = this.pending.get(lang);
    if (!p) {
      const base = import.meta.env.BASE_URL ?? '/';
      p = fetch(`${base}voice/${lang}/manifest.json`)
        .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
        .catch(() => null)
        .then((m) => {
          this.manifests.set(lang, m);
          return m;
        });
      this.pending.set(lang, p);
    }
    return p;
  }

  /** Recorded neural voice first, the browser's own speech synthesis as a fallback. */
  speak(text: string, profile: VoiceProfile, id: string, lang: Lang = this.lang): void {
    if (lang !== this.lang) this.configure(this.enabled, this.volume, lang);
    if (!this.enabled || this.volume === 0) return;
    const token = ++this.token;
    this.stop();
    const speaker = id === NARRATOR_ID ? NARRATOR_ID : id;
    void this.manifest(this.lang).then((m) => {
      if (token !== this.token) return; // a newer line replaced this one
      const file = this.recorded ? m?.[`${speaker}|${text}`] : undefined;
      if (file && typeof Audio !== 'undefined') {
        const a = new Audio(`${import.meta.env.BASE_URL ?? '/'}voice/${this.lang}/${file}`);
        a.volume = this.volume;
        this.audio = a;
        a.play().catch(() => this.synth(text, profile, speaker));
        return;
      }
      this.synth(text, profile, speaker);
    });
  }

  private synth(text: string, profile: VoiceProfile, id: string): void {
    if (!this.supported) return;
    if (!this.voices.length) this.refresh();
    window.clearTimeout(this.timer);
    window.speechSynthesis.cancel();
    // Chrome drops a speak() issued in the same tick as cancel().
    this.timer = window.setTimeout(() => {
      const u = new SpeechSynthesisUtterance(text);
      const v = this.map.get(id);
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = this.lang === 'ru' ? 'ru-RU' : 'en-US';
      u.pitch = profile.pitch;
      u.rate = profile.rate;
      u.volume = this.volume;
      window.speechSynthesis.speak(u);
    }, 30);
  }

  private stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (this.supported) {
      window.clearTimeout(this.timer);
      window.speechSynthesis.cancel();
    }
  }

  cancel(): void {
    this.token++;
    this.stop();
  }
}

export const voice = new VoiceEngine();
