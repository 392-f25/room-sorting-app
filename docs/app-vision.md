# Name

- The app is called Homeslice.

# Users

- Users are roommates who are deciding how to select rooms and split rent between themselves.

# Value proposition

An easy to use room pricer and sorter that solves room selection disputes fairly and quickly.

# Key features

- One by one each room is presented, and roommates can bid the monthly rent they would be willing to pay.
- The screen displays the room, the current price (monthly rent) and then a bid button which allows the user to enter their own custom bid (rejected if below current bid or above total monthly constraint), or just add $10 to the current bid.
- There is a 30 second timer which is reset every time a bid is placed. When the timer runs out (meaning no user wants to outbid the current bid), the room is awarded to the highest bidder, and they can no longer bid on other rooms.
- Each room is subsequently auctioned off until there is one room remaining, where it is assigned to the last roommate and their rent is determined by the remaining portion of the total monthly rent that is not paid through the other rooms.

# Example scenario

Here is an example session.

- Alice, Bob, & Cathy are planning to move into a 3 person house, which has bedrooms of varying size and layouts, their total monthly rent is $3000.
- Some bedrooms are more desirable than others, resulting in potential conflict regarding how to fairly decide who gets each room.
- They all log onto Homeslice, and register to be in the same splitting group.
- The to-be tenants enter the details for each bedroom (including an image, square feet, and appliances), as well as the total monthly rent they owe for the whole house.
- The tenants are initially presented with each room and are allowed to choose which one they prefer.
- The biggest room is auctioned off first, Alice really wants this room and has a big budget so she places a bid of $1500, which no one outbids and so she is assigned that room.
- Bob and Cathy both really want the second room, Bob starts the bidding at $700 and then they repeatedly outbid each other by 10$ until Cathy ultimately wins with a bid of $900.
- The 3rd room is automatically assigned to Cathy for the remaining $600 of monthly rent.

# Testing notes
- Define unit tests for highest bidder winning.
- Define unit tests to check for duplicate room assignments (make sure each roommate is assigned to one room).
- Define unit tests for all rooms adding up to total rent.
