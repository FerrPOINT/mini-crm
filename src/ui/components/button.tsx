import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { subjectColorStyle } from '../lib/subject-color';

const buttonVariants = cva(
  'base-control base-button inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-foreground hover:bg-accent-hover',
        secondary:
          'bg-surface-raised text-text-primary border border-border-strong hover:bg-border',
        ghost: 'hover:bg-surface-raised text-text-secondary hover:text-text-primary',
        destructive: 'bg-danger text-destructive-foreground hover:opacity-90',
        link: 'text-highlight underline-offset-4 hover:underline',
        'destructive-outline': 'border border-danger text-danger hover:bg-danger/10',
        outline:
          'border border-border-strong bg-transparent hover:bg-surface-raised text-text-primary',
        dashed: '',
        subject: '',
      },
      size: {
        default: 'h-10 min-h-10 px-4 py-2',
        sm: 'h-10 min-h-10 px-3 text-xs',
        lg: 'h-11 min-h-10 px-6',
        icon: 'base-icon-control h-10 w-10 min-h-10 min-w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** #RRGGBB data color for variant=subject; omitted values inherit a containing badge. */
  subjectColor?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, subjectColor, style, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const resolvedStyle =
      (variant ?? 'default') === 'default'
        ? {
            color: 'var(--base-button-foreground, var(--color-accent-foreground))',
            ...style,
          }
        : style;
    const colorStyle = variant === 'subject' ? subjectColorStyle(subjectColor) : undefined;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-variant={variant ?? 'default'}
        data-size={size ?? 'default'}
        ref={ref}
        style={colorStyle ? { ...resolvedStyle, ...colorStyle } : resolvedStyle}
        {...props}
        data-subject-color={variant === 'subject' ? subjectColor : undefined}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
