import type { ReactNode } from 'react';

export type IconName =
  | 'back' | 'next' | 'close' | 'settings' | 'volume' | 'mute' | 'document' | 'log' | 'message' | 'card' | 'config'
  | 'food' | 'medicine' | 'ammo' | 'fuel' | 'check' | 'lock' | 'zoom-in' | 'zoom-out' | 'fit' | 'clock' | 'branch' | 'archive' | 'restart' | 'map' | 'mind' | 'fragment' | 'menu';

const PATHS: Record<IconName, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7M8 12h12" />,
  next: <path d="M9 5l7 7-7 7M16 12H4" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>),
  volume: (<><path d="M4 10v4h4l5 4V6L8 10z" /><path d="M16.5 9a4 4 0 010 6M19 6.5a7.5 7.5 0 010 11" /></>),
  mute: (<><path d="M4 10v4h4l5 4V6L8 10z" /><path d="M17 9.5l4 5M21 9.5l-4 5" /></>),
  document: (<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9.5 12h6M9.5 15.5h6" /></>),
  log: (<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M12 15h5" /></>),
  message: <path d="M4 5h16v11H9l-5 4z" />,
  card: (<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></>),
  config: (<><rect x="3" y="8" width="18" height="8" rx="4" /><circle cx="16" cy="12" r="2.4" /></>),
  food: <><path d="M7 3v7a2 2 0 004 0V3M9 3v18" /><path d="M16 3c-2 2-2.5 5-2.5 8h3.5V3zM16.5 11V21" /></>,
  medicine: <><rect x="3" y="9" width="18" height="8" rx="4" transform="rotate(-35 12 13)" /><path d="M9.5 8l6 6" /></>,
  ammo: <><path d="M9 21V9l3-5 3 5v12z" /><path d="M9 15h6" /></>,
  fuel: <><path d="M5 21V5a1 1 0 011-1h7a1 1 0 011 1v16" /><path d="M4 21h11M14 9h2.5a1.5 1.5 0 011.5 1.5V16a1.5 1.5 0 003 0V9l-3-3M7 8h5" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
  'zoom-in': (<><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4M11 8.5v5M8.5 11h5" /></>),
  'zoom-out': (<><circle cx="11" cy="11" r="6" /><path d="M16 16l4 4M8.5 11h5" /></>),
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  clock: (<><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>),
  branch: (<><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="12" r="2" /><path d="M6 8v8M8 6c6 0 6 6 8 6" /></>),
  archive: (<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v10h14V9M10 13h4" /></>),
  restart: (<><path d="M4 12a8 8 0 108-8 8 8 0 00-5.5 2.2L4 8.5" /><path d="M4 4v4.5h4.5" /></>),
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  mind: (<><circle cx="12" cy="12" r="2" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="10" opacity="0.5" /></>),
  fragment: <path d="M12 3l3 6 6 .8-4.5 4.3 1.2 6L12 17l-5.7 3.1 1.2-6L3 9.8 9 9z" />,
};

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }): ReactNode {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
