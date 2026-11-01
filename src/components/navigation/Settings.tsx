import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { useGame } from '../../hooks/useGameState';
import type { TextSize } from '../../hooks/useGameState';
import { audio } from '../../hooks/useAudio';
import { voice } from '../../hooks/voice';
import type { Route } from '../../app/routes';
import { Shell } from './Shell';

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <div className="setting">
      <div>
        <label htmlFor={id} className="setting-label">{label}</label>
        <p className="muted">{hint}</p>
      </div>
      <input id={id} type="checkbox" role="switch" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

function Slider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }): ReactNode {
  return (
    <div className="setting">
      <label htmlFor={id} className="setting-label">{label}</label>
      <div className="slider-row">
        <input id={id} type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} aria-valuetext={`${Math.round(value * 100)} percent`} />
        <output htmlFor={id}>{Math.round(value * 100)}%</output>
      </div>
    </div>
  );
}

export function Settings({ go }: { go: (r: Route) => void }): ReactNode {
  const t = useT();
  const { settings, updateSettings } = useGame();
  const [fs, setFs] = useState<boolean>(!!document.fullscreenElement);
  const canFs = typeof document.documentElement.requestFullscreen === 'function';

  useEffect(() => {
    const onChange = (): void => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFs = (): void => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <Shell go={go} title={t('Settings')} bg="city-night">
      <div className="settings">
        <section aria-labelledby="s-audio">
          <h2 id="s-audio" className="section-title">{t('Sound')}</h2>
          <Toggle id="mute" label={t('Mute everything')} hint={t('Silences music, ambience and interface sounds.')} checked={settings.muted} onChange={(v) => updateSettings({ muted: v })} />
          <Slider id="music" label={t('Music volume')} value={settings.musicVolume} onChange={(v) => { updateSettings({ musicVolume: v }); audio.setVolumes(settings.muted ? 0 : v, settings.muted ? 0 : settings.sfxVolume); audio.unlock(); }} />
          <Slider id="sfx" label={t('Sound effects and ambience volume')} value={settings.sfxVolume} onChange={(v) => { updateSettings({ sfxVolume: v }); audio.setVolumes(settings.muted ? 0 : settings.musicVolume, settings.muted ? 0 : v); audio.unlock(); audio.play('select'); }} />
          <Toggle id="voice" label={t('Character voices')} hint={voice.supported ? t('Each character is voiced by a different natural voice.') : t('Recorded voices play when available; otherwise this browser has no speech synthesis, so voices are off.')} checked={settings.voiceOn} onChange={(v) => updateSettings({ voiceOn: v })} />
          <Slider id="voicevol" label={t('Voice volume')} value={settings.voiceVolume} onChange={(v) => updateSettings({ voiceVolume: v })} />
          <p className="muted">{t('Music and effects are generated in your browser. The game is fully playable with all audio at zero.')}</p>
        </section>
        <section aria-labelledby="s-text">
          <h2 id="s-text" className="section-title">{t('Text')}</h2>
          <div className="setting">
            <span className="setting-label" id="textsize-l">{t('Text size')}</span>
            <div role="radiogroup" aria-labelledby="textsize-l" className="seg">
              {(['small', 'medium', 'large'] as TextSize[]).map((s) => (
                <label key={s} className={settings.textSize === s ? 'on' : ''}>
                  <input type="radio" name="textsize" checked={settings.textSize === s} onChange={() => updateSettings({ textSize: s })} />
                  {t(s === 'small' ? 'Small' : s === 'large' ? 'Large' : 'Medium')}
                </label>
              ))}
            </div>
          </div>
          <Toggle id="subs" label={t('Subtitles')} hint={t('Show captions that describe ambient sounds during scenes.')} checked={settings.subtitles} onChange={(v) => updateSettings({ subtitles: v })} />
        </section>
        <section aria-labelledby="s-motion">
          <h2 id="s-motion" className="section-title">{t('Motion')}</h2>
          <Toggle id="rm" label={t('Reduced motion')} hint={t('Removes transitions, camera drift and typing effects.')} checked={settings.reducedMotion} onChange={(v) => updateSettings({ reducedMotion: v })} />
          <Toggle id="tw" label={t('Gradual text reveal')} hint={t('Dialogue appears letter by letter. You can always skip it.')} checked={settings.typewriter} onChange={(v) => updateSettings({ typewriter: v })} />
          <Toggle id="cam" label={t('Camera drift')} hint={t('Slow movement in scene backgrounds.')} checked={settings.cameraMotion} onChange={(v) => updateSettings({ cameraMotion: v })} />
        </section>
        <section aria-labelledby="s-display">
          <h2 id="s-display" className="section-title">{t('Display')}</h2>
          <div className="setting">
            <span className="setting-label" id="lang-l">{t('Language')}</span>
            <div role="radiogroup" aria-labelledby="lang-l" className="seg">
              {(['en', 'ru'] as const).map((l) => (
                <label key={l} className={settings.lang === l ? 'on' : ''}>
                  <input type="radio" name="lang" checked={settings.lang === l} onChange={() => updateSettings({ lang: l })} />
                  {l === 'en' ? 'English' : 'Русский'}
                </label>
              ))}
            </div>
          </div>
          <div className="setting">
            <div>
              <span className="setting-label">{t('Fullscreen')}</span>
              <p className="muted">{canFs ? t('Immerse yourself in the story.') : t('Fullscreen is not supported by this browser.')}</p>
            </div>
            <button type="button" className="chip-btn" onClick={toggleFs} disabled={!canFs} aria-pressed={fs}>{fs ? t('Exit fullscreen') : t('Enter fullscreen')}</button>
          </div>
        </section>
      </div>
    </Shell>
  );
}
