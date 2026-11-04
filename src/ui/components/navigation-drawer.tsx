import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useLocation } from 'react-router';
import { Menu } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog';
import { useUiLabels } from './labels';
import { useMediaQuery } from '../lib/use-media-query';

const desktopQuery = '(min-width: 768px)';

export interface NavigationDrawerProps {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desktopFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/** Product supplies navigation; Base owns modal, responsive and focus behavior. */
export function NavigationDrawer({
  title,
  open,
  onOpenChange,
  desktopFocusRef,
  children,
}: NavigationDrawerProps) {
  const labels = useUiLabels();
  const { pathname, search, hash } = useLocation();
  const route = pathname + search + hash;
  const previousRoute = useRef(route);
  const closeDesktopDrawer = useCallback(
    (desktop: boolean) => {
      if (desktop && open) onOpenChange(false);
    },
    [open, onOpenChange],
  );
  const desktop = useMediaQuery(desktopQuery, closeDesktopDrawer);
  useEffect(() => {
    if (previousRoute.current !== route && open) onOpenChange(false);
    previousRoute.current = route;
  }, [route, open, onOpenChange]);
  useEffect(() => {
    closeDesktopDrawer(desktop);
  }, [desktop, closeDesktopDrawer]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="base-shell-drawer-trigger"
          aria-label={labels.openNavigation}
          title={labels.openNavigation}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        placement="drawer"
        onCloseAutoFocus={(event) => {
          const target = desktopFocusRef.current;
          if (window.matchMedia?.(desktopQuery).matches && target?.isConnected) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        <DialogTitle className="base-shell-drawer-title">{title}</DialogTitle>
        <div className="base-shell-navigation-scroll">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
