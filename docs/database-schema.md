# Firebase Realtime Database Schema (Refactored)

This document outlines the refactored data structure for the auction application. The schema has been consolidated to improve data locality, simplify security rules, and make database operations more efficient.

---

## Root Level Structure

The root now contains a single primary node for all auction-related data.

```json
{
  "auctions": {}
}
```

---

## 1. `/auctions`

This is the single source of truth for each auction. It stores all static metadata, dynamic state, and ephemeral data like bids and selections, under a single parent key.

**Path**: `/auctions/{auctionId}`

**Schema**:
```json
{
  "auctionId_1": {
    "id": "auctionId_1",
    "totalRent": 2000,
    "status": "active", // "active", "bidding", "done"
    "rooms": [
      {
        "id": "roomId_X",
        "name": "Master Bedroom",
        "price": 1000,
        "assignedUserId": null
      },
      {
        "id": "roomId_Y",
        "name": "Small Bedroom",
        "price": 1000,
        "assignedUserId": null,
        "status": "bidding" // Optional status for the room itself
      }
    ],
    "users": [
      {
        "id": "user_A",
        "name": "Alice",
        "assignedRoomId": null
      },
      {
        "id": "user_B",
        "name": "Bob",
        "assignedRoomId": null
      }
    ],
    "selections": {
      "user_A": "roomId_Y",
      "user_B": "roomId_Y"
    },
    "bidding": {
      "roomId_Y": {
        "user_A": 1100,
        "user_B": 1050
      }
    }
  }
}
```

### Sub-nodes within an Auction

*   **/auctions/{auctionId}/selections**: Stores temporary room choices for a round.
    *   **Path**: `/auctions/{auctionId}/selections/{userId}`
    *   **Schema**: `{ "user_A": "roomId_Y" }`
    *   **Purpose**: Read by a Cloud Function to resolve selection rounds. It is cleared after each round.

*   **/auctions/{auctionId}/bidding**: Stores all bids for contested rooms within an auction.
    *   **Path**: `/auctions/{auctionId}/bidding/{roomId}/{userId}`
    *   **Schema**: `{ "user_A": 1100 }`
    *   **Purpose**: Stores active bids during a bidding phase.

---

## Example Use-Case Walkthrough (Refactored)

This section explains how the database changes during a typical auction flow with the new schema.

### Initial State

The database is an empty object.
```json
{}
```

### Step 1: Alice Creates the Auction

Alice submits the "Create Auction" form. The `saveAuction` function generates an auction ID and creates a single, complete auction object.

**Database State:**
```json
{
  "auctions": {
    "auctionId_1": {
      "id": "auctionId_1",
      "totalRent": 2000,
      "users": [],
      "rooms": [
        { "id": "roomId_X", "name": "Master Bedroom", "price": 1000, "assignedUserId": null },
        { "id": "roomId_Y", "name": "Small Bedroom", "price": 1000, "assignedUserId": null }
      ]
    }
  }
}
```

### Step 2: Users Join the Auction

Alice and Bob join the auction. The `addUserToAuction` function pushes new user objects to the `users` array for the auction.

**Database State (`/auctions/auctionId_1`):**
```json
{
  // ... other auction data
  "users": [
    { "id": "user_A", "name": "Alice", "assignedRoomId": null },
    { "id": "user_B", "name": "Bob", "assignedRoomId": null }
  ]
}
```

### Step 3: Users Select Rooms (Conflict)

Both Alice and Bob want the "Small Bedroom" (`roomId_Y`). The client calls the `submitSelection` function for each user.

1.  Alice selects `roomId_Y`. A `WRITE` operation sets `/auctions/auctionId_1/selections/user_A` to `"roomId_Y"`.
2.  Bob selects `roomId_Y`. A `WRITE` operation sets `/auctions/auctionId_1/selections/user_B` to `"roomId_Y"`.

**The `/auctions/auctionId_1/selections` tree is created:**
```json
{
  "selections": {
    "user_A": "roomId_Y",
    "user_B": "roomId_Y"
  }
}
```
A Cloud Function, triggered by these writes, detects the conflict and initiates a bidding round.

### Step 4: Bidding on the "Small Bedroom"

The Cloud Function updates the auction object to signal bidding. It sets the `status` of `roomId_Y` to `"bidding"`.

**The `/auctions/auctionId_1/rooms` array is updated:**
```json
"rooms": [
  { "id": "roomId_X", "name": "Master Bedroom", "price": 1000, "assignedUserId": null },
  { "id": "roomId_Y", "name": "Small Bedroom", "price": 1000, "assignedUserId": null, "status": "bidding" }
]
```

Bidding opens. Alice and Bob place bids via the `placeBid` function.

1.  Bob bids $1050. A `WRITE` sets `/auctions/auctionId_1/bidding/roomId_Y/user_B` to `1050`.
2.  Alice bids $1100. A `WRITE` sets `/auctions/auctionId_1/bidding/roomId_Y/user_A` to `1100`.

**The `/auctions/auctionId_1/bidding` tree is created:**
```json
{
  "bidding": {
    "roomId_Y": {
      "user_B": 1050,
      "user_A": 1100
    }
  }
}
```

### Step 5: Bidding Ends & Final Resolution

A Cloud Function determines Alice is the winner. It performs a multi-path update:
1.  Assigns `roomId_Y` to Alice (`user_A`).
2.  Recalculates the price of the remaining room (`roomId_X`) to `900`.
3.  Automatically assigns the last room to Bob (`user_B`).
4.  Clears the `selections` and `bidding` nodes.
5.  Updates the auction `status` to `"done"`.

**Final Database State (`/auctions/auctionId_1`):**
```json
{
  "id": "auctionId_1",
  "totalRent": 2000,
  "status": "done",
  "rooms": [
    { "id": "roomId_X", "name": "Master Bedroom", "price": 900, "assignedUserId": "user_B" },
    { "id": "roomId_Y", "name": "Small Bedroom", "price": 1100, "assignedUserId": "user_A" }
  ],
  "users": [
    { "id": "user_A", "name": "Alice", "assignedRoomId": "roomId_Y" },
    { "id": "user_B", "name": "Bob", "assignedRoomId": "roomId_X" }
  ],
  "selections": null, // Node is cleared
  "bidding": null     // Node is cleared
}
```
