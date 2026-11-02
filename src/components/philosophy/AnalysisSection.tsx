import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { getPhilosophy, getReferences } from '../../data';
import { useLang } from '../../i18n';
import type { PhilosopherId } from '../../data';
import type { Story } from '../../engine/types';
import { evaluate } from '../../engine/narrativeEngine';
import { PhilosopherPortrait } from './PhilosopherPortrait';

function stageOf(story: Story, flag: string): string {
  for (const n of Object.values(story.nodes)) {
    if (n.type === 'decision' && n.choices.some((c) => flag in c.sets)) return n.stage;
  }
  return '';
}

export function AnalysisSection({
  id,
  story,
  endingId,
  flags,
  active = true,
}: {
  id: PhilosopherId;
  story: Story;
  endingId: string;
  flags: Record<string, string>;
  active?: boolean;
}): ReactNode {
  const t = useT();
  const lang = useLang();
  const philosophyMeta = getPhilosophy(lang);
  const sourceReferences = getReferences(lang);
  const info = philosophyMeta.philosophers[id];
  const a = story.analysis[id];
  const ref = sourceReferences[a.reference as PhilosopherId];
  const conditional = (a.application.fragments ?? [])
    .filter((f) => evaluate(f.when, flags))
    .map((f, i) => ({ key: `c${i}`, stage: '', label: f.label, text: f.text }));
  const fragments = conditional.length || a.application.fragments ? conditional : story.flagLabels
    .filter((fl) => flags[fl.flag])
    .map((fl) => ({
      key: `${fl.flag}=${flags[fl.flag]}`,
      stage: stageOf(story, fl.flag),
      label: fl.values[flags[fl.flag]],
      text: a.application.byFlag[`${fl.flag}=${flags[fl.flag]}`],
    }));

  return (
    <section
      id={`analysis-${id}`}
      className={`phil-panel ${id}`}
      aria-labelledby={`h-${id}`}
      data-testid={`analysis-${id}`}
      role="tabpanel"
      hidden={!active}
    >
      <PhilosopherPortrait id={id} className="phil-backdrop" />
      <div className="phil-content">
        <h2 id={`h-${id}`} className="phil-name">{info.name}</h2>
        <p className="phil-section">{info.section.charAt(0) + info.section.slice(1).toLowerCase()}</p>
        <p className="phil-question">{info.question}</p>
        <ul className="chips" aria-label={t('Key concepts')}>{info.concepts.map((c) => <li key={c}>{c}</li>)}</ul>

        <div className="phil-block">
          <h3 className="meta-label">{t('From the source')} <span className="tag">{t('paraphrase')}</span></h3>
          <p>{a.argument}</p>
        </div>

        <div className="phil-block applied">
          <h3 className="meta-label blue">{t('Applied to your choices')} <span className="tag blue">{t('this game interpretation')}</span></h3>
          <p data-testid={`${id}-ending-text`}>{a.application.byEnding[endingId]}</p>
          <ul className="frag-list">
            {fragments.map((f) => (
              <li key={f.key}>
                <span className="frag-label">{f.stage ? `${f.stage} · ` : ''}{f.label}</span>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="phil-block">
          <h3 className="meta-label">{t('Limit or open question')}</h3>
          <p>{a.limitation[endingId]}</p>
        </div>

        <p className="source">
          <span className="meta-label">{t('Source')}</span> {ref.author}, <em>{ref.work}</em>, {ref.location}.
        </p>
      </div>
    </section>
  );
}
