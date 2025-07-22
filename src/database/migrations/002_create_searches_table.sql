-- Create tables for search management and analytics
-- Migration: 002_create_searches_table.sql

CREATE TABLE searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Search identification
  name TEXT, -- User-given name for saved searches
  query TEXT NOT NULL,
  parameters TEXT NOT NULL, -- JSON of search parameters
  
  -- Search execution
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  execution_time_ms INTEGER, -- How long the search took
  
  -- Results metadata
  total_results INTEGER DEFAULT 0,
  new_results INTEGER DEFAULT 0, -- Results not seen before
  pages_scraped INTEGER DEFAULT 0,
  sites_searched TEXT, -- JSON array of sites searched
  
  -- Search configuration
  is_saved BOOLEAN DEFAULT 0, -- Whether this is a saved search
  is_scheduled BOOLEAN DEFAULT 0, -- Whether this search should run automatically
  schedule_expression TEXT, -- Cron expression for scheduled searches
  last_scheduled_run DATETIME,
  next_scheduled_run DATETIME,
  
  -- Notifications
  notify_on_new_results BOOLEAN DEFAULT 0,
  notification_email TEXT,
  notification_webhook TEXT,
  
  -- Metadata
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT DEFAULT 'cli', -- cli, web, api
  
  -- Status
  status TEXT DEFAULT 'active' -- active, paused, disabled, error
);

-- Create search results junction table
CREATE TABLE search_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  found_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  page_number INTEGER DEFAULT 1,
  position_on_page INTEGER,
  relevance_score REAL DEFAULT 1.0,
  
  FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  
  -- Prevent duplicate search-job pairs
  UNIQUE(search_id, job_id)
);

-- Create analytics table for tracking scraping performance
CREATE TABLE scraping_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Session identification
  session_id TEXT NOT NULL, -- UUID for grouping related scraping operations
  search_id INTEGER, -- Associated search if applicable
  
  -- Target information
  site TEXT NOT NULL, -- LinkedIn, Indeed, etc.
  url TEXT NOT NULL,
  page_number INTEGER DEFAULT 1,
  
  -- Performance metrics
  started_at DATETIME NOT NULL,
  completed_at DATETIME,
  duration_ms INTEGER,
  status TEXT NOT NULL, -- success, error, timeout, rate_limited
  
  -- Results
  jobs_found INTEGER DEFAULT 0,
  jobs_new INTEGER DEFAULT 0, -- Jobs not previously seen
  jobs_updated INTEGER DEFAULT 0, -- Existing jobs with updates
  
  -- Technical details
  http_status_code INTEGER,
  response_size_bytes INTEGER,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  user_agent TEXT,
  
  -- Rate limiting
  rate_limited BOOLEAN DEFAULT 0,
  rate_limit_duration_ms INTEGER,
  
  FOREIGN KEY (search_id) REFERENCES searches(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_searches_is_saved ON searches(is_saved);
CREATE INDEX idx_searches_is_scheduled ON searches(is_scheduled);
CREATE INDEX idx_searches_next_scheduled_run ON searches(next_scheduled_run);
CREATE INDEX idx_searches_status ON searches(status);
CREATE INDEX idx_searches_executed_at ON searches(executed_at);

CREATE INDEX idx_search_results_search_id ON search_results(search_id);
CREATE INDEX idx_search_results_job_id ON search_results(job_id);
CREATE INDEX idx_search_results_found_at ON search_results(found_at);

CREATE INDEX idx_scraping_analytics_session_id ON scraping_analytics(session_id);
CREATE INDEX idx_scraping_analytics_site ON scraping_analytics(site);
CREATE INDEX idx_scraping_analytics_started_at ON scraping_analytics(started_at);
CREATE INDEX idx_scraping_analytics_status ON scraping_analytics(status);
CREATE INDEX idx_scraping_analytics_search_id ON scraping_analytics(search_id);

-- Trigger to update updated_at timestamp on searches
CREATE TRIGGER searches_updated_at AFTER UPDATE ON searches BEGIN
  UPDATE searches SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Create a view for search statistics
CREATE VIEW search_stats AS
SELECT 
  s.id,
  s.name,
  s.query,
  s.executed_at,
  s.total_results,
  s.new_results,
  COUNT(sr.job_id) as tracked_results,
  AVG(sr.relevance_score) as avg_relevance,
  s.execution_time_ms,
  s.is_saved,
  s.is_scheduled,
  s.status
FROM searches s
LEFT JOIN search_results sr ON s.id = sr.search_id
GROUP BY s.id, s.name, s.query, s.executed_at, s.total_results, s.new_results, s.execution_time_ms, s.is_saved, s.is_scheduled, s.status;
