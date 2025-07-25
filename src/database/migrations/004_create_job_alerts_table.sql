-- Migration: Create job_alerts table for job notification system
-- Description: User-defined job alert criteria and management
-- Version: 004
-- Dependencies: 003_create_users_table.sql

CREATE TABLE IF NOT EXISTS job_alerts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    criteria TEXT NOT NULL, -- JSON string containing AlertCriteria
    is_active BOOLEAN DEFAULT 1,
    frequency TEXT DEFAULT 'daily', -- 'immediate', 'daily', 'weekly'
    last_triggered DATETIME,
    total_notifications INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_alerts_user_id ON job_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_job_alerts_active ON job_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_job_alerts_frequency ON job_alerts(frequency);
CREATE INDEX IF NOT EXISTS idx_job_alerts_last_triggered ON job_alerts(last_triggered);
CREATE INDEX IF NOT EXISTS idx_job_alerts_created_at ON job_alerts(created_at);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_job_alerts_updated_at 
    AFTER UPDATE ON job_alerts 
    FOR EACH ROW 
    BEGIN
        UPDATE job_alerts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
