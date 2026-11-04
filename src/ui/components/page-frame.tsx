import * as React from 'react';
import { cn } from '../lib/utils';

export type PageLayoutMode = 'wide' | 'reading' | 'detail-with-aside';

const modeClass: Record<PageLayoutMode, string> = {
  wide: 'page-wide',
  reading: 'page-readable',
  'detail-with-aside': 'page-detail',
};

export type PageFrameProps = React.HTMLAttributes<HTMLDivElement> & {
  mode?: PageLayoutMode;
};

const PageFrame = React.forwardRef<HTMLDivElement, PageFrameProps>(
  ({ className, mode = 'wide', children, ...props }, ref) => (
    <div className="page-frame">
      <div ref={ref} {...props} className={cn(modeClass[mode], className)} data-page-layout={mode}>
        {children}
      </div>
    </div>
  ),
);

PageFrame.displayName = 'PageFrame';

export { PageFrame };
