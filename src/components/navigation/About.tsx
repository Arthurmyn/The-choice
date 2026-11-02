import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { getPhilosophy, getReferences } from '../../data';
import { useLang } from '../../i18n';
import type { Route } from '../../app/routes';
import { Shell } from './Shell';

export function About({ go }: { go: (r: Route) => void }): ReactNode {
  const t = useT();
  const lang = useLang();
  const philosophyMeta = getPhilosophy(lang);
  const sourceReferences = getReferences(lang);
  return (
    <Shell go={go} title={t('About')} bg="conference">
      <div className="about">
        <section>
          <h2 className="section-title">{t('The idea')}</h2>
          <p className="lede">{philosophyMeta.centralQuestion}</p>
          <p>{t('ECHO places you in realistic fictional situations where values collide: honesty and loyalty, privacy and transparency, duty and consequence. There are no morality points and no hidden score. After each story, three philosophical lenses describe what your choices might mean, without telling you what is right.')}</p>
        </section>
        <section>
          <h2 className="section-title">{t('How to play')}</h2>
          <ul className="plain">
            <li>{t('Click, Space, Enter or the right arrow advance dialogue. The left arrow goes back a line.')}</li>
            <li>{t('Keys 1, 2, 3 select an option during a decision; Enter confirms it. Every decision is confirmed before it is saved.')}</li>
            <li>{t('Inspect memory fragments during investigations. Everything you find is kept in the Memory Archive.')}</li>
            <li>{t('Progress is saved automatically after every confirmed decision, in this browser only.')}</li>
            <li>{t('After an ending, open the decision map to review branches you did not take. Reviewing never changes your save.')}</li>
          </ul>
        </section>
        <section>
          <h2 className="section-title">{t('Philosophical sources')}</h2>
          <ul className="plain">
            {philosophyMeta.order.map((id) => (
              <li key={id}><strong>{sourceReferences[id].author}</strong>, <em>{sourceReferences[id].work}</em>, {sourceReferences[id].location}.</li>
            ))}
          </ul>
          <p className="muted">{philosophyMeta.note}</p>
        </section>
        <section>
          <h2 className="section-title">{t('Credits')}</h2>
          <p>{t('Inspired in atmosphere by cinematic branching games. All characters, story, art and music are original; nothing is taken from any existing game. Voices are generated with open-source Kokoro and Silero text-to-speech models.')}</p>
          <p className="disclaimer">{t('Fictional scenarios. Consequences are simulated for philosophical discussion.')}</p>
        </section>
      </div>
    </Shell>
  );
}
