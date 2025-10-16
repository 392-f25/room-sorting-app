#!/bin/bash

# Deploy Firebase Functions
echo "Deploying Firebase Functions..."

# Navigate to functions directory
cd functions

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build the functions
echo "Building functions..."
npm run build

# Deploy to Firebase
echo "Deploying to Firebase..."
firebase deploy --only functions

echo "Functions deployed successfully!"
