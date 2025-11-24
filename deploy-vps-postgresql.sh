#!/bin/bash

################################################################################
# Server Monitoring Dashboard - Full Stack VPS Deployment with PostgreSQL
#
# This script will:
# - Install PostgreSQL 15
# - Install Nginx & Node.js
# - Setup database and import schema
# - Build and deploy frontend
# - Setup backend API server
# - Configure systemd service
# - Setup SSL (optional)
#
# Usage: sudo bash deploy-vps-postgresql.sh your-domain.com
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN=${1:-""}
INSTALL_DIR="/var/www/monitoring-dashboard"
NGINX_CONFIG="/etc/nginx/sites-available/monitoring-dashboard"

# Database configuration
DB_NAME="monitoring"
DB_USER="monitoring_user"
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
DB_PORT=5432
API_PORT=3001

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   SERVER MONITORING - FULL STACK VPS DEPLOYMENT           ║
║   PostgreSQL + Node.js Backend + React Frontend           ║
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

# Check domain parameter
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}No domain specified. Using IP address.${NC}"
    SERVER_IP=$(curl -s https://api.ipify.org)
    echo -e "${GREEN}Server IP: $SERVER_IP${NC}"
    read -p "Continue with IP address? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Deployment cancelled. Usage: sudo bash $0 your-domain.com"
        exit 1
    fi
else
    echo -e "${GREEN}Domain: $DOMAIN${NC}"
fi

echo ""
echo -e "${BLUE}Starting full stack deployment...${NC}"
echo ""

# Step 1: Update system
echo -e "${YELLOW}[1/10] Updating system...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
echo -e "${GREEN}✓ System updated${NC}"

# Step 2: Install PostgreSQL
echo -e "${YELLOW}[2/10] Installing PostgreSQL 15...${NC}"
if ! command -v psql &> /dev/null; then
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq
    apt-get install -y postgresql-15 postgresql-contrib-15
    systemctl enable postgresql
    systemctl start postgresql
fi
echo -e "${GREEN}✓ PostgreSQL installed${NC}"

# Step 3: Setup database
echo -e "${YELLOW}[3/10] Setting up database...${NC}"

sudo -u postgres psql << EOSQL
-- Drop if exists (for clean reinstall)
DROP DATABASE IF EXISTS ${DB_NAME};
DROP USER IF EXISTS ${DB_USER};

-- Create user and database
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect and setup
\c ${DB_NAME}

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOSQL

# Import schema
sudo -u postgres psql -d ${DB_NAME} << 'SCHEMA_EOF'
-- User profiles
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('superadmin', 'admin', 'viewer')),
    telegram_chat_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servers
