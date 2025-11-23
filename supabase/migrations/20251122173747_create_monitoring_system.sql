/*
  # Monitoring System Database Schema

  1. New Tables
    - `servers`
      - `id` (uuid, primary key)
      - `name` (text) - Server name/identifier
      - `hostname` (text) - Server hostname/IP
      - `provider` (text) - Cloud provider name
      - `api_key` (text) - Unique key for agent authentication
      - `status` (text) - online, offline, warning
      - `os_info` (jsonb) - Operating system information
      - `last_seen` (timestamptz) - Last metric received
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `server_metrics`
      - `id` (uuid, primary key)
      - `server_id` (uuid, foreign key)
      - `cpu_usage` (numeric) - CPU percentage
      - `memory_total` (bigint) - Total memory in bytes
      - `memory_used` (bigint) - Used memory in bytes
      - `memory_percent` (numeric) - Memory usage percentage
      - `disk_total` (bigint) - Total disk in bytes
      - `disk_used` (bigint) - Used disk in bytes
      - `disk_percent` (numeric) - Disk usage percentage
      - `network_sent` (bigint) - Network bytes sent
      - `network_recv` (bigint) - Network bytes received
      - `load_average` (jsonb) - System load average [1, 5, 15]
      - `timestamp` (timestamptz)
    
    - `server_services`
      - `id` (uuid, primary key)
      - `server_id` (uuid, foreign key)
      - `service_name` (text) - Service name (nginx, mysql, etc)
      - `status` (text) - running, stopped, failed
      - `enabled` (boolean) - Auto-start enabled
      - `port` (integer) - Service port if applicable
      - `updated_at` (timestamptz)
    
    - `server_logs`
      - `id` (uuid, primary key)
      - `server_id` (uuid, foreign key)
      - `log_type` (text) - system, application, error
      - `severity` (text) - info, warning, error, critical
      - `message` (text)
      - `source` (text) - Log source/file
      - `timestamp` (timestamptz)
    
    - `server_commands`
      - `id` (uuid, primary key)
      - `server_id` (uuid, foreign key)
      - `command_type` (text) - shutdown, restart, execute
      - `command` (text) - Command to execute
      - `status` (text) - pending, executing, completed, failed
      - `output` (text) - Command output
      - `created_at` (timestamptz)
      - `executed_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their servers
    - Public access for agent to send metrics using API key

  3. Indexes
    - Index on server_id for faster queries
    - Index on timestamp for metrics and logs
    - Index on api_key for agent authentication

  4. Important Notes
    - Agents authenticate using api_key stored in servers table
    - Metrics are stored with timestamps for historical analysis
    - Commands table allows async command execution
    - Services are monitored per server
*/

-- Create servers table
CREATE TABLE IF NOT EXISTS servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  hostname text NOT NULL,
  provider text DEFAULT '',
  api_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'warning')),
  os_info jsonb DEFAULT '{}',
  last_seen timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create server_metrics table
CREATE TABLE IF NOT EXISTS server_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  cpu_usage numeric DEFAULT 0,
  memory_total bigint DEFAULT 0,
  memory_used bigint DEFAULT 0,
  memory_percent numeric DEFAULT 0,
  disk_total bigint DEFAULT 0,
  disk_used bigint DEFAULT 0,
  disk_percent numeric DEFAULT 0,
  network_sent bigint DEFAULT 0,
  network_recv bigint DEFAULT 0,
  load_average jsonb DEFAULT '[]',
  timestamp timestamptz DEFAULT now()
);

-- Create server_services table
CREATE TABLE IF NOT EXISTS server_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  status text DEFAULT 'unknown' CHECK (status IN ('running', 'stopped', 'failed', 'unknown')),
  enabled boolean DEFAULT false,
  port integer,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(server_id, service_name)
);

-- Create server_logs table
CREATE TABLE IF NOT EXISTS server_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  log_type text DEFAULT 'system',
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message text NOT NULL,
  source text DEFAULT '',
  timestamp timestamptz DEFAULT now()
);

-- Create server_commands table
CREATE TABLE IF NOT EXISTS server_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  command_type text NOT NULL CHECK (command_type IN ('shutdown', 'restart', 'execute')),
  command text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'executing', 'completed', 'failed')),
  output text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  executed_at timestamptz
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_server_metrics_server_id ON server_metrics(server_id);
CREATE INDEX IF NOT EXISTS idx_server_metrics_timestamp ON server_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_server_services_server_id ON server_services(server_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_server_id ON server_logs(server_id);
CREATE INDEX IF NOT EXISTS idx_server_logs_timestamp ON server_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_server_commands_server_id ON server_commands(server_id);
CREATE INDEX IF NOT EXISTS idx_server_commands_status ON server_commands(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_servers_api_key ON servers(api_key);

-- Enable Row Level Security
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_commands ENABLE ROW LEVEL SECURITY;

-- RLS Policies for servers
CREATE POLICY "Authenticated users can view all servers"
  ON servers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert servers"
  ON servers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update servers"
  ON servers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete servers"
  ON servers FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for server_metrics
CREATE POLICY "Authenticated users can view all metrics"
  ON server_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert metrics"
  ON server_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);

-- RLS Policies for server_services
CREATE POLICY "Authenticated users can view all services"
  ON server_services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage services"
  ON server_services FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for server_logs
CREATE POLICY "Authenticated users can view all logs"
  ON server_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert logs"
  ON server_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- RLS Policies for server_commands
CREATE POLICY "Authenticated users can view all commands"
  ON server_commands FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert commands"
  ON server_commands FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role can update commands"
  ON server_commands FOR UPDATE
  TO service_role
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

-- Triggers for updated_at
CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON servers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_server_services_updated_at
  BEFORE UPDATE ON server_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();