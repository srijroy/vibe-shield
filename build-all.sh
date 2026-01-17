#!/bin/bash

# VibeShield - Build script for all platforms
# Builds the Go bridge for Linux, macOS, and Windows

set -e

echo "🛡️  Building VibeShield Bridge for all platforms..."
echo ""

# Create bin directory if it doesn't exist
mkdir -p bin

# Build for Linux (64-bit)
echo "🐧 Building for Linux (amd64)..."
GOOS=linux GOARCH=amd64 go build -o bin/bridge-linux-amd64 bridge.go
echo "   ✓ bin/bridge-linux-amd64"

# Build for macOS (Intel)
echo "🍎 Building for macOS (amd64)..."
GOOS=darwin GOARCH=amd64 go build -o bin/bridge-darwin-amd64 bridge.go
echo "   ✓ bin/bridge-darwin-amd64"

# Build for macOS (Apple Silicon)
echo "🍎 Building for macOS (arm64)..."
GOOS=darwin GOARCH=arm64 go build -o bin/bridge-darwin-arm64 bridge.go
echo "   ✓ bin/bridge-darwin-arm64"

# Build for Windows (64-bit)
echo "🪟 Building for Windows (amd64)..."
GOOS=windows GOARCH=amd64 go build -o bin/bridge-windows-amd64.exe bridge.go
echo "   ✓ bin/bridge-windows-amd64.exe"

# Build for current platform
echo "💻 Building for current platform..."
go build -o bin/bridge bridge.go
echo "   ✓ bin/bridge"

echo ""
echo "✅ All builds complete!"
echo ""
echo "Built binaries:"
ls -lh bin/

echo ""
echo "Test with:"
echo "  ./bin/bridge test_file.js"