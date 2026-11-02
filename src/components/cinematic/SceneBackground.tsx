import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { BackgroundId } from '../../engine/types';
import { useParallax } from '../../hooks/useParallax';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Palette {
  skyTop: string;
  skyBottom: string;
  far: string;
  near: string;
  window: string;
  glow: string;
}

const CITY: Record<string, Palette> = {
  'city-dusk': { skyTop: '#101a2b', skyBottom: '#3a4a63', far: '#18243a', near: '#0d1522', window: '#ffd9a0', glow: '#65B9FF' },
  'city-night': { skyTop: '#05080e', skyBottom: '#142033', far: '#0f1826', near: '#090e17', window: '#bfe2ff', glow: '#65B9FF' },
  'city-dawn': { skyTop: '#16253a', skyBottom: '#8fb6d4', far: '#2a4058', near: '#142132', window: '#ffe9c4', glow: '#bfe2ff' },
  'city-alert': { skyTop: '#10090d', skyBottom: '#3b2330', far: '#241621', near: '#120b11', window: '#ffb9a8', glow: '#d98a8a' },
};

function Skyline({ palette, seed, base = 640, withWindows = true }: { palette: Palette; seed: number; base?: number; withWindows?: boolean }): ReactNode {
  const parts = useMemo(() => {
    const r = rng(seed);
    const build = (minH: number, maxH: number, color: string, lit: number) => {
      const out: ReactNode[] = [];
      let x = -40;
      let i = 0;
      while (x < 1640) {
        const w = 50 + r() * 90;
        const h = minH + r() * (maxH - minH);
        out.push(<rect key={`${color}-${i}`} x={x} y={base - h} width={w} height={h + 400} fill={color} />);
        if (withWindows && lit > 0) {
          for (let wy = base - h + 14; wy < base - 8; wy += 17) {
            for (let wx = x + 7; wx < x + w - 9; wx += 14) {
              if (r() < lit) out.push(<rect key={`${color}-${i}-${wx}-${wy}`} x={wx} y={wy} width={5} height={7} fill={palette.window} opacity={0.35 + r() * 0.5} />);
            }
          }
        }
        x += w + 6 + r() * 10;
        i++;
      }
      return out;
    };
    return { far: build(110, 300, palette.far, 0.08), near: build(60, 220, palette.near, 0.16) };
  }, [palette, seed, base, withWindows]);
  return (
    <g>
      <g opacity={0.9}>{parts.far}</g>
      <g>{parts.near}</g>
    </g>
  );
}

function Defs({ id, a, b }: { id: string; a: string; b: string }): ReactNode {
  return (
    <defs>
      <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={a} />
        <stop offset="1" stopColor={b} />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#65B9FF" stopOpacity="0.55" />
        <stop offset="1" stopColor="#65B9FF" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={`${id}-warm`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.5" />
        <stop offset="1" stopColor="#ffd9a0" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-blur`}>
        <feGaussianBlur stdDeviation="14" />
      </filter>
    </defs>
  );
}

function CodeLines({ x, y, w, h, seed, color = '#65B9FF' }: { x: number; y: number; w: number; h: number; seed: number; color?: string }): ReactNode {
  const lines = useMemo(() => {
    const r = rng(seed);
    const out: ReactNode[] = [];
    for (let ly = y + 14, i = 0; ly < y + h - 10; ly += 13, i++) {
      const indent = Math.floor(r() * 3) * 14;
      out.push(<rect key={i} x={x + 12 + indent} y={ly} width={Math.max(16, r() * (w - 40 - indent))} height={4} rx={2} fill={color} opacity={0.25 + r() * 0.5} />);
    }
    return out;
  }, [x, y, w, h, seed, color]);
  return <g>{lines}</g>;
}

function Office({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#05090f" b="#16233a" />
      <rect width="1600" height="900" fill="#0a1017" />
      <g>
        <rect x="170" y="90" width="1260" height="560" fill={`url(#${id}-sky)`} />
        <svg x="170" y="90" width="1260" height="560" viewBox="0 0 1260 560" preserveAspectRatio="none">
          <Skyline palette={CITY['city-night']} seed={11} base={560} />
        </svg>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={165 + i * 315} y={90} width={10} height={560} fill="#0a1017" />
        ))}
        <rect x="170" y="90" width="1260" height="560" fill="none" stroke="#1d2a3d" strokeWidth="6" />
      </g>
      <rect x="0" y="650" width="1600" height="250" fill="#0b1119" />
      <rect x="0" y="646" width="1600" height="6" fill="#1a2535" />
      <g opacity={0.9}>
        <rect x="260" y="560" width="400" height="30" rx="4" fill="#111a27" />
        <rect x="360" y="440" width="190" height="115" rx="6" fill="#0c141f" stroke="#223249" strokeWidth="3" />
        <rect x="372" y="452" width="166" height="91" fill="#102640" />
        <CodeLines x={372} y={452} w={166} h={91} seed={4} />
        <rect x="445" y="555" width="20" height="10" fill="#1c2a3d" />
        <ellipse cx="455" cy="500" rx="180" ry="120" fill={`url(#${id}-glow)`} opacity="0.5" />
      </g>
      <g opacity={0.95}>
        <rect x="940" y="570" width="500" height="34" rx="4" fill="#111a27" />
        <rect x="1080" y="455" width="190" height="112" rx="6" fill="#0c141f" stroke="#223249" strokeWidth="3" />
        <rect x="1092" y="467" width="166" height="88" fill="#0f2238" />
        <CodeLines x={1092} y={467} w={166} h={88} seed={8} color="#8C9BB0" />
        <ellipse cx="1175" cy="515" rx="190" ry="120" fill={`url(#${id}-glow)`} opacity="0.4" />
      </g>
      <rect width="1600" height="900" fill="#05080e" opacity="0.18" />
    </>
  );
}

