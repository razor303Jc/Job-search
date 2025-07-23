# 🔐 CI/CD API Tokens & Secrets Configuration Guide

## Overview
This document outlines all API tokens, secrets, and environment variables required for the complete CI/CD pipeline deployment of the Job Search Platform.

## 📋 Required GitHub Repository Secrets

### 1. Core Application Secrets
```bash
# Database Configuration
DATABASE_URL                 # PostgreSQL connection string for production
DATABASE_URL_STAGING         # PostgreSQL connection string for staging
DATABASE_PASSWORD           # Database password (if separate from URL)

# Application Security
JWT_SECRET                   # JSON Web Token signing secret (256-bit random)
API_SECRET_KEY              # API authentication secret key
ENCRYPTION_KEY              # Data encryption key for sensitive information
SESSION_SECRET              # Session management secret

# Server Configuration
SERVER_HOST                 # Production server host (default: 0.0.0.0)
SERVER_PORT                 # Production server port (default: 3000)
NODE_ENV                    # Environment (production/staging/development)
```

### 2. Third-Party Service Integrations
```bash
# Job Board APIs (for scraping services)
INDEED_API_KEY              # Indeed API access key
LINKEDIN_CLIENT_ID          # LinkedIn API client ID
LINKEDIN_CLIENT_SECRET      # LinkedIn API client secret
GLASSDOOR_API_KEY           # Glassdoor API key
DICE_API_KEY               # Dice API key

# Email Services (for notifications)
SENDGRID_API_KEY           # SendGrid email service API key
SMTP_HOST                  # SMTP server host
SMTP_PORT                  # SMTP server port
SMTP_USERNAME              # SMTP authentication username
SMTP_PASSWORD              # SMTP authentication password

# Cloud Storage (for backups and file storage)
AWS_ACCESS_KEY_ID          # AWS S3 access key ID
AWS_SECRET_ACCESS_KEY      # AWS S3 secret access key
AWS_REGION                 # AWS region (e.g., us-east-1)
AWS_S3_BUCKET_NAME         # S3 bucket for backups and storage

# Monitoring & Analytics
SENTRY_DSN                 # Sentry error tracking DSN
NEWRELIC_LICENSE_KEY       # New Relic monitoring license
DATADOG_API_KEY            # Datadog monitoring API key
GOOGLE_ANALYTICS_ID        # Google Analytics tracking ID
```

### 3. Security & Vulnerability Scanning
```bash
# Snyk Security Scanning
SNYK_TOKEN                 # Snyk API token for vulnerability scanning

# CodeQL & Security Analysis
GITHUB_TOKEN               # GitHub token with security analysis permissions
CODEQL_LANGUAGE           # CodeQL analysis language (javascript)

# SSL/TLS Certificates
SSL_CERT_PATH             # Path to SSL certificate
SSL_KEY_PATH              # Path to SSL private key
SSL_CA_PATH               # Path to SSL certificate authority
```

### 4. Deployment & Infrastructure
```bash
# Production Deployment
PRODUCTION_SERVER_HOST     # Production server IP/hostname
PRODUCTION_SSH_KEY         # SSH private key for production server access
PRODUCTION_SSH_USER        # SSH username for production server

# Staging Deployment
STAGING_SERVER_HOST        # Staging server IP/hostname
STAGING_SSH_KEY           # SSH private key for staging server access
STAGING_SSH_USER          # SSH username for staging server

# Container Registry (if using Docker)
DOCKER_HUB_USERNAME       # Docker Hub username
DOCKER_HUB_TOKEN          # Docker Hub access token
GHCR_TOKEN                # GitHub Container Registry token

# CDN & Static Assets
CDN_ENDPOINT              # CDN endpoint URL
CDN_ACCESS_KEY            # CDN access key
CDN_SECRET_KEY            # CDN secret key
```

### 5. Testing & Quality Assurance
```bash
# Test Database
TEST_DATABASE_URL         # Test database connection string
E2E_TEST_URL             # End-to-end testing base URL

# Browser Testing
BROWSERSTACK_USERNAME     # BrowserStack username (if using)
BROWSERSTACK_ACCESS_KEY   # BrowserStack access key

# Performance Testing
LOADTEST_API_KEY         # Load testing service API key
```

## 🔧 Configuration Instructions

### Step 1: Generate Required Secrets
```bash
# Generate secure random secrets
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For API_SECRET_KEY
openssl rand -hex 32  # For ENCRYPTION_KEY
openssl rand -hex 32  # For SESSION_SECRET
```

