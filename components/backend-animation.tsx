'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { cn } from '@/lib/utils';

interface BackendAnimationProps {
  className?: string;
}

export default function BackendAnimation({ className }: BackendAnimationProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center',
        'size-8 sm:size-9 md:size-10 lg:size-11',
        className
      )}
      aria-hidden
    >
      <DotLottieReact
        src="/lottie/System Icon.svg"
        autoplay
        loop
        className="h-full w-full"
      />
    </div>
  );
}
