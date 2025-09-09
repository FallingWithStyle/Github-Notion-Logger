#!/bin/bash

# Bulk webhook setup script for GitHub repositories
# This script will add webhooks to all repositories for the Notion Logger

WEBHOOK_URL="https://notion-logger.fly.dev/webhook"
WEBHOOK_SECRET="e07f74decef15ef3"
CONTENT_TYPE="json"

echo "🚀 Starting bulk webhook setup for Notion Logger..."
echo "📡 Webhook URL: $WEBHOOK_URL"
echo ""

# Read repositories from file
while IFS= read -r repo; do
    if [ -z "$repo" ]; then
        continue
    fi
    
    echo "🔧 Setting up webhook for: $repo"
    
    # Check if webhook already exists
    existing_webhooks=$(gh api "repos/$repo/hooks" --jq '.[] | select(.config.url == "'"$WEBHOOK_URL"'") | .id' 2>/dev/null)
    
    if [ -n "$existing_webhooks" ]; then
        echo "   ✅ Webhook already exists for $repo"
        continue
    fi
    
    # Create webhook
    response=$(gh api "repos/$repo/hooks" \
        --method POST \
        --field name="web" \
        --field config[url]="$WEBHOOK_URL" \
        --field config[content_type]="$CONTENT_TYPE" \
        --field config[secret]="$WEBHOOK_SECRET" \
        --field events[]="push" \
        --field active="true" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Successfully created webhook for $repo"
    else
        echo "   ❌ Failed to create webhook for $repo: $response"
    fi
    
    # Small delay to avoid rate limiting
    sleep 1
    
done < repos.txt

echo ""
echo "🎉 Bulk webhook setup completed!"
echo "📊 Check the output above for any errors."
echo ""
echo "💡 To verify webhooks were created, you can run:"
echo "   gh api repos/FallingWithStyle/REPO_NAME/hooks"
