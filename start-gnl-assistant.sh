#!/bin/bash

# GNL Assistant Startup Script (Port 4250)
# This script starts the specialized GNL Assistant server

echo "🚀 Starting GNL Assistant Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if required environment variables are set
if [ -z "$NOTION_API_KEY" ]; then
    echo "❌ NOTION_API_KEY environment variable is not set."
    echo "Please set it in your .env file or environment."
    exit 1
fi

if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN environment variable is not set."
    echo "Please set it in your .env file or environment."
    exit 1
fi

# Set GNL-specific configuration
export GNL_ASSISTANT_PORT=${GNL_ASSISTANT_PORT:-4250}
export FLY_IO_BASE_URL=${FLY_IO_BASE_URL:-"https://notion-logger.fly.dev"}
export LLAMA_HUB_URL=${LLAMA_HUB_URL:-"http://localhost:9000"}

echo "📡 Fly.io URL: $FLY_IO_BASE_URL"
echo "🦙 Llama-hub URL: $LLAMA_HUB_URL"
echo "🔌 GNL Assistant Port: $GNL_ASSISTANT_PORT"

# Check if port is available
if lsof -Pi :$GNL_ASSISTANT_PORT -sTCP:LISTEN -t >/dev/null; then
    echo "⚠️  Port $GNL_ASSISTANT_PORT is already in use."
    echo "Please stop the existing process or use a different port."
    exit 1
fi

# Start the GNL Assistant server
echo "🚀 Starting GNL Assistant on port $GNL_ASSISTANT_PORT..."
node gnl-assistant.js
