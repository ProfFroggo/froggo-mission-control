import { Switch } from '@radix-ui/themes';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'default' | 'green' | 'red';
}

/**
 * Toggle Switch Component
 *
 * Wraps Radix Themes Switch.
 * iOS/macOS-style toggle - pill-shaped with sliding thumb.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 'md',
  colorScheme = 'default',
}: ToggleProps) {
  const radixSize = size === 'sm' ? '1' : size === 'lg' ? '3' : '2';
  const color =
    colorScheme === 'green' ? 'grass' :
    colorScheme === 'red' ? 'red' :
    'indigo';

  return (
    <Switch
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      size={radixSize as '1' | '2' | '3'}
      color={color as 'grass' | 'red' | 'indigo'}
    />
  );
}
