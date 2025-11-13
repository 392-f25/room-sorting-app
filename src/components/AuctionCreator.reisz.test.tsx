import {describe, it, vi } from 'vitest'
import {render, screen} from '@testing-library/react'
import { AuctionCreator } from './AuctionCreator'
import { userEvent } from '@testing-library/user-event';

describe('user tries to create a room', () => {
    it('should display an error message when an invalid rent is provided', async () => {
        const onCreate = vi.fn()

        render(<AuctionCreator onCreate={onCreate}/>);

        screen.getByText("Create Auction").click()
        expect(await screen.findByText(/Please enter a valid total rent./)).toBeInTheDocument();
        expect(onCreate).not.toHaveBeenCalled();
    });

    it('should display an error message when rooms aren\'t given names', async () => {
        const onCreate = vi.fn()

        render(<AuctionCreator onCreate={onCreate}/>);
        const input = screen.getByLabelText('Total Rent');
        await userEvent.type(input, "1")
        const roomInputs = screen.getAllByLabelText(/Room Name/)
        roomInputs.forEach(input => userEvent.clear(input))

        screen.getByText("Create Auction").click()
        expect(await screen.findByText(/Please enter names for all rooms./)).toBeInTheDocument();
        expect(onCreate).not.toHaveBeenCalled(); 
    });
});