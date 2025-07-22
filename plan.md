# 🧠 Job Dorker - Node.js Job Scraper using Google Dorks

## 📘 Project Overview

**Goal:**  
Build a Node.js app that:

- Uses **Google Dorks** to search for job listings across multiple job boards
- Scrapes job data from search result links with intelligent parsing
- Generates comprehensive reports (CSV, PDF, JSON) with analytics
- Provides both CLI and optional Web UI interfaces
- Implements rate limiting and respectful scraping practices
- Supports job filtering, deduplication, and saved searches

---

## 🧱 Recommended Tech Stack

### 🏗️ Core Runtime

- **Node.js** (v20 LTS) – Latest stable with performance improvements
- **TypeScript** – Type safety, better IDE support, fewer runtime errors

### 🌐 HTTP & Web Scraping

- **Got** (over Axios) – Better performance, HTTP/2 support, built-in retry logic
- **Playwright** (primary) – Modern, reliable, handles SPA sites, mobile testing
- **Cheerio** (secondary) – Fast server-side DOM manipulation for static content
- **tough-cookie** – Advanced cookie handling
- **user-agents** – Realistic user agent rotation

### 📊 Data Processing & Storage

- **better-sqlite3** – Faster than sqlite3, synchronous API, WAL mode
- **csv-stringify** (over csv-writer) – Better streaming support
- **pdfkit** – PDF generation (keep)
- **fast-json-stringify** – 2-5x faster JSON serialization
- **lodash** – Utility functions for data manipulation

### 🎯 CLI & Interface

- **Commander.js** (over Inquirer) – More flexible CLI argument parsing
- **ora** – Beautiful terminal spinners
- **chalk** – Terminal styling
- **boxen** – Create boxes in terminal
- **table** – ASCII table formatting

### 🔧 Development & Quality

- **Vitest** (over Jest) – Faster, better TypeScript support, ESM native
- **Biome** (over ESLint + Prettier) – All-in-one linter/formatter, 100x faster
- **Husky** – Git hooks (keep)
- **tsx** (over nodemon) – Fast TypeScript execution
- **concurrently** – Run multiple commands

### 📋 Queue & Background Processing

- **Bullmq** (over Bull) – Modern Redis-based queue, better TypeScript support
- **p-queue** – Simple in-memory queue for rate limiting
- **bottleneck** – Advanced rate limiting with clustering

### 🏃‍♂️ Performance & Monitoring

- **pino** (over Winston) – 5x faster JSON logging
- **clinic.js** – Performance profiling
- **autocannon** – Load testing
- **0x** – Flame graph profiling

### 🛡️ Security & Validation

- **zod** – Runtime type validation and parsing
- **helmet** – Security headers (if web UI)
- **rate-limiter-flexible** – Advanced rate limiting
- **validator** – String validation utilities

### 🔄 Optional Web Features

- **Fastify** (over Express) – 2x faster, better TypeScript support
- **@fastify/static** – Static file serving
- **@fastify/view** – Template rendering
- **socket.io** – Real-time updates for web UI

### 📦 Build & Distribution

- **tsup** – Fast TypeScript bundler
- **pkg** – Create executable binaries
- **Docker** – Containerization
- **semantic-release** – Automated versioning

---

## 🎯 Tech Stack Rationale

### Why These Choices?

#### **Playwright over Puppeteer**

- ✅ **Cross-browser support** (Chrome, Firefox, Safari)
- ✅ **Better handling of modern SPAs** (React, Vue job sites)
- ✅ **Mobile device emulation** for responsive scraping
- ✅ **Auto-wait functionality** reduces flaky tests
- ✅ **Network interception** for advanced debugging

#### **TypeScript over JavaScript**

- ✅ **Catch errors at compile time** vs runtime
- ✅ **Better IDE support** with autocomplete
- ✅ **Self-documenting code** with interfaces
- ✅ **Easier refactoring** as project grows
- ✅ **Better team collaboration**

#### **Got over Axios**

