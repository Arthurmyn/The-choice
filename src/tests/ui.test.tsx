import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { stories as allStories } from '../data';

const stories = allStories.filter((s) => s.exhaustive !== false);
import { enumeratePaths, pathKey } from '../engine/narrativeEngine';
import { SETTINGS_KEY, emptyProgress, saveProgress, storyKey, withDecision } from '../engine/progressManager';
import { readFileSync } from 'node:fs';
import { resolveEnding } from '../engine/endingResolver';
import type { Story } from '../engine/types';

// Animation libraries are not under test; render children immediately.
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const strip = (tag: string) =>
    React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => {
      const rest = Object.fromEntries(Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'variants', 'layout', 'custom'].includes(k) && !k.startsWith('while')));
      return React.createElement(tag, { ...rest, ref }, children as ReactNode);
    });
  const cache = new Map<string, ReturnType<typeof strip>>();
  const motion = new Proxy({}, {
    get: (_t, tag: string) => {
      if (!cache.has(tag)) cache.set(tag, strip(tag));
      return cache.get(tag);
    },
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    MotionConfig: ({ children }: { children: ReactNode }) => children,
  };
});

const { App } = await import('../app/App');

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reducedMotion: true, typewriter: false, subtitles: true, musicVolume: 0, sfxVolume: 0, textSize: 'medium', cameraMotion: false }));
  window.location.hash = '';
});
afterEach(() => cleanup());

const click = (el: HTMLElement) => act(() => { fireEvent.click(el); });

async function go(hash: string): Promise<void> {
  act(() => { window.location.hash = hash; });
  await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
}

/** Advance through whatever beat is on screen until `until` returns truthy. */
async function drive(story: Story, choices: string[], until: () => boolean): Promise<void> {
  const choiceIds = new Set(choices);
  for (let guard = 0; guard < 400 && !until(); guard++) {
    const q = (id: string) => screen.queryByTestId(id);
    const title = screen.queryByRole('button', { name: /Press to begin/ });
    if (title) { click(title); continue; }
    if (q('interaction')) {
      const inter = q('interaction')!;
      const cont = q('interaction-continue') as HTMLButtonElement;
      if (!cont.disabled) { click(cont); continue; }
      const send = q('send-message');
      if (send) { click(send); }
      else if (q('run-test')) {
        const radios = within(inter).getAllByRole('radio') as HTMLInputElement[];
        click(radios[0]); // Harbor / sign in as
        click(radios[radios.length / 2 + 2]); // Brightwell / owner
        click(q('run-test') as HTMLElement);
      } else if (q('step-0')) {
        for (let i = 0; i < 3; i++) {
          const b = await screen.findByTestId(`step-${i}`);
          await waitFor(() => expect((b as HTMLButtonElement).disabled).toBe(false), { timeout: 3000 });
          click(b);
          await waitFor(() => expect(inter.querySelectorAll('.step.done').length).toBe(i + 1), { timeout: 3000 });
        }
      } else {
        for (const h of within(inter).getAllByRole('button', { pressed: false })) click(h);
      }
      await waitFor(() => expect((q('interaction-continue') as HTMLButtonElement | null)?.disabled ?? false).toBe(false), { timeout: 5000 });
      continue;
    }
    const ev = q('evidence-continue') as HTMLButtonElement | null;
    if (ev) {
      if (ev.disabled) {
        for (const b of screen.getAllByRole('button', { name: /required/i })) {
          click(b);
          click(screen.getByRole('button', { name: /^Close/ }));
        }
        continue;
      }
      click(ev);
      continue;
    }
    if (q('confirm-button')) {
      const id = [...choiceIds].find((c) => q(`choice-${c}`));
      if (!id) throw new Error('no choice found');
      click(q(`choice-${id}`)!);
      click(q('confirm-button')!);
      continue;
    }
    const rc = q('result-continue');
    if (rc) { click(rc); continue; }
    const next = q('next-line');
    if (next) { click(next); continue; }
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  if (!until()) throw new Error(`stuck in ${story.id}: ${document.body.textContent?.slice(0, 200)}`);
}

describe('menu', () => {
  it('shows all menu options; Continue is disabled with no save', () => {
    render(<App />);
    for (const label of ['Continue', 'New Experience', 'Stories', 'Memory Archive', 'Settings', 'About']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByTestId('menu-continue')).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'ECHO' })).toBeInTheDocument();
    expect(screen.getByText(/Your choices leave a trace/i)).toBeInTheDocument();
  });

  it('lists both stories with disclaimer and playtime', async () => {
    render(<App />);
    await go('#/stories');
    expect(await screen.findByText('RELEASE TODAY')).toBeInTheDocument();
    expect(screen.getByText('SPEAK FOR SOMEONE ELSE')).toBeInTheDocument();
    expect(screen.getAllByText(/Fictional scenario\. Consequences are simulated for philosophical discussion\./).length).toBe(3);
    expect(screen.getByText('THE LAST JOURNEY')).toBeInTheDocument();
    expect(screen.getByText('5–7 min')).toBeInTheDocument();
  });
});

