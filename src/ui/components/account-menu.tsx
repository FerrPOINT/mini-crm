import type { ReactNode } from 'react';
import { LifeBuoy, LogOut, Palette, UserRound } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ResourceListDescription } from './resource-list';
import { ThemeMenuItems } from './theme-menu-items';
import { useUiLabels } from './labels';

/** Shared header menu. Identity, permissions and logout lifecycle remain with its owner. */
export function AccountMenu({
  account,
  modal = true,
  showTheme = true,
  beforeTheme,
  children,
}: {
  account?: {
    label: string;
    secondary?: string;
    onLogout: () => void;
    pending?: boolean;
  };
  /** Preserve the surrounding application's established focus/inert behavior. */
  modal?: boolean;
  /** Disable preference writes in isolated presentation previews. */
  showTheme?: boolean;
  /** Owner-supplied menu items before the platform theme group. */
  beforeTheme?: ReactNode;
  /** Owner-supplied menu items after themes and before logout. */
  children?: ReactNode;
}) {
  const labels = useUiLabels();
  return (
    <DropdownMenu modal={modal}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={account ? labels.account : showTheme ? labels.theme : labels.help}
          title={account ? labels.account : showTheme ? labels.theme : labels.help}
        >
          {account ? (
            <UserRound className="h-5 w-5" aria-hidden />
          ) : showTheme ? (
            <Palette className="h-5 w-5" aria-hidden />
          ) : (
            <LifeBuoy className="h-5 w-5" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-2rem)]">
        {account && (
          <DropdownMenuLabel>
            {account.label}
            {account.secondary && (
              <ResourceListDescription className="block">
                {account.secondary}
              </ResourceListDescription>
            )}
          </DropdownMenuLabel>
        )}
        {beforeTheme}
        {showTheme && <ThemeMenuItems />}
        {children}
        {account && (
          <DropdownMenuItem disabled={account.pending} onSelect={account.onLogout}>
            <LogOut className="h-4 w-4" aria-hidden />
            {labels.logout}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
