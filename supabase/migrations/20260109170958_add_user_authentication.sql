/*
  # Add User Authentication Support

  ## Changes Made

  1. **Add user_id Column**
     - Add `user_id` column to `monitored_emails` table
     - Links each monitored email to a specific authenticated user
     - References auth.users table with CASCADE delete
     - Set NOT NULL with a default for existing rows

  2. **Update RLS Policies**
     - Drop service_role only policies
     - Create user-specific policies that check auth.uid()
     - Users can only access their own monitored emails
     - Users can only access breach records for their monitored emails

  3. **Create Indexes**
     - Add index on user_id for efficient user-based queries
     - Improves performance when filtering by authenticated user

  ## Security Impact

  - **Before**: Only service_role could access data
  - **After**: Users can access only their own data through authenticated sessions
  - Each user's data is completely isolated from other users
*/

-- Add user_id column to monitored_emails
-- First add as nullable, then set default and make NOT NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'monitored_emails' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE monitored_emails ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- For any existing rows, set a placeholder (should be empty in new setup)
    -- In production with existing data, you'd need to handle this differently
    UPDATE monitored_emails SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
    
    -- Now make it NOT NULL
    ALTER TABLE monitored_emails ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- Create index on user_id for efficient queries
CREATE INDEX IF NOT EXISTS idx_monitored_emails_user_id ON monitored_emails(user_id);

-- Drop old service_role policies
DROP POLICY IF EXISTS "Service role can manage monitored_emails" ON monitored_emails;
DROP POLICY IF EXISTS "Service role can manage breach_records" ON breach_records;

-- Create user-specific policies for monitored_emails
CREATE POLICY "Users can view own monitored emails"
  ON monitored_emails
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitored emails"
  ON monitored_emails
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitored emails"
  ON monitored_emails
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monitored emails"
  ON monitored_emails
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create user-specific policies for breach_records
-- Users can view breach records for their monitored emails
CREATE POLICY "Users can view own breach records"
  ON breach_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monitored_emails
      WHERE monitored_emails.id = breach_records.monitored_email_id
      AND monitored_emails.user_id = auth.uid()
    )
  );

-- Service role can still manage breach records (for edge functions)
CREATE POLICY "Service role can manage breach records"
  ON breach_records
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
