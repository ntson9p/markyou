import * as React from 'react';

import { cn } from '@/lib/utils';

interface SwitchProps extends Omit<React.ComponentProps<'button'>, 'onChange' | 'type'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * On/off switch. A native `<button role="switch">` rather than a Radix
 * primitive: it is a dozen lines, and the initial bundle is budgeted (§7).
 *
 * Labelling is the caller's job — pass `aria-labelledby` pointing at the row
 * label, or `aria-label` when there is no visible one.
 */
function Switch({ checked, onCheckedChange, className, disabled, ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent p-0.5 transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'size-4 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export { Switch };
