# Server Monitoring Dashboard - PostgreSQL Edition

Full-stack server monitoring dengan PostgreSQL database di VPS sendiri.

---

## 🎯 Features

- ✅ **PostgreSQL Database** - Database di VPS sendiri (bukan cloud)
- ✅ **Node.js Backend** - Express.js REST API
- ✅ **React Frontend** - Modern dashboard UI
- ✅ **Real-time Monitoring** - CPU, RAM, Disk, Network
- ✅ **Service Management** - Monitor services (nginx, mysql, etc)
- ✅ **Remote Commands** - Execute commands via dashboard
- ✅ **Alert System** - Email & Telegram notifications
- ✅ **Multi-user** - Role-based access (superadmin/admin/viewer)
- ✅ **Self-hosted** - 100% di VPS sendiri

---

## 🚀 Quick Deploy (VPS)

### Satu Perintah:

```bash
# Upload project ke VPS
scp -r ./* root@your-vps:/var/www/monitoring-dashboard/

# SSH & deploy
ssh root@your-vps
cd /var/www/monitoring-dashboard
chmod +x deploy-vps-postgresql.sh
sudo bash deploy-vps-postgresql.sh yourdomain.com
```

**Selesai dalam 5 menit!**

Script otomatis install:
- PostgreSQL 15
- Node.js 18 + Express
- Nginx + SSL
- Frontend + Backend
- Systemd service

---

## 📚 Documentation

| File | Description |
|------|-------------|
| `QUICK_START_POSTGRESQL.md` | Panduan cepat deployment |
| `POSTGRESQL_SETUP.md` | Guide lengkap PostgreSQL setup |
| `DEPLOYMENT_GUIDE.md` | Deployment options (VPS/Netlify/Docker) |
| `deploy-vps-postgresql.sh` | Auto installer PostgreSQL + Full stack |
| `setup-postgresql.sh` | Standalone PostgreSQL installer |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────┐
│              VPS Server                 │
│                                         │
│  ┌──────────┐      ┌──────────────┐   │
│  │  Nginx   │─────▶│   Frontend   │   │
│  │  :80     │      │   (React)    │   │
│  └────┬─────┘      └──────────────┘   │
│       │                                 │
│       │ Proxy /api                      │
│       ▼                                 │
│  ┌──────────┐      ┌──────────────┐   │
│  │ Node.js  │─────▶│ PostgreSQL   │   │
│  │ Backend  │      │   Database   │   │
│  │ :3001    │      │   :5432      │   │
│  └──────────┘      └──────────────┘   │
└─────────────────────────────────────────┘
           ▲
           │ HTTP POST /api/metrics
           │
    ┌──────┴──────┐
    │   Agents    │ (Python script di server)
    └─────────────┘
```

---

## 💾 Database Schema

### Tables:

1. **user_profiles** - User accounts & roles
2. **servers** - Registered servers
3. **server_metrics** - CPU, RAM, Disk metrics (time-series)
4. **server_services** - Services status (nginx, mysql, etc)
5. **server_commands** - Remote command execution
6. **alerts** - Alert notifications

**Full schema:** Created automatically by deployment script

---

## 🔧 Technology Stack

### Backend:
- **PostgreSQL 15** - Database
- **Node.js 18** - Runtime
- **Express.js** - REST API framework
- **pg** - PostgreSQL client
- **TypeScript** - Type safety

### Frontend:
- **React 18** - UI framework
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **Lucide Icons** - Icon library

### Infrastructure:
- **Nginx** - Web server & reverse proxy
- **Systemd** - Process management
- **Let's Encrypt** - SSL certificates

---

## 📦 Installation

### Prerequisites:

- VPS dengan Ubuntu 20.04+ atau Debian 10+
- Root access
- Minimal 1GB RAM
- Domain (optional)

### Deployment Options:

#### Option 1: Automatic (Recommended)

```bash
sudo bash deploy-vps-postgresql.sh yourdomain.com
```

#### Option 2: Manual Setup

```bash
# 1. Install PostgreSQL
sudo bash setup-postgresql.sh

# 2. Configure environment
cp .env.example .env
nano .env  # Edit database credentials

# 3. Install dependencies
npm install

# 4. Build frontend
npm run build

# 5. Start backend
npm run dev:server

# 6. Configure Nginx (see POSTGRESQL_SETUP.md)
```

---

## 🔐 Security

### Default Credentials:

**Dashboard:**
- Email: `admin@admin.com`
- Password: `admin123456`

⚠️ **GANTI PASSWORD SETELAH LOGIN PERTAMA!**

### Database Credentials:

Generated automatically saat deployment:
```
Database: monitoring
User: monitoring_user
Password: [auto-generated 25 chars]
```

**SIMPAN CREDENTIALS INI!**

### Firewall:

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw deny 5432/tcp  # Block PostgreSQL from outside
sudo ufw enable
```

---

## 📊 Usage

### 1. Access Dashboard

Browser → `https://yourdomain.com`

### 2. Add Server

Dashboard → Add Server → Input:
- Name: My Server
- Host: server-ip
- Port: 22
- Username: root

