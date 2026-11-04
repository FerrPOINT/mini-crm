import { useTheme } from '../lib/theme';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from './dropdown-menu';
import { useUiLabels } from './labels';

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const labels = useUiLabels();
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{labels.theme}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        aria-label={labels.theme}
        value={theme}
        onValueChange={(value) => {
          if (value === 'dark' || value === 'gray' || value === 'light') setTheme(value);
        }}
      >
        <DropdownMenuRadioItem value="light">{labels.themeLight}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark">{labels.themeDark}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="gray">{labels.themeGray}</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
    </>
  );
}