function DevWorkspace({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#070b12" b="#0f1722" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <rect y="640" width="1600" height="260" fill="#0a1019" />
      <rect y="636" width="1600" height="8" fill="#17222f" />
      {[
        { x: 230, w: 380, y: 250, h: 240, s: 1 },
        { x: 640, w: 440, y: 210, h: 280, s: 2 },
        { x: 1110, w: 360, y: 250, h: 240, s: 3 },
      ].map((m) => (
        <g key={m.s}>
          <ellipse cx={m.x + m.w / 2} cy={m.y + m.h / 2} rx={m.w * 0.7} ry={m.h * 0.7} fill={`url(#${id}-glow)`} opacity="0.35" />
          <rect x={m.x - 8} y={m.y - 8} width={m.w + 16} height={m.h + 16} rx="10" fill="#0a111a" stroke="#1f2e42" strokeWidth="3" />
          <rect x={m.x} y={m.y} width={m.w} height={m.h} fill="#0d1d33" />
          <CodeLines x={m.x} y={m.y} w={m.w} h={m.h} seed={m.s * 7} color={m.s === 2 ? '#8C9BB0' : '#65B9FF'} />
          <rect x={m.x + m.w / 2 - 12} y={m.y + m.h + 8} width={24} height={60} fill="#101a26" />
        </g>
      ))}
      <rect x="180" y="640" width="1240" height="26" fill="#111b28" />
      <g>
        <circle cx="1480" cy="360" r="130" fill={`url(#${id}-warm)`} opacity="0.35" />
        <path d="M1450 640 L1480 400 L1510 380" stroke="#1f2b3b" strokeWidth="8" fill="none" />
      </g>
    </>
  );
}

function Conference({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#060a11" b="#101a28" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <g>
        <rect x="300" y="110" width="1000" height="330" rx="10" fill="#0b1522" stroke="#233650" strokeWidth="5" />
        <rect x="318" y="128" width="964" height="294" fill="#0f2640" />
        <ellipse cx="800" cy="275" rx="640" ry="260" fill={`url(#${id}-glow)`} opacity="0.35" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x={350 + i * 310} y={160} width={270} height={200} rx={6} fill="#0a1b30" stroke="#2c4a70" strokeWidth="2" />
            <circle cx={485 + i * 310} cy={235} r={32} fill="#1b3558" />
            <path d={`M${435 + i * 310} 330 q50 -60 100 0`} fill="#1b3558" />
          </g>
        ))}
      </g>
      <polygon points="120,900 480,610 1120,610 1480,900" fill="#0d1520" />
      <polygon points="260,900 560,660 1040,660 1340,900" fill="#142031" />
      <polygon points="260,900 560,660 1040,660 1340,900" fill="none" stroke="#223249" strokeWidth="3" />
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={470 + i * 165} cy={780 - Math.abs(2 - i) * 18} rx={42} ry={26} fill="#0a111b" opacity="0.9" />
      ))}
      <rect width="1600" height="900" fill="#05080e" opacity="0.15" />
    </>
  );
}

