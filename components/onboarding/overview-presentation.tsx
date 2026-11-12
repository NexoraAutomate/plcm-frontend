'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import GradientText from '@/components/GradientText';
import ShinyText from '@/components/ShinyText';
import SpotlightCard from '@/components/SpotlightCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OVERVIEW_SLIDES, type OverviewSlide } from '@/lib/onboarding/overview';

const GRADIENT = ['#0f766e', '#0369a1', '#334155'];

type OverviewPresentationProps = {
  onContinue?: () => void;
};

function SlideHero({ slide }: { slide: Extract<OverviewSlide, { kind: 'hero' }> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6 px-2 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-700/80 dark:text-teal-300/80">
        {slide.eyebrow}
      </p>
      <h3 className="max-w-4xl whitespace-pre-line text-3xl font-semibold tracking-tight sm:text-5xl">
        <GradientText colors={GRADIENT} animationSpeed={10} className="justify-start text-left">
          {slide.headline}
        </GradientText>
      </h3>
      <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {slide.subhead}
      </p>
      <ShinyText
        text={slide.accent}
        color="#64748b"
        shineColor="#f8fafc"
        speed={2.4}
        className="text-sm font-medium sm:text-base"
      />
    </div>
  );
}

function SlideProblem({ slide }: { slide: Extract<OverviewSlide, { kind: 'problem' }> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-6 px-2 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-700/80 dark:text-teal-300/80">
        {slide.eyebrow}
      </p>
      <h3 className="max-w-4xl whitespace-pre-line text-2xl font-semibold tracking-tight sm:text-4xl">
        <GradientText colors={GRADIENT} animationSpeed={10} className="justify-start text-left">
          {slide.headline}
        </GradientText>
      </h3>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
        {slide.body}
      </p>
      <ul className="grid max-w-3xl gap-2 sm:grid-cols-2">
        {slide.questions.map((q) => (
          <li
            key={q}
            className="rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-sm text-foreground/90"
          >
            {q}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlideJourney({ slide }: { slide: Extract<OverviewSlide, { kind: 'journey' }> }) {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-2 sm:px-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-700/80 dark:text-teal-300/80">
          {slide.eyebrow}
        </p>
        <h3 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          <GradientText colors={GRADIENT} animationSpeed={10} className="justify-start text-left">
            {slide.headline}
          </GradientText>
        </h3>
        <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{slide.body}</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {slide.steps.map((step) => (
          <li key={step.step}>
            <SpotlightCard
              theme="light"
              className="h-full !rounded-2xl !p-4 dark:!bg-zinc-950"
              spotlightColor="rgba(13, 148, 136, 0.35)"
              intensity={0.35}
              ambient
            >
              <div className="relative z-[2] space-y-1">
                <p className="text-[11px] font-semibold tracking-wider text-teal-700 dark:text-teal-300">
                  {step.step}
                </p>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.body}</p>
              </div>
            </SpotlightCard>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SlideCapabilities({
  slide,
}: {
  slide: Extract<OverviewSlide, { kind: 'capabilities' }>;
}) {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-2 sm:px-6">
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-700/80 dark:text-teal-300/80">
          {slide.eyebrow}
        </p>
        <h3 className="whitespace-pre-line text-2xl font-semibold tracking-tight sm:text-4xl">
          <GradientText colors={GRADIENT} animationSpeed={10} className="justify-start text-left">
            {slide.headline}
          </GradientText>
        </h3>
        <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">{slide.body}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {slide.items.map((item) => (
          <li key={item.title}>
            <SpotlightCard
              theme="light"
              className="h-full !rounded-2xl !p-4 dark:!bg-zinc-950"
              spotlightColor="rgba(3, 105, 161, 0.35)"
              intensity={0.35}
              ambient
            >
              <div className="relative z-[2] space-y-1.5">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </SpotlightCard>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SlideClose({
  slide,
  onContinue,
}: {
  slide: Extract<OverviewSlide, { kind: 'close' }>;
  onContinue?: () => void;
}) {
  const handleContinue = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
    onContinue?.();
  };

  return (
    <div className="flex h-full flex-col justify-center gap-6 px-2 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-700/80 dark:text-teal-300/80">
        {slide.eyebrow}
      </p>
      <h3 className="max-w-4xl whitespace-pre-line text-2xl font-semibold tracking-tight sm:text-4xl">
        <GradientText colors={GRADIENT} animationSpeed={10} className="justify-start text-left">
          {slide.headline}
        </GradientText>
      </h3>
      <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{slide.body}</p>
      <div className="flex flex-wrap gap-2">
        {slide.audiences.map((audience) => (
          <span
            key={audience}
            className="rounded-full border border-border/70 px-3 py-1 text-xs text-foreground/80"
          >
            {audience}
          </span>
        ))}
      </div>
      {onContinue ? (
        <div>
          <Button type="button" onClick={handleContinue}>
            {slide.cta}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function renderSlide(slide: OverviewSlide, onContinue?: () => void) {
  switch (slide.kind) {
    case 'hero':
      return <SlideHero slide={slide} />;
    case 'problem':
      return <SlideProblem slide={slide} />;
    case 'journey':
      return <SlideJourney slide={slide} />;
    case 'capabilities':
      return <SlideCapabilities slide={slide} />;
    case 'close':
      return <SlideClose slide={slide} onContinue={onContinue} />;
    default:
      return null;
  }
}

export function OverviewPresentation({ onContinue }: OverviewPresentationProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const slide = OVERVIEW_SLIDES[index] ?? OVERVIEW_SLIDES[0];
  const total = OVERVIEW_SLIDES.length;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const toggleFullscreen = useCallback(async () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by the browser; ignore.
    }
  }, []);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'Escape' && document.fullscreenElement) {
        void document.exitFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-slate-50 via-teal-50/40 to-sky-50/50 dark:from-zinc-950 dark:via-teal-950/20 dark:to-sky-950/30',
        isFullscreen && 'flex h-screen w-screen flex-col rounded-none border-0'
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-70',
          'bg-[radial-gradient(ellipse_at_top_right,rgba(13,148,136,0.12),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(3,105,161,0.10),transparent_50%)]'
        )}
        aria-hidden
      />

      <div className="relative z-[1] flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            PLCM overview
          </p>
          <p className="truncate text-sm text-foreground/80">
            Slide {index + 1} of {total}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="Previous slide"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={goNext}
            disabled={index === total - 1}
            aria-label="Next slide"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1 gap-1.5"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="size-3.5" />
                Exit
              </>
            ) : (
              <>
                <Maximize2 className="size-3.5" />
                Fullscreen
              </>
            )}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'relative z-[1] px-2 py-4 sm:px-4 sm:py-6',
          isFullscreen ? 'min-h-0 flex-1' : 'min-h-[28rem] sm:min-h-[32rem]'
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="h-full"
          >
            {renderSlide(slide, onContinue)}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="relative z-[1] flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3 sm:px-6">
        <div className="flex gap-1.5" aria-hidden>
          {OVERVIEW_SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-6 bg-teal-600 dark:bg-teal-400' : 'w-1.5 bg-border hover:bg-muted-foreground/40'
              )}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">
          Use ← → or Space to navigate
        </p>
      </div>
    </div>
  );
}
