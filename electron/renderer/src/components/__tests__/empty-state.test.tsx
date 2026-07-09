// src/components/__tests__/empty-state.test.tsx — EmptyState smoke test
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Globe } from 'lucide-react';
import { EmptyState } from '../empty-state';

describe('EmptyState', () => {
  it('renders icon + title + description', () => {
    render(<EmptyState icon={Globe} title="Hello" description="World" />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('renders without description', () => {
    render(<EmptyState icon={Globe} title="Only title" />);
    expect(screen.getByText('Only title')).toBeInTheDocument();
  });
});