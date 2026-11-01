import { useState } from 'react';
import { useT } from '../../i18n';
import type { ReactNode } from 'react';
import type { Character, Interaction } from '../../engine/types';
import { CalendarInterface } from './CalendarInterface';
import { ConsoleSteps } from './ConsoleSteps';
import { MessageInterface } from './MessageInterface';
import { TestLab } from './TestLab';
import { Icon } from '../ui/Icon';

const TASK: Record<Interaction['type'], string> = {
  testLab: 'Pick who signs in and whose document they ask for, from two different organizations. Then run the test.',
  steps: 'Run the three checks one after another, from the top.',
  chat: 'Send your message. The team will answer.',
  calendar: 'Open each entry in the history to see what actually happened.',
};

/** Runs one interactive object and unlocks "Continue" when it is finished. */
export function InteractionHost({
  interaction,
  flags,
  characters,
  onComplete,
}: {
  interaction: Interaction;
  flags: Record<string, string>;
  characters: Record<string, Character>;
  onComplete: () => void;
}): ReactNode {
  const t = useT();
  const [done, setDone] = useState(false);
  const finish = (): void => setDone(true);
  return (
    <div className="overlay-center">
      <div className="interaction" data-testid="interaction">
        <p className="task">{t(TASK[interaction.type])}</p>
        {interaction.type === 'testLab' && <TestLab config={interaction} onDone={finish} />}
        {interaction.type === 'steps' && <ConsoleSteps config={interaction} onDone={finish} />}
        {interaction.type === 'chat' && <MessageInterface chat={interaction} flags={flags} characters={characters} onDone={finish} />}
        {interaction.type === 'calendar' && <CalendarInterface config={interaction} onDone={finish} />}
        <div className="interaction-foot">
          <button type="button" className="cta" disabled={!done} onClick={onComplete} data-testid="interaction-continue">
            {t('Continue')} <Icon name="next" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