function VolunteerRoom({ id }: { id: string }): ReactNode {
  const bulbs = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ x: 80 + i * 70, y: 130 + Math.sin(i * 0.9) * 28 })), []);
  return (
    <>
      <Defs id={id} a="#0d131c" b="#1a2230" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <rect x="1120" y="140" width="340" height="360" rx="6" fill="#26384f" stroke="#334a66" strokeWidth="6" />
      <rect x="1132" y="152" width="316" height="336" fill="#4a6683" opacity="0.55" />
      <path d="M1290 152 V488 M1132 320 H1448" stroke="#334a66" strokeWidth="6" />
      <rect x="140" y="210" width="360" height="190" rx="8" fill="#151e2b" stroke="#25344a" strokeWidth="3" />
      <rect x="170" y="238" width="300" height="14" rx="4" fill="#65B9FF" opacity="0.55" />
      <rect x="170" y="268" width="230" height="8" rx="4" fill="#8C9BB0" opacity="0.5" />
      <rect x="170" y="290" width="260" height="8" rx="4" fill="#8C9BB0" opacity="0.4" />
      <rect x="170" y="330" width="120" height="40" rx="6" fill="#65B9FF" opacity="0.25" />
      <path d={bulbs.map((b, i) => `${i ? 'L' : 'M'}${b.x} ${b.y}`).join(' ')} stroke="#2b3647" strokeWidth="3" fill="none" />
      {bulbs.map((b, i) => (
        <g key={i}>
          <circle cx={b.x} cy={b.y + 10} r="34" fill={`url(#${id}-warm)`} opacity="0.55" />
          <circle cx={b.x} cy={b.y + 10} r="5" fill="#ffe3b3" />
        </g>
      ))}
      <rect y="640" width="1600" height="260" fill="#0f1621" />
      <rect x="260" y="560" width="760" height="40" rx="4" fill="#243247" />
      <rect x="290" y="600" width="12" height="100" fill="#1a2536" />
      <rect x="980" y="600" width="12" height="100" fill="#1a2536" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={320 + i * 150} y={i % 2 ? 480 : 500} width={110} height={i % 2 ? 80 : 60} rx={4} fill="#3a2f26" stroke="#4a3d31" strokeWidth="2" />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={1160 + i * 120} y={560 - (i % 2) * 40} width={100} height={100 + (i % 2) * 40} rx={4} fill="#33291f" stroke="#43372b" strokeWidth="2" />
      ))}
    </>
  );
}

function Messaging({ id }: { id: string }): ReactNode {
  const cards = useMemo(() => {
    const r = rng(21);
    return Array.from({ length: 9 }, (_, i) => ({
      x: 60 + r() * 1400,
      y: 60 + r() * 700,
      w: 240 + r() * 220,
      h: 54 + r() * 36,
      own: i % 3 === 0,
      o: 0.1 + r() * 0.2,
    }));
  }, []);
  return (
    <>
      <Defs id={id} a="#060a11" b="#0e1623" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <g filter={`url(#${id}-blur)`}>
        {cards.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={22} fill={c.own ? '#65B9FF' : '#8C9BB0'} opacity={c.o} />
        ))}
      </g>
      <ellipse cx="800" cy="500" rx="700" ry="320" fill={`url(#${id}-glow)`} opacity="0.35" />
      <g opacity="0.55">
        <rect x="660" y="140" width="280" height="560" rx="38" fill="#0b121c" stroke="#223249" strokeWidth="4" />
        <rect x="680" y="180" width="240" height="470" rx="12" fill="#0f1b2c" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i % 2 ? 790 : 696} y={210 + i * 90} width={110} height={44} rx={16} fill={i % 2 ? '#65B9FF' : '#2b3c52'} opacity="0.7" />
        ))}
      </g>
    </>
  );
}

