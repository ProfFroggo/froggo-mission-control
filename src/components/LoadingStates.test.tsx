/**
 * Tests for LoadingStates component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Spinner,
  LoadingButton,
  Skeleton,
  TaskCardSkeleton,
  TableRowSkeleton,
  AgentCardSkeleton,
  SessionCardSkeleton,
  LoadingOverlay,
  ProgressBar,
  InlineLoader,
  PulsingDot,
} from './LoadingStates';

describe('LoadingStates', () => {
  describe('Spinner', () => {
    it('should render with default size', () => {
      const { container } = render(<Spinner />);

      const spinner = container.querySelector('svg');
      expect(spinner).toBeInTheDocument();
    });

    it('should render with custom size', () => {
      const { container } = render(<Spinner size={24} />);

      const spinner = container.querySelector('svg');
      expect(spinner).toHaveAttribute('height', '24');
      expect(spinner).toHaveAttribute('width', '24');
    });

    it('should have animate-spin class', () => {
      const { container } = render(<Spinner />);

      const spinner = container.querySelector('svg');
      expect(spinner).toHaveClass('animate-spin');
    });

    it('should apply custom className', () => {
      const { container } = render(<Spinner className="custom-class" />);

      const spinner = container.querySelector('svg');
      expect(spinner).toHaveClass('custom-class');
    });
  });

  describe('LoadingButton', () => {
    it('should render children when not loading', () => {
      render(<LoadingButton>Click me</LoadingButton>);

      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('should show loading state when loading=true', () => {
      render(<LoadingButton loading>Click me</LoadingButton>);

      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<LoadingButton onClick={handleClick}>Click me</LoadingButton>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled=true', () => {
      render(<LoadingButton disabled>Click me</LoadingButton>);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should apply variant classes', () => {
      render(<LoadingButton variant="secondary">Click me</LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-mission-control-surface');
    });

    it('should apply size classes', () => {
      render(<LoadingButton size="lg">Click me</LoadingButton>);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6');
    });

    it('should render icon when provided', () => {
      const Icon = () => <span data-testid="icon">Icon</span>;
      render(<LoadingButton icon={<Icon />}>Click me</LoadingButton>);

      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should not render icon when loading', () => {
      const Icon = () => <span data-testid="icon">Icon</span>;
      render(<LoadingButton icon={<Icon />} loading>Click me</LoadingButton>);

      expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    });

    it('should have correct type attribute', () => {
      render(<LoadingButton type="submit">Click me</LoadingButton>);

      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });
  });

  describe('Skeleton', () => {
    it('should render with default classes', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('bg-mission-control-border');
      expect(skeleton).toHaveClass('animate-pulse');
    });

    it('should apply custom width', () => {
      const { container } = render(<Skeleton width="w-1/2" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('w-1/2');
    });

    it('should apply custom height', () => {
      const { container } = render(<Skeleton height="h-8" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('h-8');
    });

    it('should apply rounded-full', () => {
      const { container } = render(<Skeleton rounded="full" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('rounded-full');
    });

    it('should apply custom className', () => {
      const { container } = render(<Skeleton className="custom-class" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('custom-class');
    });
  });

  describe('TaskCardSkeleton', () => {
    it('should render task card skeleton', () => {
      const { container } = render(<TaskCardSkeleton />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should have task card container class', () => {
      const { container } = render(<TaskCardSkeleton />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('bg-mission-control-surface');
      expect(outerDiv).toHaveClass('rounded-lg');
    });
  });

  describe('TableRowSkeleton', () => {
    it('should render table row skeleton with default columns', () => {
      render(
        <table>
          <tbody>
            <TableRowSkeleton />
          </tbody>
        </table>
      );

      const cells = screen.getAllByRole('cell');
      expect(cells.length).toBe(4);
    });

    it('should render with custom column count', () => {
      render(
        <table>
          <tbody>
            <TableRowSkeleton columns={6} />
          </tbody>
        </table>
      );

      const cells = screen.getAllByRole('cell');
      expect(cells.length).toBe(6);
    });
  });

  describe('AgentCardSkeleton', () => {
    it('should render agent card skeleton', () => {
      const { container } = render(<AgentCardSkeleton />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('SessionCardSkeleton', () => {
    it('should render session card skeleton', () => {
      const { container } = render(<SessionCardSkeleton />);

      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('LoadingOverlay', () => {
    it('should render loading message', () => {
      const { container } = render(<LoadingOverlay message="Loading data..." />);

      expect(screen.getByText('Loading data...')).toBeInTheDocument();
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should use default message', () => {
      render(<LoadingOverlay />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should not be fullscreen by default', () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).not.toHaveClass('fixed');
      expect(overlay).toHaveClass('absolute');
    });

    it('should be fullscreen when fullScreen=true', () => {
      const { container } = render(<LoadingOverlay fullScreen />);

      const overlay = container.firstChild as HTMLElement;
      expect(overlay).toHaveClass('fixed');
      expect(overlay).toHaveClass('inset-0');
      expect(overlay).toHaveClass('z-50');
    });
  });

  describe('ProgressBar', () => {
    it('should render with correct progress percentage', () => {
      render(<ProgressBar progress={50} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '50%' });
    });

    it('should clamp progress to 100', () => {
      render(<ProgressBar progress={150} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });

    it('should clamp progress to 0', () => {
      render(<ProgressBar progress={-10} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should show percentage by default', () => {
      render(<ProgressBar progress={75} />);

      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('should hide percentage when showPercentage=false', () => {
      render(<ProgressBar progress={75} showPercentage={false} />);

      expect(screen.queryByText('75%')).not.toBeInTheDocument();
    });

    it('should render label when provided', () => {
      render(<ProgressBar progress={50} label="Uploading..." />);

      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    it('should have correct aria attributes', () => {
      render(<ProgressBar progress={50} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('InlineLoader', () => {
    it('should render spinner', () => {
      const { container } = render(<InlineLoader />);

      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('should render text when provided', () => {
      render(<InlineLoader text="Loading..." />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should have different sizes', () => {
      const { container, rerender } = render(<InlineLoader size="sm" />);

      const small = container.querySelector('svg');
      expect(small).toHaveAttribute('height', '12');

      rerender(<InlineLoader size="lg" />);
      const large = container.querySelector('svg');
      expect(large).toHaveAttribute('height', '20');
    });
  });

  describe('PulsingDot', () => {
    it('should render pulsing dot', () => {
      const { container } = render(<PulsingDot />);

      const spans = container.querySelectorAll('span > span');
      expect(spans.length).toBe(2); // ping and relative
    });

    it('should have animate-ping class', () => {
      const { container } = render(<PulsingDot />);

      const pingDot = container.querySelector('.animate-ping');
      expect(pingDot).toBeInTheDocument();
    });

    it('should apply custom color', () => {
      const { container } = render(<PulsingDot color="bg-red-500" />);

      const dots = container.querySelectorAll('span > span');
      expect(dots[0]).toHaveClass('bg-red-500');
    });
  });
});