CREATE TABLE servers (
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

-- Server metrics
CREATE TABLE server_metrics (
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

-- Server services
CREATE TABLE server_services (
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

-- Server commands
CREATE TABLE server_commands (
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

-- Alerts
CREATE TABLE alerts (
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

-- Indexes
CREATE INDEX idx_servers_owner ON servers(owner_id);
CREATE INDEX idx_servers_status ON servers(status);
CREATE INDEX idx_servers_agent_token ON servers(agent_token);
CREATE INDEX idx_metrics_server ON server_metrics(server_id);
CREATE INDEX idx_metrics_recorded ON server_metrics(recorded_at DESC);
CREATE INDEX idx_services_server ON server_services(server_id);
CREATE INDEX idx_commands_server ON server_commands(server_id);
CREATE INDEX idx_commands_status ON server_commands(status);
CREATE INDEX idx_alerts_server ON alerts(server_id);
CREATE INDEX idx_alerts_resolved ON alerts(is_resolved);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
SCHEMA_EOF

echo -e "${GREEN}✓ Database configured${NC}"

# Step 4: Install Nginx
echo -e "${YELLOW}[4/10] Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi
echo -e "${GREEN}✓ Nginx installed${NC}"

# Step 5: Install Node.js
echo -e "${YELLOW}[5/10] Installing Node.js 18...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node --version) installed${NC}"

# Step 6: Prepare application
echo -e "${YELLOW}[6/10] Preparing application...${NC}"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Copy files if they exist in parent directory
if [ -f "../package.json" ]; then
    cp -r ../* . 2>/dev/null || true
elif [ ! -f "package.json" ]; then
    echo -e "${RED}✗ Project files not found${NC}"
    echo "Please upload project to $INSTALL_DIR first"
    exit 1
fi

# Create .env file
cat > .env << ENV_EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}
POSTGRES_HOST=localhost
POSTGRES_PORT=${DB_PORT}
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
POSTGRES_PASSWORD=${DB_PASSWORD}
PORT=${API_PORT}
NODE_ENV=production
ENV_EOF

echo -e "${GREEN}✓ Application prepared${NC}"

# Step 7: Build application
echo -e "${YELLOW}[7/10] Building application...${NC}"
npm install --silent
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"

# Step 8: Setup backend service
echo -e "${YELLOW}[8/10] Setting up backend API service...${NC}"

# Create systemd service
cat > /etc/systemd/system/monitoring-api.service << SERVICE_EOF
[Unit]
Description=Monitoring Dashboard API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=monitoring-api

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# Enable and start service
systemctl daemon-reload
systemctl enable monitoring-api
systemctl start monitoring-api

echo -e "${GREEN}✓ Backend service started${NC}"

# Step 9: Configure Nginx
echo -e "${YELLOW}[9/10] Configuring Nginx...${NC}"

if [ -z "$DOMAIN" ]; then
    # IP-based configuration
    cat > $NGINX_CONFIG << 'NGINX_EOF'
server {
    listen 80 default_server;
    server_name _;

    root /var/www/monitoring-dashboard/dist;
    index index.html;

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF
else
    # Domain-based configuration
    cat > $NGINX_CONFIG << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root /var/www/monitoring-dashboard/dist;
    index index.html;

    # Frontend
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF
fi

ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/monitoring-dashboard
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo -e "${GREEN}✓ Nginx configured${NC}"

# Step 10: Setup firewall
echo -e "${YELLOW}[10/10] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full' > /dev/null 2>&1 || true
    ufw allow ${API_PORT}/tcp > /dev/null 2>&1 || true
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ UFW not installed${NC}"
fi

# SSL Setup (if domain provided)
if [ ! -z "$DOMAIN" ]; then
    echo ""
    echo -e "${YELLOW}Setting up SSL certificate...${NC}"

    if ! command -v certbot &> /dev/null; then
        apt-get install -y certbot python3-certbot-nginx
    fi

    read -p "Install SSL certificate now? (y/n): " install_ssl

    if [ "$install_ssl" = "y" ]; then
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --register-unsafely-without-email
        echo -e "${GREEN}✓ SSL certificate installed${NC}"
    fi
fi

# Completion
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║    FULL STACK DEPLOYMENT COMPLETED SUCCESSFULLY!          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

if [ -z "$DOMAIN" ]; then
    echo -e "${GREEN}✓ Dashboard:${NC} ${BLUE}http://$SERVER_IP${NC}"
    echo -e "${GREEN}✓ API:${NC} ${BLUE}http://$SERVER_IP/api${NC}"
else
    if [ "$install_ssl" = "y" ]; then
        echo -e "${GREEN}✓ Dashboard:${NC} ${BLUE}https://$DOMAIN${NC}"
        echo -e "${GREEN}✓ API:${NC} ${BLUE}https://$DOMAIN/api${NC}"
    else
        echo -e "${GREEN}✓ Dashboard:${NC} ${BLUE}http://$DOMAIN${NC}"
        echo -e "${GREEN}✓ API:${NC} ${BLUE}http://$DOMAIN/api${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}Database Info:${NC}"
echo "  Database: ${DB_NAME}"
echo "  User: ${DB_USER}"
echo "  Password: ${DB_PASSWORD}"
echo "  Connection: postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}"
echo ""
echo -e "${RED}⚠ SAVE DATABASE CREDENTIALS SECURELY!${NC}"
echo ""
echo -e "${YELLOW}Service Management:${NC}"
echo "  Check API:     systemctl status monitoring-api"
echo "  Restart API:   systemctl restart monitoring-api"
echo "  View API logs: journalctl -u monitoring-api -f"
echo "  Check Nginx:   systemctl status nginx"
echo "  Check DB:      systemctl status postgresql"
echo ""
echo -e "${YELLOW}Database Commands:${NC}"
echo "  Connect: sudo -u postgres psql -d ${DB_NAME}"
echo "  Backup:  sudo -u postgres pg_dump ${DB_NAME} > backup.sql"
echo "  Restore: sudo -u postgres psql ${DB_NAME} < backup.sql"
echo ""
echo -e "${GREEN}Your monitoring dashboard is ready!${NC}"
echo ""
