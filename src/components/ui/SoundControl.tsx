import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../../i18n';
import { useGame } from '../../hooks/useGameState';
import { Icon } from './Icon';

/** HUD mute toggle with a small volume popover. Nothing plays until the player interacts. */
export function SoundControl(): ReactNode {
  const t = useT();
  const { settings, updateSettings } = useGame();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="sound" ref={box}>
      <button type="button" className="icon-btn" aria-label={t('Sound controls')} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name={settings.muted ? 'mute' : 'volume'} />
      </button>
      {open && (
        <div className="sound-pop" role="group" aria-label={t('Sound')}>
          <button type="button" className="chip-btn" aria-pressed={settings.muted} onClick={() => updateSettings({ muted: !settings.muted })}>
            {settings.muted ? t('Unmute') : t('Mute all')}
          </button>
          <label>
            <span>{t('Music')}</span>
            <input type="range" min={0} max={100} value={Math.round(settings.musicVolume * 100)} onChange={(e) => updateSettings({ musicVolume: Number(e.target.value) / 100 })} />
          </label>
          <label>
            <span>{t('Voices')}</span>
            <input type="range" min={0} max={100} value={Math.round(settings.voiceVolume * 100)} onChange={(e) => updateSettings({ voiceVolume: Number(e.target.value) / 100, voiceOn: Number(e.target.value) > 0 })} />
          </label>
          <label>
            <span>{t('Effects')}</span>
            <input type="range" min={0} max={100} value={Math.round(settings.sfxVolume * 100)} onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) / 100 })} />
          </label>
        </div>
      )}
    </div>
  );
}
