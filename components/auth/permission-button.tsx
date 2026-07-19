'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth-context';
import { permissionTooltip } from '@/lib/permission-codes';
import { Can } from '@/components/auth/can';

type ButtonProps = ComponentProps<typeof Button>;

interface PermissionButtonProps extends ButtonProps {
  permission: string | string[];
  /**
   * - hide (default): do not render if unauthorized (CRUD actions)
   * - disable: show disabled with lock + tooltip (exports, known features)
   */
  mode?: 'hide' | 'disable';
  requireAll?: boolean;
  children: ReactNode;
}

/**
 * Action guard for buttons. Use mode="hide" for CRUD; mode="disable" for export/print.
 */
export function PermissionButton({
  permission,
  mode = 'hide',
  requireAll = false,
  children,
  disabled,
  ...buttonProps
}: PermissionButtonProps) {
  const { can, hasAllPermissions } = useAuth();
  const list = Array.isArray(permission) ? permission : [permission];
  const allowed = requireAll ? hasAllPermissions(list) : can(list);

  if (mode === 'hide') {
    return (
      <Can permission={permission} requireAll={requireAll}>
        <Button disabled={disabled} {...buttonProps}>
          {children}
        </Button>
      </Can>
    );
  }

  if (allowed) {
    return (
      <Button disabled={disabled} {...buttonProps}>
        {children}
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button disabled {...buttonProps}>
              {children}
              <Lock className="ml-1.5 h-3.5 w-3.5 opacity-70" aria-hidden />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{permissionTooltip(permission)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