function City({ id }: { id: BackgroundId }): ReactNode {
  const p = CITY[id] ?? CITY['city-night'];
  return (
    <>
      <Defs id={id} a={p.skyTop} b={p.skyBottom} />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <ellipse cx="1050" cy="560" rx="900" ry="260" fill={p.glow} opacity={id === 'city-dawn' ? 0.28 : 0.12} />
      <Skyline palette={p} seed={id.length * 13} base={720} />
      <rect y="720" width="1600" height="180" fill={p.near} />
      <rect y="716" width="1600" height="6" fill={p.far} />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <rect key={i} x={80 + i * 230} y={800} width={110} height={5} rx={2} fill={p.window} opacity="0.35" />
      ))}
      {id === 'city-night' && (
        <g stroke="#bfe2ff" strokeWidth="1" opacity="0.14">
          {Array.from({ length: 40 }, (_, i) => (
            <line key={i} x1={(i * 83) % 1600} y1={(i * 37) % 700} x2={((i * 83) % 1600) - 14} y2={((i * 37) % 700) + 40} />
          ))}
        </g>
      )}
    </>
  );
}

/** Film-like atmosphere over any scene: bloom, light sweep, rain, grain. */
function Atmosphere({ id }: { id: BackgroundId }): ReactNode {
  const rain = id.startsWith('city') || id === 'forest-road' || id === 'ruined-city' || id === 'gas-station';
  return (
    <div className="atmo" aria-hidden="true">
      <i className="atmo-bloom" />
      <i className="atmo-sweep" />
      {rain && <i className="atmo-rain" />}
      <i className="atmo-grain" />
    </div>
  );
}


/* ---------- Post-collapse locations ---------- */
const Glow = ({ id, x, y, r, c = '#ffb36b', o = 0.5 }: { id: string; x: number; y: number; r: number; c?: string; o?: number }): ReactNode => (
  <>
    <radialGradient id={`${id}-g${x}${y}`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stopColor={c} stopOpacity={o} />
      <stop offset="1" stopColor={c} stopOpacity="0" />
    </radialGradient>
    <circle cx={x} cy={y} r={r} fill={`url(#${id}-g${x}${y})`} />
  </>
);

function Pines({ seed, y, count, h, color, spread = 1600 }: { seed: number; y: number; count: number; h: number; color: string; spread?: number }): ReactNode {
  const trees = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ x: r() * spread, hh: h * (0.6 + r() * 0.7), w: 50 + r() * 50 }));
  }, [seed, count, h, spread]);
  return (
    <g fill={color}>
      {trees.map((t, i) => (
        <g key={i}>
          <rect x={t.x - 4} y={y - 20} width={8} height={30} />
          {[0, 1, 2, 3].map((k) => (
            <polygon key={k} points={`${t.x},${y - t.hh + k * (t.hh / 5)} ${t.x - t.w * (0.35 + k * 0.18)},${y - t.hh * 0.18 + k * (t.hh / 14)} ${t.x + t.w * (0.35 + k * 0.18)},${y - t.hh * 0.18 + k * (t.hh / 14)}`} />
          ))}
        </g>
      ))}
    </g>
  );
}

function Cars({ list }: { list: [number, number, number][] }): ReactNode {
  return (
    <g fill="#0a0f16" stroke="#1a2535" strokeWidth="2">
      {list.map(([x, y, w], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <rect x={0} y={-w * 0.22} width={w} height={w * 0.22} rx={8} />
          <path d={`M${w * 0.18} ${-w * 0.22} L${w * 0.3} ${-w * 0.4} L${w * 0.72} ${-w * 0.4} L${w * 0.86} ${-w * 0.22}Z`} />
          <circle cx={w * 0.22} cy={0} r={w * 0.07} />
          <circle cx={w * 0.78} cy={0} r={w * 0.07} />
        </g>
      ))}
    </g>
  );
}

function GasStation({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#0b1219" b="#3c4d60" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <Pines seed={5} y={620} count={22} h={150} color="#0f1722" />
      <path d="M0 620 L1600 600 L1600 900 L0 900Z" fill="#0c1218" />
      <rect y="640" width="1600" height="260" fill="#10171f" />
      <g>
        <rect x="260" y="250" width="1060" height="34" fill="#0a0f15" stroke="#27374b" strokeWidth="3" />
        <rect x="262" y="284" width="1056" height="14" fill="#1a2634" />
        {[330, 700, 1230].map((x) => <rect key={x} x={x} y="298" width="22" height="342" fill="#141d28" />)}
        {[420, 760, 1090].map((x, i) => (
          <g key={x}>
            <rect x={x} y="470" width="76" height="170" rx="6" fill="#18222e" stroke="#2a3a4e" strokeWidth="3" />
            <rect x={x + 12} y="492" width="52" height="34" fill={i === 1 ? '#65b9ff' : '#2b4a68'} opacity={i === 1 ? 0.8 : 0.5} />
          </g>
        ))}
        <rect x="560" y="150" width="14" height="110" fill="#141d28" />
        <rect x="470" y="118" width="196" height="44" rx="4" fill="#0f1822" stroke="#27374b" strokeWidth="3" />
        <rect x="486" y="132" width="164" height="16" fill="#65b9ff" opacity="0.35" />
      </g>
      <Glow id={id} x={788} y={540} r={260} c="#65b9ff" o={0.22} />
      <Cars list={[[1180, 760, 300], [120, 790, 260]]} />
      <rect y="880" width="1600" height="20" fill="#080c11" />
    </>
  );
}

