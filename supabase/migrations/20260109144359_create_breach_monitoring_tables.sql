/*
  # Create Breach Monitoring System

  1. New Tables
    - `monitored_emails`
      - `id` (uuid, primary key)
      - `email` (text, the email address to monitor)
      - `scan_interval` (text, one of: 'daily', 'hourly', 'every_10_minutes')
      - `last_scan` (timestamptz, when the email was last checked)
      - `is_active` (boolean, whether monitoring is active)
      - `created_at` (timestamptz, when the email was added)
      - `updated_at` (timestamptz, last update time)
    
    - `breach_records`
      - `id` (uuid, primary key)
      - `monitored_email_id` (uuid, foreign key to monitored_emails)
      - `breach_name` (text, unique identifier of the breach)
      - `breach_title` (text, human readable name)
      - `breach_date` (timestamptz, when the breach occurred)
      - `detected_at` (timestamptz, when we detected this breach)
      - `is_new` (boolean, whether this is a newly detected breach)
      - `pwn_count` (integer, number of affected accounts)
      - `data_classes` (jsonb, types of data compromised)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to manage their own monitored emails
*/

-- Create monitored_emails table
CREATE TABLE IF NOT EXISTS monitored_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  scan_interval text NOT NULL DEFAULT 'daily' CHECK (scan_interval IN ('daily', 'hourly', 'every_10_minutes')),
  last_scan timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create breach_records table
CREATE TABLE IF NOT EXISTS breach_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_email_id uuid NOT NULL REFERENCES monitored_emails(id) ON DELETE CASCADE,
  breach_name text NOT NULL,
  breach_title text NOT NULL,
  breach_date timestamptz NOT NULL,
  detected_at timestamptz DEFAULT now(),
  is_new boolean DEFAULT true,
  pwn_count integer DEFAULT 0,
  data_classes jsonb DEFAULT '[]'::jsonb,
  UNIQUE(monitored_email_id, breach_name)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monitored_emails_scan_interval ON monitored_emails(scan_interval);
CREATE INDEX IF NOT EXISTS idx_monitored_emails_last_scan ON monitored_emails(last_scan);
CREATE INDEX IF NOT EXISTS idx_monitored_emails_is_active ON monitored_emails(is_active);
CREATE INDEX IF NOT EXISTS idx_breach_records_monitored_email_id ON breach_records(monitored_email_id);
CREATE INDEX IF NOT EXISTS idx_breach_records_is_new ON breach_records(is_new);

-- Enable RLS
ALTER TABLE monitored_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE breach_records ENABLE ROW LEVEL SECURITY;

-- Since this is a personal app without user authentication,
-- we'll allow all operations for now (public access)
-- If you add authentication later, you should update these policies

CREATE POLICY "Allow all operations on monitored_emails"
  ON monitored_emails
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on breach_records"
  ON breach_records
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_monitored_emails_updated_at
  BEFORE UPDATE ON monitored_emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
