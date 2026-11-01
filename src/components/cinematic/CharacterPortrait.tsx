import type { ReactNode } from 'react';
import type { Character, Expression } from '../../engine/types';

/* ---------- colour helpers ---------- */
const rgb = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};
const toHex = (c: number[]): string => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number): string => {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const EYES = ['#5b3f2c', '#3f6d8c', '#4d7a55', '#6a4a30', '#2f4b66'];
const hash = (s: string): number => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);

/* ---------- expressions ---------- */
interface Face {
  open: number; // eye openness multiplier
  lid: number; // upper-lid droop
  browL: string;
  browR: string;
  cd: number; // mouth corner offset (negative = smile)
  mouthOpen: number;
}
const FACES: Record<Expression, Face> = {
  neutral: { open: 1, lid: 0, browL: 'M75 108 q16 -7 33 -2 q-16 -1 -33 5z', browR: 'M112 106 q17 -5 33 2 q-17 -3 -33 -2z', cd: 0, mouthOpen: 0 },
  concerned: { open: 1, lid: 0.5, browL: 'M75 111 q16 -2 33 -12 q-15 7 -33 15z', browR: 'M112 99 q17 10 33 12 q-17 -2 -33 -8z', cd: 1.6, mouthOpen: 0 },
  angry: { open: 0.85, lid: 1.6, browL: 'M75 100 q16 4 33 12 q-17 -5 -33 -7z', browR: 'M112 112 q17 -8 33 -12 q-17 8 -33 11z', cd: 1.2, mouthOpen: 0 },
  sad: { open: 0.85, lid: 1.4, browL: 'M75 113 q16 -4 33 -15 q-15 9 -33 18z', browR: 'M112 98 q17 11 33 15 q-17 -3 -33 -10z', cd: 3, mouthOpen: 0 },
  confident: { open: 0.95, lid: 0.6, browL: 'M75 107 q16 -6 33 -2 q-16 0 -33 5z', browR: 'M112 100 q17 -9 33 -3 q-17 1 -33 6z', cd: -2.2, mouthOpen: 0 },
  surprised: { open: 1.45, lid: -0.6, browL: 'M75 99 q16 -11 33 -1 q-16 -3 -33 3z', browR: 'M112 98 q17 -10 33 1 q-17 -4 -33 -1z', cd: 0, mouthOpen: 7 },
};

function Hair({ style, id, hi }: { style: Character['visual']['hair']['style']; id: string; hi: string }): ReactNode {
  const base = `url(#hair-${id})`;
  const strands = (d: string): ReactNode => <path d={d} fill="none" stroke={hi} strokeWidth="1.6" strokeLinecap="round" opacity="0.4" filter={`url(#soft1-${id})`} />;
  switch (style) {
    case 'long':
      return (
        <g>
          <path fill={base} d="M60 126 C46 30 174 30 160 126 L172 232 L138 232 L148 132 C130 98 90 98 72 132 L82 232 L48 232 Z" />
          {strands('M70 90 C80 66 128 62 150 92')}
          {strands('M64 140 C62 180 66 210 74 228')}
          {strands('M156 140 C158 180 154 210 146 228')}
        </g>
      );
    case 'bun':
      return (
        <g>
          <ellipse cx="110" cy="56" rx="21" ry="19" fill={base} />
          <path fill={base} d="M63 124 C54 38 166 38 157 124 C146 92 80 92 63 124 Z" />
          {strands('M72 94 C88 74 130 72 148 94')}
        </g>
      );
    case 'curly':
      return (
        <g fill={base}>
          {[68, 84, 100, 116, 132, 148].map((x, i) => (
            <circle key={x} cx={x} cy={70 - (i % 2) * 8} r="20" />
          ))}
          <path d="M63 126 C54 50 166 50 157 126 C146 98 80 98 63 126 Z" />
          {[76, 104, 132].map((x) => <circle key={x} cx={x} cy={74} r="6" fill={hi} opacity="0.22" filter={`url(#soft1-${id})`} />)}
        </g>
      );
    case 'cropped':
      return (
        <g>
          <path fill={base} d="M64 122 C56 36 164 36 156 122 C148 96 128 84 110 84 C92 84 72 96 64 122 Z" />
          {strands('M78 92 C92 76 128 76 144 94')}
        </g>
      );
    case 'side':
      return (
        <g>
          <path fill={base} d="M60 130 C44 30 168 24 160 114 C154 84 122 76 96 82 C78 90 72 108 70 130 L70 184 L54 184 Z" />
          {strands('M72 98 C86 78 126 70 150 96')}
          {strands('M66 130 C64 150 64 168 68 182')}
        </g>
      );
    default:
      return (
        <g>
          <path fill={base} d="M64 124 C54 30 166 30 156 124 C148 86 98 78 64 124 Z" />
          {strands('M76 96 C90 76 128 74 146 98')}
          {strands('M70 112 C82 90 120 84 140 100')}
        </g>
      );
  }
}

