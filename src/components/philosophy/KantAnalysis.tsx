import type { ReactNode } from 'react';
import type { Story } from '../../engine/types';
import { AnalysisSection } from './AnalysisSection';

export function KantAnalysis({ story, endingId, flags, active }: { story: Story; endingId: string; flags: Record<string, string>; active?: boolean }): ReactNode {
  return <AnalysisSection id="kant" story={story} endingId={endingId} flags={flags} active={active} />;
}
