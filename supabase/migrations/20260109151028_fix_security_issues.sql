/*
  # Fix Security Issues

  ## Changes Made

  1. **Remove Unused Indexes**
     - Drop `idx_monitored_emails_scan_interval` (not used by queries)
     - Drop `idx_monitored_emails_last_scan` (not used by queries)
     - Drop `idx_monitored_emails_is_active` (not used by queries)
     - Drop `idx_breach_records_monitored_email_id` (foreign key already indexed)
     - Drop `idx_breach_records_is_new` (not used by queries)

  2. **Fix Function Security**
     - Update `update_updated_at_column` function with immutable search_path
     - Add SECURITY DEFINER and explicit search_path to prevent injection attacks

  3. **Fix RLS Policies (CRITICAL)**
     - Drop insecure "Allow all operations" policies that use USING (true)
     - Replace with restrictive policies that only allow service_role access
     - Service_role bypasses RLS for edge function operations
     - This ensures data is only accessible through authenticated API calls
     - Anonymous users cannot directly access or modify data

  ## Security Impact

  - **Before**: Anyone could read/write all data (RLS completely bypassed)
  - **After**: Only authenticated edge functions can access data
  - Data is now properly secured against unauthorized access
*/

-- Drop unused indexes to reduce overhead
DROP INDEX IF EXISTS idx_monitored_emails_scan_interval;
DROP INDEX IF EXISTS idx_monitored_emails_last_scan;
DROP INDEX IF EXISTS idx_monitored_emails_is_active;
DROP INDEX IF EXISTS idx_breach_records_monitored_email_id;
DROP INDEX IF EXISTS idx_breach_records_is_new;

-- Fix function to have immutable search_path (prevents security vulnerabilities)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop insecure policies that allow unrestricted access
DROP POLICY IF EXISTS "Allow all operations on monitored_emails" ON monitored_emails;
DROP POLICY IF EXISTS "Allow all operations on breach_records" ON breach_records;

-- Create secure policies that restrict access to service_role only
-- Service role is used by edge functions and bypasses RLS for backend operations
-- This ensures data can only be accessed through authenticated API endpoints

CREATE POLICY "Service role can manage monitored_emails"
  ON monitored_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage breach_records"
  ON breach_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Note: If you want to add user authentication in the future, you should:
-- 1. Add a user_id column to monitored_emails
-- 2. Create policies like: USING (auth.uid() = user_id)
-- 3. Replace service_role policies with authenticated user policies
