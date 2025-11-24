# Quick Start - PostgreSQL di VPS

Panduan singkat deploy monitoring dashboard dengan PostgreSQL di VPS sendiri.

---

## 🚀 Deployment Super Cepat (5 Menit)

### 1. Upload Project ke VPS

```bash
# Dari komputer lokal
scp -r ./* root@ip-vps-kamu:/var/www/monitoring-dashboard/
```

### 2. Deploy All-in-One

```bash
# SSH ke VPS
ssh root@ip-vps-kamu

# Masuk folder
cd /var/www/monitoring-dashboard

# Jalankan installer
chmod +x deploy-vps-postgresql.sh
sudo bash deploy-vps-postgresql.sh domain-kamu.com

# Atau tanpa domain (pakai IP):
sudo bash deploy-vps-postgresql.sh
```

### 3. Selesai!

Script otomatis install & setup:
- ✅ PostgreSQL 15
- ✅ Database + Schema
- ✅ Node.js + Nginx
- ✅ Frontend + Backend
- ✅ Systemd Service
- ✅ SSL Certificate (optional)

**Akses Dashboard:**
- `https://domain-kamu.com`
- atau `http://ip-vps-kamu`

**Login:**
- Email: `admin@admin.com`
- Password: `admin123456`

---

## 📋 Setelah Deploy

### Save Database Credentials

Script akan menampilkan:
```
Database: monitoring
User: monitoring_user
Password: abc123xyz...
```

**SIMPAN PASSWORD INI!**

### Ganti Password Admin

Login ke dashboard → User Management → Change password

### Check Status

```bash
# Backend API
sudo systemctl status monitoring-api

# PostgreSQL
sudo systemctl status postgresql

# Nginx
sudo systemctl status nginx
```

### View Logs

```bash
# API logs (real-time)
sudo journalctl -u monitoring-api -f

# Nginx errors
sudo tail -f /var/log/nginx/error.log
```

---

## 🔧 Management Commands

### Restart Services

```bash
# Restart API server
sudo systemctl restart monitoring-api

# Restart Nginx
sudo systemctl reload nginx

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Database Access

```bash
# Connect to database
sudo -u postgres psql -d monitoring

# Inside psql:
\dt                    # List tables
SELECT * FROM servers; # Query data
\q                     # Exit
```

### Update Application

```bash
cd /var/www/monitoring-dashboard

# Pull updates (jika pakai git)
git pull

# Install dependencies
npm install

# Rebuild
npm run build

# Restart API
sudo systemctl restart monitoring-api
```

---

## 📊 Architecture

```
Internet
   │
   ▼
Nginx (Port 80/443)
   │
   ├─▶ Frontend (Static Files) → /dist/
   │
   └─▶ Backend API (Port 3001) → /api
          │
          ▼
      PostgreSQL (Port 5432)
```

**Data Flow:**
1. Browser → Nginx (reverse proxy)
2. Nginx → Frontend (React app)
3. Frontend → Backend API (`/api`)
4. Backend → PostgreSQL Database
5. Agent → Backend API → PostgreSQL

---

## 🛡 Security Tips

1. **Ganti default password** setelah login pertama
2. **Setup firewall:**
   ```bash
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   sudo ufw enable
   ```
3. **Backup database rutin:**
   ```bash
   sudo -u postgres pg_dump monitoring > backup.sql
   ```
4. **Monitor logs:**
   ```bash
   sudo journalctl -u monitoring-api -f
   ```

---

## 🆘 Troubleshooting

### Backend tidak jalan?

```bash
# Check logs
sudo journalctl -u monitoring-api -n 50

# Restart
sudo systemctl restart monitoring-api
```

### Database error?

```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Test connection
sudo -u postgres psql -d monitoring
```

### Frontend tidak load?

```bash
# Rebuild
cd /var/www/monitoring-dashboard
npm run build
sudo systemctl reload nginx
```

---

## 📝 Files Yang Dibuat

| File | Lokasi | Purpose |
|------|--------|---------|
| Database | `/var/lib/postgresql/15/main/` | PostgreSQL data |
| Frontend | `/var/www/monitoring-dashboard/dist/` | React build |
| Backend | `/var/www/monitoring-dashboard/server/` | API server |
| Config | `/var/www/monitoring-dashboard/.env` | Environment vars |
| Service | `/etc/systemd/system/monitoring-api.service` | Systemd service |
| Nginx | `/etc/nginx/sites-available/monitoring-dashboard` | Web server config |

---

## ✅ Checklist Post-Deployment

- [ ] Dashboard bisa diakses
- [ ] Login berhasil
- [ ] Database credentials disimpan
- [ ] Password admin diganti
- [ ] SSL/HTTPS aktif (jika pakai domain)
- [ ] Firewall dikonfigurasi
- [ ] Backup strategy dibuat
- [ ] Logs dimonitor

---

## 📚 Dokumentasi Lengkap

- **Full Guide:** `POSTGRESQL_SETUP.md`
- **Deployment:** `DEPLOYMENT_GUIDE.md`

---

## 🎉 Success!

Dashboard monitoring sekarang 100% running di VPS sendiri!

**Tidak perlu:**
- ❌ Supabase cloud
- ❌ External database service
- ❌ Third-party hosting

**Semua di VPS:**
- ✅ PostgreSQL database
- ✅ Backend API
- ✅ Frontend dashboard
- ✅ Full control

**Happy Monitoring!** 🚀
