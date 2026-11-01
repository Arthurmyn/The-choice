import type { ReactNode } from 'react';
import type { EvidenceItem } from '../../engine/types';

export function KindIcon({ kind }: { kind: EvidenceItem['kind'] }): ReactNode {
  const common = { width: 28, height: 28, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false };
  switch (kind) {
    case 'document':
      return (
        <svg {...common}>
          <path d="M7 3h7l4 4v14H7z" />
          <path d="M14 3v4h4M9.5 12h6M9.5 15.5h6" />
        </svg>
      );
    case 'log':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 9l3 3-3 3M12 15h5" />
        </svg>
      );
    case 'message':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
      );
    case 'card':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path d="M3 10h18M7 15h4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="4" />
          <circle cx="16" cy="12" r="2.4" />
        </svg>
      );
  }
}
