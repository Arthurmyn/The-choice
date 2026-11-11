import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { stories } from '../data';
import { enumeratePaths, pathKey } from '../engine/narrativeEngine';
import { SETTINGS_KEY, storyKey } from '../engine/progressManager';
import { resolveEnding } from '../engine/endingResolver';

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
const story = stories[0];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reducedMotion: true, typewriter: false, subtitles: true, musicVolume: 0, sfxVolume: 0, textSize: 'medium', cameraMotion: false, lang: 'en' }));
  window.location.hash = '';
});
afterEach(() => cleanup());

const click = (el: HTMLElement) => act(() => { fireEvent.click(el); });

async function go(hash: string): Promise<void> {
  act(() => { window.location.hash = hash; });
  await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
}

/** Advance through whatever beat is on screen until `until` returns truthy. */
async function drive(choices: string[], until: () => boolean): Promise<void> {
  const choiceIds = new Set(choices);
  for (let guard = 0; guard < 400 && !until(); guard++) {
    const q = (id: string) => screen.queryByTestId(id);
    const notice = q('notice-continue');
    if (notice) { click(notice); continue; }
    const title = screen.queryByRole('button', { name: /Press to begin/ });
    if (title) { click(title); continue; }
    const ev = q('evidence-continue') as HTMLButtonElement | null;
    if (ev) { click(ev); continue; }
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
  if (!until()) throw new Error(`stuck: ${document.body.textContent?.slice(0, 200)}`);
}

const ind = (key: string) => screen.getByTestId(`ind-${key}`).getAttribute('aria-label');

describe('menu and chapters', () => {
  it('shows all menu options, the title and the tagline; Continue is disabled with no save', () => {
    render(<App />);
    for (const label of ['Continue', 'New Experience', 'Stories', 'Memory Archive', 'Settings', 'About']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByTestId('menu-continue')).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'ECHO' })).toBeInTheDocument();
    expect(screen.getByText('The Ethics of Survival')).toBeInTheDocument();
    expect(screen.getByText(/Your choices leave a trace/i)).toBeInTheDocument();
    expect(screen.getByText('0 of 9 endings')).toBeInTheDocument();
  });

  it('lists the three chapters, all playable, with disclaimer and playtime', async () => {
    render(<App />);
    await go('#/stories');
    for (const title of ['The Infected Survivor', 'The Last Medicine', 'Who Controls the Group?']) expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getAllByText('8-10 min')).toHaveLength(3);
    expect(screen.getAllByText(/Fictional scenario\. Consequences are simulated for philosophical discussion\./)).toHaveLength(3);
    for (const st of stories) expect(screen.getByTestId(`play-${st.id}`)).toBeEnabled();
    expect(screen.queryByText(/In development|Release Today|Last Journey|Speak for Someone/i)).toBeNull();
  });

  it('switches to Russian', async () => {
    render(<App />);
    click(screen.getByRole('button', { name: 'RU' }));
    expect(await screen.findByText('Этика выживания')).toBeInTheDocument();
    await go('#/stories');
    expect(await screen.findByText('Укушенная')).toBeInTheDocument();
    expect(screen.getByText('Последнее лекарство')).toBeInTheDocument();
    expect(screen.getByText('Кто управляет группой?')).toBeInTheDocument();
  });
});

describe('content notice', () => {
  it('appears before the first scene, can be left, and does not return once the story has begun', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    const notice = await screen.findByTestId('content-notice');
    expect(notice.textContent).toMatch(/death, coercion and fear/);
    expect(notice.textContent).toMatch(/leave at any time/);
    expect(notice.textContent).toMatch(/Nothing here is a recommendation about real events/);
    expect(screen.queryByRole('button', { name: /Press to begin/ })).toBeNull();
    click(screen.getByTestId('notice-continue'));
    expect(await screen.findByRole('button', { name: /Press to begin/ })).toBeInTheDocument();

    await drive(['isolate_force'], () => !!screen.queryByTestId('decision-screen'));
    click(screen.getByTestId('choice-isolate_force'));
    click(screen.getByTestId('confirm-button'));
    cleanup();
    render(<App />);
    expect(screen.queryByTestId('content-notice')).toBeNull();
  });
});