describe.each(stories.map((s) => [s.id, s] as const))('full UI playthrough of %s', (_id, story) => {
  const paths = enumeratePaths(story);
  it.each(paths.map((p) => [pathKey(p), p] as const))('path %s', async (_k, history) => {
    const choices = history.map((h) => h.choiceId);
    render(<App />);
    await go(`#/play/${story.id}`);
    const endingText = resolveEnding(story, history)!;

    await drive(story, choices, () => !!screen.queryByTestId('ending-summary'));

    const summary = screen.getByTestId('ending-summary');
    expect(within(summary).getByRole('heading', { level: 2 }).textContent).toBe(endingText.ending.title);
    for (const f of endingText.fragments) expect(within(summary).getByText(f)).toBeInTheDocument();

    // Saved progress matches the played path.
    const saved = JSON.parse(localStorage.getItem(storyKey(story.id))!);
    expect(saved.history.map((h: { choiceId: string }) => h.choiceId)).toEqual(choices);
    expect(Object.keys(saved.completed)).toEqual([pathKey(history)]);

    // Analysis reflects the real ending.
    click(within(summary).getByTestId('open-analysis'));
    const kant = await screen.findByTestId('analysis-kant', undefined, { timeout: 4000 });
    expect(kant.textContent).toContain(story.analysis.kant.application.byEnding[endingText.ending.id].slice(0, 60));
    expect(screen.getByTestId('analysis-mill')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-aristotle')).toBeInTheDocument();

    // Map highlights the path and review does not alter the save.
    const before = localStorage.getItem(storyKey(story.id));
    await go(`#/map/${story.id}/${pathKey(history)}`);
    const map = await screen.findByTestId('decision-map', undefined, { timeout: 4000 });
    expect(map.querySelectorAll('.map-node.visited').length).toBe(8);
    expect(map.querySelectorAll('.map-edge.active').length).toBe(7);
    const alt = map.querySelector('.map-node.unvisited') as SVGElement;
    fireEvent.click(alt);
    expect(screen.getAllByText(/not taken|not reached/i).length).toBeGreaterThan(0);
    expect(localStorage.getItem(storyKey(story.id))).toBe(before);
  }, 30000);
});

describe('persistence and restart', () => {
  const story = stories[0];

  it('resumes mid-scene and after a decision after reload', async () => {
    const { unmount } = render(<App />);
    await go(`#/play/${story.id}`);
    await drive(story, ['verify'], () => !!screen.queryByTestId('decision-screen'));
    // Reload on the first decision
    unmount();
    render(<App />);
    expect(await screen.findByTestId('decision-screen')).toBeInTheDocument();
    expect(screen.getByText('VERIFY THE EVIDENCE')).toBeInTheDocument();

    click(screen.getByTestId('choice-verify'));
    click(screen.getByTestId('confirm-button'));
    expect(await screen.findByTestId('interaction')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).history).toHaveLength(1);

    // Reload after the decision: lands in the reaction, not back on the decision.
    cleanup();
    render(<App />);
    expect(screen.queryByTestId('decision-screen')).toBeNull();
    expect(screen.getByTestId('interaction') || screen.getByTestId('dialogue')).toBeTruthy();
  });

  it('prevents choosing a decision twice', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive(story, ['verify'], () => !!screen.queryByTestId('decision-screen'));
    click(screen.getByTestId('choice-verify'));
    const confirm = screen.getByTestId('confirm-button');
    click(confirm);
    click(confirm);
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).history).toHaveLength(1);
  });

  it('restarts one story without touching the other or completed endings', async () => {
    const s0 = stories[0];
    const s1 = stories[1];
    render(<App />);
    await go(`#/play/${s0.id}`);
    await drive(s0, ['verify', 'disclose', 'postpone'], () => !!screen.queryByTestId('ending-summary'));
    await go(`#/play/${s1.id}`);
    await drive(s1, ['ask'], () => !!screen.queryByTestId('decision-screen'));
    click(screen.getByTestId('choice-ask'));
    click(screen.getByTestId('confirm-button'));
    const s1Saved = localStorage.getItem(storyKey(s1.id));

    await go('#/stories');
    click(await screen.findByTestId(`restart-${s0.id}`));
    click(screen.getByTestId(`restart-yes-${s0.id}`));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storyKey(s0.id))!).history).toEqual([]));
    expect(Object.keys(JSON.parse(localStorage.getItem(storyKey(s0.id))!).completed)).toHaveLength(1);
    expect(localStorage.getItem(storyKey(s1.id))).toBe(s1Saved);
  });

  it('reopens a finished story on its ending when continued', async () => {
    const s0 = stories[0];
    render(<App />);
    await go(`#/play/${s0.id}`);
    await drive(s0, ['trust-report', 'delay', 'full'], () => !!screen.queryByTestId('ending-summary'));
    cleanup();
    window.location.hash = '';
    render(<App />);
    const cont = screen.getByTestId('menu-continue');
    expect(cont).toBeEnabled();
    click(cont);
    expect(await screen.findByTestId('ending-summary', undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('lists the endings found on the ending screen, hides the ones not found, and keeps the count after restarting', async () => {
    const s0 = stories[0];
    render(<App />);
    await go(`#/play/${s0.id}`);
    await drive(s0, ['verify', 'disclose', 'postpone'], () => !!screen.queryByTestId('ending-summary'));
    const region = within(screen.getByTestId('ending-summary')).getByRole('region', { name: 'Endings found' });
    expect(region.textContent).toMatch(/1\/3/);
    expect(within(region).getByText('POSTPONED')).toBeInTheDocument();
    expect(within(region).getByText('Ending 2')).toBeInTheDocument();
    expect(within(region).queryByText('LIMITED RELEASE')).toBeNull();

    await go('#/stories');
    click(await screen.findByTestId(`restart-${s0.id}`));
    click(screen.getByTestId(`restart-yes-${s0.id}`));
    await go('#/stories');
    expect(within(await screen.findByTestId(`story-${s0.id}`)).getByText('1 of 3 endings')).toBeInTheDocument();
  });

  it('recovers from a corrupted save instead of crashing', async () => {
    localStorage.setItem(storyKey(stories[0].id), '{{{ nope');
    render(<App />);
    expect(screen.getByText(/unreadable and has been reset/)).toBeInTheDocument();
    await go('#/stories');
    expect(await screen.findByText('RELEASE TODAY')).toBeInTheDocument();
  });
});

describe('memory fragments and archive', () => {
  const story = stories[0];

  it('keeps inspected fragments across reloads and shows them in the Memory Archive', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive(story, ['verify'], () => !!screen.queryByTestId('evidence-continue'));
    // Nothing found yet.
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).fragments).toEqual([]);
    click(screen.getByRole('button', { name: /Security report #214, required/ }));
    expect(screen.getByText(/Added to the Memory Archive/)).toBeInTheDocument();
    click(screen.getByRole('button', { name: /^Close/ }));
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).fragments).toEqual(['report']);

    cleanup();
    await go('#/archive');
    render(<App />);
    expect(await screen.findByText('Memory Archive')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`^1/${8 + 33}$`))).toBeInTheDocument();
    expect(screen.getByText(/Report #214|Security report #214/)).toBeInTheDocument();
    expect(screen.getAllByLabelText('Undiscovered fragment').length).toBe(7 + 33);
  });

  it('does not lose fragments when a story is restarted', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive(story, ['verify'], () => !!screen.queryByTestId('evidence-continue'));
    click(screen.getByRole('button', { name: /Security report #214, required/ }));
    click(screen.getByRole('button', { name: /^Close/ }));
    await go('#/stories');
    click(await screen.findByTestId(`restart-${story.id}`));
    click(screen.getByTestId(`restart-yes-${story.id}`));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).history).toEqual([]));
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).fragments).toEqual(['report']);
  });

  it('loads old saves that have no fragments field', async () => {
    localStorage.setItem(storyKey(story.id), JSON.stringify({ version: 1, storyId: story.id, history: [], cursor: null, completed: {}, updatedAt: 1 }));
    render(<App />);
    expect(screen.queryByText(/unreadable/)).toBeNull();
  });
});

