'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDataStore } from '@/lib/data-store';
import type { User } from '@/lib/models';

const NONE_VALUE = '__none__';

export function projectManagerLabel(user: Pick<User, 'full_name' | 'username'>): string {
  return user.full_name?.trim() || user.username;
}

type ProjectManagerSelectProps = {
  value?: string | null;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
};

export function ProjectManagerSelect({
  value,
  onChange,
  id,
  className = 'h-10',
  placeholder = 'Select project manager',
}: ProjectManagerSelectProps) {
  const { users } = useDataStore();

  const options = useMemo(
    () =>
      [...users]
        .filter((user) => user.is_active)
        .sort((a, b) =>
          projectManagerLabel(a).localeCompare(projectManagerLabel(b), undefined, {
            sensitivity: 'base',
          })
        ),
    [users]
  );

  const current = (value ?? '').trim();
  const matched = options.find(
    (user) =>
      projectManagerLabel(user) === current ||
      user.username === current ||
      user.full_name?.trim() === current
  );
  const selectValue = matched
    ? String(matched.id)
    : current
      ? `legacy:${current}`
      : NONE_VALUE;

  return (
    <Select
      value={selectValue}
      onValueChange={(next) => {
        if (next === NONE_VALUE) {
          onChange('');
          return;
        }
        if (next.startsWith('legacy:')) {
          onChange(next.slice('legacy:'.length));
          return;
        }
        const user = options.find((item) => String(item.id) === next);
        onChange(user ? projectManagerLabel(user) : '');
      }}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>None</SelectItem>
        {!matched && current ? (
          <SelectItem value={`legacy:${current}`}>{current}</SelectItem>
        ) : null}
        {options.map((user) => (
          <SelectItem key={user.id} value={String(user.id)}>
            {projectManagerLabel(user)}
            {user.full_name?.trim() && user.full_name.trim() !== user.username
              ? ` (@${user.username})`
              : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