describe('indicators in the HUD', () => {
  it('show words and arrows, never numbers or a total', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive([], () => !!screen.queryByTestId('decision-screen'));
    const bar = screen.getByTestId('indicators');
    expect(bar.querySelectorAll('li')).toHaveLength(4);
    expect(bar.textContent).not.toMatch(/\d/);
    expect(['trust', 'safety', 'resources', 'participation'].map(ind)).toEqual([
      'Trust: Stable, unchanged', 'Safety: Stable, unchanged', 'Resources: Stable, unchanged', 'Participation: Stable, unchanged',
    ]);

    click(screen.getByTestId('choice-isolate_force'));
    click(screen.getByTestId('confirm-button'));
    await waitFor(() => expect(ind('trust')).toBe('Trust: Strained, falling'));
    expect(ind('safety')).toBe('Safety: Stable, rising');
    expect(ind('participation')).toBe('Participation: Strained, falling');
    expect(ind('resources')).toBe('Resources: Stable, unchanged');
    expect(screen.getByTestId('indicators').textContent).not.toMatch(/\d/);
  });
});

describe.each(stories.map((st) => [st.id, st] as const))('full UI playthrough of every path of %s', (_id, story) => {
  const paths = enumeratePaths(story);
  it.each(paths.map((p) => [pathKey(p), p] as const))('path %s', async (_k, history) => {
    const choices = history.map((h) => h.choiceId);
    render(<App />);
    await go(`#/play/${story.id}`);
    const resolved = resolveEnding(story, history)!;

    await drive(choices, () => !!screen.queryByTestId('ending-summary'));

    const summary = screen.getByTestId('ending-summary');
    expect(within(summary).getByRole('heading', { level: 2 }).textContent).toBe(resolved.ending.title);
    for (const f of resolved.fragments) expect(within(summary).getByText(f)).toBeInTheDocument();

    // "How the system worked" lists each decision made, and nothing is scored or ranked.
    const panel = within(summary).getByTestId('system-panel');
    for (const d of ['d1', history[1].nodeId, 'd3']) expect(within(panel).getByTestId(`system-${d}`)).toBeInTheDocument();
    expect(panel.querySelectorAll('ol > li')).toHaveLength(3);
    expect(summary.textContent).not.toMatch(/\bscore|\btotal\b|\bpoints\b|\bbest\b|\bworst\b|\bcorrect\b|\brank/i);

    // Saved progress matches the played path.
    const saved = JSON.parse(localStorage.getItem(storyKey(story.id))!);
    expect(saved.history.map((h: { choiceId: string }) => h.choiceId)).toEqual(choices);
    expect(Object.keys(saved.completed)).toEqual([pathKey(history)]);

    // Analysis: three philosophers, the lenses, the collision, three questions and the Kazakhstan card.
    click(within(summary).getByTestId('open-analysis'));
    const first = await screen.findByTestId('analysis-hobbes', undefined, { timeout: 4000 });
    expect(first.textContent).toContain(story.analysis.hobbes.application.byEnding[resolved.ending.id].slice(0, 60));
    for (const ph of Object.keys(story.analysis)) expect(screen.getByTestId(`analysis-${ph}`)).toBeInTheDocument();
    expect(screen.getByText('Where the principles collide')).toBeInTheDocument();
    expect(document.querySelectorAll('.questions li')).toHaveLength(3);
    if (story.id === 'infected-survivor') {
      expect(screen.getByTestId('lenses').textContent).toMatch(/Popper[\s\S]*Castells/);
      expect(screen.getByTestId('context-card').textContent).toMatch(/Kazakhstan[\s\S]*Amangeldinova et al\., 2020/);
    }

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
  it('resumes on the first decision after a reload, and after a decision', async () => {
    const { unmount } = render(<App />);
    await go(`#/play/${story.id}`);
    await drive(['isolate_force'], () => !!screen.queryByTestId('decision-screen'));
    unmount();
    render(<App />);
    expect(await screen.findByTestId('decision-screen')).toBeInTheDocument();
    expect(screen.getByText('DAWN')).toBeInTheDocument();
    for (const id of ['isolate_force', 'stay_watch', 'group_decide']) expect(screen.getByTestId(`choice-${id}`)).toBeInTheDocument();

    click(screen.getByTestId('choice-isolate_force'));
    click(screen.getByTestId('confirm-button'));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).history).toHaveLength(1));

    // Reload after the decision: lands in the reaction, not back on the decision.
    cleanup();
    render(<App />);
    expect(screen.queryByTestId('decision-screen')).toBeNull();
    expect(screen.getByTestId('dialogue')).toBeInTheDocument();
  });

  it('offers only the second decision that belongs to the first answer', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive(['stay_watch', 'let_leave'], () => !!screen.queryByTestId('decision-screen'));
    click(screen.getByTestId('choice-stay_watch'));
    click(screen.getByTestId('confirm-button'));
    await drive(['stay_watch', 'let_leave'], () => screen.queryByTestId('choice-let_leave') !== null);
    expect(screen.getByText('THE SHARE')).toBeInTheDocument();
    expect(screen.getByTestId('choice-forbid_leave')).toBeInTheDocument();
    expect(screen.queryByTestId('choice-key_marat')).toBeNull();
    expect(screen.queryByTestId('choice-all_vote')).toBeNull();
  });

  it('prevents choosing a decision twice', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive(['isolate_force'], () => !!screen.queryByTestId('decision-screen'));
    click(screen.getByTestId('choice-isolate_force'));
    const confirm = screen.getByTestId('confirm-button');
    click(confirm);
    click(confirm);
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).history).toHaveLength(1);
  });

  it('reopens a finished story on its ending when continued, and counts the endings found', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive(['group_decide', 'all_vote', 'group_challenge'], () => !!screen.queryByTestId('ending-summary'));
    const region = within(screen.getByTestId('ending-summary')).getByRole('region', { name: 'Endings found' });
    expect(region.textContent).toMatch(/1\/3/);
    expect(within(region).getByText('THE OPEN TABLE')).toBeInTheDocument();
    expect(within(region).queryByText('A SINGLE HAND')).toBeNull();

    cleanup();
    window.location.hash = '';
    render(<App />);
    expect(screen.getByText('1 of 9 endings')).toBeInTheDocument();
    const cont = screen.getByTestId('menu-continue');
    expect(cont).toBeEnabled();
    click(cont);
    expect(await screen.findByTestId('ending-summary', undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('restart keeps the endings found', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive(['isolate_force', 'key_marat', 'one_decides'], () => !!screen.queryByTestId('ending-summary'));
    await go('#/stories');
    click(await screen.findByTestId(`restart-${story.id}`));
    click(screen.getByTestId(`restart-yes-${story.id}`));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).history).toEqual([]));
    expect(Object.keys(JSON.parse(localStorage.getItem(storyKey(story.id))!).completed)).toHaveLength(1);
  });

  it('recovers from a corrupted save instead of crashing', async () => {
    localStorage.setItem(storyKey(story.id), '{{{ nope');
    render(<App />);
    expect(screen.getByText(/unreadable and has been reset/)).toBeInTheDocument();
    await go('#/stories');
    expect(await screen.findByText('The Infected Survivor')).toBeInTheDocument();
  });
});

