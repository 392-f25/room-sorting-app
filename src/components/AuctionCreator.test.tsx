import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AuctionCreator } from './AuctionCreator';

describe('AuctionCreator', () => {
  it('shows inline validation when room names are missing', () => {
    const onCreate = vi.fn();
    render(<AuctionCreator onCreate={onCreate} />);

    // set count to 2
    const countInput = screen.getByLabelText(/Number of Rooms/i);
    fireEvent.change(countInput, { target: { value: '2' } });

    // clear second room name
    const roomNameInputs = screen.getAllByRole('textbox').filter(input => (input as HTMLInputElement).value.startsWith('Room'));
    fireEvent.change(roomNameInputs[1], { target: { value: '' } });

    const button = screen.getByText(/Create Auction/i);
    fireEvent.click(button);

    expect(screen.getByText(/Please enter names for all rooms/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
