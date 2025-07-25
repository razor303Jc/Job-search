-- Migration: Create alert_deliveries table for tracking notification history
-- Description: Track when and how alerts are delivered to users
-- Version: 005
-- Dependencies: 004_create_job_alerts_table.sql

CREATE TABLE IF NOT EXISTS alert_deliveries (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    delivery_method TEXT NOT NULL, -- 'email', 'push', 'sms'
    delivery_status TEXT NOT NULL, -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
    delivery_details TEXT, -- JSON string with delivery metadata
    job_data TEXT, -- JSON string with matched job information
    error_message TEXT,
    delivered_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (alert_id) REFERENCES job_alerts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert_id ON alert_deliveries(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_user_id ON alert_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON alert_deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_method ON alert_deliveries(delivery_method);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_delivered_at ON alert_deliveries(delivered_at);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_created_at ON alert_deliveries(created_at);
