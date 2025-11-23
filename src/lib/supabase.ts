import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Server {
  id: string;
  name: string;
  hostname: string;
  provider: string;
  api_key: string;
  status: 'online' | 'offline' | 'warning';
  os_info: Record<string, any>;
  last_seen: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
  notes?: string;
}

export interface ServerMetrics {
  id: string;
  server_id: string;
  cpu_usage: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  disk_total: number;
  disk_used: number;
  disk_percent: number;
  network_sent: number;
  network_recv: number;
  load_average: number[];
  timestamp: string;
}

export interface ServerService {
  id: string;
  server_id: string;
  service_name: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  enabled: boolean;
  port?: number;
  updated_at: string;
}

export interface ServerLog {
  id: string;
  server_id: string;
  log_type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  timestamp: string;
}

export interface ServerCommand {
  id: string;
  server_id: string;
  command_type: 'shutdown' | 'restart' | 'execute';
  command: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  output: string;
  created_at: string;
  executed_at?: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  role: 'admin' | 'user';
  email: string;
  email_notifications: boolean;
  telegram_chat_id: string;
  created_at: string;
  updated_at: string;
}

export interface AlertThreshold {
  id: string;
  server_id: string;
  metric_type: 'cpu' | 'memory' | 'disk';
  threshold_value: number;
  enabled: boolean;
  created_at: string;
}

export interface ServerAlert {
  id: string;
  server_id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  acknowledged: boolean;
  created_at: string;
  acknowledged_at?: string;
}
