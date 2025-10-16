"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRoomSelections = exports.detectRoomConflicts = exports.submitBids = exports.getAuction = exports.createAuction = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const auctionLogic_1 = require("./auctionLogic");
// Initialize Firebase Admin
admin.initializeApp();
const db = admin.database();
/**
 * Creates a new auction with the provided data
 */
exports.createAuction = functions.https.onCall(async (data) => {
    try {
        const { totalRent, rooms: roomNames, users: userNames } = data;
        // Generate a unique auction ID
        const auctionRef = db.ref("auctionDetails").push();
        const auctionId = auctionRef.key;
        if (!auctionId) {
            throw new functions.https.HttpsError("internal", "Failed to generate auction ID");
        }
        // Prepare the data for the multi-path update
        const updates = {};
        // The main auction details
        const rooms = roomNames.reduce((acc, name, i) => {
            const roomId = `room${i + 1}`;
            acc[roomId] = { name, basePrice: Number((totalRent / roomNames.length).toFixed(2)) };
            return acc;
        }, {});
        const users = userNames.reduce((acc, name, i) => {
            const userId = `user${i + 1}`;
            acc[userId] = { name };
            return acc;
        }, {});
        updates[`/auctionDetails/${auctionId}`] = {
            totalRent,
            status: "active",
            rooms,
            users,
        };
        // The initial state of assignments for all rooms
        const initialAssignments = Object.keys(rooms).reduce((acc, roomId) => {
            acc[roomId] = { userId: null, price: rooms[roomId].basePrice };
            return acc;
        }, {});
        updates[`/auctionState/${auctionId}`] = {
            assignments: initialAssignments,
        };
        // Perform the atomic update
        await db.ref().update(updates);
        return { auctionId };
    }
    catch (error) {
        console.error("Error creating auction:", error);
        throw new functions.https.HttpsError("internal", "Failed to create auction");
    }
});
/**
 * Gets auction details by ID
 */
exports.getAuction = functions.https.onCall(async (data) => {
    try {
        const { auctionId } = data;
        const [detailsSnapshot, stateSnapshot] = await Promise.all([
            db.ref(`auctionDetails/${auctionId}`).once("value"),
            db.ref(`auctionState/${auctionId}`).once("value")
        ]);
        const details = detailsSnapshot.val();
        const state = stateSnapshot.val();
        if (!details) {
            throw new functions.https.HttpsError("not-found", "Auction not found");
        }
        return {
            details,
            state
        };
    }
    catch (error) {
        console.error("Error getting auction:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to get auction");
    }
});
/**
 * Submits bids for a room
 */
exports.submitBids = functions.https.onCall(async (data) => {
    try {
        const { auctionId, roomId, bids } = data;
        // Get current auction state
        const [detailsSnapshot, stateSnapshot] = await Promise.all([
            db.ref(`auctionDetails/${auctionId}`).once("value"),
            db.ref(`auctionState/${auctionId}`).once("value")
        ]);
        const details = detailsSnapshot.val();
        const state = stateSnapshot.val();
        if (!details || !state) {
            throw new functions.https.HttpsError("not-found", "Auction not found");
        }
        // Convert to Auction object for processing
        const auction = {
            id: auctionId,
            totalRent: details.totalRent,
            users: Object.entries(details.users).map(([id, user]) => {
                var _a;
                return ({
                    id,
                    name: user.name,
                    assignedRoomId: ((_a = state.assignments[roomId]) === null || _a === void 0 ? void 0 : _a.userId) === id ? roomId : undefined
                });
            }),
            rooms: Object.entries(details.rooms).map(([id, room]) => {
                var _a, _b;
                return ({
                    id,
                    name: room.name,
                    price: ((_a = state.assignments[id]) === null || _a === void 0 ? void 0 : _a.price) || room.basePrice,
                    assignedUserId: (_b = state.assignments[id]) === null || _b === void 0 ? void 0 : _b.userId
                });
            })
        };
        // Process the bids using the auction logic
        const updatedAuction = (0, auctionLogic_1.assignHighestBidder)(auction, roomId, bids);
        // Update the database with new assignments
        const updates = {};
        for (const room of updatedAuction.rooms) {
            if (room.assignedUserId) {
                updates[`/auctionState/${auctionId}/assignments/${room.id}`] = {
                    userId: room.assignedUserId,
                    price: room.price
                };
            }
        }
        await db.ref().update(updates);
        return { success: true };
    }
    catch (error) {
        console.error("Error submitting bids:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to submit bids");
    }
});
/**
 * Detects conflicts in room selections
 */