function Highway({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#0a1018" b="#42566b" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <Pines seed={9} y={500} count={30} h={120} color="#0e1620" />
      <rect y="500" width="1600" height="400" fill="#0b1118" />
      <polygon points="800,470 1340,900 260,900" fill="#141c26" />
      <polygon points="800,470 830,900 770,900" fill="#1d2a39" opacity="0.7" />
      {[560, 610, 680, 770, 880].map((y, i) => <rect key={y} x={796 - i * 2} y={y} width={8 + i * 2} height={22 + i * 8} fill="#7d8fa3" opacity={0.25 + i * 0.1} />)}
      <Cars list={[[330, 760, 340], [900, 640, 170], [1090, 700, 230], [640, 600, 100]]} />
      <rect y="440" width="1600" height="160" fill="#8aa3bc" opacity="0.08" />
      <Glow id={id} x={800} y={470} r={380} c="#9fc0e0" o={0.2} />
    </>
  );
}

function ForestRoad({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#070c12" b="#26384a" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <Pines seed={3} y={560} count={26} h={330} color="#0a1118" />
      <Pines seed={8} y={650} count={20} h={420} color="#070b10" />
      <polygon points="780,520 820,520 1180,900 420,900" fill="#10171f" />
      <polygon points="790,520 810,520 830,900 770,900" fill="#1c2836" opacity="0.5" />
      <rect y="480" width="1600" height="200" fill="#9fb8d2" opacity="0.07" />
      <Cars list={[[1010, 840, 220]]} />
      <Pines seed={14} y={940} count={9} h={720} color="#05080c" />
    </>
  );
}

function Hospital({ id }: { id: string }): ReactNode {
  const lights = [200, 280, 360, 440, 520];
  return (
    <>
      <Defs id={id} a="#06090e" b="#13202b" />
      <rect width="1600" height="900" fill="#0a1117" />
      <polygon points="0,0 1600,0 1000,300 600,300" fill="#101a24" />
      <polygon points="0,900 1600,900 1000,600 600,600" fill="#0c141b" />
      <polygon points="0,0 600,300 600,600 0,900" fill="#0d151d" />
      <polygon points="1600,0 1000,300 1000,600 1600,900" fill="#0b1219" />
      <rect x="600" y="300" width="400" height="300" fill="#16242f" />
      <rect x="760" y="360" width="80" height="150" fill="#0a1218" stroke="#2b4156" strokeWidth="3" />
      <path d="M790 400h20M800 390v20" stroke="#65b9ff" strokeWidth="6" opacity="0.7" />
      {lights.map((y, i) => (
        <g key={y}>
          <rect x={800 - (170 - i * 18)} y={i * 36 + 12} width={(170 - i * 18) * 2} height={8 + i * 0.5} fill="#d6e8f6" opacity={i === 2 ? 0.15 : 0.55} />
        </g>
      ))}
      {[120, 260, 400].map((y) => <rect key={y} x="30" y={y} width="140" height="230" fill="#0a1016" stroke="#1d2c3b" strokeWidth="3" />)}
      {[120, 260, 400].map((y) => <rect key={y} x="1430" y={y} width="140" height="230" fill="#0a1016" stroke="#1d2c3b" strokeWidth="3" />)}
      <Glow id={id} x={800} y={430} r={420} c="#9fd0f0" o={0.14} />
      <rect y="880" width="1600" height="20" fill="#05080b" />
    </>
  );
}

