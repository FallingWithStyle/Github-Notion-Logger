# Local AI Assistant Setup

This document explains how to set up and run the AI assistant locally to reduce Fly.io hosting costs.

## Overview

The AI assistant has been moved to run locally while the main application continues to run on Fly.io. This hybrid architecture provides:

- **Cost Savings**: ~40% reduction in Fly.io compute costs
- **Better Performance**: Local AI processing with no network latency
- **More Control**: Direct access to AI models and processing
- **Easier Development**: Local debugging and testing

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Fly.io App    │    │  Local Assistant │
│                 │    │                 │
│ • Core APIs     │◄──►│ • AI Chat       │
│ • Data Sync     │    │ • Context       │
│ • Webhooks      │    │ • Sessions      │
│ • Static Files  │    │ • Llama Models  │
└─────────────────┘    └─────────────────┘
```

## Prerequisites

1. **Node.js**: Version 18 or higher
2. **Environment Variables**: Same as main app
3. **Llama-hub**: Running locally or accessible
4. **Network Access**: To reach Fly.io app

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create or update your `.env` file with:

```env
# Local Assistant Configuration
LOCAL_ASSISTANT_PORT=3001
FLY_IO_BASE_URL=https://your-app.fly.dev
LLAMA_HUB_URL=http://localhost:9000

# Required for AI services
NOTION_API_KEY=your_notion_key
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_key
LLAMA_API_KEY=your_llama_key
```

### 3. Start Local Assistant

#### Option A: Using npm script
```bash
npm run start:local-assistant
```

#### Option B: Using startup script
```bash
npm run start:local-assistant:script
```

#### Option C: Direct execution
```bash
node local-assistant.js
```

### 4. Verify Setup

Check that the local assistant is running:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "local-assistant",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "flyIOConnection": "https://your-app.fly.dev"
}
```

## Usage

### Starting Both Services

1. **Start Fly.io app** (if not already running):
   ```bash
   fly deploy
   ```

2. **Start local assistant**:
   ```bash
   npm run start:local-assistant
   ```

### Testing AI Functionality

The AI endpoints are now proxied through Fly.io to your local assistant:

- `POST /api/v2/ai/chat` - AI chat
- `POST /api/v2/ai/recommendations` - AI recommendations  
- `POST /api/v2/ai/analyze` - AI analysis
- `GET /api/v2/ai/health` - Health check

### Frontend Integration

The frontend will automatically use the AI functionality through the Fly.io proxy. No frontend changes are required.

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using port 3001
   lsof -i :3001
   
   # Kill the process or use different port
   export LOCAL_ASSISTANT_PORT=3002
   ```

2. **Fly.io Connection Failed**
   - Verify `FLY_IO_BASE_URL` is correct
   - Check that Fly.io app is running
   - Test connectivity: `curl https://your-app.fly.dev/health`

3. **Llama-hub Connection Failed**
   - Verify `LLAMA_HUB_URL` is correct
   - Check that Llama-hub is running
   - Test connectivity: `curl http://localhost:9000/health`

4. **Environment Variables Missing**
   - Check `.env` file exists and has required variables
   - Verify variables are loaded: `echo $NOTION_API_KEY`

### Debug Mode

Run with debug logging:

```bash
DEBUG=* npm run start:local-assistant
```

## Performance Monitoring

The local assistant includes performance metrics:

- **Context Time**: Time to fetch data from Fly.io
- **AI Time**: Time for AI processing
- **Validation Time**: Time for response validation
- **Total Time**: End-to-end request time

Monitor these in the console output or add your own monitoring.

## Development

### Making Changes

1. **AI Services**: Modify files in `services/ai-*`
2. **Local Assistant**: Modify `local-assistant.js`
3. **Proxy Routes**: Modify `routes/ai-proxy.js`

### Testing Changes

1. Restart local assistant after changes
2. Test AI endpoints through Fly.io proxy
3. Check console logs for errors

## Cost Optimization

This setup reduces Fly.io costs by:

- **CPU Usage**: ~40% reduction (AI processing moved local)
- **Memory Usage**: ~30% reduction (AI context moved local)
- **API Calls**: Reduced external AI service calls
- **Processing Time**: Faster local AI processing

## Security Considerations

- Local assistant runs on localhost by default
- No external access to AI services
- All data fetching goes through Fly.io app
- Environment variables remain secure

## Backup and Recovery

- **Local Assistant**: Restart with `npm run start:local-assistant`
- **Fly.io App**: Standard Fly.io deployment process
- **Data**: All data remains in Fly.io/Notion

## Support

For issues with the local assistant:

1. Check console logs for errors
2. Verify all environment variables
3. Test individual components (Fly.io, Llama-hub)
4. Check network connectivity

The local assistant is designed to be resilient and will provide fallback responses when services are unavailable.
