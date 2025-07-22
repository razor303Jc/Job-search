-- Create basic jobs table without FTS
-- Migration: 001_create_jobs_table.sql

CREATE TABLE jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Basic job information
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL, -- LinkedIn, Indeed, Glassdoor, etc.
  
  -- Job details
  description TEXT,
  salary TEXT,
  employment_type TEXT, -- Full-time, Part-time, Contract, etc.
  experience_level TEXT, -- Entry, Mid, Senior, Executive
  remote_type TEXT, -- Remote, Hybrid, On-site
  
  -- Extracted metadata
  posted_date TEXT, -- ISO date string
  application_deadline TEXT, -- ISO date string
  company_size TEXT,
  industry TEXT,
  skills TEXT, -- JSON array of skills
  benefits TEXT, -- JSON array of benefits
  
  -- Scraping metadata
  scraped_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confidence_score REAL DEFAULT 1.0, -- 0.0 to 1.0
  has_details BOOLEAN DEFAULT 0,
  raw_data TEXT, -- JSON of raw scraped data
  
  -- Search context
  search_query TEXT, -- Original search query
  search_params TEXT, -- JSON of search parameters
  page_number INTEGER DEFAULT 1,
  position_on_page INTEGER,
  
  -- Status tracking
  status TEXT DEFAULT 'active', -- active, expired, filled, removed
  duplicate_of INTEGER, -- Reference to original job if this is a duplicate
  
  FOREIGN KEY (duplicate_of) REFERENCES jobs(id)
);

-- Create indexes for performance
CREATE INDEX idx_jobs_company ON jobs(company);
CREATE INDEX idx_jobs_location ON jobs(location);
CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_scraped_at ON jobs(scraped_at);
CREATE INDEX idx_jobs_updated_at ON jobs(updated_at);
CREATE INDEX idx_jobs_posted_date ON jobs(posted_date);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_employment_type ON jobs(employment_type);
CREATE INDEX idx_jobs_remote_type ON jobs(remote_type);
CREATE INDEX idx_jobs_search_query ON jobs(search_query);

-- Trigger to update updated_at timestamp
CREATE TRIGGER jobs_updated_at AFTER UPDATE ON jobs 
BEGIN
  UPDATE jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
