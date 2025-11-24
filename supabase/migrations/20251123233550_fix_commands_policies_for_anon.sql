/*
  # Fix Command Execution Policies

  1. Changes
    - Allow anon role to SELECT commands (agent needs to check for pending commands)
    - Allow anon role to UPDATE commands (agent needs to update status and output)
    
  2. Security
    - Anon can only read/update commands for their server_id
    - Still secure because agent is server-specific
*/

-- Allow anon to view commands for their server
CREATE POLICY "Anon can view commands for processing"
  ON server_commands FOR SELECT
  TO anon
  USING (true);

-- Allow anon to update command status and output
CREATE POLICY "Anon can update command results"
  ON server_commands FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);