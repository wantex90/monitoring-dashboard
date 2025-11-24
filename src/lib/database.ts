import { Pool, QueryResult } from 'pg';

// Database connection pool
let pool: Pool | null = null;

// Initialize database connection
export function initDatabase(connectionString?: string) {
  const dbUrl = connectionString || import.meta.env.VITE_DATABASE_URL || process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('Database connection string is required. Please set DATABASE_URL environment variable.');
  }

  pool = new Pool({
    connectionString: dbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  return pool;
}

// Get database pool instance
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

// Query helper
export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const client = await getPool().connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

// Transaction helper
export async function transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Close database connection
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Database interfaces matching PostgreSQL schema
export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  agent_token: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  last_seen: string | null;
  os_type: string | null;
  os_version: string | null;
  kernel_version: string | null;
  hostname: string | null;
  cpu_model: string | null;
  total_cpu_cores: number | null;
  total_ram_gb: number | null;
  total_disk_gb: number | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ServerMetrics {
  id: string;
  server_id: string;
  cpu_percent: number;
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  disk_percent: number;
  disk_used_gb: number;
  disk_total_gb: number;
  network_rx_bytes: bigint;
  network_tx_bytes: bigint;
  uptime_seconds: bigint;
  load_average: any;
  recorded_at: string;
}

export interface ServerService {
  id: string;
  server_id: string;
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'unknown';
  pid: number | null;
  cpu_percent: number | null;
  ram_mb: number | null;
  uptime_seconds: bigint | null;
  last_checked: string;
}

export interface ServerCommand {
  id: string;
  server_id: string;
  command: string;
  output: string | null;
  exit_code: number | null;
  executed_by: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'superadmin' | 'admin' | 'viewer';
  telegram_chat_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  server_id: string;
  type: 'cpu' | 'ram' | 'disk' | 'service' | 'offline' | 'custom';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number | null;
  current_value: number | null;
  is_resolved: boolean;
  resolved_at: string | null;
  notified: boolean;
  created_at: string;
}

// Database operations
export const db = {
  // Servers
  async getServers(ownerId?: string): Promise<Server[]> {
    const sql = ownerId
      ? 'SELECT * FROM servers WHERE owner_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM servers ORDER BY created_at DESC';
    const params = ownerId ? [ownerId] : [];
    const result = await query<Server>(sql, params);
    return result.rows;
  },

  async getServerById(id: string): Promise<Server | null> {
    const result = await query<Server>('SELECT * FROM servers WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async createServer(server: Partial<Server>): Promise<Server> {
    const sql = `
      INSERT INTO servers (name, host, port, username, agent_token, owner_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await query<Server>(sql, [
      server.name,
      server.host,
      server.port || 22,
      server.username,
      server.agent_token,
      server.owner_id,
      server.status || 'offline',
    ]);
    return result.rows[0];
  },

  async updateServer(id: string, updates: Partial<Server>): Promise<Server> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');

    const sql = `UPDATE servers SET ${setClause} WHERE id = $1 RETURNING *`;
    const result = await query<Server>(sql, [id, ...values]);
    return result.rows[0];
  },

  async deleteServer(id: string): Promise<void> {
    await query('DELETE FROM servers WHERE id = $1', [id]);
  },

  // Metrics
  async getServerMetrics(serverId: string, limit = 100): Promise<ServerMetrics[]> {
    const sql = `
      SELECT * FROM server_metrics
      WHERE server_id = $1
      ORDER BY recorded_at DESC
      LIMIT $2
    `;
    const result = await query<ServerMetrics>(sql, [serverId, limit]);
    return result.rows;
  },

  async addMetrics(metrics: Partial<ServerMetrics>): Promise<ServerMetrics> {
    const sql = `
      INSERT INTO server_metrics (
        server_id, cpu_percent, ram_percent, ram_used_gb, ram_total_gb,
        disk_percent, disk_used_gb, disk_total_gb, network_rx_bytes,
        network_tx_bytes, uptime_seconds, load_average
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    const result = await query<ServerMetrics>(sql, [
      metrics.server_id,
      metrics.cpu_percent,
      metrics.ram_percent,
      metrics.ram_used_gb,
      metrics.ram_total_gb,
      metrics.disk_percent,
      metrics.disk_used_gb,
      metrics.disk_total_gb,
      metrics.network_rx_bytes,
      metrics.network_tx_bytes,
      metrics.uptime_seconds,
      JSON.stringify(metrics.load_average),
    ]);
    return result.rows[0];
  },

  // Services
  async getServerServices(serverId: string): Promise<ServerService[]> {
    const sql = 'SELECT * FROM server_services WHERE server_id = $1 ORDER BY name';
    const result = await query<ServerService>(sql, [serverId]);
    return result.rows;
  },

  async upsertService(service: Partial<ServerService>): Promise<ServerService> {
    const sql = `
      INSERT INTO server_services (
        server_id, name, status, pid, cpu_percent, ram_mb, uptime_seconds
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (server_id, name)
      DO UPDATE SET
        status = EXCLUDED.status,
        pid = EXCLUDED.pid,
        cpu_percent = EXCLUDED.cpu_percent,
        ram_mb = EXCLUDED.ram_mb,
        uptime_seconds = EXCLUDED.uptime_seconds,
        last_checked = NOW()
      RETURNING *
    `;
    const result = await query<ServerService>(sql, [
      service.server_id,
      service.name,
      service.status,
      service.pid,
      service.cpu_percent,
      service.ram_mb,
      service.uptime_seconds,
    ]);
    return result.rows[0];
  },

  // Commands
  async getServerCommands(serverId: string, limit = 50): Promise<ServerCommand[]> {
    const sql = `
      SELECT * FROM server_commands
      WHERE server_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await query<ServerCommand>(sql, [serverId, limit]);
    return result.rows;
  },

  async getCommandById(id: string): Promise<ServerCommand | null> {
    const result = await query<ServerCommand>('SELECT * FROM server_commands WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async createCommand(command: Partial<ServerCommand>): Promise<ServerCommand> {
    const sql = `
      INSERT INTO server_commands (server_id, command, executed_by, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query<ServerCommand>(sql, [
      command.server_id,
      command.command,
      command.executed_by,
      command.status || 'pending',
    ]);
    return result.rows[0];
  },

  async updateCommand(id: string, updates: Partial<ServerCommand>): Promise<ServerCommand> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');

    const sql = `UPDATE server_commands SET ${setClause} WHERE id = $1 RETURNING *`;
    const result = await query<ServerCommand>(sql, [id, ...values]);
    return result.rows[0];
  },

  // Alerts
  async getAlerts(serverId?: string, resolved = false): Promise<Alert[]> {
    const sql = serverId
      ? 'SELECT * FROM alerts WHERE server_id = $1 AND is_resolved = $2 ORDER BY created_at DESC'
      : 'SELECT * FROM alerts WHERE is_resolved = $1 ORDER BY created_at DESC';
    const params = serverId ? [serverId, resolved] : [resolved];
    const result = await query<Alert>(sql, params);
    return result.rows;
  },

  async createAlert(alert: Partial<Alert>): Promise<Alert> {
    const sql = `
      INSERT INTO alerts (
        server_id, type, severity, message, threshold, current_value
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await query<Alert>(sql, [
      alert.server_id,
      alert.type,
      alert.severity,
      alert.message,
      alert.threshold,
      alert.current_value,
    ]);
    return result.rows[0];
  },

  async resolveAlert(id: string): Promise<Alert> {
    const sql = `
      UPDATE alerts
      SET is_resolved = true, resolved_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await query<Alert>(sql, [id]);
    return result.rows[0];
  },

  // Users
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const result = await query<UserProfile>(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  },

  async createUserProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
    const sql = `
      INSERT INTO user_profiles (user_id, email, full_name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query<UserProfile>(sql, [
      profile.user_id,
      profile.email,
      profile.full_name,
      profile.role || 'viewer',
    ]);
    return result.rows[0];
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');

    const sql = `UPDATE user_profiles SET ${setClause} WHERE user_id = $1 RETURNING *`;
    const result = await query<UserProfile>(sql, [userId, ...values]);
    return result.rows[0];
  },
};
