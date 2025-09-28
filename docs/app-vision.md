# Name

- The app is called Homeslice.

# Users

- Users are roommates who are deciding how to select rooms and split rent between themselves.

# Value proposition

An easy to use room pricer and sorter that solves room selection disputes fairly and quickly.

# Key features

- A roommate creates a new “Room Auction” by entering:
  - Total rent for the apartment/house.
  - Number of rooms.
  - Room names (e.g., Bedroom A, B, C).
- The app generates a join link that the other roommates can use to enter the same auction.
- Each room is auctioned one at a time in rounds until all rooms are assigned.
- The current room being auctioned is displayed with:
  - A photo (optional), name, and current highest bid.
  - A countdown timer (default 30 seconds).
  - Buttons to “raise bid by $10” or “enter custom bid.”
- Users can place a bid as long as:
  - It is higher than the current highest bid.
  - Their total committed bids across all rooms do not exceed the total monthly rent.
- When the timer runs out without a new bid:
  - The room is awarded to the highest bidder.
  - That roommate is removed from bidding for the remaining rooms.
- The process repeats for the next room.
- The final room is automatically assigned to the last unassigned roommate, with rent determined by the remaining balance of total rent.

# Example scenario

Here is an example session.

- Alice, Bob, and Cathy are moving into a 3-person apartment with a total rent of $3000.
- Alice creates a “Room Auction” in Homeslice, enters the total rent ($3000), and labels the rooms A, B, and C.
- She sends the join link to Bob and Cathy. All three join from their phones.
- Round 1: Room A (the biggest) is shown.
  - Starting price: $0.
  - Alice bids $1000. The app updates the highest bid and resets the 30s timer.
  - Bob raises to $1200. Timer resets.
  - Alice bids $1500. Timer runs out with no more bids.
  - Room A is assigned to Alice at $1500.
- Round 2: Room B is shown.
  - Bob opens with $700. Timer resets.
  - Cathy raises to $800, then Bob raises to $850, then Cathy raises to $900.
  - Timer runs out. Cathy wins Room B at $900.
- Round 3: Only Room C remains.
  - It is automatically assigned to Bob.
  - His rent is calculated as the remaining balance: $3000 – ($1500 + $900) = $600.
- Final assignment:
  - Alice: Room A at $1500
  - Cathy: Room B at $900
  - Bob: Room C at $600
- All roommates can see their assigned rooms and rents in the summary screen.

# Testing notes
- Define unit tests for highest bidder winning.
- Define unit tests to check for duplicate room assignments (make sure each roommate is assigned to one room).
- Define unit tests for all rooms adding up to total rent.
