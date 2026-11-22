import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Bubble } from '../../src/otto/Bubble';

describe('Bubble', () => {
  it('shows one line at a time and advances with Next', async () => {
    const user = userEvent.setup();
    render(<Bubble lines={['Hello', 'World']} onDone={() => {}} />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.queryByText('World')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('calls onDone once after the last line and renders actions', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const onAction = vi.fn();
    render(
      <Bubble
        lines={['One', 'Two']}
        onDone={onDone}
        actions={[{ label: 'Try again', onClick: onAction }]}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('calls onDone on mount for a single line and shows its actions', () => {
    const onDone = vi.fn();
    render(<Bubble lines={['Only']} onDone={onDone} actions={[{ label: 'Go', onClick: () => {} }]} />);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });

  it('renders **x** as a code element', () => {
    const { container } = render(<Bubble lines={['Turn the **lpf** up']} onDone={() => {}} />);
    const code = container.querySelector('code');
    expect(code?.textContent).toBe('lpf');
    expect(container.textContent).toContain('Turn the lpf up');
  });

  it('does not interpret HTML in lines', () => {
    const { container } = render(<Bubble lines={['<b>hi</b>']} onDone={() => {}} />);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>hi</b>');
  });

  it('resets to the first line when lines change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Bubble lines={['A1', 'A2']} onDone={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A2')).toBeInTheDocument();
    rerender(<Bubble lines={['B1', 'B2']} onDone={() => {}} />);
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
  });
});
