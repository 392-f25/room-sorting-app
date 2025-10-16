# Firebase Functions Setup for Room Sorting App

This document explains the Firebase Functions setup that hosts the auction logic on the server side.

## Overview

The Firebase Functions provide server-side processing for auction operations, moving the business logic from the client to the cloud. This ensures consistency, security, and better performance.

## Architecture

```
Client App (React)
    ↓ HTTPS Calls
Firebase Functions (Node.js)
    ↓ Database Operations
Firebase Realtime Database
```

## Functions Available

### 1. `createAuction`
- **Purpose**: Creates a new auction with initial data
- **Input**: `{ totalRent: number, rooms: string[], users: string[] }`
- **Output**: `{ auctionId: string }`
- **Database**: Creates entries in `/auctionDetails` and `/auctionState`

### 2. `getAuction`
- **Purpose**: Retrieves current auction state
- **Input**: `{ auctionId: string }`
- **Output**: `{ details: AuctionDetails, state: AuctionState }`
- **Database**: Reads from `/auctionDetails` and `/auctionState`

### 3. `submitBids`
- **Purpose**: Processes bids and assigns highest bidder
- **Input**: `{ auctionId: string, roomId: string, bids: Bid[] }`
- **Output**: `{ success: boolean }`
- **Logic**: Uses `assignHighestBidder` from auction logic

### 4. `detectRoomConflicts`
- **Purpose**: Analyzes room selections for conflicts
- **Input**: `{ auctionId: string, selections: Record<string, string | null> }`
- **Output**: `{ conflicts: string[], roomToUsers: Record<string, string[]> }`
- **Logic**: Uses `detectConflicts` from auction logic

### 5. `applyRoomSelections`
- **Purpose**: Applies unique room selections
- **Input**: `{ auctionId: string, selections: Record<string, string | null> }`
- **Output**: `{ success: boolean }`
- **Logic**: Uses `applySelections` from auction logic

## File Structure

```
functions/
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.js         # ESLint configuration
├── src/
│   ├── index.ts         # Main functions file
│   ├── types.ts         # Type definitions
│   └── auctionLogic.ts  # Business logic (moved from client)
└── README.md           # Functions documentation
```

## Client Integration

The client uses the `functions-client.ts` utility to interact with the functions:

```typescript
import { createAuction, getAuction, submitBids } from '../utilities/functions-client';

// Create auction
const result = await createAuction({
  totalRent: 3000,
  rooms: ['Master Bedroom', 'Guest Room'],
  users: ['Alice', 'Bob']
});

// Get auction state
const auction = await getAuction(result.auctionId);

// Submit bids
await submitBids({
  auctionId: result.auctionId,
  roomId: 'room1',
  bids: [{ userId: 'user1', amount: 1200 }]
});
```

## Database Schema

### `/auctionDetails/{auctionId}`
```json
{
  "totalRent": 3000,
  "status": "active",
  "rooms": {
    "room1": { "name": "Master Bedroom", "basePrice": 1500 },
    "room2": { "name": "Guest Room", "basePrice": 1500 }
  },
  "users": {
    "user1": { "name": "Alice" },
    "user2": { "name": "Bob" }
  }
}
```

### `/auctionState/{auctionId}`
```json
{
  "assignments": {
    "room1": { "userId": "user1", "price": 1200 },
    "room2": { "userId": null, "price": 1800 }
  }
}
```

## Development Setup

### Prerequisites
- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase project configured

### Local Development
1. Install dependencies:
   ```bash
   cd functions
   npm install
   ```

2. Build functions:
   ```bash
   npm run build
   ```

3. Start emulator:
   ```bash
   npm run serve
   ```

### Deployment
1. Build and deploy:
   ```bash
   npm run deploy:functions
   ```

2. Or use the deployment script:
   ```bash
   ./scripts/deploy-functions.sh
   ```

## Security Considerations

- All functions use Firebase Authentication for user verification
- Input validation is performed on all function parameters
- Database operations are atomic to prevent race conditions
- Error handling provides appropriate HTTP status codes

## Performance Benefits

1. **Reduced Client Bundle**: Business logic moved to server
2. **Consistent Processing**: All clients use same server logic
3. **Better Caching**: Server-side caching of auction states
4. **Scalability**: Functions auto-scale based on demand

## Migration from Client-Side Logic

The original client-side functions in `Auction.tsx` have been moved to:
- `functions/src/auctionLogic.ts` - Pure business logic
- `functions/src/index.ts` - Firebase Functions wrappers
- `src/utilities/functions-client.ts` - Client-side API

This maintains the same functionality while providing server-side processing benefits.

## Monitoring and Logging

Firebase Functions provide built-in monitoring:
- Function execution logs
- Performance metrics
- Error tracking
- Usage analytics

Access these through the Firebase Console under the Functions section.
