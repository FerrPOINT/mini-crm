import type { ReactNode } from 'react';
export function AppHeader({
  leading,
  context,
  actions,
}: {
  leading: ReactNode;
  context?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="platform-header" data-platform-header>
      <div className="platform-header-leading" data-platform-header-slot="leading">
        {leading}
      </div>
      {context && (
        <div className="platform-header-context" data-platform-header-slot="context">
          {context}
        </div>
      )}
      {actions && (
        <div className="platform-header-actions" data-platform-header-slot="actions">
          {actions}
        </div>
      )}
    </header>
  );
}
