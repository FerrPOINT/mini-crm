import * as React from 'react';
import { cn } from '../lib/utils';
import { useComposedRefs } from '@radix-ui/react-compose-refs';
import { initTextareaAutosize, destroyTextareaAutosize } from '../lib/textarea-runtime.js';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  appearance?: 'default' | 'inline';
  /** Fit content within native rows and CSS min/max-height; does not emit form events. */
  autoSize?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, appearance = 'default', autoSize = false, ...props }, forwardedRef) => {
    const field = React.useRef<HTMLTextAreaElement>(null);
    const ref = useComposedRefs(forwardedRef, field);
    // Controlled values, rows and owner styles may change without input events.
    React.useLayoutEffect(() => {
      if (!field.current) return;
      if (autoSize) initTextareaAutosize(field.current);
      else destroyTextareaAutosize(field.current);
    });
    React.useLayoutEffect(() => {
      const element = field.current;
      return () => {
        if (element) destroyTextareaAutosize(element);
      };
    }, []);
    return (
      <textarea
        data-appearance={appearance}
        data-base-autosize={autoSize ? '' : undefined}
        className={cn('base-control base-textarea', className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
