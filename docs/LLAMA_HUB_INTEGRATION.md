# Llama-hub Integration

This document describes the Llama-hub integration added to the GitHub Notion Logger project.

## Overview

The integration connects the GitHub Notion Logger to a local Llama-hub server running llama3-7b and other models, providing AI-powered features for project analysis, commit message suggestions, and general text generation.

## Configuration

### Environment Variables

Add these environment variables to your `.env` file:

```bash
# Llama-hub Configuration
LLAMA_HUB_URL=http://localhost:9000
LLAMA_API_KEY=your_llama_api_key_here
LLAMA_DEFAULT_MODEL=llama3-7b
```

### Prerequisites

1. **Llama-hub Server**: Must be running on port 9000 (or configured URL)
2. **API Key**: Set the `LLAMA_API_KEY` environment variable
3. **Model Available**: Ensure llama3-7b model is available in the hub

## API Endpoints

### Health Check
```
GET /api/llama/health
```
Returns the health status of the Llama-hub service.

### Available Models
```
GET /api/llama/models
```
Lists all available models in the Llama-hub.

### Chat Completion
```
POST /api/llama/chat
```
**Body:**
```json
{
  "model": "llama3-7b",
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "maxTokens": 1000,
  "temperature": 0.7,
  "stream": false
}
```

### Text Generation
```
POST /api/llama/generate
```
**Body:**
```json
{
  "prompt": "Explain quantum computing",
  "model": "llama3-7b",
  "maxTokens": 500,
  "temperature": 0.7
}
```

### Project Analysis
```
POST /api/llama/analyze-project
```
**Body:**
```json
{
  "projectData": "{\"commits\": [...], \"totalCommits\": 10}",
  "analysisType": "productivity"
}
```

**Analysis Types:**
- `general` - General project insights
- `productivity` - Productivity patterns
- `quality` - Code quality analysis
- `planning` - Project management insights

### Commit Message Suggestion
```
POST /api/llama/suggest-commit
```
**Body:**
```json
{
  "changes": [
    {
      "status": "modified",
      "filename": "server.js",
      "additions": 15,
      "deletions": 3
    }
  ],
  "context": "Adding user authentication"
}
```

## Usage Examples

### 1. Test the Integration
```bash
node test-llama-integration.js
```

### 2. Generate Text via API
```bash
curl -X POST http://localhost:3260/api/llama/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What are the benefits of version control?",
    "maxTokens": 200
  }'
```

### 3. Analyze Project Data
```bash
curl -X POST http://localhost:3260/api/llama/analyze-project \
  -H "Content-Type: application/json" \
  -d '{
    "projectData": "{\"commits\": [{\"message\": \"feat: add auth\", \"date\": \"2024-01-15\"}]}",
    "analysisType": "productivity"
  }'
```

## Service Architecture

### LlamaHubService Class

Located in `services/llama-hub-service.js`, this class provides:

- **chatCompletion()** - Full chat completion with messages
- **generateText()** - Simple text generation from prompt
- **analyzeProject()** - Project data analysis with different types
- **suggestCommitMessage()** - AI-powered commit message suggestions
- **getModels()** - List available models
- **getHealth()** - Check service health

### Error Handling

All endpoints include comprehensive error handling:
- API key validation
- Input validation
- Network error handling
- Llama-hub service error propagation

## Integration Points

The Llama-hub integration is designed to enhance existing features:

1. **Project Analysis** - AI insights into development patterns
2. **Commit Suggestions** - Better commit message generation
3. **General AI Features** - Text generation and chat capabilities
4. **Future Enhancements** - Extensible for additional AI features

## Troubleshooting

### Common Issues

1. **Service Unavailable (503)**
   - Check if Llama-hub server is running
   - Verify `LLAMA_HUB_URL` is correct
   - Check Llama-hub logs

2. **API Key Errors**
   - Ensure `LLAMA_API_KEY` is set
   - Verify the key is valid in Llama-hub

3. **Model Not Available**
   - Check if llama3-7b is loaded in Llama-hub
   - Use `/api/llama/models` to see available models

4. **Timeout Errors**
   - Llama-hub models may take time to load
   - Check model status in Llama-hub health endpoint

### Debugging

1. Check server logs for Llama-hub related errors
2. Use the test script: `node test-llama-integration.js`
3. Verify Llama-hub health: `curl http://localhost:9000/health`
4. Check available models: `curl http://localhost:9000/v1/models`

## Future Enhancements

Potential future features:
- Streaming responses for real-time generation
- Model selection based on task type
- Integration with existing project data
- Automated commit message generation
- Project health scoring with AI insights
