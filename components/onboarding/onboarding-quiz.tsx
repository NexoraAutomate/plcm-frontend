'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleHelp, RotateCcw, XCircle } from 'lucide-react';
import {
  ONBOARDING_QUIZ,
  QUIZ_SECTION_LABELS,
  quizScore,
  scoreMessage,
  type QuizSectionId,
} from '@/lib/onboarding/quiz';
import { HighlightRoleNames } from '@/components/onboarding/highlight-role-names';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Phase = 'taking' | 'results';

export function OnboardingQuiz() {
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});
  const [phase, setPhase] = useState<Phase>('taking');
  const [index, setIndex] = useState(0);

  const question = ONBOARDING_QUIZ[index];
  const answeredCount = useMemo(
    () => ONBOARDING_QUIZ.filter((q) => answers[q.id] !== undefined).length,
    [answers]
  );
  const result = useMemo(() => quizScore(answers), [answers]);

  function selectOption(optionIndex: number) {
    if (!question || phase !== 'taking') return;
    // Lock in the first choice so feedback is immediate and final for this visit.
    if (answers[question.id] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }));
  }

  function goNext() {
    if (index >= ONBOARDING_QUIZ.length - 1) return;
    if (answers[question.id] === undefined) return;
    setIndex((i) => i + 1);
  }

  function goPrev() {
    if (index > 0) setIndex((i) => i - 1);
  }

  function submit() {
    setPhase('results');
  }

  function retake() {
    setAnswers({});
    setIndex(0);
    setPhase('taking');
  }

  if (phase === 'results') {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your score</CardTitle>
            <CardDescription>{scoreMessage(result.percent)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-3xl font-semibold tracking-tight">
              {result.correct}
              <span className="text-lg font-normal text-muted-foreground">
                {' '}
                / {result.total}
              </span>
              <span className="ml-2 text-base font-medium text-muted-foreground">
                ({result.percent}%)
              </span>
            </p>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(QUIZ_SECTION_LABELS) as QuizSectionId[]).map((section) => {
                const row = result.bySection[section];
                const pct = row.total ? Math.round((row.correct / row.total) * 100) : 0;
                return (
                  <div key={section} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="font-medium">{QUIZ_SECTION_LABELS[section]}</div>
                    <div className="text-muted-foreground">
                      {row.correct}/{row.total} ({pct}%)
                    </div>
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="outline" className="gap-1.5" onClick={retake}>
              <RotateCcw className="size-3.5" aria-hidden />
              Retake quiz
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Review answers</h3>
          {ONBOARDING_QUIZ.map((q, i) => {
            const chosen = answers[q.id];
            const ok = chosen === q.correctIndex;
            return (
              <Card key={q.id} className={cn(ok ? 'border-teal-500/40' : 'border-rose-500/40')}>
                <CardHeader className="gap-1 py-4">
                  <div className="flex items-start gap-2">
                    {ok ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-600" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                    )}
                    <div className="min-w-0 space-y-1">
                      <CardDescription>
                        {QUIZ_SECTION_LABELS[q.section]} · Q{i + 1}
                      </CardDescription>
                      <CardTitle className="text-sm font-medium leading-snug">
                        <HighlightRoleNames text={q.prompt} />
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 pb-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">Your answer: </span>
                    {chosen === undefined ? (
                      '—'
                    ) : (
                      <HighlightRoleNames text={q.options[chosen]} />
                    )}
                  </p>
                  {!ok ? (
                    <p>
                      <span className="text-muted-foreground">Correct: </span>
                      <HighlightRoleNames text={q.options[q.correctIndex]} />
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">
                    <HighlightRoleNames text={q.explain} />
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (!question) return null;

  const selected = answers[question.id];
  const revealed = selected !== undefined;
  const isCorrect = revealed && selected === question.correctIndex;
  const allAnswered = answeredCount === ONBOARDING_QUIZ.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CircleHelp className="size-3.5" aria-hidden />
          {QUIZ_SECTION_LABELS[question.section]}
        </span>
        <span>
          Question {index + 1} of {ONBOARDING_QUIZ.length}
          <span className="ml-2">· {answeredCount} answered</span>
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${((index + 1) / ONBOARDING_QUIZ.length) * 100}%` }}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base leading-snug">
            <HighlightRoleNames text={question.prompt} />
          </CardTitle>
          <CardDescription>
            {revealed ? 'Answer locked — see feedback below' : 'Choose one answer'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            key={question.id}
            value={selected === undefined ? '' : String(selected)}
            onValueChange={(value) => {
              if (value === '') return;
              selectOption(Number(value));
            }}
            className="gap-3"
            disabled={revealed}
          >
            {question.options.map((option, optionIndex) => {
              const id = `${question.id}-${optionIndex}`;
              const isChosen = selected === optionIndex;
              const isAnswer = optionIndex === question.correctIndex;
              return (
                <div
                  key={id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                    !revealed && isChosen && 'border-primary/50 bg-primary/5',
                    revealed && isAnswer && 'border-teal-500/50 bg-teal-500/10',
                    revealed && isChosen && !isAnswer && 'border-rose-500/50 bg-rose-500/10'
                  )}
                >
                  <RadioGroupItem
                    value={String(optionIndex)}
                    id={id}
                    className="mt-0.5"
                    disabled={revealed}
                  />
                  <Label
                    htmlFor={id}
                    className={cn(
                      'text-sm font-normal leading-snug',
                      revealed ? 'cursor-default' : 'cursor-pointer'
                    )}
                  >
                    <HighlightRoleNames text={option} />
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {revealed ? (
            <div
              className={cn(
                'rounded-lg border px-3 py-3 text-sm',
                isCorrect
                  ? 'border-teal-500/40 bg-teal-500/10 text-teal-950 dark:text-teal-50'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-50'
              )}
              role="status"
            >
              <div className="flex items-start gap-2 font-medium">
                {isCorrect ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                )}
                <span>{isCorrect ? 'Correct' : 'Incorrect'}</span>
              </div>
              {!isCorrect ? (
                <p className="mt-2 pl-6">
                  Correct answer:{' '}
                  <span className="font-medium">
                    <HighlightRoleNames text={question.options[question.correctIndex]} />
                  </span>
                </p>
              ) : null}
              <p className={cn('mt-1.5 pl-6', !isCorrect && 'mt-1')}>
                <HighlightRoleNames text={question.explain} />
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={goPrev} disabled={index === 0}>
          Previous
        </Button>
        <div className="flex flex-wrap gap-2">
          {index < ONBOARDING_QUIZ.length - 1 ? (
            <Button type="button" onClick={goNext} disabled={!revealed}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={!allAnswered}>
              Submit quiz
            </Button>
          )}
        </div>
      </div>

      {!allAnswered && index === ONBOARDING_QUIZ.length - 1 ? (
        <p className="text-sm text-muted-foreground">
          Answer every question before submitting. Use Previous to fill any blanks.
        </p>
      ) : null}
    </div>
  );
}
