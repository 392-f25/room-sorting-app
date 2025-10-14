# Firebase Realtime Database Schema (MVP)

This document outlines the simplified MVP data structure for the auction application. The goal is to use the leanest possible structure that still supports the core functionality, with the understanding that it can be optimized for scale later.

---

## Root Level Structure

```json
{
  "auctionDetails": {},
  "bids": {},
  "auctionState": {}
}
```

---

## 1. `/auctionDetails`

Stores all the setup and metadata for a specific auction in a single location. For an MVP, this is simpler than splitting auction data across multiple collections.

**Path**: `/auctionDetails/{auctionId}`

**Schema**:
```json
{
  "auctionId_1": {
    "totalRent": 2000,
    "status": "active",
    "rooms": {
      "roomId_X": {
        "name": "Master Bedroom",
        "basePrice": 1000
      },
      "roomId_Y": {
        "name": "Small Bedroom",
        "basePrice": 1000
      }
    },
    "users": {
      "user_A": { "name": "Alice" },
      "user_B": { "name": "Bob" }
    }
  }
}
```

---

## 2. `/bids`

Stores all bids for all auctions. This path is expected to receive frequent writes during an active auction. This remains essential for the MVP.

**Path**: `/bids/{auctionId}/{roomId}`

**Schema**:
```json
{
  "auctionId_1": {
    "roomId_Y": {
      "user_B": 1050,
      "user_A": 1100
    }
  }
}
```

---

## 3. `/auctionState`

Stores the live results and current state of an auction. The `assignments` object is created along with the auction and contains an entry for every room. This provides an explicit representation of each room's state (assigned or unassigned) at all times.

**Path**: `/auctionState/{auctionId}`

**Schema (at the end of an auction):**
```json
{
  "auctionId_1": {
    "assignments": {
      "roomId_Y": {
        "userId": "alice_id",
        "price": 1100
      },
      "roomId_X": {
        "userId": "bob_id",
        "price": 900
      }
    }
  }
}
```

---

## Example Use-Case Walkthrough (MVP)

This section explains how the database changes during a typical auction flow.

### Initial State

The database is an empty object.
```json
{}
```

### Step 1: Alice Creates the Auction

Alice submits the "Create Auction" form. The `saveAuction` function generates an auction ID, and creates the initial state for the auction across all relevant collections. Note that `/auctionState/assignments` is created at the beginning with all rooms initialized.

**Database State:**
```json
{
  "auctionDetails": {
    "auctionId_1": {
      "totalRent": 2000,
      "status": "active",
      "rooms": {
        "roomId_X": { "name": "Master Bedroom", "basePrice": 1000 },
        "roomId_Y": { "name": "Small Bedroom", "basePrice": 1000 }
      },
      "users": {
        "alice_id": { "name": "Alice" },
        "bob_id": { "name": "Bob" }
      }
    }
  },
  "auctionState": {
    "auctionId_1": {
      "assignments": {
        "roomId_X": {
          "userId": null,
          "price": 1000
        },
        "roomId_Y": {
          "userId": null,
          "price": 1000
        }
      }
    }
  }
}
```

### Step 2: Bidding on the "Small Bedroom"

Bidding opens for `roomId_Y`. Alice and Bob place bids.

1.  Bob bids $1050. A `WRITE` operation sets `/bids/auctionId_1/roomId_Y/bob_id` to `1050`.
2.  Alice bids $1100. A `WRITE` operation sets `/bids/auctionId_1/roomId_Y/alice_id` to `1100`.

**The `/bids` tree is created:**
```json
{
  "bids": {
    "auctionId_1": {
      "roomId_Y": {
        "bob_id": 1050,
        "alice_id": 1100
      }
    }
  }
}
```

### Step 3: "Small Bedroom" Bidding Ends

The round concludes. The app determines Alice is the winner. It now **updates** the existing `/auctionState` object. The price of the remaining unassigned room (`roomId_X`) is recalculated (`2000 - 1100 = 900`).

**The `/auctionState` tree is updated:**
```json
{
  "auctionState": {
    "auctionId_1": {
      "assignments": {
        "roomId_X": {
          "userId": null,
          "price": 900
        },
        "roomId_Y": {
          "userId": "alice_id",
          "price": 1100
        }
      }
    }
  }
}
```

### Step 4: Final Resolution

Bob is assigned the last room. The app updates the final assignment and changes the auction status to `closed`.

**Final Database State:**
```json
{
  "auctionDetails": {
    "auctionId_1": {
      "status": "closed", // Status is updated
      // ... other fields unchanged
    }
  },
  "bids": { ... },
  "auctionState": {
    "auctionId_1": {
      "assignments": {
        "roomId_X": {
          "userId": "bob_id",
          "price": 900
        },
        "roomId_Y": {
          "userId": "alice_id",
          "price": 1100
        }
      }
    }
  }
}
```
