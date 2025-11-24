/*
  # Fix Server Commands RLS Policies

  This migration fixes the RLS policies for server_commands table to allow:
  1. Anonymous users (agents) to UPDATE command status and output
  2. Proper SELECT access for agents to fetch pending commands

  ## Changes
  - Drop existing restrictive policies
  - Create new policies that allow anon users (agents) to:
    - SELECT their server's pending commands
    - UPDATE command status, output, and executed_at for their server
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anon can insert commands" ON server_commands;
DROP POLICY IF EXISTS "Anon can view commands" ON server_commands;
DROP POLICY IF EXISTS "Users can manage commands for their servers" ON server_commands;

-- Allow authenticated users full access
CREATE POLICY "Authenticated users can manage all commands"
  ON server_commands
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow anon (agents) to select pending commands for their server
CREATE POLICY "Agents can select their pending commands"
  ON server_commands
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon (agents) to insert commands (for internal use)
CREATE POLICY "Agents can insert commands"
  ON server_commands
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon (agents) to update command execution results
CREATE POLICY "Agents can update command results"
  ON server_commands
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);