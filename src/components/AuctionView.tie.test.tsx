import { render, screen, fireEvent } from '@testing-library/react';
import { AuctionView } from './AuctionView';
import { initAuction } from '../utilities/auction';

describe('AuctionView tie behavior', () => {
  it('shows tie warning when highest bids match', () => {
    const auction = initAuction('a1', 3000, ['A', 'B', 'C'], ['Alice', 'Bob', 'Cathy']);
    render(<AuctionView auction={auction} />);

    // Alice and Bob both select room A to cause conflict
    const selects = screen.getAllByRole('combobox');
    // Alice select
    fireEvent.change(selects[0], { target: { value: 'r1' } });
    // Bob select
    fireEvent.change(selects[1], { target: { value: 'r1' } });

    const submit = screen.getByText(/Submit Selections/i);
    fireEvent.click(submit);

    // Now bidding phase should show two inputs for r1
    const bidInputs = screen.getAllByRole('spinbutton');
    // Enter same bid for both
    fireEvent.change(bidInputs[0], { target: { value: '500' } });
    const submitBtns = screen.getAllByText(/Submit Bid/i);
    fireEvent.click(submitBtns[0]);
    // second
    fireEvent.change(bidInputs[1], { target: { value: '500' } });
    fireEvent.click(submitBtns[1]);

    // Tie warning should be visible
    expect(screen.getByText(/Tie detected/i)).toBeInTheDocument();
  });
});