function Checkpoint({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#090e15" b="#2a3a4b" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <Pines seed={4} y={560} count={20} h={160} color="#0d141c" />
      <rect y="560" width="1600" height="340" fill="#0e151c" />
      <g fill="#0a0f15" stroke="#1f2d3d" strokeWidth="2">
        <rect x="90" y="400" width="360" height="130" rx="14" />
        <rect x="120" y="360" width="290" height="50" rx="10" />
        <rect x="1130" y="420" width="400" height="110" rx="14" />
      </g>
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={380 + i * 94} y={i % 2 ? 560 : 545} width={86} height={i % 2 ? 150 : 165} fill="#1a2430" stroke="#2d3e50" strokeWidth="3" />
      ))}
      <path d="M360 545 L1240 545" stroke="#4d607a" strokeWidth="3" strokeDasharray="12 6" />
      <path d="M360 525 q40 -18 80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0 t80 0" stroke="#5c7087" strokeWidth="3" fill="none" />
      {[300, 1280].map((x) => (
        <g key={x}>
          <rect x={x} y="250" width="14" height="300" fill="#141d28" />
          <rect x={x - 26} y="236" width="66" height="26" rx="4" fill="#cfe3f5" opacity="0.8" />
          <Glow id={id} x={x + 7} y={262} r={220} c="#cfe3f5" o={0.3} />
        </g>
      ))}
      <rect x="720" y="500" width="150" height="62" fill="#18222d" stroke="#2d3e50" strokeWidth="3" />
      <rect x="735" y="514" width="120" height="14" fill="#e8b36b" opacity="0.55" />
    </>
  );
}

function Camp({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#070b11" b="#1b2733" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <Pines seed={11} y={640} count={22} h={300} color="#0a1017" />
      <rect y="640" width="1600" height="260" fill="#0c1218" />
      {[[240, 0.9], [1120, 1.1], [1390, 0.8]].map(([x, k]) => (
        <g key={x}>
          <polygon points={`${x},${560 - 170 * k} ${x - 150 * k},${700} ${x + 150 * k},${700}`} fill="#18222e" stroke="#2b3b4e" strokeWidth="3" />
          <polygon points={`${x},${560 - 170 * k} ${x - 26 * k},${700} ${x + 26 * k},${700}`} fill="#0b1219" />
        </g>
      ))}
      <Glow id={id} x={760} y={650} r={430} c="#ff9b4a" o={0.38} />
      <path d="M715 690 q45 -120 20 -160 q70 40 55 100 q30 -30 20 -70 q55 70 5 130z" fill="#ffb36b" opacity="0.85" />
      <path d="M735 690 q25 -60 12 -90 q38 24 30 60 q12 -14 10 -32 q22 40 0 62z" fill="#ffe3b0" opacity="0.9" />
      <rect x="690" y="696" width="130" height="14" rx="6" fill="#241a12" />
    </>
  );
}

