import { render, screen } from '@testing-library/react';
import { Checklist } from '../../src/stage/Checklist';

describe('Checklist', () => {
  it('marks completed steps done and the current step as the active step', () => {
    render(
      <Checklist
        title="Your first beat"
        labels={['One', 'Two', 'Three', 'Four', 'Five']}
        current={2}
        completed={2}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveAttribute('aria-label', expect.stringContaining('done'));
    expect(items[1]).toHaveAttribute('aria-label', expect.stringContaining('done'));
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).not.toHaveAttribute('aria-label', expect.stringContaining('done'));
    expect(items[3]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Your first beat')).toBeInTheDocument();
  });
});
