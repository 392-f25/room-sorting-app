# Firebase Realtime Database Schema (MVP)

This document outlines the streamlined data structure for the multi-device room auction application. The new structure consolidates all auction data into a single `auctions` collection for better real-time synchronization and simpler client-side management.

---

## Root Level Structure

```json
{
  "auctions": {},
  "selections": {}
}
```

---

## 1. `/auctions`

Stores all auction data in a single location for each auction. This consolidated approach simplifies real-time updates and reduces the number of database reads required.

**Path**: `/auctions/{auctionId}`

**Schema**:
```json
{
  "auction_id_123": {
    "total_rent": 2000,
    "status": "waiting", // waiting | selecting | bidding | completed
    "rooms": {
      "room1": {
        "name": "Master Bedroom",
        "cur_price": 1000,
        "cur_assignment": null, // userId or null
        "status": "available" // available | bidding | assigned
      },
      "room2": {
        "name": "Small Bedroom", 
        "cur_price": 1000,
        "cur_assignment": null,
        "status": "available"
      }
    },
    "users": {
      "user1": {
        "name": "Alice",
        "cur_assignment": null, // roomId or null
        "is_connected": true
      },
      "user2": {
        "name": "Bob",
        "cur_assignment": null,
        "is_connected": true
      }
    },
    "conflicts": {
      "room1": {
        "bidders": {
          "user2": {
            "bid": 650,
            "submitted": true
          },
          "user3": {
            "bid": 675,
            "submitted": false
          }
        }
      }
    }
  }
}
```

---

## 2. `/selections`

Stores temporary room selections during the selection phase. This is a separate collection to avoid conflicts with the main auction data during real-time updates.

**Path**: `/selections/{auctionId}`

**Schema**:
```json
{
  "auction_id_123": {
    "user1": "room2",
    "user2": "room1",
    "user3": "room2"
  }
}
```

---

## Status Flow

The auction progresses through these statuses:

1. **`waiting`** - Auction created, waiting for users to join
2. **`selecting`** - Users are selecting their preferred rooms
3. **`bidding`** - Conflicts detected, users are bidding on contested rooms
4. **`completed`** - All rooms assigned, auction finished

---

## Example Use-Case Walkthrough

This section explains how the database changes during a typical auction flow using the new structure.

### Initial State

The database starts empty.
```json
{}
```

### Step 1: Alice Creates the Auction

Alice submits the "Create Auction" form. The `saveAuction` function generates an auction ID and creates the initial auction structure.

**Database State:**
```json
{
  "auctions": {
    "auction_123": {
      "total_rent": 2000,
      "status": "waiting",
      "rooms": {
        "room1": {
          "name": "Master Bedroom",
          "cur_price": 1000,
          "cur_assignment": null,
          "status": "available"
        },
        "room2": {
          "name": "Small Bedroom",
          "cur_price": 1000,
          "cur_assignment": null,
          "status": "available"
        }
      },
      "users": {
        "user1": {
          "name": "Alice",
          "cur_assignment": null,
          "is_connected": true
        }
      },
      "conflicts": {}
    }
  }
}
```

### Step 2: Bob Joins the Auction

Bob joins using the auction URL. The `addUserToAuction` function adds him to the users list.

**Database State:**
```json
{
  "auctions": {
    "auction_123": {
      "total_rent": 2000,
      "status": "waiting",
      "rooms": { /* same as before */ },
      "users": {
        "user1": {
          "name": "Alice",
          "cur_assignment": null,
          "is_connected": true
        },
        "user2": {
          "name": "Bob",
          "cur_assignment": null,
          "is_connected": true
        }
      },
      "conflicts": {}
    }
  }
}
```

### Step 3: Auction Starts - Selection Phase

When the auction has enough users, it transitions to the `selecting` phase. Users make their room selections.

**Database State:**
```json
{
  "auctions": {
    "auction_123": {
      "total_rent": 2000,
      "status": "selecting",
      "rooms": { /* same as before */ },
      "users": { /* same as before */ },
      "conflicts": {}
    }
  },
  "selections": {
    "auction_123": {
      "user1": "room2",
      "user2": "room1"
    }
  }
}
```