function Shelter({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#070a0f" b="#101923" />
      <rect width="1600" height="900" fill="#0b1118" />
      <path d="M0 520 Q800 -60 1600 520 L1600 900 L0 900Z" fill="#0f1822" />
      {[120, 190, 260].map((y) => <rect key={y} x="0" y={y} width="1600" height="10" fill="#1d2b3b" opacity="0.7" />)}
      {[200, 540, 880, 1220].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 0 V ${180 + (i % 2) * 40}`} stroke="#233447" strokeWidth="3" />
          <circle cx={x} cy={200 + (i % 2) * 40} r="10" fill="#ffd9a0" />
          <Glow id={id} x={x} y={200 + (i % 2) * 40} r={190} c="#ffc27a" o={0.35} />
        </g>
      ))}
      {Array.from({ length: 14 }, (_, i) => <line key={i} x1={i * 120} y1="520" x2={i * 120 + 40} y2="900" stroke="#17222f" strokeWidth="2" />)}
      <rect y="720" width="1600" height="180" fill="#090e14" />
      {[[180, 640, 160, 90], [380, 680, 120, 70], [1200, 650, 200, 100]].map(([x, y, w, h]) => <rect key={x} x={x} y={y} width={w} height={h} fill="#17212c" stroke="#26374a" strokeWidth="3" />)}
    </>
  );
}

function RuinedCity({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#0a0d12" b="#2a2f38" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <Skyline palette={{ skyTop: '#0a0d12', skyBottom: '#2a2f38', far: '#151b23', near: '#0b1016', window: '#8aa3bc', glow: '#65b9ff' }} seed={31} base={660} />
      <g fill="#050709" opacity="0.8">
        {[300, 780, 1230].map((x) => <path key={x} d={`M${x} 560 q-40 -160 20 -300 q-60 120 50 300z`} />)}
      </g>
      <Glow id={id} x={1100} y={620} r={320} c="#ff8a4a" o={0.2} />
      <rect y="660" width="1600" height="240" fill="#0b1015" />
      <Cars list={[[230, 790, 300], [700, 760, 220], [1180, 820, 360]]} />
      <g stroke="#1d2530" strokeWidth="3">{[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={i * 300} y1="900" x2={i * 300 + 120} y2="700" />)}</g>
    </>
  );
}

function HavenGate({ id }: { id: string }): ReactNode {
  return (
    <>
      <Defs id={id} a="#060a10" b="#1a2735" />
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      <rect y="300" width="1600" height="440" fill="#0f1822" />
      {Array.from({ length: 16 }, (_, i) => <rect key={i} x={i * 100 + 6} y="310" width="88" height="420" fill={i % 2 ? '#121c27' : '#142029'} stroke="#1f2f40" strokeWidth="2" />)}
      {[160, 1440].map((x) => (
        <g key={x}>
          <rect x={x - 60} y="130" width="120" height="180" fill="#0d151e" stroke="#26374b" strokeWidth="3" />
          <rect x={x - 70} y="112" width="140" height="26" fill="#0a1017" />
          <rect x={x - 28} y="170" width="56" height="30" fill="#ffd9a0" opacity="0.7" />
        </g>
      ))}
      <polygon points="160,200 560,740 40,740" fill="#cfe3f5" opacity="0.05" />
      <polygon points="1440,200 1050,740 1580,740" fill="#cfe3f5" opacity="0.05" />
      <rect x="690" y="380" width="220" height="360" rx="4" fill="#0a1017" stroke="#32465c" strokeWidth="4" />
      <rect x="700" y="390" width="95" height="340" fill="#16222e" />
      <rect x="805" y="390" width="95" height="340" fill="#16222e" />
      <Glow id={id} x={800} y={560} r={360} c="#cfe3f5" o={0.2} />
      <g stroke="#51657c" strokeWidth="2">{Array.from({ length: 16 }, (_, i) => <line key={i} x1={i * 100} y1="300" x2={i * 100 + 50} y2="270" />)}</g>
      <rect y="740" width="1600" height="160" fill="#0a1015" />
      <g fill="#05080c">{Array.from({ length: 14 }, (_, i) => <g key={i}><circle cx={90 + i * 52} cy={800 - (i % 3) * 8} r="12" /><rect x={78 + i * 52} y={810 - (i % 3) * 8} width="24" height="60" rx="8" /></g>)}</g>
    </>
  );
}

export function SceneBackground({ id, image, className = '' }: { id: BackgroundId; image?: string; className?: string }): ReactNode {
  const [imgOk, setImgOk] = useState(true);
  const par = useParallax(14);
  let body: ReactNode;
  switch (id) {
    case 'office-night':
      body = <Office id={id} />;
      break;
    case 'dev-workspace':
      body = <DevWorkspace id={id} />;
      break;
    case 'conference':
      body = <Conference id={id} />;
      break;
    case 'volunteer-room':
      body = <VolunteerRoom id={id} />;
      break;
    case 'messaging':
      body = <Messaging id={id} />;
      break;
    case 'gas-station':
      body = <GasStation id={id} />;
      break;
    case 'highway':
      body = <Highway id={id} />;
      break;
    case 'forest-road':
      body = <ForestRoad id={id} />;
      break;
    case 'hospital':
      body = <Hospital id={id} />;
      break;
    case 'checkpoint':
      body = <Checkpoint id={id} />;
      break;
    case 'camp':
      body = <Camp id={id} />;
      break;
    case 'shelter':
      body = <Shelter id={id} />;
      break;
    case 'ruined-city':
      body = <RuinedCity id={id} />;
      break;
    case 'haven-gate':
      body = <HavenGate id={id} />;
      break;
    default:
      body = <City id={id} />;
  }
  return (
    <div className={`bg-layer ${className}`} aria-hidden="true" data-bg={id}>
      <div className="bg-par" ref={par}>
        <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className="bg-svg" focusable="false">
          {body}
        </svg>
        {image && imgOk && <img className="bg-img" src={image} alt="" loading="lazy" onError={() => setImgOk(false)} />}
      </div>
      <Atmosphere id={id} />
    </div>
  );
}
