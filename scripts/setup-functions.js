#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔧 Setting up Firebase Functions...\n');

try {
  const functionsDir = path.join(__dirname, '..', 'functions');
  
  // Check if functions directory exists
  if (!fs.existsSync(functionsDir)) {
    console.error('❌ Functions directory not found. Please ensure the functions folder exists.');
    process.exit(1);
  }

  // Navigate to functions directory
  process.chdir(functionsDir);

  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('🔨 Building functions...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('\n✅ Functions setup complete!');
  console.log('\n📋 Available commands:');
  console.log('  npm run functions:serve    - Start local emulator');
  console.log('  npm run functions:build   - Build functions');
  console.log('  npm run deploy:functions  - Deploy to Firebase');
  
} catch (error) {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
}
