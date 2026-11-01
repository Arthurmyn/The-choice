import type { ReactNode } from 'react';
import type { PhilosopherId } from '../../data';

/**
 * Engraved-style busts in cool stone tones. Stylised on purpose: they are
 * illustrations, not likenesses, and they stay out of the way of the text.
 */
export function PhilosopherPortrait({ id, className = '' }: { id: PhilosopherId; className?: string }): ReactNode {
  const g = `stone-${id}`;
  return (
    <svg className={`phil-svg ${className}`} viewBox="0 0 200 240" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9d6e4" />
          <stop offset="0.55" stopColor="#6d8196" />
          <stop offset="1" stopColor="#1d2a38" />
        </linearGradient>
        <linearGradient id={`${g}-dark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7b8ea3" />
          <stop offset="1" stopColor="#101a25" />
        </linearGradient>
        <linearGradient id={`${g}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.72" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`${g}-m`}>
          <rect width="200" height="240" fill={`url(#${g}-fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${g}-m)`}>
        {id === 'kant' && (
          <g>
            <path d="M10 240 C14 190 52 176 100 174 C148 176 186 190 190 240Z" fill={`url(#${g}-dark)`} />
            <path d="M82 176 L100 214 L118 176 L108 170 L92 170Z" fill="#dbe5ef" opacity="0.9" />
            <rect x="86" y="148" width="28" height="30" rx="8" fill={`url(#${g})`} />
            <ellipse cx="100" cy="104" rx="34" ry="44" fill={`url(#${g})`} />
            <path d="M62 100 C56 44 144 44 138 100 C132 70 112 60 100 60 C88 60 68 70 62 100Z" fill="#e6edf5" opacity="0.92" />
            <g fill="#e6edf5" opacity="0.88">
              <ellipse cx="58" cy="116" rx="11" ry="9" />
              <ellipse cx="55" cy="134" rx="10" ry="8" />
              <ellipse cx="142" cy="116" rx="11" ry="9" />
              <ellipse cx="145" cy="134" rx="10" ry="8" />
            </g>
            <path d="M80 98 q8 -5 16 0 M104 98 q8 -5 16 0" stroke="#0f1822" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M82 108 q7 4 14 0 M104 108 q7 4 14 0" stroke="#0f1822" strokeWidth="1.6" fill="none" opacity="0.7" />
            <path d="M100 108 q-4 14 2 18 M88 136 q12 6 24 0" stroke="#0f1822" strokeWidth="2" fill="none" opacity="0.7" strokeLinecap="round" />
          </g>
        )}
        {id === 'mill' && (
          <g>
            <path d="M8 240 C12 192 50 178 100 176 C150 178 188 192 192 240Z" fill={`url(#${g}-dark)`} />
            <path d="M78 178 L100 222 L122 178 L112 168 L88 168Z" fill="#cfdbe8" opacity="0.88" />
            <path d="M94 192 l6 40 l6 -40z" fill="#101a25" />
            <rect x="85" y="146" width="30" height="32" rx="8" fill={`url(#${g})`} />
            <ellipse cx="100" cy="102" rx="33" ry="46" fill={`url(#${g})`} />
            <path d="M68 86 C70 54 128 50 132 86 C122 66 82 64 68 86Z" fill="#9fb0c2" opacity="0.85" />
            <path d="M80 98 q8 -4 16 0 M104 98 q8 -4 16 0" stroke="#0f1822" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M80 108 q7 3 14 0 M104 108 q7 3 14 0" stroke="#0f1822" strokeWidth="1.4" fill="none" opacity="0.6" />
            <path d="M100 106 q-4 16 3 20 M90 138 q10 4 20 0" stroke="#0f1822" strokeWidth="2" fill="none" opacity="0.65" strokeLinecap="round" />
          </g>
        )}
        {id === 'aristotle' && (
          <g>
            <path d="M6 240 C10 196 46 180 100 178 C154 180 190 196 194 240Z" fill={`url(#${g}-dark)`} />
            <path d="M30 200 C70 180 120 196 170 232 L190 240 L40 240Z" fill="#8ea1b5" opacity="0.45" />
            <rect x="84" y="146" width="32" height="34" rx="9" fill={`url(#${g})`} />
            <ellipse cx="100" cy="100" rx="34" ry="46" fill={`url(#${g})`} />
            <path d="M68 86 C70 52 130 52 132 86 C122 70 78 70 68 86Z" fill="#b9c8d8" opacity="0.7" />
            <g fill="#dfe8f1" opacity="0.92">
              <path d="M66 112 C64 150 82 168 100 170 C118 168 136 150 134 112 C128 134 116 140 100 140 C84 140 72 134 66 112Z" />
              {[76, 90, 104, 118].map((x, i) => <circle key={x} cx={x} cy={150 + (i % 2) * 6} r="8" />)}
            </g>
            <path d="M80 94 q8 -4 16 0 M104 94 q8 -4 16 0" stroke="#0f1822" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M82 104 q7 3 14 0 M104 104 q7 3 14 0" stroke="#0f1822" strokeWidth="1.4" fill="none" opacity="0.6" />
          </g>
        )}
      </g>
    </svg>
  );
}
