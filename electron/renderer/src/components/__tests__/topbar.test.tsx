// src/components/__tests__/topbar.test.tsx — TopBar smoke test
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/render-helpers';
import { TopBar } from '../topbar';

describe('TopBar', () => {
  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <TopBar
        theme="dark"
        onToggleTheme={vi.fn()}
        onOpenPalette={vi.fn()}
        onOpenHelp={vi.fn()}
        onOpenRepair={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    expect(container.textContent).toContain('WebPilot');
    expect(container.textContent).toContain('v4.0.4');
  });

  it('calls onToggleTheme when theme button clicked', async () => {
    const onToggle = vi.fn();
    const { container } = renderWithProviders(
      <TopBar
        theme="dark"
        onToggleTheme={onToggle}
        onOpenPalette={vi.fn()}
        onOpenHelp={vi.fn()}
        onOpenRepair={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );
    const btn = container.querySelector('button[aria-label="切换主题"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});