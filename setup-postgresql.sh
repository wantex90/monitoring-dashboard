#!/bin/bash

################################################################################
# PostgreSQL Setup Script for VPS
#
# This script will:
# - Install PostgreSQL 15
# - Create database and user
# - Import schema from Supabase migrations
# - Configure secure access
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DB_NAME="monitoring"
DB_USER="monitoring_user"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
DB_PORT=5432

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║           POSTGRESQL SETUP FOR MONITORING APP             ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo bash $0"
    exit 1
fi

echo -e "${BLUE}Starting PostgreSQL installation...${NC}"
echo ""

# Step 1: Install PostgreSQL
echo -e "${YELLOW}[1/6] Installing PostgreSQL 15...${NC}"

# Add PostgreSQL repository
apt-get install -y wget ca-certificates
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list

apt-get update -qq
apt-get install -y postgresql-15 postgresql-contrib-15

echo -e "${GREEN}✓ PostgreSQL installed${NC}"

# Step 2: Start PostgreSQL
echo -e "${YELLOW}[2/6] Starting PostgreSQL service...${NC}"
systemctl enable postgresql
systemctl start postgresql
echo -e "${GREEN}✓ PostgreSQL started${NC}"

# Step 3: Create database and user
echo -e "${YELLOW}[3/6] Creating database and user...${NC}"

sudo -u postgres psql << EOSQL
-- Create user
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to database and setup extensions
\c ${DB_NAME}

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOSQL

echo -e "${GREEN}✓ Database created${NC}"

# Step 4: Import schema
echo -e "${YELLOW}[4/6] Importing database schema...${NC}"

# Create combined migration file
cat > /tmp/init_schema.sql << 'SCHEMA_EOF'
-- Combined schema from Supabase migrations

-- User profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('superadmin', 'admin', 'viewer')),
    telegram_chat_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    username TEXT NOT NULL,
    agent_token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'warning', 'error')),
    last_seen TIMESTAMPTZ,
    os_type TEXT,
    os_version TEXT,
    kernel_version TEXT,
    hostname TEXT,
    cpu_model TEXT,
    total_cpu_cores INTEGER,
    total_ram_gb NUMERIC(10,2),
    total_disk_gb NUMERIC(10,2),
    owner_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server metrics table
CREATE TABLE IF NOT EXISTS server_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    cpu_percent NUMERIC(5,2),
    ram_percent NUMERIC(5,2),
    ram_used_gb NUMERIC(10,2),
    ram_total_gb NUMERIC(10,2),
    disk_percent NUMERIC(5,2),
    disk_used_gb NUMERIC(10,2),
    disk_total_gb NUMERIC(10,2),
    network_rx_bytes BIGINT,
    network_tx_bytes BIGINT,
    uptime_seconds BIGINT,
    load_average JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server services table
CREATE TABLE IF NOT EXISTS server_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'stopped', 'failed', 'unknown')),
    pid INTEGER,
    cpu_percent NUMERIC(5,2),
    ram_mb NUMERIC(10,2),
    uptime_seconds BIGINT,
    last_checked TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(server_id, name)
);

-- Server commands table
CREATE TABLE IF NOT EXISTS server_commands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    output TEXT,
    exit_code INTEGER,
    executed_by UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('cpu', 'ram', 'disk', 'service', 'offline', 'custom')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    threshold NUMERIC(5,2),
    current_value NUMERIC(10,2),
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_agent_token ON servers(agent_token);
CREATE INDEX IF NOT EXISTS idx_metrics_server ON server_metrics(server_id);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON server_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_server ON server_services(server_id);
CREATE INDEX IF NOT EXISTS idx_commands_server ON server_commands(server_id);
CREATE INDEX IF NOT EXISTS idx_commands_status ON server_commands(status);
CREATE INDEX IF NOT EXISTS idx_alerts_server ON alerts(server_id);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(is_resolved);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

SCHEMA_EOF

# Import schema
sudo -u postgres psql -d ${DB_NAME} -f /tmp/init_schema.sql

echo -e "${GREEN}✓ Schema imported${NC}"

# Step 5: Configure PostgreSQL for remote access (if needed)
echo -e "${YELLOW}[5/6] Configuring PostgreSQL...${NC}"

PG_HBA="/etc/postgresql/15/main/pg_hba.conf"
PG_CONF="/etc/postgresql/15/main/postgresql.conf"

# Backup original configs
cp $PG_HBA ${PG_HBA}.backup
cp $PG_CONF ${PG_CONF}.backup

# Allow local connections
if ! grep -q "host ${DB_NAME} ${DB_USER} 127.0.0.1/32 md5" $PG_HBA; then
    echo "host ${DB_NAME} ${DB_USER} 127.0.0.1/32 md5" >> $PG_HBA
fi

# Enable listening on localhost
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = 'localhost'/" $PG_CONF

# Restart PostgreSQL
systemctl restart postgresql

echo -e "${GREEN}✓ PostgreSQL configured${NC}"

# Step 6: Create .env file
echo -e "${YELLOW}[6/6] Creating environment configuration...${NC}"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

cat > ${SCRIPT_DIR}/.env.local << ENV_EOF
# PostgreSQL Database Configuration
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}
POSTGRES_HOST=localhost
POSTGRES_PORT=${DB_PORT}
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}

# Application Configuration
NODE_ENV=production
ENV_EOF

echo -e "${GREEN}✓ Environment file created${NC}"

# Completion
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║        POSTGRESQL SETUP COMPLETED SUCCESSFULLY!           ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${YELLOW}Database Credentials:${NC}"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo "  Password: ${DB_PASSWORD}"
echo "  Port: ${DB_PORT}"
echo ""
echo -e "${YELLOW}Connection String:${NC}"
echo -e "  ${BLUE}postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}${NC}"
echo ""
echo -e "${RED}⚠ IMPORTANT: Save these credentials securely!${NC}"
echo ""
echo -e "${YELLOW}Configuration file created at:${NC}"
echo "  ${SCRIPT_DIR}/.env.local"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  Connect to DB:  sudo -u postgres psql -d ${DB_NAME}"
echo "  Check status:   sudo systemctl status postgresql"
echo "  View logs:      sudo journalctl -u postgresql -f"
echo "  Restart DB:     sudo systemctl restart postgresql"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Copy .env.local to your project directory"
echo "  2. Update application to use PostgreSQL connection"
echo "  3. Test database connection"
echo ""
echo -e "${GREEN}PostgreSQL is ready to use!${NC}"
echo ""
