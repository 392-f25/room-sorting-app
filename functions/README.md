# Firebase Functions for Room Sorting App

This directory contains the Firebase Functions that handle server-side auction logic for the room sorting application.

## Functions

### `createAuction`
Creates a new auction with the provided data.
- **Input**: `{ totalRent: number, rooms: string[], users: string[] }`
- **Output**: `{ auctionId: string }`

### `getAuction`
Retrieves auction details and current state.
- **Input**: `{ auctionId: string }`
- **Output**: `{ details: AuctionDetails, state: AuctionState }`

### `submitBids`
Processes bids for a specific room and assigns the highest bidder.
- **Input**: `{ auctionId: string, roomId: string, bids: Bid[] }`
- **Output**: `{ success: boolean }`

### `detectRoomConflicts`
Analyzes room selections to detect conflicts.
- **Input**: `{ auctionId: string, selections: Record<string, string | null> }`
- **Output**: `{ conflicts: string[], roomToUsers: Record<string, string[]> }`

### `applyRoomSelections`
Applies unique room selections and recalculates prices.
- **Input**: `{ auctionId: string, selections: Record<string, string | null> }`
- **Output**: `{ success: boolean }`

## Development

### Prerequisites
- Node.js 18+
- Firebase CLI
- Firebase project configured

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the functions:
   ```bash
   npm run build
   ```

3. Test locally:
   ```bash
   npm run serve
   ```

### Deployment
```bash
npm run deploy
```

## Database Schema

The functions work with the following Firebase Realtime Database structure:

```
/auctionDetails/{auctionId}
  - totalRent: number
  - status: string
  - rooms: { [roomId]: { name: string, basePrice: number } }
  - users: { [userId]: { name: string } }

/auctionState/{auctionId}
  - assignments: { [roomId]: { userId: string | null, price: number } }
```
