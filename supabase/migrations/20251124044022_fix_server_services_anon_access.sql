/*
  # Fix Server Services RLS for Anonymous Access

  This migration adds RLS policies to allow anonymous users (agents) to upsert service data.

  ## Changes
  - Add policy for anon users to INSERT services
  - Add policy for anon users to UPDATE services
  - Agents use anon key and need these permissions to report service status
*/

-- Allow anon (agents) to insert new service records
CREATE POLICY "Agents can insert services"
  ON server_services
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon (agents) to update existing service records
CREATE POLICY "Agents can update services"
  ON server_services
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);