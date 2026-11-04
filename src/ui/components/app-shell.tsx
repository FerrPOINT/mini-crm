import { SidebarList } from './sidebar-list';
import { useCallback, useId, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from './button';
import { useMediaQuery } from '../lib/use-media-query';

import { SidebarItem, SidebarItemLabel } from './sidebar-item';
import { NavigationDrawer } from './navigation-drawer';

import { PageFrame, type PageLayoutMode } from './page-frame';

import { useUiLabels } from './labels';

const compactSidebarQuery = '(min-width: 768px) and (max-width: 1279px)';

export interface ShellNavItem {
  to: string;
  label: string;
  icon: ElementType;
  end?: boolean;
  active?: boolean;
}

export interface AppShellProps {
  title: string;
  navigation?: readonly ShellNavItem[];
  /** Place the mobile navigation trigger in the application header. */
  renderHeader: (navigationTrigger: ReactNode) => ReactNode;
  /** Optional existing per-application preference key. Storage failures never disable navigation. */
  sidebarStorageKey?: string;
  /** Toggle the wide desktop preference; 768-1279 stays compact and mobile uses its drawer. */
  collapsibleSidebar?: boolean;
  layout?: PageLayoutMode;
  children: ReactNode;
}

export function AppShell({
  title,
  navigation = [],
  renderHeader,
  sidebarStorageKey,
  layout = 'wide',
  collapsibleSidebar = false,
  children,
}: AppShellProps) {
  const labels = useUiLabels();
  const explicitSidebar = collapsibleSidebar;
  const [open, setOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const focusCompactSidebar = useCallback((compact: boolean) => {
    if (compact && document.activeElement === sidebarToggleRef.current) mainRef.current?.focus();
  }, []);
  const compactViewport = useMediaQuery(compactSidebarQuery, focusCompactSidebar);
  function readPreference(key?: string) {
    try {
      return Boolean(
        key && typeof window !== 'undefined' && window.localStorage.getItem(key) === 'true',
      );
    } catch {
      return false;
    }
  }
  const [sidebar, setSidebar] = useState(() => ({
    key: sidebarStorageKey,
    collapsed: readPreference(sidebarStorageKey),
  }));
  // A new preference key selects its own value without writing the previous application's state.
  const preferenceCollapsed =
    sidebar.key === sidebarStorageKey ? sidebar.collapsed : readPreference(sidebarStorageKey);
  const collapsed = compactViewport || preferenceCollapsed;
  function toggleSidebar() {
    if (compactViewport) return;
    const next = !preferenceCollapsed;
    setSidebar({ key: sidebarStorageKey, collapsed: next });
    try {
      if (sidebarStorageKey) window.localStorage.setItem(sidebarStorageKey, String(next));
    } catch {
      /* The current view remains usable when browser storage is unavailable. */
    }
  }
  const sidebarId = useId();
  function links(items: readonly ShellNavItem[], drawer: boolean, label = labels.navigation) {
    return (
      <SidebarList asChild className="base-shell-navigation">
        <nav aria-label={label}>
          {items.map(({ to, label, icon: Icon, end, active }) => {
            const Target = active === undefined ? NavLink : Link;
            return (
              <SidebarItem key={to} asChild active={active} className="base-shell-link min-h-11">
                <Target
                  to={to}
                  {...(active === undefined ? { end: end ?? to === '/' } : {})}
                  aria-label={label}
                  aria-current={active === undefined ? undefined : active ? 'page' : false}
                  title={label}
                  onClick={() => setOpen(false)}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden />
                  <SidebarItemLabel className={drawer ? '' : 'base-shell-nav-label'}>
                    {label}
                  </SidebarItemLabel>
                </Target>
              </SidebarItem>
            );
          })}
        </nav>
      </SidebarList>
    );
  }
  function nav(drawer = false) {
    return links(navigation, drawer);
  }
  const navigationTrigger = (
    <NavigationDrawer title={title} open={open} onOpenChange={setOpen} desktopFocusRef={mainRef}>
      {nav(true)}
    </NavigationDrawer>
  );
  return (
    <div
      className="base-app-shell"
      data-base-shell
      data-sidebar-mode={explicitSidebar ? (collapsed ? 'compact' : 'expanded') : undefined}
    >
      {renderHeader(navigationTrigger)}
      <aside id={sidebarId} className="base-shell-sidebar" aria-label={labels.navigation}>
        {explicitSidebar && !compactViewport && (
          <div className="base-shell-sidebar-toolbar">
            <span className="base-shell-nav-label base-shell-sidebar-label">
              {labels.navigation}
            </span>
            <Button
              ref={sidebarToggleRef}
              variant="ghost"
              size="icon"
              aria-label={collapsed ? labels.expandSidebar : labels.collapseSidebar}
              title={collapsed ? labels.expandSidebar : labels.collapseSidebar}
              aria-expanded={!collapsed}
              aria-controls={sidebarId}
              onClick={toggleSidebar}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        )}
        <div className="base-shell-navigation-scroll">{nav()}</div>
      </aside>
      <div className="base-shell-work">
        <main ref={mainRef} tabIndex={-1} className="shell-main base-shell-main">
          <PageFrame mode={layout}>{children}</PageFrame>
        </main>
      </div>
    </div>
  );
}