describe('settings and accessibility', () => {
  it('persists mute', async () => {
    render(<App />);
    await go('#/settings');
    click(await screen.findByLabelText('Mute everything'));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).muted).toBe(true);
  });

  it('persists settings', async () => {
    render(<App />);
    await go('#/settings');
    click(await screen.findByLabelText('Large'));
    expect(document.documentElement.dataset.textSize).toBe('large');
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).textSize).toBe('large');
    click(screen.getByLabelText('Subtitles'));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).subtitles).toBe(false);
    fireEvent.change(screen.getByLabelText('Music volume'), { target: { value: '30' } });
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).musicVolume).toBe(0.3);
  });

  it('supports keyboard advance and back in scenes', async () => {
    render(<App />);
    await go(`#/play/${stories[0].id}`);
    click(await screen.findByRole('button', { name: /Press to begin/ }));
    const first = screen.getByTestId('dialogue').textContent;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('dialogue').textContent).not.toBe(first);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('dialogue').textContent).toBe(first);
  });

  it('shows captions only when subtitles are on', async () => {
    render(<App />);
    await go(`#/play/${stories[0].id}`);
    expect(await screen.findByText(/hum of air conditioning/)).toBeInTheDocument();
    cleanup();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reducedMotion: true, typewriter: false, subtitles: false }));
    render(<App />);
    await go(`#/play/${stories[0].id}`);
    await screen.findByRole('button', { name: /Press to begin/ });
    expect(screen.queryByText(/hum of air conditioning/)).toBeNull();
  });
});


