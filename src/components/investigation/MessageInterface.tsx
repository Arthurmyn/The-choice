import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import { joinVariants } from '../../engine/narrativeEngine';
import type { Character, ChatInteraction } from '../../engine/types';
import { useGame } from '../../hooks/useGameState';
import { useAudio } from '../../hooks/useAudio';

export function MessageInterface({
  chat,
  flags,
  characters,
  onDone,
  compact = false,
}: {
  chat: ChatInteraction;
  flags: Record<string, string>;
  characters: Record<string, Character>;
  /** Present for interactive chats: called when the exchange has finished. */
  onDone?: () => void;
  compact?: boolean;
}): ReactNode {
  const t = useT();
  const { settings } = useGame();
  const { play } = useAudio();
  const resolved = useMemo(() => chat.messages.map((m) => ({ from: m.from, text: joinVariants(m.parts, flags) })), [chat.messages, flags]);
  const interactive = !!chat.sendLabel;
  const firstMe = resolved.findIndex((m) => m.from === 'me');

  const [shown, setShown] = useState<number>(interactive ? Math.max(0, firstMe) : resolved.length);
  const [sent, setSent] = useState(false);
  const [typing, setTyping] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);
  const endRef = useRef<HTMLLIElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const delay = settings.reducedMotion ? 120 : 1100;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: settings.reducedMotion ? 'auto' : 'smooth' });
  }, [shown, typing, sent, receipt, settings.reducedMotion]);

  const send = (): void => {
    if (sent) return;
    setSent(true);
    play('notify');
    setShown(firstMe + 1);
    setReceipt(t('Sending…'));
    const timers: number[] = [];
    let tm = delay * 0.6;
    timers.push(window.setTimeout(() => setReceipt(chat.receipt?.text ?? t('Delivered')), tm));
    for (let i = firstMe + 1; i < resolved.length; i++) {
      timers.push(window.setTimeout(() => setTyping(true), tm));
      tm += delay;
      timers.push(
        window.setTimeout(() => {
          setTyping(false);
          setShown(i + 1);
          play('notify');
        }, tm),
      );
    }
    timers.push(window.setTimeout(() => doneRef.current?.(), tm + 350));
  };

  const who = (from: string): string => (from === 'me' ? t('You') : (characters[from]?.name ?? from));
  const visible = resolved.slice(0, shown);
  const lastMeIndex = visible.map((m) => m.from).lastIndexOf('me');

  return (
    <div className={`chat ${compact ? 'compact' : ''}`}>
      <header className="chat-head">
        <span className="chat-app">{chat.app}</span>
        <span className="chat-channel">{chat.channel}</span>
      </header>
      <ol className="chat-list" aria-label={`${chat.channel} conversation`}>
        {visible.map((m, i) => (
          <li key={i} className={`bubble ${m.from === 'me' ? 'me' : 'them'}`}>
            <span className="bubble-who">{who(m.from)}</span>
            <p>{m.text}</p>
            {i === lastMeIndex && receipt && <span className="bubble-receipt">{receipt}</span>}
          </li>
        ))}
        {typing && (
          <li className="bubble them typing" aria-label={t('Typing')}>
            <span className="dots"><i /><i /><i /></span>
          </li>
        )}
        <li ref={endRef} aria-hidden="true" />
      </ol>
      {interactive && !sent && (
        <div className="composer">
          <div className="composer-text" aria-label={t('Message to send')}>{resolved[firstMe]?.text}</div>
          <button type="button" className="cta" onClick={send} data-testid="send-message">
            {chat.sendLabel}
          </button>
        </div>
      )}
    </div>
  );
}
