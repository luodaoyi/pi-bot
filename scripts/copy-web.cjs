#!/usr/bin/env node
/**
 * Cross-platform script to copy web dist files to main dist directory
 */
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../web/dist');
const targetDir = path.join(__dirname, '../dist/web');

// Remove target directory if it exists
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

// Create target directory
fs.mkdirSync(targetDir, { recursive: true });

// Copy files
function copyRecursiveSync(src, dest) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const files = fs.readdirSync(src);
    files.forEach(file => {
      copyRecursiveSync(path.join(src, file), path.join(dest, file));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  copyRecursiveSync(sourceDir, targetDir);
  console.log('✓ Copied web dist to dist/web');
} catch (error) {
  console.error('Error copying web dist:', error);
  process.exit(1);
}
