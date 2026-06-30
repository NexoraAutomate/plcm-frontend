'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExpandableRowProps {
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  className?: string;
}

export function ExpandableRow({
  children,
  expandedContent,
  className = '',
}: ExpandableRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr className={cn('border-b hover:bg-muted/50 transition-colors', className)}>
        <td className="w-8 px-2 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-180'
              )}
            />
          </Button>
        </td>
        {children}
      </tr>
      {isExpanded && (
        <tr className="bg-muted/30 border-b">
          <td colSpan={100} className="p-0">
            <div className="px-6 py-4">
              {expandedContent}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
