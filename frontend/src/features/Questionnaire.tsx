import { useState } from 'react';
import { MessageSquare, ArrowRight } from 'lucide-react';
import { useApi } from '../services/api';
import type { Answers } from '../services/types';
import { ErrorBox } from '../components/UI';
export default function Questionnaire({
  checkinId,
  onSubmit,
  busy,
}: {
  checkinId: string;
  onSubmit: (a: Answers) => void;
  busy: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>({
    wellbeing: 7,
    fatigue: 'none',
    sleep_quality: 'restful',
    mood: 'steady',
    symptoms: 'none',
    notes: '',
    followup: '',
  });
  const q = useApi<{ followups: string[]; voice: string }>(
    `/questionnaires/${checkinId}?symptoms=${answers.symptoms}`,
  );
  function set(key: keyof Answers, value: string | number) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(answers);
      }}
      className="questionnaire"
    >
      <div className="section-intro">
        <MessageSquare size={20} />
        <p>
          A quick check-in with you.
          <br />
          <small>Selectable and typed responses work entirely offline.</small>
        </p>
      </div>
      <label>
        How are you feeling today?<span className="range-value">{answers.wellbeing} / 10</span>
        <input
          aria-label="Well-being"
          type="range"
          min="1"
          max="10"
          value={answers.wellbeing}
          onChange={(e) => set('wellbeing', +e.target.value)}
        />
        <div className="range-labels">
          <span>Very unwell</span>
          <span>Feeling well</span>
        </div>
      </label>
      {(
        [
          {
            key: 'fatigue',
            title: 'Any unusual fatigue?',
            options: [
              ['none', 'None'],
              ['mild', 'Mild'],
              ['unusual', 'Unusual'],
            ],
          },
          {
            key: 'sleep_quality',
            title: 'How was your sleep?',
            options: [
              ['restful', 'Restful'],
              ['interrupted', 'Interrupted'],
              ['poor', 'Poor'],
            ],
          },
          {
            key: 'mood',
            title: 'How would you describe your mood?',
            options: [
              ['steady', 'Steady'],
              ['low', 'Low'],
              ['anxious', 'Anxious'],
            ],
          },
          {
            key: 'symptoms',
            title: 'Any new symptoms or discomfort?',
            options: [
              ['none', 'None'],
              ['dizziness', 'Dizziness'],
              ['pain', 'Pain'],
              ['other', 'Other'],
            ],
          },
        ] as const
      ).map((group) => (
        <fieldset key={group.key}>
          <legend>{group.title}</legend>
          <div className="segmented">
            {group.options.map(([v, l]) => (
              <button
                type="button"
                aria-pressed={answers[group.key] === v}
                key={v}
                className={answers[group.key] === v ? 'selected' : ''}
                onClick={() => {
                  set(group.key, v);
                  if (group.key === 'symptoms') set('followup', '');
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {q.error && <ErrorBox message={q.error} retry={q.refresh} />}{' '}
      {!!q.data?.followups.length && (
        <label className="followup">
          {q.data.followups.join(' ')}
          <textarea
            required
            maxLength={2000}
            value={answers.followup}
            onChange={(e) => set('followup', e.target.value)}
            placeholder="Describe timing, changes and associated symptoms…"
          />
        </label>
      )}
      <label>
        Anything else to share? <small>Optional</small>
        <textarea
          maxLength={2000}
          value={answers.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Notes for your crew medical officer"
        />
      </label>
      <div className="input-note">
        Local speech recognition is not installed. No microphone is required or activated.
      </div>
      <button disabled={busy || q.loading || !!q.error} className="button primary full">
        {busy ? 'Saving responses…' : 'Complete questionnaire'}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
