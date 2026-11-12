'use client';

import { Fragment, type ReactNode } from 'react';
import { ONBOARDING_ROLES } from '@/lib/onboarding/content';

type RoleTerm = {
  phrase: string;
  color: string;
};

/** Longest phrases first so “Field Service Engineer” wins over shorter tokens. */
const ROLE_TERMS: RoleTerm[] = (() => {
  const terms: RoleTerm[] = [];
  for (const role of ONBOARDING_ROLES) {
    terms.push({ phrase: `${role.label}s`, color: role.color });
    terms.push({ phrase: role.label, color: role.color });
    if (role.shortLabel === 'Admin') {
      terms.push({ phrase: 'Admins', color: role.color });
    }
    if (role.shortLabel === 'Dev') {
      terms.push({ phrase: 'Devs', color: role.color });
    }
    terms.push({ phrase: role.shortLabel, color: role.color });
  }
  return terms.sort((a, b) => b.phrase.length - a.phrase.length);
})();

const ROLE_NAME_PATTERN = new RegExp(
  `\\b(${ROLE_TERMS.map((t) => t.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
  'g'
);

const COLOR_BY_PHRASE = new Map(ROLE_TERMS.map((t) => [t.phrase, t.color]));

function colorForMatch(matched: string): string | undefined {
  return COLOR_BY_PHRASE.get(matched) ?? COLOR_BY_PHRASE.get(matched.replace(/s$/, ''));
}

/** Renders plain text with role names bold and tinted to match role badges. */
export function HighlightRoleNames({ text }: { text: string }): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  ROLE_NAME_PATTERN.lastIndex = 0;

  while ((match = ROLE_NAME_PATTERN.exec(text)) !== null) {
    const [matched] = match;
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const color = colorForMatch(matched);
    parts.push(
      <strong key={`${match.index}-${matched}`} className="font-semibold" style={{ color }}>
        {matched}
      </strong>
    );
    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  if (parts.length === 0) return text;

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </>
  );
}
