import {describe, expect, test} from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('landing UI', () => {
  test('shows create auction form', () => {
    render(<App />)
    expect(screen.getByText('Create Auction Room')).toBeDefined()
    expect(screen.getByRole('textbox')).toBeDefined()
  })
})