exports.detectRoomConflicts = functions.https.onCall(async (data) => {
    try {
        const { auctionId, selections } = data;
        // Get current auction state
        const [detailsSnapshot, stateSnapshot] = await Promise.all([
            db.ref(`auctionDetails/${auctionId}`).once("value"),
            db.ref(`auctionState/${auctionId}`).once("value")
        ]);
        const details = detailsSnapshot.val();
        const state = stateSnapshot.val();
        if (!details || !state) {
            throw new functions.https.HttpsError("not-found", "Auction not found");
        }
        // Convert to Auction object for processing
        const auction = {
            id: auctionId,
            totalRent: details.totalRent,
            users: Object.entries(details.users).map(([id, user]) => {
                var _a;
                return ({
                    id,
                    name: user.name,
                    assignedRoomId: (_a = Object.entries(state.assignments).find(([, assignment]) => assignment.userId === id)) === null || _a === void 0 ? void 0 : _a[0]
                });
            }),
            rooms: Object.entries(details.rooms).map(([id, room]) => {
                var _a, _b;
                return ({
                    id,
                    name: room.name,
                    price: ((_a = state.assignments[id]) === null || _a === void 0 ? void 0 : _a.price) || room.basePrice,
                    assignedUserId: (_b = state.assignments[id]) === null || _b === void 0 ? void 0 : _b.userId
                });
            })
        };
        // Detect conflicts
        const conflicts = (0, auctionLogic_1.detectConflicts)(auction, selections);
        return conflicts;
    }
    catch (error) {
        console.error("Error detecting conflicts:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to detect conflicts");
    }
});
/**
 * Applies room selections
 */
exports.applyRoomSelections = functions.https.onCall(async (data) => {
    try {
        const { auctionId, selections } = data;
        // Get current auction state
        const [detailsSnapshot, stateSnapshot] = await Promise.all([
            db.ref(`auctionDetails/${auctionId}`).once("value"),
            db.ref(`auctionState/${auctionId}`).once("value")
        ]);
        const details = detailsSnapshot.val();
        const state = stateSnapshot.val();
        if (!details || !state) {
            throw new functions.https.HttpsError("not-found", "Auction not found");
        }
        // Convert to Auction object for processing
        const auction = {
            id: auctionId,
            totalRent: details.totalRent,
            users: Object.entries(details.users).map(([id, user]) => {
                var _a;
                return ({
                    id,
                    name: user.name,
                    assignedRoomId: (_a = Object.entries(state.assignments).find(([, assignment]) => assignment.userId === id)) === null || _a === void 0 ? void 0 : _a[0]
                });
            }),
            rooms: Object.entries(details.rooms).map(([id, room]) => {
                var _a, _b;
                return ({
                    id,
                    name: room.name,
                    price: ((_a = state.assignments[id]) === null || _a === void 0 ? void 0 : _a.price) || room.basePrice,
                    assignedUserId: (_b = state.assignments[id]) === null || _b === void 0 ? void 0 : _b.userId
                });
            })
        };
        // Apply selections
        const updatedAuction = (0, auctionLogic_1.applySelections)(auction, selections);
        // Update the database with new assignments
        const updates = {};
        for (const room of updatedAuction.rooms) {
            updates[`/auctionState/${auctionId}/assignments/${room.id}`] = {
                userId: room.assignedUserId || null,
                price: room.price
            };
        }
        await db.ref().update(updates);
        return { success: true };
    }
    catch (error) {
        console.error("Error applying selections:", error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "Failed to apply selections");
    }
});
//# sourceMappingURL=index.js.map