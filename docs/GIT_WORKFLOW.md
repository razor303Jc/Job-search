# Git Workflow & Branch Protection

This document outlines our Git workflow and branch protection strategy.

## Branch Structure

```
main (production)
  ↑
stage (staging)
  ↑
dev (development)
```

## Branch Workflow

### Development Branch (`dev`)

- **Purpose**: Active development and feature integration
- **Protection**: Require pull request reviews, status checks must pass
- **Auto-deployment**: Development environment
- **Auto-promotion**: Creates PR to `stage` after successful build

### Staging Branch (`stage`)

- **Purpose**: Pre-production testing and validation
- **Protection**: Require pull request reviews, status checks must pass, dismiss stale reviews
- **Auto-deployment**: Staging environment
- **Auto-promotion**: Creates PR to `main` after successful build (requires manual approval)

### Main Branch (`main`)

- **Purpose**: Production-ready code
- **Protection**: Require pull request reviews, status checks must pass, dismiss stale reviews, require review from CODEOWNERS
- **Auto-deployment**: Production environment
- **Manual approval**: Required for all merges

## CI/CD Pipeline

### Quality Gates (All Branches)

- ✅ Linting (Biome)
- ✅ Type checking (TypeScript)
- ✅ Unit tests (Vitest)
- ✅ Integration tests

### Extended Gates (Stage & Main)

- ✅ End-to-end tests (Playwright)
- ✅ Docker build & push
- ✅ Security scanning

### Auto-Merge Logic

1. **Dev → Stage**
   - Triggered: Push to `dev` with passing quality checks
   - Action: Auto-create PR to `stage`
   - Merge: Manual approval required

2. **Stage → Main**
   - Triggered: Push to `stage` with passing all checks
   - Action: Auto-create PR to `main`
   - Merge: Manual approval + CODEOWNERS review required

## Environment Deployments

| Branch  | Environment | Auto-Deploy | Access        |
| ------- | ----------- | ----------- | ------------- |
| `dev`   | Development | ✅          | Internal team |
| `stage` | Staging     | ✅          | Stakeholders  |
| `main`  | Production  | ✅          | Public        |

## GitHub Repository Settings

To enable this workflow, configure these repository settings:

### Branch Protection Rules

#### For `main` branch:

```
☑ Require a pull request before merging
  ☑ Require approvals (1)
  ☑ Dismiss stale PR approvals when new commits are pushed
  ☑ Require review from CODEOWNERS
☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  ☑ quality
  ☑ e2e
  ☑ build
☑ Require conversation resolution before merging
☑ Include administrators
```

#### For `stage` branch:

```
☑ Require a pull request before merging
  ☑ Require approvals (1)
  ☑ Dismiss stale PR approvals when new commits are pushed
☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  ☑ quality
  ☑ e2e
  ☑ build
☑ Require conversation resolution before merging
```

#### For `dev` branch:

```
☑ Require a pull request before merging
☑ Require status checks to pass before merging
  ☑ Require branches to be up to date before merging
  ☑ quality
☑ Require conversation resolution before merging
```

### Environment Protection Rules

#### Development Environment:

- No restrictions
- Auto-deployment from `dev` branch

#### Staging Environment:

- Required reviewers: Development team
- Auto-deployment from `stage` branch

#### Production Environment:

- Required reviewers: Lead developers + CODEOWNERS
- Wait timer: 5 minutes
- Auto-deployment from `main` branch

## Usage Examples

### Feature Development

```bash
# Start feature development
git checkout dev
git pull origin dev
git checkout -b feature/new-scraper

# Make changes and commit
git add .
git commit -m "feat: add new job board scraper"

# Push and create PR to dev
git push origin feature/new-scraper
# Create PR: feature/new-scraper → dev
```

### Hotfix to Production

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# Fix and commit
git add .
git commit -m "fix: resolve critical job parsing issue"

# Push and create PR to main
git push origin hotfix/critical-bug
# Create PR: hotfix/critical-bug → main
```

### Release Process

1. Features merged to `dev` via PRs
2. `dev` builds → auto-creates PR to `stage`
3. Manual approval → `stage` deploys to staging
4. Testing on staging environment
5. `stage` builds → auto-creates PR to `main`
6. Manual approval + CODEOWNERS review → `main` deploys to production

This workflow ensures code quality, proper testing, and controlled releases while enabling rapid development cycles.
