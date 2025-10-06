# Name

- The app is called Homeslice.

# Users

- Users are roommates who are deciding how to select rooms and split rent between themselves.

# Value proposition

An easy to use room pricer and sorter that solves room selection disputes fairly and quickly.

# Key features

- A group of roommates connect to the app and create a new “Room Auction”:
  - Information required to create a new auction includes the total rent for the apartment/house, the number of rooms, and the room names (e.g., Bedroom 1, 2, 3).
- Throughout the auction, each room will have a temporary "assignment" for the current highest bidder, and a corresponding price they are willing to pay in rent.
- The app begins the auction, setting each room as initially unassigned and splitting the rent equally across all rooms.
- The users then take turns choosing which room they want the most.
- Once the round of selections is over, the app checks whether there is any overlap in choices
  - If there is no conflict, everyone gets their desired room and chips in the corresponding rent amount.
- If there is a conflict, the app will then take bids on rooms and update room prices.
- Residents that both want the same room are asked to make a bid on their desired room
  - The app will allow bids that are less than the currently listed amount, however, they must be more than $0 and less than the total amount for rent.
- The sought after room(s) then has their price updated to the highest bid, and the highest bidder becomes temporarily assigned to that room.
- Any non-sought after rooms then have their bids updated to be an even split of the remaining rent.
- Then the next round of selections begins. All residents who have not been assigned a room (i.e. were not the highest bidder), can then reselect which room they desire most. 
- If conflict remains, the process of updating conflicting rooms' bids repeats.
- These rounds of auctions continue until each resident has selected a unique room

# Example scenario

Here is an example session:

- Alice, Bob, and Cathy are moving into a 3-person apartment with a total rent of $3000.
- Alice creates a “Room Auction” in HomeSlice, enters the total rent ($3000), and labels the rooms A, B, and C.
- Once the room is created, the app then displays rooms A, B, and C at a price of $1000 each.
- Alice, Bob, and Cathy are then prompted in turns to select their preferred rooms.
- Round 1: Alice chooses room A, Bob chooses room A, and Cathy chooses room B.
  - Since there is a conflict between Alice and Bob, they are prompted in turns to make bids for room A.
  - Alice bids $1200 while Bob bids $1500.
  - Since Bob was the highest bidder, he is temporarily assigned to room A
  - The current room prices and assignments are updated to be as follows: Room A (Bob) - $1500, Room B (none) - $750, Room C (none) - $750
- Round 2: Alice and Cathy are shown the rooms again (with their new prices and assignments), and Alice chooses room A, while Cathy chooses room B.
  - Since there is once again a conflict between Alice and Bob, they are prompted in turns to make bids for the room.
  - Alice bids $2000 while Bob bids $1800.
  - Since Alice was the highest bidder, she replaces Bob's assignment to room A
  - The current room prices and assignments are updated to be as follows: Room A (Alice) - $2000, Room B (none) - $500, Room C (none) - $500
- Round 3: Bob and Cathy are shown the rooms again (with their new prices and assignments), and Bob chooses room B, while Cathy chooses room B.
  - Since there is a conflict between Bob and Cathy, they are prompted in turns to make bids for room B.
  - Bob bids $450 while Cathy bids $450.
  - Since Bob and Cathy bid the same amount, Bob and Cathy are asked to place new bids
  - This time Bob bids $600 while Cathy bids $200
  - Since Bob was the highest bidder, he is temporarily assigned to room B
  - The current room prices and assignments are updated to be as follows: Room A (Alice) - $2000, Room B (Bob) - $600, Room C (none) - $400
- Round 4: Cathy is shown the rooms again (with their new prices and assignments), and she chooses room C
  - As there are no more conflicts, the auction comes to the close with the following assignments:
  - Alice: Room A at $2000
  - Bob: Room B at $600
  - Cathy: Room C at $400
- All roommates can see their assigned rooms and rents in a summary screen.

# Testing notes
- Define unit tests for highest bidder winning.
- Define unit tests to check for duplicate room assignments (make sure each roommate is assigned to one room).
- Define unit tests for all rooms adding up to total rent.
