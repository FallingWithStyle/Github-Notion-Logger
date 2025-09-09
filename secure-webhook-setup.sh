#!/bin/bash

# Secure webhook setup script for GitHub repositories
# This script reads the webhook secret from environment variables

WEBHOOK_URL="https://notion-logger.fly.dev/webhook"
CONTENT_TYPE="json"

# Check if webhook secret is provided
if [ -z "$GITHUB_WEBHOOK_SECRET" ]; then
    echo "❌ Error: GITHUB_WEBHOOK_SECRET environment variable is required"
    echo "💡 Run: export GITHUB_WEBHOOK_SECRET=\$(fly secrets list | grep GITHUB_WEBHOOK_SECRET | awk '{print \$2}')"
    exit 1
fi

echo "🚀 Starting secure webhook setup for Notion Logger..."
echo "📡 Webhook URL: $WEBHOOK_URL"
echo "🔐 Using webhook secret from environment variable"
echo ""

# Get list of repositories
echo "📋 Fetching repository list..."
gh repo list --limit 50 --json name,owner --jq '.[] | "\(.owner.login)/\(.name)"' > temp_repos.txt

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
        --field config[secret]="$GITHUB_WEBHOOK_SECRET" \
        --field events[]="push" \
        --field active="true" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Successfully created webhook for $repo"
    else
        echo "   ❌ Failed to create webhook for $repo: $response"
    fi
    
    # Small delay to avoid rate limiting
    sleep 1
    
done < temp_repos.txt

# Clean up temp file
rm temp_repos.txt

echo ""
echo "🎉 Secure webhook setup completed!"
echo "📊 Check the output above for any errors."
echo ""
echo "💡 To verify webhooks were created, you can run:"
echo "   gh api repos/FallingWithStyle/REPO_NAME/hooks"
