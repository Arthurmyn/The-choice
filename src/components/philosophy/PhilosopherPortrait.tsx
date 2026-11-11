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
        {id === 'hobbes' && (
          <g>
            <path d="M6 240 C10 194 48 178 100 176 C152 178 190 194 194 240Z" fill={`url(#${g}-dark)`} />
            <path d="M70 182 C84 198 116 198 130 182 L124 168 L76 168Z" fill="#dbe5ef" opacity="0.85" />
            <rect x="85" y="148" width="30" height="30" rx="8" fill={`url(#${g})`} />
            <ellipse cx="100" cy="100" rx="34" ry="46" fill={`url(#${g})`} />
            <path d="M68 96 C60 104 62 124 70 132 C66 116 68 106 68 96Z M132 96 C140 104 138 124 130 132 C134 116 132 106 132 96Z" fill="#e6edf5" opacity="0.88" />
            <path d="M80 90 q8 -5 16 0 M104 90 q8 -5 16 0" stroke="#0f1822" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M82 100 q7 3 14 0 M104 100 q7 3 14 0" stroke="#0f1822" strokeWidth="1.5" fill="none" opacity="0.65" />
            <path d="M100 98 q-4 14 2 18" stroke="#0f1822" strokeWidth="2" fill="none" opacity="0.65" strokeLinecap="round" />
            <path d="M82 124 C90 118 110 118 118 124 C112 128 88 128 82 124Z" fill="#e6edf5" opacity="0.92" />
            <path d="M94 134 C98 142 102 142 106 134 C104 146 96 146 94 134Z" fill="#e6edf5" opacity="0.85" />
          </g>
        )}
        {id === 'locke' && (
          <g>
            <path d="M8 240 C12 192 50 178 100 176 C150 178 188 192 192 240Z" fill={`url(#${g}-dark)`} />
            <path d="M92 174 L100 206 L108 174Z" fill="#dbe5ef" opacity="0.9" />
            <rect x="86" y="148" width="28" height="30" rx="8" fill={`url(#${g})`} />
            <g fill="#d3deea" opacity="0.9">
              <path d="M58 100 C54 58 146 58 142 100 L146 168 C136 176 128 164 126 150 L74 150 C72 164 64 176 54 168Z" />
              {[58, 66, 134, 142].map((x, i) => <circle key={x} cx={x} cy={150 + (i % 2) * 12} r="9" />)}
            </g>
            <ellipse cx="100" cy="104" rx="29" ry="42" fill={`url(#${g})`} />
            <path d="M72 84 C74 62 126 62 128 84 C118 72 84 72 72 84Z" fill="#d3deea" opacity="0.9" />
            <path d="M82 98 q7 -4 14 0 M104 98 q7 -4 14 0" stroke="#0f1822" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <path d="M82 107 q6 3 12 0 M106 107 q6 3 12 0" stroke="#0f1822" strokeWidth="1.4" fill="none" opacity="0.6" />
            <path d="M100 106 q-3 14 3 18 M90 132 q10 4 20 0" stroke="#0f1822" strokeWidth="2" fill="none" opacity="0.65" strokeLinecap="round" />
          </g>
        )}
        {id === 'rousseau' && (
          <g>
            <path d="M6 240 C10 196 46 180 100 178 C154 180 190 196 194 240Z" fill={`url(#${g}-dark)`} />
            <path d="M76 180 L100 208 L124 180 L112 170 L88 170Z" fill="#cfdbe8" opacity="0.85" />
            <rect x="85" y="146" width="30" height="34" rx="9" fill={`url(#${g})`} />
            <ellipse cx="100" cy="102" rx="33" ry="45" fill={`url(#${g})`} />
            <path d="M66 94 C62 54 138 54 134 94 C128 72 112 66 100 66 C88 66 72 72 66 94Z" fill="#dfe8f1" opacity="0.92" />
            <path d="M132 90 C148 104 148 138 138 160 C142 136 140 112 130 98Z" fill="#dfe8f1" opacity="0.8" />
            <path d="M80 96 q8 -4 16 0 M104 96 q8 -4 16 0" stroke="#0f1822" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            <path d="M82 106 q7 3 14 0 M104 106 q7 3 14 0" stroke="#0f1822" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M100 104 q-4 14 2 18 M90 134 q10 5 20 0" stroke="#0f1822" strokeWidth="2" fill="none" opacity="0.65" strokeLinecap="round" />
          </g>
        )}
      </g>
    </svg>
  );
}
