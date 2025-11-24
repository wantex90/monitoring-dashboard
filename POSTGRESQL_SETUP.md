# PostgreSQL Setup Guide

Panduan lengkap untuk deploy monitoring dashboard dengan PostgreSQL di VPS sendiri.

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        VPS Server                       │
│                                                         │
│  ┌──────────────┐     ┌──────────────┐                │
│  │   Nginx      │────▶│  Static      │                │
│  │   (Port 80)  │     │  Frontend    │                │
│  └──────┬───────┘     └──────────────┘                │
│         │                                               │
│         │ Proxy /api                                    │
│         ▼                                               │
│  ┌──────────────┐     ┌──────────────┐                │
│  │  Node.js     │────▶│  PostgreSQL  │                │
│  │  Backend API │     │  Database    │                │
│  │  (Port 3001) │     │  (Port 5432) │                │
│  └──────────────┘     └──────────────┘                │
│                                                         │
└─────────────────────────────────────────────────────────┘
                           ▲
                           │
                      Agent Reports
                           │
                  ┌────────┴────────┐
                  │  Monitored      │
                  │  Servers        │
                  └─────────────────┘
```

---

## 📦 What's Included

### Files Created:

1. **setup-postgresql.sh** - Standalone PostgreSQL installer
2. **deploy-vps-postgresql.sh** - Full stack deployment script
3. **src/lib/database.ts** - PostgreSQL database client & operations
4. **server/index.ts** - Express.js backend API server
5. **.env** - Environment configuration (auto-generated)
6. **systemd service** - monitoring-api.service (auto-configured)

### Components:

- **PostgreSQL 15** - Database server
- **Node.js 18** - Runtime for backend
- **Express.js** - REST API framework
- **React + Vite** - Frontend dashboard
- **Nginx** - Web server & reverse proxy
- **Systemd** - Process management

---

## 🚀 Quick Deploy (All-in-One)

### Option 1: Dengan Domain

```bash
# Upload project ke VPS
scp -r ./* root@your-vps-ip:/var/www/monitoring-dashboard/

# SSH dan deploy
ssh root@your-vps-ip
cd /var/www/monitoring-dashboard
chmod +x deploy-vps-postgresql.sh
sudo bash deploy-vps-postgresql.sh yourdomain.com
```

### Option 2: Tanpa Domain (Pakai IP)

```bash
sudo bash deploy-vps-postgresql.sh
```

**Script akan otomatis:**
- ✅ Install PostgreSQL 15
- ✅ Setup database & import schema
- ✅ Install Nginx & Node.js
- ✅ Build frontend & backend
- ✅ Setup systemd service
- ✅ Configure reverse proxy
- ✅ Setup SSL (jika ada domain)

**Durasi: ~10 menit**

---

## 🔧 Manual Setup (Step by Step)

### Step 1: Install PostgreSQL

```bash
chmod +x setup-postgresql.sh
sudo bash setup-postgresql.sh
```

Output:
```
Database: monitoring
User: monitoring_user
Password: [auto-generated]
Connection: postgresql://monitoring_user:password@localhost:5432/monitoring
```

**SAVE PASSWORD!** Akan dipakai untuk backend.

### Step 2: Configure Environment

Edit `.env`:

```bash
DATABASE_URL=postgresql://monitoring_user:PASSWORD_FROM_STEP1@localhost:5432/monitoring
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=monitoring
POSTGRES_USER=monitoring_user
POSTGRES_PASSWORD=PASSWORD_FROM_STEP1
PORT=3001
NODE_ENV=production
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Build Frontend

```bash
npm run build
```

Output di folder `dist/`

### Step 5: Test Backend

```bash
npm run dev:server
```

Check: `http://localhost:3001/health`

Response: `{"status":"ok","timestamp":"..."}`

### Step 6: Setup Systemd Service

```bash
sudo nano /etc/systemd/system/monitoring-api.service
```

Paste:

```ini
[Unit]
Description=Monitoring Dashboard API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/monitoring-dashboard
Environment=NODE_ENV=production
EnvironmentFile=/var/www/monitoring-dashboard/.env
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable monitoring-api
sudo systemctl start monitoring-api
sudo systemctl status monitoring-api
```

### Step 7: Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/monitoring-dashboard
```

Paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/monitoring-dashboard/dist;
    index index.html;

    # Frontend - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Backend API - Reverse proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/monitoring-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 8: Setup SSL (Optional)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🔐 Security Configuration

### PostgreSQL Security

1. **Restrict remote access:**

Edit `/etc/postgresql/15/main/pg_hba.conf`:

```
# Allow only localhost
host    monitoring    monitoring_user    127.0.0.1/32    md5
```

2. **Firewall:**

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny 5432/tcp  # Block PostgreSQL from outside
sudo ufw enable
```

3. **Strong password:**

```bash
sudo -u postgres psql
ALTER USER monitoring_user WITH PASSWORD 'your_very_strong_password';
```

### Application Security

1. **Environment variables:**
   - Never commit `.env` to git
   - Use strong database passwords
   - Rotate credentials regularly

2. **API Authentication:**
   - Backend uses token-based auth
   - Implement JWT for production
   - Add rate limiting

3. **CORS Configuration:**
   - Restrict to your domain only
   - Update `server/index.ts` CORS settings

---

## 📊 Database Management

### Backup Database

```bash
# Manual backup
sudo -u postgres pg_dump monitoring > backup_$(date +%Y%m%d).sql

# Automated daily backup (crontab)
sudo crontab -e
```

Add:
```
0 2 * * * /usr/bin/pg_dump -U monitoring_user monitoring > /backups/monitoring_$(date +\%Y\%m\%d).sql
```

### Restore Database

```bash
sudo -u postgres psql monitoring < backup_20251124.sql
```

### Database Maintenance

```bash
# Connect to database
sudo -u postgres psql -d monitoring

# View all tables
\dt

# Check database size
SELECT pg_size_pretty(pg_database_size('monitoring'));

# Vacuum and analyze
VACUUM ANALYZE;

# View active connections
SELECT * FROM pg_stat_activity WHERE datname = 'monitoring';
```

---

## 🛠 Troubleshooting

### Backend API Not Starting

```bash
# Check logs
sudo journalctl -u monitoring-api -f

# Check if port is in use
sudo netstat -tulpn | grep 3001

# Restart service
sudo systemctl restart monitoring-api
```

### Database Connection Failed

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
psql -U monitoring_user -d monitoring -h localhost

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Nginx 502 Bad Gateway

```bash
# Check if backend is running
curl http://localhost:3001/health

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Test Nginx config
sudo nginx -t
```

### Frontend Not Loading

```bash
# Check if files exist
ls -la /var/www/monitoring-dashboard/dist/

# Rebuild frontend
cd /var/www/monitoring-dashboard
npm run build
sudo systemctl reload nginx
```

---

## 🔄 Update & Maintenance

### Update Application

```bash
cd /var/www/monitoring-dashboard

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Rebuild frontend
npm run build

# Restart backend
sudo systemctl restart monitoring-api

# Reload Nginx
sudo systemctl reload nginx
```

### Update Database Schema

```bash
# Create migration file
nano migrations/update_schema.sql

# Apply migration
sudo -u postgres psql -d monitoring -f migrations/update_schema.sql
```

### Monitor System Resources

```bash
# CPU & Memory
htop

# Disk space
df -h

# Database connections
sudo -u postgres psql -d monitoring -c "SELECT count(*) FROM pg_stat_activity;"

# API server process
ps aux | grep tsx
```

---

## 📝 Useful Commands

### Service Management

```bash
# Backend API
sudo systemctl start monitoring-api
sudo systemctl stop monitoring-api
sudo systemctl restart monitoring-api
sudo systemctl status monitoring-api

# PostgreSQL
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl restart postgresql

# Nginx
sudo systemctl reload nginx
sudo systemctl restart nginx
```

### Logs

```bash
# Backend API logs
sudo journalctl -u monitoring-api -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Database

```bash
# Connect
sudo -u postgres psql -d monitoring

# List tables
\dt

# Describe table
\d servers

# Count records
SELECT COUNT(*) FROM servers;

# Recent metrics
SELECT * FROM server_metrics ORDER BY recorded_at DESC LIMIT 10;

# Active alerts
SELECT * FROM alerts WHERE is_resolved = false;
```

---

## 🚦 Performance Optimization

### PostgreSQL Tuning

Edit `/etc/postgresql/15/main/postgresql.conf`:

```
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

Restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Connection Pooling

Backend sudah pakai connection pooling (pg.Pool):
- Max connections: 20
- Idle timeout: 30s
- Connection timeout: 2s

### Nginx Caching

Add to Nginx config:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api {
    proxy_cache api_cache;
    proxy_cache_valid 200 1m;
    proxy_cache_bypass $http_cache_control;
    # ... other proxy settings
}
```

---

## 📊 Monitoring Stack

### Monitor Database

```bash
# Install pgAdmin (optional)
curl https://www.pgadmin.org/static/packages_pgadmin_org.pub | sudo apt-key add
sudo apt install pgadmin4
```

### Monitor Application

Add monitoring tools:
```bash
# PM2 for process monitoring (alternative to systemd)
npm install -g pm2
pm2 start server/index.ts --name monitoring-api
pm2 startup
pm2 save

# Prometheus + Grafana (advanced)
# See separate documentation
```

---

## ✅ Post-Installation Checklist

- [ ] Database credentials saved securely
- [ ] SSL certificate installed (if using domain)
- [ ] Firewall configured
- [ ] Backup strategy implemented
- [ ] API authentication configured
- [ ] CORS settings updated
- [ ] Monitoring enabled
- [ ] Log rotation configured
- [ ] Auto-updates scheduled
- [ ] Default admin password changed

---

## 🆘 Support & Resources

### Documentation
- PostgreSQL: https://www.postgresql.org/docs/
- Express.js: https://expressjs.com/
- Nginx: https://nginx.org/en/docs/

### Common Issues
- Port conflicts: Change API_PORT in .env
- Memory issues: Adjust PostgreSQL settings
- Slow queries: Add database indexes

---

## 🎉 Success!

Your monitoring dashboard is now running with:
- ✅ PostgreSQL database on your VPS
- ✅ Node.js backend API
- ✅ React frontend
- ✅ Nginx reverse proxy
- ✅ SSL encryption (optional)
- ✅ Systemd service management

**Access your dashboard:**
- Dashboard: `https://yourdomain.com`
- API: `https://yourdomain.com/api`
- Health check: `https://yourdomain.com/api/health`

**Default Login:**
- Email: admin@admin.com
- Password: admin123456

**IMPORTANT:** Change admin password after first login!

---

**Need help?** Check logs:
```bash
sudo journalctl -u monitoring-api -f
```
