#!/bin/bash

# Script to push catboost-wasm-demo to GitHub

echo "CatBoost WebAssembly Demo - GitHub Push Helper"
echo "=============================================="
echo ""
echo "Before running this script, create a new repository on GitHub:"
echo "1. Go to https://github.com/new"
echo "2. Name it 'catboost-wasm-demo'"
echo "3. Don't initialize with README (we already have one)"
echo "4. Create the repository"
echo ""
echo "Have you created the repository? (y/n)"
read -r response

if [[ "$response" != "y" ]]; then
    echo "Please create the repository first, then run this script again."
    exit 1
fi

echo ""
echo "Enter your GitHub username:"
read -r username

if [[ -z "$username" ]]; then
    echo "Username cannot be empty"
    exit 1
fi

# Set up the remote
echo ""
echo "Setting up remote..."
git remote add origin "https://github.com/${username}/catboost-wasm-demo.git"

# Verify remote was added
echo ""
echo "Remote configuration:"
git remote -v

# Rename branch to main (GitHub's default)
echo ""
echo "Renaming branch to 'main'..."
git branch -m master main

# Push to GitHub
echo ""
echo "Pushing to GitHub..."
git push -u origin main

echo ""
echo "✅ Done! Your repository should now be available at:"
echo "   https://github.com/${username}/catboost-wasm-demo"
echo ""
echo "Next steps:"
echo "1. Enable GitHub Pages in repository settings for live demo"
echo "2. Update README_GITHUB.md with your username"
echo "3. Rename README_GITHUB.md to README.md"
echo "4. Push the updates"