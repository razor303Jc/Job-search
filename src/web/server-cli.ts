#!/usr/bin/env node

/**
 * Enhanced Web Server CLI
 * Start the Phase 7 enhanced web dashboard
 */

import { logger } from '../utils/logger.js';
import { EnhancedWebServer } from './server-v2.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  logger.info('🚀 Starting Enhanced Web Server (Phase 7)');

  try {
    const server = new EnhancedWebServer();
    await server.start(PORT, HOST);

    logger.info(`
    ╔══════════════════════════════════════════╗
    ║          Enhanced Web Dashboard          ║
    ║                                          ║
    ║  🌐 Web Interface: http://localhost:${PORT}   ║
    ║  📡 WebSocket: ws://localhost:${PORT}/ws       ║
    ║  🏥 Health Check: /health                ║
    ║  📊 API v2: /api/v2/*                   ║
    ║                                          ║
    ║  Features:                               ║
    ║  ✓ Real-time WebSocket updates          ║
    ║  ✓ Interactive dashboard                ║
    ║  ✓ Live scraping progress               ║
    ║  ✓ Job statistics & analytics           ║
    ║                                          ║
    ╚══════════════════════════════════════════╝
    `);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutting down enhanced web server...');
      await server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('🛑 Received SIGTERM, shutting down...');
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start enhanced web server');
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error({ err: error }, '❌ Unhandled error in enhanced web server');
  process.exit(1);
});
