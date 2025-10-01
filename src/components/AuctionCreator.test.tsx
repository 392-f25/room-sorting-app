import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AuctionCreator } from './AuctionCreator';

describe('AuctionCreator', () => {
  it('shows inline validation when names are missing', () => {
  const onCreate = vi.fn();
  render(<AuctionCreator onCreate={onCreate} />);

  // set count to 2 and clear one user name
  const countInput = screen.getByRole('spinbutton') as HTMLInputElement;
  fireEvent.change(countInput, { target: { value: '2' } });

  // clear second user name
  const userInputs = screen.getAllByRole('textbox');
  // textbox inputs include totalRent, then room and user name textboxes; pick the last textbox for the second user
  const lastUserInput = userInputs[userInputs.length - 1];
  fireEvent.change(lastUserInput, { target: { value: '' } });

    const button = screen.getByText(/Create Auction/i);
    fireEvent.click(button);

    expect(screen.getByText(/Please enter names for all rooms and users/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