### Step 2: Configure GitHub Repository Secrets
1. Navigate to your GitHub repository
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret from the lists above

### Step 3: Environment-Specific Configuration

#### Production Environment Variables
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-db:5432/jobsearch
SERVER_HOST=0.0.0.0
SERVER_PORT=3000
LOG_LEVEL=warn
```

#### Staging Environment Variables
```bash
NODE_ENV=staging
DATABASE_URL=postgresql://user:password@staging-db:5432/jobsearch_staging
SERVER_HOST=0.0.0.0
SERVER_PORT=3001
LOG_LEVEL=info
```

#### Development Environment Variables
```bash
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/jobsearch_dev
SERVER_HOST=localhost
SERVER_PORT=3000
LOG_LEVEL=debug
```

## 🛡️ Security Best Practices

### Secret Management
- ✅ **Never commit secrets to version control**
- ✅ **Use GitHub Secrets for CI/CD variables**
- ✅ **Rotate secrets regularly (quarterly recommended)**
- ✅ **Use environment-specific secrets**
- ✅ **Limit secret access to necessary personnel only**

### Access Control
- ✅ **Enable 2FA for all service accounts**
- ✅ **Use principle of least privilege**
- ✅ **Regular access audits and cleanup**
- ✅ **Monitor secret usage and access logs**

### Encryption Standards
- ✅ **Use AES-256 for data encryption**
- ✅ **Use RSA-2048 or higher for key exchange**
- ✅ **Implement TLS 1.3 for transport encryption**
- ✅ **Use bcrypt or Argon2 for password hashing**

## 📊 CI/CD Pipeline Secrets Usage

### GitHub Actions Workflows

#### 1. CI/CD Workflow (`ci-cd.yml`)
```yaml
env:
  NODE_ENV: ${{ secrets.NODE_ENV }}
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
  SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

#### 2. Quality Gates (`quality-gates.yml`)
```yaml
env:
  SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  CODEQL_LANGUAGE: ${{ secrets.CODEQL_LANGUAGE }}
  SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
```

#### 3. Release Workflow (`release.yml`)
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  DOCKER_HUB_TOKEN: ${{ secrets.DOCKER_HUB_TOKEN }}
  AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
  AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

#### 4. Deployment Workflow (`deploy.yml`)
```yaml
env:
  PRODUCTION_SERVER_HOST: ${{ secrets.PRODUCTION_SERVER_HOST }}
  PRODUCTION_SSH_KEY: ${{ secrets.PRODUCTION_SSH_KEY }}
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

## 🔍 Validation Checklist

### Pre-Deployment Validation
- [ ] All required secrets configured in GitHub repository
- [ ] Database connections tested for all environments
- [ ] SSL certificates valid and properly configured
- [ ] Third-party API keys tested and rate limits verified
- [ ] Monitoring and alerting systems configured
- [ ] Backup and recovery procedures tested

### Security Validation
- [ ] Secret rotation schedule established
- [ ] Access permissions audited and documented
- [ ] Vulnerability scanning enabled and passing
- [ ] Security headers and CSP policies configured
- [ ] Encryption at rest and in transit verified

### Monitoring & Alerting
- [ ] Error tracking (Sentry) configured
- [ ] Performance monitoring (New Relic/Datadog) active
- [ ] Log aggregation and analysis setup
- [ ] Uptime monitoring and alerting configured
- [ ] Security incident response procedures documented

## 📞 Emergency Contacts & Procedures

### Secret Compromise Response
1. **Immediate Actions**:
   - Rotate compromised secrets immediately
   - Review access logs for unauthorized usage
   - Notify security team and stakeholders

2. **Recovery Steps**:
   - Update all affected services with new secrets
   - Monitor for unusual activity
   - Document incident and lessons learned

### Support Contacts
- **DevOps Team**: devops@company.com
- **Security Team**: security@company.com
- **Database Admin**: dba@company.com
- **Infrastructure**: infrastructure@company.com

---

## 🚀 Next Steps

1. **Configure Repository Secrets**: Set up all required secrets in GitHub repository settings
2. **Test CI/CD Pipeline**: Trigger a test deployment to staging environment
3. **Validate Security Scanning**: Ensure all security tools are properly configured
4. **Monitor Deployment**: Verify all services are running correctly
5. **Documentation**: Update runbooks and operational procedures

**Status**: Ready for production deployment once all secrets are configured
**Priority**: High - Required for CI/CD pipeline functionality
**Timeline**: Complete within 1-2 hours before first deployment