- ✅ **HTTP/2 support** for better performance
- ✅ **Built-in retry logic** with exponential backoff
- ✅ **Advanced caching** capabilities
- ✅ **Better error handling** with detailed context
- ✅ **Smaller bundle size**

#### **Vitest over Jest**

- ✅ **Native ESM support** without configuration
- ✅ **Better TypeScript integration**
- ✅ **Faster test execution** (uses Vite's transform pipeline)
- ✅ **Modern snapshot testing**
- ✅ **Better watch mode**

#### **BullMQ over Bull**

- ✅ **Modern TypeScript support**
- ✅ **Better Redis Cluster support**
- ✅ **Advanced job patterns** (batches, flows)
- ✅ **Built-in rate limiting**
- ✅ **Better observability**

#### **Pino over Winston**

- ✅ **5x faster performance**
- ✅ **JSON-first logging** for structured logs
- ✅ **Better memory usage**
- ✅ **Child logger support**
- ✅ **Excellent ecosystem**

#### **Better-SQLite3 over SQLite3**

- ✅ **Synchronous API** simplifies code
- ✅ **WAL mode** for better concurrent access
- ✅ **Better performance** with prepared statements
- ✅ **TypeScript-friendly**

### 📋 Alternative Considerations

#### **For Enterprise Scale:**

- **PostgreSQL** instead of SQLite for multi-user scenarios
- **Redis** for distributed caching and sessions
- **RabbitMQ** for enterprise messaging patterns
- **Prometheus + Grafana** for metrics and monitoring

#### **For Cloud Deployment:**

- **Serverless options:** AWS Lambda, Vercel Functions
- **Container orchestration:** Kubernetes, Docker Swarm
- **Cloud databases:** PlanetScale, Supabase, MongoDB Atlas
- **Message queues:** AWS SQS, Google Cloud Tasks

---

## 🏗️ Updated Project Structure

```text
job-dorker/
├── src/
│   ├── types/                    # TypeScript type definitions
│   │   ├── job.types.ts
│   │   ├── scraper.types.ts
│   │   └── config.types.ts
│   ├── scrapers/
│   │   ├── base-scraper.ts       # Abstract base class
│   │   ├── playwright-scraper.ts # Dynamic content scraper
│   │   ├── cheerio-scraper.ts    # Static content scraper
│   │   └── sites/                # Site-specific implementations
│   │       ├── linkedin.scraper.ts
│   │       ├── indeed.scraper.ts
│   │       └── glassdoor.scraper.ts
│   ├── parsers/
│   │   ├── job-parser.ts
│   │   ├── schemas/              # Zod validation schemas
│   │   └── extractors/           # Site-specific extractors
│   ├── generators/
│   │   ├── base-generator.ts
│   │   ├── csv.generator.ts
│   │   ├── pdf.generator.ts
│   │   └── json.generator.ts
│   ├── queue/
│   │   ├── job-queue.ts          # BullMQ setup
│   │   ├── processors/
│   │   └── schedulers/
│   ├── utils/
│   │   ├── rate-limiter.ts
│   │   ├── logger.ts             # Pino configuration
│   │   ├── deduplicator.ts
│   │   ├── validators.ts         # Zod schemas
│   │   └── cache.ts              # Caching utilities
│   ├── database/
│   │   ├── connection.ts         # Better-SQLite3 setup
│   │   ├── migrations/
│   │   └── models/
│   ├── cli/
│   │   ├── index.ts              # Commander.js setup
│   │   ├── commands/
│   │   └── prompts/
│   ├── web/                      # Optional Fastify web UI
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── plugins/
│   │   └── static/
│   └── index.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/                      # Playwright E2E tests
│   ├── fixtures/
│   └── helpers/
├── scripts/
│   ├── build.ts
│   ├── migrate.ts
│   └── seed.ts
├── config/
│   ├── vitest.config.ts
│   ├── tsconfig.json
│   ├── biome.json
│   └── playwright.config.ts
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.dev.yml
└── dist/                         # Built TypeScript output
```

---

## 🏗️ Project Structure

```text
job-dorker/
├── src/
│   ├── scrapers/
│   │   ├── base-scraper.js
│   │   ├── google-dork-scraper.js
│   │   ├── linkedin-scraper.js
│   │   └── indeed-scraper.js
│   ├── parsers/
│   │   ├── job-parser.js
│   │   └── site-specific-parsers/
│   ├── generators/
│   │   ├── csv-generator.js
│   │   ├── pdf-generator.js
│   │   └── json-generator.js
│   ├── utils/
│   │   ├── rate-limiter.js
│   │   ├── logger.js
│   │   ├── deduplicator.js
│   │   └── validators.js
│   ├── config/
│   │   ├── dorks.js
│   │   └── settings.js
│   ├── cli/
│   │   └── index.js
│   ├── web/
│   │   ├── routes/
│   │   ├── views/
│   │   └── public/
│   └── index.js
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── docs/
├── scripts/
├── .github/
│   └── workflows/
├── config/
│   ├── .env.example
│   └── jest.config.js
├── package.json
├── README.md
├── .gitignore
├── .eslintrc.js
├── .prettierrc
└── docker-compose.yml
```

---

## 🔍 Google Dorks Strategy

### Target Job Sites

- LinkedIn Jobs
- Indeed
- Glassdoor
- AngelList/Wellfound
- RemoteOK
- Stack Overflow Jobs
- Company career pages

### Example Dorks

```text

site:linkedin.com/jobs "software engineer" location:remote
site:indeed.com "node.js developer" -intern
site:glassdoor.com "full stack" salary:>80000
filetype:pdf "job description" "react developer"
```

---

## 🧪 Testing Strategy

### Unit Tests

- Scraper functions
- Data parsers
- Report generators
- Utility functions
- Configuration validation

### Integration Tests

- End-to-end scraping workflows
- Report generation pipeline
- CLI interface testing
- Web API endpoints

### Test Coverage Goals

- **Minimum:** 80% code coverage
- **Target:** 90% code coverage

### Testing Tools

```bash

npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:integration # Integration tests
npm run test:coverage # Coverage report
npm run test:watch    # Watch mode
```

---

## 🚀 CI/CD Pipeline

### GitHub Actions Workflow

#### On Push/PR:

1. **Lint & Format Check**
   - ESLint validation
   - Prettier format check
   - Package vulnerability audit

2. **Test Suite**
   - Unit tests (Node.js 16, 18, 20)
   - Integration tests
   - Coverage reporting to Codecov

3. **Security Checks**
   - npm audit
   - CodeQL analysis
   - Dependency vulnerability scan

#### On Release

1. **Build & Package**
   - Create distribution bundle
   - Generate documentation
   - Docker image build

2. **Deploy**
   - Publish to npm (if library)
   - Deploy to staging environment
   - Create GitHub release

### Environments

- **Development:** Local development
- **Staging:** Pre-production testing
- **Production:** Live deployment (if web version)

---

## 📋 Current Status & Progress

### ✅ Phase 1: Core Foundation (COMPLETE)
- ✅ Initialize Node.js project with proper package.json
- ✅ Set up development environment (ESLint, Prettier, Husky) 
- ✅ Implement basic project structure
- ✅ Create base scraper class with rate limiting
- ✅ Implement Google Dorks generator
- ✅ Build job data parser system
- ✅ Add comprehensive logging system (Winston)
- ✅ Write initial unit tests (67 tests passing)

### ✅ Phase 2: Scraping Engine (COMPLETE)
- ✅ Implement Cheerio-based scraper for static content
- ✅ Add Playwright support for dynamic content (LinkedIn, Glassdoor)
- ✅ Create site-specific parsers with intelligent detection
- ✅ Implement job deduplication logic
- ✅ Add error handling and retry mechanisms
- ✅ Build data validation system
- ✅ Add progress indicators and spinners
- ✅ Implement concurrent scraping with queue management

### ✅ Phase 3: Database Layer (COMPLETE)

- ✅ SQLite database integration with better-sqlite3
- ✅ Database connection management with WAL mode
- ✅ Migration system with smart SQL parsing
- ✅ Job repository with CRUD operations
- ✅ Full-text search capabilities
- ✅ Database backup and statistics
- ✅ Report generation system

### ✅ Phase 4: Web Interface (COMPLETE)

- ✅ Fastify web server setup
- ✅ RESTful API endpoints for jobs
- ✅ Modern responsive web interface
- ✅ Real-time job search and filtering
- ✅ Interactive job analytics dashboard
- ✅ Web-based report generation
- ✅ Mobile-friendly responsive design

### ✅ Phase 5: Docker Deployment (COMPLETE)

- ✅ Docker multi-stage builds with Node.js 20.15 compatibility
- ✅ Production container with SQLite database setup
- ✅ Development container with hot reload support
- ✅ Docker Compose orchestration with Redis integration
- ✅ Health checks for all services
- ✅ Working web interface containerization

### 📝 Phase 6: Report Generation (NEXT)

- ⏳ Enhanced CSV export with customizable columns
- ⏳ Advanced JSON export with analytics
- ⏳ PDF report with charts and visualization
- ⏳ Report templates and branding
- ⏳ Automated report scheduling
- ⏳ Data filtering and summary statistics

---

## 📋 TODO List

### ✅ Phase 1: Core Foundation (Week 1-2) - COMPLETE

- [x] Initialize Node.js project with proper package.json
- [x] Set up development environment (ESLint, Prettier, Husky)
- [x] Implement basic project structure
- [x] Create base scraper class with rate limiting
- [x] Implement Google Dorks generator
- [x] Build simple job data parser
- [x] Add basic logging system
- [x] Write initial unit tests

### ✅ Phase 2: Scraping Engine (Week 3-4) - COMPLETE

- [x] Implement Cheerio-based scraper for static content
- [x] Add Playwright support for dynamic content
- [x] Create site-specific parsers (LinkedIn, Indeed, etc.)
- [x] Implement job deduplication logic
- [x] Add error handling and retry mechanisms
- [x] Build data validation system
- [x] Add progress indicators
- [x] Implement concurrent scraping with queue

### ✅ Phase 3: Database & Storage (Week 5) - COMPLETE

- [x] SQLite database integration with better-sqlite3
- [x] Database connection management with WAL mode
- [x] Migration system with smart SQL parsing
- [x] Job repository with CRUD operations
- [x] Full-text search capabilities
- [x] Database backup and statistics

### ✅ Phase 4: Web Interface (Week 6) - COMPLETE

- [x] Fastify web server setup
- [x] RESTful API endpoints for jobs
- [x] Modern responsive web interface
- [x] Real-time job search and filtering
- [x] Interactive job analytics dashboard
- [x] Web-based report generation

### ✅ Phase 5: Docker Deployment (Week 7) - COMPLETE

- [x] Docker containerization with multi-stage builds
- [x] Docker Compose orchestration
- [x] Health checks and monitoring
- [x] Production and development environments
- [x] Redis integration for queue management

### 📝 Phase 6: Enhanced Reports & CLI (Week 8) - NEXT

- [ ] Enhanced CSV export with customizable columns
- [ ] Advanced PDF reports with charts and analytics
- [ ] JSON export with structured analytics data
- [ ] Interactive CLI with Inquirer
- [ ] Command-line arguments parsing
- [ ] Report templates and scheduling
- [ ] Data filtering and summary statistics

### Phase 7: Testing & Quality (Week 9)

- [ ] Comprehensive unit test suite expansion
- [ ] Integration tests for all workflows
- [ ] Performance benchmarking
- [ ] Security testing and audit
- [ ] Documentation completion
- [ ] Load testing and optimization

### Phase 6: Advanced Features (Week 8+)

- [ ] Web UI with Express
- [ ] Job alerts and notifications
- [ ] Database integration for job storage
- [ ] API endpoints for external integration
- [ ] Scheduled scraping with cron
- [ ] Job matching algorithms
- [ ] Company research integration

### Phase 7: Deployment & Monitoring (Ongoing)

- [ ] Docker containerization
- [ ] CI/CD pipeline setup
- [ ] Monitoring and alerting
- [ ] Performance optimization
- [ ] Documentation website
- [ ] Community features

### 🚀 Future Enhancement Plans

#### Career Management Suite

- [ ] **CV Upload & Management**
  - PDF/DOCX resume parsing and analysis
  - Skills extraction and gap analysis
  - Resume optimization recommendations
  - Multiple CV version management

- [ ] **Education Hub**
  - Course recommendations based on job requirements
  - Certification tracking and expiration alerts
  - Learning path suggestions
  - Integration with online learning platforms

- [ ] **Google Drive Integration**
  - Read-only access to shared certification folders
  - Automatic certificate parsing and validation
  - Portfolio document management
  - Shared reference document access

- [ ] **AI-Powered Features**
  - Job description analysis and matching
  - Resume-to-job compatibility scoring
  - Interview preparation question generation
  - Career progression recommendations
  - Salary negotiation insights

- [ ] **Advanced Analytics**
  - Job market trend analysis
  - Company culture insights
  - Skills demand forecasting
  - Geographic job market analysis

#### Integration & Automation

- [ ] **Third-Party Integrations**
  - LinkedIn profile sync
  - GitHub portfolio integration
  - Calendar scheduling for applications
  - CRM-style application tracking

- [ ] **Smart Notifications**
  - AI-curated job recommendations
  - Application deadline reminders
  - Market trend alerts
  - Skills development suggestions

---

## 🔒 Security & Ethics

### Respectful Scraping

- Implement proper rate limiting (1-2 requests/second)
- Respect robots.txt files
- Add random delays between requests
- Use rotating user agents
- Implement circuit breakers for failed requests

### Data Privacy

- No personal data collection beyond public job listings
- Secure handling of any cached data
- Option to anonymize company information
- Clear data retention policies

### Legal Considerations

- Terms of service compliance
- Fair use guidelines
- Attribution where required
- Rate limiting to avoid service disruption

---

## 📊 Monitoring & Analytics

### Metrics to Track

- Scraping success rates by site
- Job discovery statistics
- Processing time performance
- Error rates and types
- User engagement (CLI/Web)

### Logging Strategy

- Structured logging with Winston
- Log levels: ERROR, WARN, INFO, DEBUG
- Rotation and retention policies
- Performance monitoring

---

## 🔧 Configuration Management

### Environment Variables

```bash
# .env
NODE_ENV=development
LOG_LEVEL=info
SCRAPE_DELAY=2000
MAX_CONCURRENT_REQUESTS=5
OUTPUT_DIRECTORY=./reports
DATABASE_URL=sqlite:./jobs.db
WEB_PORT=3000
```

### Configuration Files

- `config/dorks.json` - Google Dork patterns
- `config/sites.json` - Supported job sites
- `config/parsers.json` - Parser configurations

---

## 📈 Performance Optimization

### Caching Strategy

- Cache job listings to avoid duplicate processing
- Cache parsed site structures
- Implement intelligent cache invalidation

### Scalability Considerations

- Queue-based processing for large scraping jobs
- Database indexing for fast job searches
- Pagination for large result sets
- Memory management for long-running processes

---

## 📚 Documentation Plan

- [ ] API documentation with JSDoc
- [ ] User guide for CLI usage
- [ ] Developer setup instructions
- [ ] Scraping best practices guide
- [ ] Troubleshooting guide
- [ ] Contributing guidelines

---

## 🎯 Success Metrics

### Technical KPIs

- 95%+ uptime for scraping operations
- <5 second average response time
- 80%+ successful job extraction rate
- Zero security vulnerabilities

### User Experience KPIs

- Intuitive CLI interface
- Clear error messages
- Comprehensive reporting
- Fast report generation (<30 seconds for 100 jobs)
