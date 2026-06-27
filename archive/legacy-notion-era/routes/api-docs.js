const express = require('express');
const fs = require('fs');
const path = require('path');
const { asyncHandler } = require('../services/server');

const router = express.Router();

/**
 * Get API documentation endpoint
 * GET /api/docs
 * 
 * Returns comprehensive API documentation in JSON format for programmatic access
 */
router.get('/docs', asyncHandler(async (req, res) => {
  try {
    const docsPath = path.join(__dirname, '../docs/API_REFERENCE.md');
    
    // Read the markdown documentation
    const markdown = fs.readFileSync(docsPath, 'utf8');
    
    // Determine base URL - use request host or environment variable
    const protocol = req.protocol || 'https';
    const host = req.get('host') || process.env.FLY_APP_NAME 
      ? `${process.env.FLY_APP_NAME}.fly.dev` 
      : 'localhost:8080';
    const baseUrl = process.env.API_BASE_URL || `${protocol}://${host}/api`;
    
    // Return both markdown and a structured endpoint list
    const endpoints = {
      baseUrl: baseUrl,
      documentation: {
        markdown: markdown,
        url: `${baseUrl.replace('/api', '')}/docs/API_REFERENCE.md`
      },
      endpoints: {
        commits: {
          'POST /api/commits': {
            description: 'Log commits via API',
            method: 'POST',
            path: '/api/commits',
            authentication: 'None',
            requestBody: {
              commits: 'Array of commit objects'
            }
          },
          'GET /api/commits/:date': {
            description: 'Get commits for a specific date',
            method: 'GET',
            path: '/api/commits/:date',
            authentication: 'Optional (for backfill)',
            queryParams: {
              backfill: 'boolean (requires API key)'
            }
          },
          'GET /api/commits/summary/:date': {
            description: 'Get daily summary with project stats and themes',
            method: 'GET',
            path: '/api/commits/summary/:date',
            authentication: 'Optional (for backfill)'
          }
        },
        webhooks: {
          'POST /api/webhook': {
            description: 'GitHub webhook endpoint for commit events',
            method: 'POST',
            path: '/api/webhook',
            authentication: 'GitHub signature verification'
          }
        },
        projects: {
          'GET /api/projects': {
            description: 'Get project overview with health indicators and filtering',
            method: 'GET',
            path: '/api/projects',
            authentication: 'None',
            queryParams: {
              page: 'number (default: 1)',
              limit: 'number (default: 20)',
              category: 'string (optional)',
              status: 'string (optional)',
              healthStatus: 'string (optional)',
              activityStatus: 'string (optional)',
              search: 'string (optional)',
              sortBy: 'string (optional, default: lastActivity)'
            }
          },
          'GET /api/projects/:projectName/health': {
            description: 'Get detailed health status for a specific project',
            method: 'GET',
            path: '/api/projects/:projectName/health',
            authentication: 'None'
          },
          'GET /api/projects/categories': {
            description: 'Get available project categories with statistics',
            method: 'GET',
            path: '/api/projects/categories',
            authentication: 'None'
          },
          'GET /api/projects/search': {
            description: 'Search projects with filters',
            method: 'GET',
            path: '/api/projects/search',
            authentication: 'None',
            queryParams: {
              q: 'string (required, min 2 chars)',
              category: 'string (optional)',
              status: 'string (optional)',
              healthStatus: 'string (optional)',
              activityStatus: 'string (optional)'
            }
          }
        },
        progress: {
          'GET /api/progress/analytics': {
            description: 'Get detailed progress analytics for all projects',
            method: 'GET',
            path: '/api/progress/analytics',
            authentication: 'None',
            queryParams: {
              projectName: 'string (optional)',
              page: 'number (optional)',
              limit: 'number (optional)',
              minCompletion: 'number (optional)',
              maxCompletion: 'number (optional)',
              minVelocity: 'number (optional)'
            }
          },
          'GET /api/progress/incomplete': {
            description: 'Get tracking of incomplete work items',
            method: 'GET',
            path: '/api/progress/incomplete',
            authentication: 'None'
          },
          'GET /api/progress/velocity': {
            description: 'Get velocity trends for projects',
            method: 'GET',
            path: '/api/progress/velocity',
            authentication: 'None'
          },
          'GET /api/progress/blocked': {
            description: 'Get blocked and stale work items',
            method: 'GET',
            path: '/api/progress/blocked',
            authentication: 'None'
          }
        },
        ai: {
          'POST /api/ai/chat': {
            description: 'AI chat with project context',
            method: 'POST',
            path: '/api/ai/chat',
            authentication: 'None',
            requestBody: {
              message: 'string (required)',
              sessionId: 'string (optional)',
              contextType: 'string (optional)',
              options: 'object (optional)'
            }
          },
          'POST /api/ai/recommendations': {
            description: 'Get AI recommendations',
            method: 'POST',
            path: '/api/ai/recommendations',
            authentication: 'None'
          },
          'POST /api/ai/analyze': {
            description: 'AI analysis endpoint',
            method: 'POST',
            path: '/api/ai/analyze',
            authentication: 'None'
          },
          'GET /api/ai/health': {
            description: 'Health check for AI services',
            method: 'GET',
            path: '/api/ai/health',
            authentication: 'None'
          }
        },
        cache: {
          'POST /api/cache/projects/clear': {
            description: 'Clear project management cache',
            method: 'POST',
            path: '/api/cache/projects/clear',
            authentication: 'None'
          },
          'POST /api/cache/progress/clear': {
            description: 'Clear progress tracking cache',
            method: 'POST',
            path: '/api/cache/progress/clear',
            authentication: 'None'
          },
          'GET /api/cache/status': {
            description: 'Get cache status and statistics',
            method: 'GET',
            path: '/api/cache/status',
            authentication: 'None'
          }
        },
        performance: {
          'GET /api/performance/stats': {
            description: 'Get performance statistics and metrics',
            method: 'GET',
            path: '/api/performance/stats',
            authentication: 'None'
          },
          'POST /api/performance/clear': {
            description: 'Clear all performance caches',
            method: 'POST',
            path: '/api/performance/clear',
            authentication: 'None'
          }
        }
      },
      authentication: {
        apiKey: {
          description: 'Some endpoints require API key authentication',
          header: 'X-API-Key: your-api-key',
          alternative: 'Authorization: Bearer your-api-key'
        },
        webhook: {
          description: 'Webhook endpoints verify GitHub signatures',
          header: 'X-Hub-Signature-256'
        }
      },
      rateLimiting: {
        backfill: {
          perHour: 5,
          perDay: 20,
          cooldown: '5 minutes'
        }
      },
      version: '1.0.0',
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: endpoints
    });
    
  } catch (error) {
    console.error('❌ Error serving API documentation:', error);
    res.status(500).json({
      success: false,
      error: 'Error serving API documentation',
      details: error.message
    });
  }
}));

module.exports = router;