/**
 * Semi-realistic, softly modelled bust: skin and hair are shaded with blurred
 * planes, eyes have iris and lids, and the outfit has collar and lapels.
 * Light is cool and comes from the left; the base dissolves into the scene.
 */
function SvgPortrait({ character, expression, className }: { character: Character; expression: Expression; className: string }): ReactNode {
  const v = character.visual;
  const id = character.id;
  const f = FACES[expression];
  const skin = v.skin;
  const skinHi = mix(skin, '#fff2e6', 0.14);
  const skinLo = mix(skin, '#2a1812', 0.34);
  const lip = mix(skin, '#a8443f', 0.42);
  const hairHi = mix(v.hair.color, '#d9c2a2', 0.35);
  const eye = EYES[hash(id) % EYES.length];
  const male = character.voice?.gender === 'm';
  const jacket = v.outfit;
  const jacketHi = mix(jacket, '#8fb4d6', 0.22);
  const shirt = '#dfe5ec';
  const ey = 127;
  const o = f.open;
  const cd = f.cd;
  const lipY = 165;

  const eyeShape = (cx: number): string => `M${cx - 11} ${ey} Q${cx} ${ey - 9 * o} ${cx + 11} ${ey} Q${cx} ${ey + 6.5 * o} ${cx - 11} ${ey}Z`;

  return (
    <svg className={`portrait-svg ${className}`} viewBox="0 0 220 300" role="img" aria-label={`${character.name}, ${expression}`} focusable="false">
      <defs>
        <filter id={`soft1-${id}`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" /></filter>
        <filter id={`soft3-${id}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" /></filter>
        <filter id={`soft6-${id}`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="7" /></filter>
        <radialGradient id={`halo-${id}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#65b9ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#65b9ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`face-${id}`} cx="0.36" cy="0.32" r="0.8">
          <stop offset="0" stopColor={skinHi} />
          <stop offset="0.5" stopColor={skin} />
          <stop offset="1" stopColor={skinLo} />
        </radialGradient>
        <linearGradient id={`neck-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={skin} />
          <stop offset="1" stopColor={skinLo} />
        </linearGradient>
        <linearGradient id={`hair-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={mix(v.hair.color, '#ffffff', 0.12)} />
          <stop offset="1" stopColor={mix(v.hair.color, '#000000', 0.55)} />
        </linearGradient>
        <linearGradient id={`jacket-${id}`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor={jacketHi} />
          <stop offset="0.5" stopColor={jacket} />
          <stop offset="1" stopColor={mix(jacket, '#000', 0.55)} />
        </linearGradient>
        <linearGradient id={`rim-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9fd6ff" stopOpacity="0.55" />
          <stop offset="0.18" stopColor="#65b9ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`iris-${id}`} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor={mix(eye, '#ffffff', 0.35)} />
          <stop offset="1" stopColor={mix(eye, '#000000', 0.4)} />
        </radialGradient>
        <linearGradient id={`fade-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.72" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={`mask-${id}`}><rect width="220" height="300" fill={`url(#fade-${id})`} /></mask>
        <clipPath id={`clipL-${id}`}><path d={eyeShape(91)} /></clipPath>
        <clipPath id={`clipR-${id}`}><path d={eyeShape(129)} /></clipPath>
        <clipPath id={`head-${id}`}><path d="M64 118 C64 78 84 56 110 56 C136 56 156 78 156 118 C156 140 150 160 140 174 C132 186 122 194 110 194 C98 194 88 186 80 174 C70 160 64 140 64 118 Z" /></clipPath>
      </defs>

      <ellipse cx="110" cy="120" rx="108" ry="118" fill={`url(#halo-${id})`} />
      <g mask={`url(#mask-${id})`}>
        {/* torso: jacket, shirt, lapels */}
        <path d="M4 300 C6 244 42 222 88 214 L110 238 L132 214 C178 222 214 244 216 300 Z" fill={`url(#jacket-${id})`} />
        <path d="M90 214 L110 266 L130 214 L120 208 L100 208 Z" fill={shirt} />
        <path d="M90 214 L110 266 L130 214 L120 208 L100 208 Z" fill="#000" opacity="0.1" />
        {male && <path d="M104 218 L110 224 L116 218 L119 290 L110 298 L101 290 Z" fill={mix(v.accent ?? '#65b9ff', '#10202e', 0.55)} />}
        <path d="M88 214 L66 230 L94 290 L106 252 Z" fill={mix(jacket, '#000', 0.25)} opacity="0.85" />
        <path d="M132 214 L154 230 L126 290 L114 252 Z" fill={mix(jacket, '#000', 0.4)} opacity="0.9" />
        <path d="M88 214 L66 230 L94 290" fill="none" stroke={mix(jacket, '#9fd6ff', 0.45)} strokeWidth="1.4" opacity="0.7" />
        {v.accessory === 'lanyard' && (
          <g>
            <path d="M92 214 L106 296 M128 214 L114 296" stroke="#8c9aa8" strokeWidth="3.5" opacity="0.85" />
            <rect x="99" y="274" width="22" height="20" rx="2" fill="#cfd8e2" opacity="0.85" />
          </g>
        )}
        <path d="M4 300 C6 244 42 222 88 214 L88 230 C50 240 22 262 14 300 Z" fill={`url(#rim-${id})`} />

        {/* neck */}
        <path d="M92 168 L92 220 C100 230 120 230 128 220 L128 168 Z" fill={`url(#neck-${id})`} />
        <ellipse cx="110" cy="204" rx="26" ry="14" fill="#000" opacity="0.38" filter={`url(#soft3-${id})`} />

        {/* back hair (long) */}
        {v.hair.style === 'long' && <Hair style="long" id={id} hi={hairHi} />}

        {/* ears */}
        <ellipse cx="64" cy="130" rx="6.5" ry="12" fill={skin} />
        <ellipse cx="156" cy="130" rx="6.5" ry="12" fill={skinLo} />

        {/* head */}
        <path d="M64 118 C64 78 84 56 110 56 C136 56 156 78 156 118 C156 140 150 160 140 174 C132 186 122 194 110 194 C98 194 88 186 80 174 C70 160 64 140 64 118 Z" fill={`url(#face-${id})`} />
        <g clipPath={`url(#head-${id})`}>
          <path d="M132 80 C158 96 164 140 146 174 C138 188 126 196 112 196 C134 160 140 118 132 80Z" fill="#05080c" opacity="0.24" filter={`url(#soft3-${id})`} />
          <ellipse cx="82" cy="150" rx="12" ry="20" fill={skinHi} opacity="0.14" filter={`url(#soft3-${id})`} />
          <ellipse cx="110" cy="190" rx="26" ry="8" fill="#05080c" opacity="0.35" filter={`url(#soft3-${id})`} />
          <ellipse cx="92" cy="126" rx="17" ry="9" fill="#05080c" opacity="0.22" filter={`url(#soft3-${id})`} />
          <ellipse cx="129" cy="126" rx="17" ry="9" fill="#05080c" opacity="0.26" filter={`url(#soft3-${id})`} />
          {/* nose */}
          <path d="M112 128 C116 140 120 148 118 154 C114 158 106 158 102 154" fill="none" stroke="#05080c" strokeWidth="5" opacity="0.18" filter={`url(#soft1-${id})`} strokeLinecap="round" />
          <ellipse cx="106" cy="148" rx="2.4" ry="5" fill={skinHi} opacity="0.35" filter={`url(#soft1-${id})`} />
          <ellipse cx="104" cy="155" rx="2.6" ry="1.5" fill="#1a0d0a" opacity="0.55" />
          <ellipse cx="117" cy="155" rx="2.6" ry="1.5" fill="#1a0d0a" opacity="0.55" />
          <path d={`M98 ${lipY + 9} Q110 ${lipY + 14} 122 ${lipY + 9}`} fill="none" stroke="#05080c" strokeWidth="6" opacity="0.1" filter={`url(#soft3-${id})`} />
        </g>
        <path d="M64 118 C64 78 84 56 110 56" fill="none" stroke={`url(#rim-${id})`} strokeWidth="2" opacity="0.45" filter={`url(#soft1-${id})`} />

        {/* hair (front) */}
        {v.hair.style !== 'long' && <Hair style={v.hair.style} id={id} hi={hairHi} />}
        {v.hair.style === 'long' && (
          <path fill={`url(#hair-${id})`} d="M63 122 C56 40 164 40 157 122 C142 92 82 92 63 122 Z" />
        )}

        {/* eyes */}
        {[91, 129].map((cx, i) => (
          <g key={cx}>
            <path d={eyeShape(cx)} fill="#e7ecf1" />
            <g clipPath={`url(#clip${i ? 'R' : 'L'}-${id})`}>
              <circle cx={cx} cy={ey + 0.8} r={5.6} fill={`url(#iris-${id})`} />
              <circle cx={cx} cy={ey + 0.5} r={2.3} fill="#06090c" />
              <circle cx={cx + 1.8} cy={ey - 1.4} r={1.3} fill="#fff" opacity="0.9" />
              <path d={`M${cx - 12} ${ey - 9 * o - 2 + f.lid} L${cx + 12} ${ey - 9 * o - 2 + f.lid} L${cx + 12} ${ey - 1} Q${cx} ${ey - 8 * o + f.lid * 1.2} ${cx - 12} ${ey - 1}Z`} fill={skinLo} opacity="0.42" />
            </g>
            <path d={`M${cx - 12} ${ey} Q${cx} ${ey - 9.5 * o + f.lid * 0.6} ${cx + 12} ${ey}`} fill="none" stroke="#08090b" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
            <path d={`M${cx - 10} ${ey + 1} Q${cx} ${ey + 7 * o} ${cx + 10} ${ey + 1}`} fill="none" stroke="#2a1a14" strokeWidth="0.9" opacity="0.5" />
            <path d={`M${cx - 10} ${ey - 11 * o - 2} Q${cx} ${ey - 14 * o - 3} ${cx + 10} ${ey - 11 * o - 2}`} fill="none" stroke={skinLo} strokeWidth="1.2" opacity="0.45" />
          </g>
        ))}
        <path d={f.browL} fill={v.hair.color} opacity="0.92" filter={`url(#soft1-${id})`} />
        <path d={f.browR} fill={v.hair.color} opacity="0.92" filter={`url(#soft1-${id})`} />

        {/* mouth */}
        <path d={`M98 ${lipY + cd} Q104 ${lipY - 4} 110 ${lipY - 2.5} Q116 ${lipY - 4} 122 ${lipY + cd} Q110 ${lipY + 0.5 + f.mouthOpen * 0.4} 98 ${lipY + cd}Z`} fill={mix(lip, '#000', 0.12)} />
        {f.mouthOpen > 0 && <ellipse cx="110" cy={lipY + f.mouthOpen * 0.5} rx="8" ry={f.mouthOpen * 0.6} fill="#2a0f12" />}
        <path d={`M99 ${lipY + cd * 0.9 + 0.5} Q110 ${lipY + 8 + f.mouthOpen} 121 ${lipY + cd * 0.9 + 0.5} Q110 ${lipY + 1.5 + f.mouthOpen} 99 ${lipY + cd * 0.9 + 0.5}Z`} fill={lip} />
        <ellipse cx="108" cy={lipY + 5.5 + f.mouthOpen} rx="5" ry="1.4" fill="#fff" opacity="0.18" filter={`url(#soft1-${id})`} />
        <path d={`M98 ${lipY + cd} Q110 ${lipY + 1.5 + f.mouthOpen * 0.3} 122 ${lipY + cd}`} fill="none" stroke="#1d0a0b" strokeWidth="1.1" opacity="0.6" />

        {v.accessory === 'glasses' && (
          <g fill="none" stroke="#c4cfdb" strokeWidth="1.8" opacity="0.88">
            <rect x="74" y="113" width="36" height="28" rx="10" />
            <rect x="111" y="113" width="36" height="28" rx="10" />
            <path d="M110 125 h1" />
            <path d="M76 118 L96 116" stroke="#fff" opacity="0.35" />
          </g>
        )}
        {v.accessory === 'headset' && (
          <g fill="none" stroke="#9aa9bb" strokeWidth="3.6" strokeLinecap="round">
            <path d="M64 130 C62 72 158 72 156 130" />
            <rect x="57" y="124" width="12" height="26" rx="5" fill="#9aa9bb" />
            <path d="M63 150 q4 22 32 26" strokeWidth="2.2" />
          </g>
        )}
      </g>
    </svg>
  );
}

/* Optional real images: drop files in src/assets/characters/<id>/<expression>.png (or neutral.png). */
const IMAGES = import.meta.glob('../../assets/characters/**/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const findImage = (id: string, expression: Expression): string | undefined => {
  const hit = (name: string): string | undefined => Object.entries(IMAGES).find(([p]) => p.endsWith(`/characters/${id}/${name}`.replace(/^/, '')))?.[1];
  for (const ext of ['png', 'webp', 'jpg', 'jpeg']) {
    const u = hit(`${expression}.${ext}`) ?? hit(`neutral.${ext}`);
    if (u) return u;
  }
  return undefined;
};

export function CharacterPortrait({
  character,
  expression = 'neutral',
  className = '',
}: {
  character: Character;
  expression?: Expression;
  className?: string;
}): ReactNode {
  const src = findImage(character.id, expression);
  if (src) {
    return <img className={`portrait-svg portrait-img ${className}`} src={src} alt={`${character.name}, ${expression}`} loading="lazy" draggable={false} />;
  }
  return <SvgPortrait character={character} expression={expression} className={className} />;
}