describe('The Last Journey in the app', () => {
  const lj = allStories[2];
  const fixtures = JSON.parse(readFileSync('src/tests/fixtures/lastJourney.paths.json', 'utf8')) as Record<string, { nodeId: string; choiceId: string }[]>;

  it('shows the chapter and shared supplies, records evidence that changes the story, and does not show the future', async () => {
    render(<App />);
    await go(`#/play/${lj.id}`);
    await drive(lj, ['help'], () => !!screen.queryByTestId('evidence-continue'));
    expect(screen.getByLabelText('Food: 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Fuel: 5')).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/Chapter 1/);

    // Inspecting the fuel tank changes the story, so it is saved in this run's history.
    click(screen.getByRole('button', { name: /Fuel tank hatch/ }));
    click(screen.getByRole('button', { name: /^Close/ }));
    expect(screen.getByLabelText('Fuel: 6')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(storyKey(lj.id))!).history.map((h: { choiceId: string }) => h.choiceId)).toContain('item:c1_tank');

    await drive(lj, ['help'], () => !!screen.queryByTestId('decision-screen'));
    expect(screen.getByText('THE CHILD IN THE STORAGE ROOM')).toBeInTheDocument();
    for (const id of ['help', 'leave', 'send_leo', 'split']) expect(screen.getByTestId(`choice-${id}`)).toBeInTheDocument();
    click(screen.getByTestId('choice-help'));
    click(screen.getByTestId('confirm-button'));
    // Food drops by one for sharing. The night's theft has not happened yet, so it is not shown.
    await waitFor(() => expect(screen.getByLabelText('Food: 3')).toBeInTheDocument());
  });

  it('keeps going after a reload and resumes on the same beat', async () => {
    const { unmount } = render(<App />);
    await go(`#/play/${lj.id}`);
    await drive(lj, ['help'], () => !!screen.queryByTestId('decision-screen'));
    unmount();
    render(<App />);
    expect(await screen.findByTestId('decision-screen')).toBeInTheDocument();
  });

  it('shows the endings found, in the story list, on the ending screen and in the Memory Archive', async () => {
    const h = fixtures.TOGETHER.map((r, i) => ({ ...r, timestamp: i }));
    saveProgress(withDecision(lj, emptyProgress(lj.id), h, 5));
    render(<App />);
    await go('#/stories');
    const card = await screen.findByTestId(`story-${lj.id}`);
    expect(within(card).getByText('1 of 7 endings')).toBeInTheDocument();
    await go('#/');
    expect(screen.getByText('1 of 13 endings')).toBeInTheDocument();
    await go('#/archive');
    click(await screen.findByRole('tab', { name: /Decision paths/ }));
    const regions = screen.getAllByRole('region', { name: 'Endings found' });
    expect(regions.map((r) => r.textContent).join(' ')).toMatch(/1\/7/);
  });

  it('draws the decision map for a finished campaign with all seven endings', async () => {
    const h = fixtures.ALONE.map((r, i) => ({ ...r, timestamp: i }));
    saveProgress(withDecision(lj, emptyProgress(lj.id), h, 5));
    render(<App />);
    await go(`#/map/${lj.id}/latest`);
    const map = await screen.findByTestId('decision-map', undefined, { timeout: 4000 });
    expect(map.querySelectorAll('.map-node.ending').length).toBe(7);
    const decisions = h.filter((r) => !r.choiceId.startsWith('item:')).length;
    expect(map.querySelectorAll('.map-node.visited').length).toBe(1 + decisions * 2 + 1);
    expect(map.querySelectorAll('.map-edge.active').length).toBeGreaterThan(decisions);
  });

  it('shows the philosophical analysis for the reached ending', async () => {
    const h = fixtures.BETRAYAL.map((r, i) => ({ ...r, timestamp: i }));
    saveProgress(withDecision(lj, emptyProgress(lj.id), h, 5));
    render(<App />);
    await go(`#/analysis/${lj.id}/latest`);
    const kant = await screen.findByTestId('analysis-kant', undefined, { timeout: 4000 });
    expect(kant.textContent).toContain('betrayal is a clean violation');
    expect(screen.getByTestId('analysis-mill')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-aristotle')).toBeInTheDocument();
  });
});