### Step 4: Conflict Detection - Bidding Phase

The system detects that both users want different rooms (no conflict in this case), but if there was a conflict, the auction would transition to `bidding` status.

**Example with conflict:**
```json
{
  "auctions": {
    "auction_123": {
      "total_rent": 2000,
      "status": "bidding",
      "rooms": {
        "room1": {
          "name": "Master Bedroom",
          "cur_price": 1000,
          "cur_assignment": null,
          "status": "bidding"
        },
        "room2": {
          "name": "Small Bedroom",
          "cur_price": 1000,
          "cur_assignment": null,
          "status": "available"
        }
      },
      "users": { /* same as before */ },
      "conflicts": {
        "room1": {
          "bidders": {
            "user1": {
              "bid": 0,
              "submitted": false
            },
            "user2": {
              "bid": 0,
              "submitted": false
            }
          }
        }
      }
    }
  },
  "selections": {
    "auction_123": {
      "user1": "room1",
      "user2": "room1"
    }
  }
}
```

### Step 5: Bidding Process

Users place their bids on the contested room. The system tracks both the bid amount and submission status.

**Database State:**
```json
{
  "auctions": {
    "auction_123": {
      "total_rent": 2000,
      "status": "bidding",
      "rooms": { /* same as before */ },
      "users": { /* same as before */ },
      "conflicts": {
        "room1": {
          "bidders": {
            "user1": {
              "bid": 1200,
              "submitted": true
            },
            "user2": {
              "bid": 1100,
              "submitted": true
            }
          }
        }
      }
    }
  }
}
```

### Step 6: Bidding Resolution

The system determines Alice (user1) is the winner with the highest bid. The room is assigned and prices are recalculated.

**Database State:**
```json
{
  "auctions": {
    "auction_123": {
      "total_rent": 2000,
      "status": "selecting",
      "rooms": {
        "room1": {
          "name": "Master Bedroom",
          "cur_price": 1200,
          "cur_assignment": "user1",
          "status": "assigned"
        },
        "room2": {
          "name": "Small Bedroom",
          "cur_price": 800,
          "cur_assignment": null,
          "status": "available"
        }
      },
      "users": {
        "user1": {
          "name": "Alice",
          "cur_assignment": "room1",
          "is_connected": true
        },
        "user2": {
          "name": "Bob",
          "cur_assignment": null,
          "is_connected": true
        }
      },
      "conflicts": {}
    }
  },
  "selections": {
    "auction_123": {
      "user2": "room2"
    }
  }
}
```

### Step 7: Final Assignment

Bob is assigned to the remaining room, and the auction is completed.

**Final Database State:**
```json
{
  "auctions": {
    "auction_123": {
      "total_rent": 2000,
      "status": "completed",
      "rooms": {
        "room1": {
          "name": "Master Bedroom",
          "cur_price": 1200,
          "cur_assignment": "user1",
          "status": "assigned"
        },
        "room2": {
          "name": "Small Bedroom",
          "cur_price": 800,
          "cur_assignment": "user2",
          "status": "assigned"
        }
      },
      "users": {
        "user1": {
          "name": "Alice",
          "cur_assignment": "room1",
          "is_connected": true
        },
        "user2": {
          "name": "Bob",
          "cur_assignment": "room2",
          "is_connected": true
        }
      },
      "conflicts": {}
    }
  }
}
```

---

## Key Benefits of New Structure

1. **Simplified Real-time Updates**: All auction data is in one location, making it easier to sync across devices
2. **Reduced Database Reads**: Clients only need to listen to one main path per auction
3. **Better Conflict Management**: Conflicts are tracked within the auction object
4. **Cleaner Status Management**: Single status field controls the entire auction flow
5. **Easier Debugging**: All related data is co-located for easier troubleshooting

---

## Client-Side Implementation Notes

- Clients subscribe to `/auctions/{auctionId}` for real-time updates
- Selections are managed separately in `/selections/{auctionId}` to avoid conflicts
- The `is_connected` field helps track which users are currently active
- The `status` field on rooms indicates their current state (available, bidding, assigned)
- Bid submission status is tracked to ensure all users have submitted before resolution


