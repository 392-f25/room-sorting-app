#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Deploying Firebase Functions...\n');

try {
  // Navigate to functions directory
  const functionsDir = path.join(__dirname, '..', 'functions');
  process.chdir(functionsDir);

  console.log('📦 Installing dependencies...');
  execSync('npm install', { stdio: 'inherit' });

  console.log('🔨 Building functions...');
  execSync('npm run build', { stdio: 'inherit' });

  console.log('☁️  Deploying to Firebase...');
  execSync('firebase deploy --only functions', { stdio: 'inherit' });

  console.log('\n✅ Functions deployed successfully!');
} catch (error) {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
}
