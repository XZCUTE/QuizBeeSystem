#!/bin/bash
# Cleanup script for ICCT QuizBee project
# This script removes unused files and optimizes the project

echo "Starting cleanup process..."

# Remove any temporary files
find . -name "*.tmp" -type f -delete
find . -name "*.bak" -type f -delete
find . -name ".DS_Store" -type f -delete

# Remove unused assets
if [ -f "./public/icon.svg" ]; then
  echo "Removing unused icon.svg..."
  rm ./public/icon.svg
fi

# Check for node_modules and clean if needed
if [ -d "node_modules" ]; then
  echo "Cleaning node_modules..."
  npm prune
fi

# Optimize images if imagemin is available
if command -v npx &> /dev/null; then
  if [ -d "./public" ]; then
    echo "Optimizing images..."
    npx imagemin-cli "./public/*.png" --out-dir="./public/optimized"
    
    # Replace original files with optimized ones
    if [ -d "./public/optimized" ]; then
      mv ./public/optimized/* ./public/
      rmdir ./public/optimized
    fi
  fi
fi

echo "Cleanup complete!" 