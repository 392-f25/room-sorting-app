import {describe, it, vi } from 'vitest'
import {render, screen} from '@testing-library/react'
import { AuctionCreator } from './AuctionCreator';


describe('user tries to create a room', () => {
    it('should display an error message when an invalid rent is provided', async () => {
        const onCreate = vi.fn()

        render(<AuctionCreator onCreate={onCreate}/>);

        screen.getByText("Create Auction").click()
        expect(await screen.findByText(/Please enter a valid total rent./)).toBeInTheDocument();
        expect(onCreate).not.toHaveBeenCalled();
    });
});