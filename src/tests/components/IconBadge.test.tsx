/**
 * IconBadge Component Tests
 * Verifies proper icon alignment and rendering
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import IconBadge, { BadgePresets } from '../../components/IconBadge';
import { AlertTriangle, Play, Phone, CheckCircle } from 'lucide-react';

describe('IconBadge', () => {
  it('renders with default props', () => {
    const { container } = render(<IconBadge icon={AlertTriangle} />);
    const badge = container.firstChild as HTMLElement;
    
    expect(badge).toBeDefined();
    expect(badge.className).toContain('flex');
    expect(badge.className).toContain('items-center');
    expect(badge.className).toContain('justify-center');
  });

  it('applies custom size', () => {
    const { container } = render(<IconBadge icon={Play} size={24} />);
    const icon = container.querySelector('svg');
    
    expect(icon).toBeDefined();
    expect(icon?.getAttribute('width')).toBe('24');
    expect(icon?.getAttribute('height')).toBe('24');
  });

  it('applies custom color classes', () => {
    const customColor = 'text-red-400 bg-red-500/20';
    const { container } = render(<IconBadge icon={Phone} color={customColor} />);
    const badge = container.firstChild as HTMLElement;
    
    expect(badge.className).toContain('text-red-400');
    expect(badge.className).toContain('bg-red-500/20');
  });

  it('applies rounded variants correctly', () => {
    const { container: containerSm } = render(<IconBadge icon={AlertTriangle} rounded="sm" />);
    expect((containerSm.firstChild as HTMLElement).className).toContain('rounded');
    
    const { container: containerFull } = render(<IconBadge icon={AlertTriangle} rounded="full" />);
    expect((containerFull.firstChild as HTMLElement).className).toContain('rounded-full');
  });

  it('includes flex-shrink-0 class', () => {
    const { container } = render(<IconBadge icon={CheckCircle} />);
    const badge = container.firstChild as HTMLElement;
    
    expect(badge.className).toContain('flex-shrink-0');
  });

  it('works with preset colors', () => {
    const { container } = render(
      <IconBadge 
        icon={AlertTriangle} 
        color={BadgePresets.systemAlert.color} 
      />
    );
    const badge = container.firstChild as HTMLElement;
    
    expect(badge.className).toContain('text-red-400');
    expect(badge.className).toContain('bg-red-500/10');
  });

  it('applies additional className prop', () => {
    const { container } = render(
      <IconBadge 
        icon={Play} 
        className="custom-class" 
      />
    );
    const badge = container.firstChild as HTMLElement;
    
    expect(badge.className).toContain('custom-class');
  });
});

describe('BadgePresets', () => {
  it('has notification type presets', () => {
    expect(BadgePresets.taskComplete).toBeDefined();
    expect(BadgePresets.taskComplete.color).toContain('green');
    
    expect(BadgePresets.systemAlert).toBeDefined();
    expect(BadgePresets.systemAlert.color).toContain('red');
  });

  it('has approval type presets', () => {
    expect(BadgePresets.tweet).toBeDefined();
    expect(BadgePresets.email).toBeDefined();
    expect(BadgePresets.message).toBeDefined();
  });

  it('has channel presets', () => {
    expect(BadgePresets.discord).toBeDefined();
    expect(BadgePresets.telegram).toBeDefined();
    expect(BadgePresets.whatsapp).toBeDefined();
  });
});