Generate agent token → Copy install command

### 3. Install Agent

SSH ke server yang mau dimonitor:

```bash
# Copy-paste command dari dashboard
curl https://yourdomain.com/install-agent.sh | bash -s TOKEN_HERE
```

Agent akan:
- Install Python dependencies
- Create systemd service
- Start sending metrics setiap 30 detik

### 4. Monitor

Dashboard menampilkan:
- CPU, RAM, Disk usage (real-time charts)
- Network traffic
- Running services
- System information
- Alert notifications

---

## 🛠 Management

### Service Commands:

```bash
# Backend API
sudo systemctl status monitoring-api
sudo systemctl restart monitoring-api
sudo journalctl -u monitoring-api -f

# PostgreSQL
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Nginx
sudo systemctl reload nginx
```

### Database Operations:

```bash
# Connect to database
sudo -u postgres psql -d monitoring

# Backup database
sudo -u postgres pg_dump monitoring > backup_$(date +%Y%m%d).sql

# Restore database
sudo -u postgres psql monitoring < backup_20251124.sql
```

### Update Application:

```bash
cd /var/www/monitoring-dashboard
git pull
npm install
npm run build
sudo systemctl restart monitoring-api
```

---

## 🔄 API Endpoints

### Public (Agent Access):

- `POST /api/metrics` - Submit server metrics
- `POST /api/services` - Update service status
- `GET /api/commands?server_id=xxx` - Get pending commands
- `PATCH /api/commands/:id` - Update command result

### Protected (Dashboard):

- `GET /api/servers` - List all servers
- `POST /api/servers` - Add new server
- `GET /api/servers/:id/metrics` - Get metrics
- `POST /api/commands` - Execute remote command
- `GET /api/alerts` - Get alerts

**Authentication:** Bearer token (JWT)

---

## 📈 Performance

### Database Optimization:

- Indexes pada frequently queried columns
- Connection pooling (max 20 connections)
- Automatic cleanup old metrics (retention policy)

### Caching:

- Frontend assets: 1 year cache
- API responses: No cache (real-time)
- Static files: Nginx gzip compression

### Monitoring:

```bash
# Check database size
sudo -u postgres psql -d monitoring -c "SELECT pg_size_pretty(pg_database_size('monitoring'));"

# Active connections
sudo -u postgres psql -d monitoring -c "SELECT count(*) FROM pg_stat_activity;"

# Slow queries
sudo -u postgres psql -d monitoring -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"
```

---

## 🆘 Troubleshooting

### Backend API tidak start:

```bash
# Check logs
sudo journalctl -u monitoring-api -n 50

# Check if port in use
sudo netstat -tulpn | grep 3001

# Check database connection
sudo -u postgres psql -d monitoring
```

### Frontend tidak load:

```bash
# Rebuild
cd /var/www/monitoring-dashboard
npm run build

# Check Nginx
sudo nginx -t
sudo systemctl reload nginx
```

### Database error:

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# View logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Restart
sudo systemctl restart postgresql
```

---

## 🔍 Monitoring the Monitor

### System Resources:

```bash
# CPU & Memory
htop

# Disk space
df -h

# Database size
sudo -u postgres psql -d monitoring -c "SELECT pg_size_pretty(pg_database_size('monitoring'));"
```

### Logs:

```bash
# Real-time API logs
sudo journalctl -u monitoring-api -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

---

## 📝 Configuration

### Environment Variables (`.env`):

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/monitoring
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=monitoring
POSTGRES_USER=monitoring_user
POSTGRES_PASSWORD=your_password
PORT=3001
NODE_ENV=production
```

### Nginx Configuration:

Location: `/etc/nginx/sites-available/monitoring-dashboard`

Reverse proxy `/api` ke `http://localhost:3001`

### Systemd Service:

Location: `/etc/systemd/system/monitoring-api.service`

Auto-restart on failure, startup on boot

---

## 🎯 Roadmap

- [ ] Multi-region support
- [ ] Advanced alerting rules
- [ ] Custom dashboards
- [ ] API rate limiting
- [ ] Prometheus integration
- [ ] Docker compose deployment
- [ ] Kubernetes support

---

## 📄 License

MIT License - Free to use & modify

---

## 🤝 Support

- **Documentation:** See `/docs` folder
- **Issues:** Check logs first (`journalctl -u monitoring-api -f`)
- **Database:** `sudo -u postgres psql -d monitoring`

---

## ✅ Checklist

- [ ] VPS ready (Ubuntu/Debian)
- [ ] Domain pointed to VPS (optional)
- [ ] Project uploaded
- [ ] Deployment script executed
- [ ] Database credentials saved
- [ ] Dashboard accessible
- [ ] Admin password changed
- [ ] First server added
- [ ] Agent installed on server
- [ ] Metrics displaying
- [ ] Firewall configured
- [ ] SSL enabled (if using domain)
- [ ] Backup strategy planned

---

**Selamat! Dashboard monitoring sudah jalan 100% di VPS sendiri!** 🎉

Tidak perlu Supabase cloud, semua database ada di VPS kamu.

**Happy Monitoring!** 🚀
