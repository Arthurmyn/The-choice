import { useCallback, useEffect, useState } from 'react';

/** Reveals text gradually. `finish()` completes it instantly. */
export function useTypewriter(text: string, enabled: boolean, charsPerSecond = 62): { shown: string; done: boolean; finish: () => void } {
  const [count, setCount] = useState(enabled ? 0 : text.length);

  useEffect(() => {
    if (!enabled) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let raf = 0;
    const start = performance.now();
    const step = (now: number): void => {
      const n = Math.min(text.length, Math.floor(((now - start) / 1000) * charsPerSecond));
      setCount(n);
      if (n < text.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, enabled, charsPerSecond]);

  const finish = useCallback(() => setCount(text.length), [text]);
  return { shown: text.slice(0, count), done: count >= text.length, finish };
}