describe('memory fragments and archive', () => {
  it('keeps inspected fragments and shows them in the Memory Archive', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive([], () => !!screen.queryByTestId('evidence-continue'));
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).fragments).toEqual([]);
    click(screen.getByRole('button', { name: /^The wound/ }));
    expect(screen.getByText(/Added to the Memory Archive/)).toBeInTheDocument();
    click(screen.getByRole('button', { name: /^Close/ }));
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).fragments).toEqual(['wound']);
    // Inspecting evidence here does not change the story, so it is not in the decision history.
    expect(JSON.parse(localStorage.getItem(storyKey(story.id))!).history).toEqual([]);

    cleanup();
    await go('#/archive');
    render(<App />);
    expect(await screen.findByText('Memory Archive')).toBeInTheDocument();
    expect(screen.getByText('1/9')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Undiscovered fragment')).toHaveLength(8);
  });

  it('shows the ambiguity honestly: the three items do not settle whether the bite is infectious', () => {
    const inv = Object.values(story.nodes).find((n) => n.type === 'investigation');
    if (inv?.type !== 'investigation') throw new Error();
    expect(inv.items.map((i) => i.finding).join(' ')).toMatch(/does not settle/);
    expect(inv.items.every((i) => !i.apply)).toBe(true);
  });
});

describe('settings and accessibility', () => {
  it('persists mute and settings', async () => {
    render(<App />);
    await go('#/settings');
    click(await screen.findByLabelText('Mute everything'));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).muted).toBe(true);
    click(screen.getByLabelText('Large'));
    expect(document.documentElement.dataset.textSize).toBe('large');
    click(screen.getByLabelText('Subtitles'));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).subtitles).toBe(false);
  });

  it('supports keyboard advance and back in scenes', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    click(await screen.findByTestId('notice-continue'));
    click(await screen.findByRole('button', { name: /Press to begin/ }));
    const first = screen.getByTestId('dialogue').textContent;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('dialogue').textContent).not.toBe(first);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByTestId('dialogue').textContent).toBe(first);
  });

  it('shows captions only when subtitles are on', async () => {
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive([], () => !!screen.queryByText(/chain rattles at the shutter/));
    expect(screen.getByText(/chain rattles at the shutter/)).toBeInTheDocument();
    cleanup();
    localStorage.clear();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ reducedMotion: true, typewriter: false, subtitles: false, lang: 'en' }));
    render(<App />);
    await go(`#/play/${story.id}`);
    await drive([], () => screen.queryAllByTestId('dialogue').length > 0 && /Aida came back/.test(screen.getByTestId('dialogue').textContent ?? ''));
    expect(screen.queryByText(/chain rattles at the shutter/)).toBeNull();
  });
});
