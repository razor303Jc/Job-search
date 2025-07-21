# 🧠 Job Dorker - Node.js Job Scraper

[![CI/CD Pipeline](https://github.com/yourusername/job-dorker/workflows/CI/CD%20Pipeline/badge.svg)](https://github.com/yourusername/job-dorker/actions)
[![codecov](https://codecov.io/gh/yourusername/job-dorker/branch/main/graph/badge.svg)](https://codecov.io/gh/yourusername/job-dorker)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

A modern, high-performance Node.js job scraper that uses Google Dorks to find job listings across multiple job boards with intelligent parsing and comprehensive reporting.

## ✨ Features

- 🔍 **Google Dorks Integration** - Advanced search patterns for targeted job discovery
- 🎭 **Multi-Browser Scraping** - Playwright for modern SPAs, Cheerio for static content
- 📊 **Multiple Export Formats** - CSV, JSON, and PDF reports with analytics
- 🚀 **High Performance** - TypeScript, modern async patterns, intelligent rate limiting
- 🛡️ **Respectful Scraping** - Built-in rate limiting, robots.txt compliance
- 🎯 **CLI & Web Interface** - Command-line tool and optional web UI
- 🔄 **Background Processing** - Queue-based scraping with BullMQ
- 📈 **Monitoring & Analytics** - Comprehensive logging and metrics
- 🐳 **Docker Ready** - Complete containerization with Docker Compose

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 20.0.0
- npm or yarn
- Redis (for queue processing)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/job-dorker.git
cd job-dorker

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Build the project
npm run build

# Start the application
npm start
```

### Docker Setup

```bash
# Development with hot reload
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up -d
```

## 📖 Usage

### CLI Commands

```bash
# Search for jobs
job-dorker search --keywords "node.js developer" --location "remote" --format csv

# Show current configuration
job-dorker config --show

# Reset configuration to defaults
job-dorker config --reset
```

### Search Options

```bash
job-dorker search [options]

Options:
  -k, --keywords <keywords...>  Job keywords to search for
  -l, --location <location>     Job location
  -r, --remote                  Include remote jobs only
  -o, --output <path>           Output file path
  -f, --format <format>         Report format (csv, json, pdf)
  -m, --max-results <number>    Maximum number of results (default: 100)
  -v, --verbose                 Verbose logging
```

## 🏗️ Architecture

```
src/
├── types/           # TypeScript type definitions
├── scrapers/        # Web scraping implementations
├── parsers/         # Job data parsing logic
├── generators/      # Report generation
├── utils/           # Utility functions
├── cli/             # Command-line interface
└── web/            # Optional web UI (Fastify)
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests with Playwright
npm run test:e2e

# Coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## 🔧 Development

### Setup Development Environment

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run linting and formatting
npm run lint
npm run format

# Type checking
npm run typecheck
```

### Code Quality

This project uses modern tooling for code quality:

- **Biome** - Fast linting and formatting (replaces ESLint + Prettier)
- **TypeScript** - Type safety and better developer experience
- **Vitest** - Fast testing framework with native TypeScript support
- **Husky** - Git hooks for automated quality checks

### Git Hooks

Pre-commit hooks automatically run:
- Code formatting with Biome
- Linting checks
- Type checking
- Unit tests

## 🚀 Deployment

### Environment Variables

```bash
# Core Configuration
NODE_ENV=production
LOG_LEVEL=info

# Scraping Settings
SCRAPE_DELAY=2000
MAX_CONCURRENT_REQUESTS=5
RESPECT_ROBOTS_TXT=true

# Database
DATABASE_URL=sqlite:./data/jobs.db

# Queue (Redis)
REDIS_URL=redis://localhost:6379

# Web UI (optional)
WEB_PORT=3000
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Scale the application
docker-compose up -d --scale job-dorker=3

# View logs
docker-compose logs -f job-dorker
```

## 📊 Monitoring

### Metrics Tracked

- Scraping success rates by site
- Job discovery statistics
- Processing time performance
- Error rates and types
- Memory and CPU usage

### Logging

Structured JSON logging with configurable levels:
- **ERROR** - Application errors
- **WARN** - Warnings and rate limiting
- **INFO** - General information
- **DEBUG** - Detailed debugging information

## 🔒 Security & Ethics

### Respectful Scraping Practices

- Rate limiting (1-2 requests/second)
- Robots.txt compliance
- Random delays between requests
- User agent rotation
- Circuit breakers for failed requests

### Data Privacy

- No personal data collection beyond public job listings
- Secure handling of cached data
- Optional data anonymization
- Clear data retention policies

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Follow the existing code style (enforced by Biome)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Playwright](https://playwright.dev/) - Modern web scraping
- [Cheerio](https://cheerio.js.org/) - Server-side DOM manipulation
- [Biome](https://biomejs.dev/) - Fast linting and formatting
- [Vitest](https://vitest.dev/) - Fast testing framework
- [BullMQ](https://docs.bullmq.io/) - Modern job queue

## 📞 Support

- 📧 Email: support@jobdorker.com
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/job-dorker/discussions)
- 🐛 Bug Reports: [GitHub Issues](https://github.com/yourusername/job-dorker/issues)

---

Made with ❤️ by [Your Name](https://github.com/yourusername)
