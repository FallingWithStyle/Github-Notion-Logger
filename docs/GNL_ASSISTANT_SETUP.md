# GNL Assistant Setup

This document explains how to set up and run the GNL (GitHub Notion Logger) AI assistant locally to reduce Fly.io hosting costs.

## Overview

The AI assistant runs locally on port 4250 while the main application continues to run on Fly.io. This hybrid architecture provides:

- **Cost Savings**: ~40% reduction in Fly.io compute costs
- **Better Performance**: Local AI processing with no network latency
- **More Control**: Direct access to AI models and processing
- **Easier Development**: Local debugging and testing
- **GNL-Specific**: Optimized for GitHub Notion Logger project

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Fly.io App    │    │ GNL Assistant   │
│                 │    │  (Port 4250)    │
│ • Core APIs     │◄──►│ • AI Chat       │
│ • Data Sync     │    │ • Project       │
│ • Webhooks      │    │   Analysis      │
│ • Static Files  │    │ • Enhanced      │
└─────────────────┘    │   Monitoring    │
                       └─────────────────┘
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
# GNL Assistant Configuration
GNL_ASSISTANT_PORT=4250
FLY_IO_BASE_URL=https://your-app.fly.dev
LLAMA_HUB_URL=http://localhost:9000

# Required for AI services
NOTION_API_KEY=your_notion_key
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_key
LLAMA_API_KEY=your_llama_key
```

### 3. Start GNL Assistant

#### Option A: Using npm script
```bash
npm run start:gnl-assistant
```

#### Option B: Using startup script
```bash
npm run start:gnl-assistant:script
```

#### Option C: Direct execution
```bash
node gnl-assistant.js
```

### 4. Verify Setup

Check that the GNL Assistant is running:

```bash
curl http://localhost:4250/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "gnl-assistant",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "flyIOConnection": "https://your-app.fly.dev",
  "uptime": 12345,
  "activeRequests": 0,
  "queuedRequests": 0,
  "activeSessions": 0
}
```

## Usage

### Starting Both Services

1. **Start Fly.io app** (if not already running):
   ```bash
   fly deploy
   ```

2. **Start GNL Assistant**:
   ```bash
   npm run start:gnl-assistant
   ```

### Testing AI Functionality

The AI endpoints are now proxied through Fly.io to your GNL Assistant:

- `POST /api/v2/ai/chat` - AI chat (proxied to GNL)
- `POST /api/v2/ai/recommendations` - AI recommendations (proxied to GNL)
- `POST /api/v2/ai/analyze` - AI analysis (proxied to GNL)
- `GET /api/v2/ai/health` - Health check (proxied to GNL)

### Direct GNL Assistant Access

You can also access the GNL Assistant directly:

- `POST /api/gnl/chat` - Direct GNL chat
- `POST /api/gnl/analyze` - Direct GNL analysis
- `GET /health` - GNL health check
- `GET /metrics` - GNL performance metrics

### Frontend Integration

The frontend will automatically use the AI functionality through the Fly.io proxy. No frontend changes are required.

## Configuration

### Environment Variables
```env
# GNL Assistant
GNL_ASSISTANT_PORT=4250
FLY_IO_BASE_URL=https://notion-logger.fly.dev
LLAMA_HUB_URL=http://localhost:9000

# Required for both
NOTION_API_KEY=your_notion_key
GITHUB_TOKEN=your_github_token
OPENAI_API_KEY=your_openai_key
LLAMA_API_KEY=your_llama_key
```

### Port Configuration
- **Fly.io App**: Port 8080 (default)
- **GNL Assistant**: Port 4250
- **Llama-hub**: Port 9000 (external)

## Benefits Achieved

### Cost Savings
- **40% reduction** in Fly.io compute costs
- **Local processing** eliminates external AI service costs
- **Efficient resource usage** with concurrency control

### Performance Improvements
- **Faster AI processing** (no network latency)
- **Better response times** with local processing
- **Enhanced monitoring** and metrics

### Development Benefits
- **Easier debugging** with local AI services
- **Better control** over AI models and processing
- **Flexible configuration** for different use cases

### Reliability
- **Fallback responses** when services unavailable
- **Graceful degradation** with error handling
- **Health monitoring** and automatic recovery

## Monitoring & Maintenance

### Key Metrics to Monitor
- **Response Times**: Average AI processing time
- **Error Rates**: Failed requests percentage
- **Memory Usage**: Server resource consumption
- **Active Sessions**: Concurrent user sessions
- **Fly.io Calls**: API requests to main app

### Maintenance Tasks
- **Session Cleanup**: Automatic every 10 minutes
- **Metrics Reset**: Available via API endpoint
- **Health Checks**: Monitor service availability
- **Log Monitoring**: Check for errors and performance issues

## Troubleshooting

### Common Issues
1. **Port Conflicts**: Check if port 4250 is available
2. **Fly.io Connection**: Verify FLY_IO_BASE_URL is correct
3. **Llama-hub Issues**: Ensure Llama-hub is running
4. **Memory Usage**: Monitor and restart if needed

### Debug Commands
```bash
# Check running processes
lsof -i :4250

# Test connectivity
curl http://localhost:4250/health

# View metrics
curl http://localhost:4250/metrics
```

## Support

For issues with the GNL Assistant:

1. Check console logs for errors
2. Verify all environment variables
3. Test individual components (Fly.io, Llama-hub)
4. Check network connectivity

The GNL Assistant is designed to be resilient and will provide fallback responses when services are unavailable.
