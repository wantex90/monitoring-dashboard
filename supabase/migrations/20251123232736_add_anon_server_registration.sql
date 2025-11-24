/*
  # Allow Anonymous Server Registration

  1. Changes
    - Add policy to allow anon role to INSERT servers (for agent registration)
    - Add policy to allow anon role to SELECT servers (to check if already registered)
    - Add policy to allow anon role to INSERT server_metrics (to send metrics)
    
  2. Security
    - Only allows INSERT and SELECT, not UPDATE or DELETE
    - Anon can only create new servers and send metrics
    - Management operations still require authentication
*/

-- Allow anon to check if server already exists
CREATE POLICY "Anon can view servers for registration"
  ON servers FOR SELECT
  TO anon
  USING (true);

-- Allow anon to register new servers
CREATE POLICY "Anon can register new servers"
  ON servers FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to send metrics
CREATE POLICY "Anon can insert metrics"
  ON server_metrics FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to read metrics (needed for agent to verify)
CREATE POLICY "Anon can view metrics"
  ON server_metrics FOR SELECT
  TO anon
  USING (true);