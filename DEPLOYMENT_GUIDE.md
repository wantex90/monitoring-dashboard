# Deployment Guide - Server Monitoring Dashboard

Panduan lengkap deploy aplikasi monitoring ke hosting sendiri.

---

## 📋 Requirements

- **Web Server**: Nginx/Apache (VPS) atau Static Hosting
- **Node.js**: v18+ (untuk build)
- **Domain**: Domain sendiri (opsional, bisa pakai IP)
- **SSL Certificate**: Let's Encrypt (recommended)

---

## 🚀 Option 1: VPS Deployment (Ubuntu/Debian)

### Step 1: Persiapan Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Nginx
sudo apt install nginx -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Verify installation
node --version
npm --version
```

### Step 2: Upload & Build Project

```bash
# Clone atau upload project ke server
cd /var/www
sudo mkdir monitoring-dashboard
sudo chown $USER:$USER monitoring-dashboard
cd monitoring-dashboard

# Upload files via Git
git clone <your-repo-url> .

# Or upload via SCP/SFTP
# scp -r ./dist/* user@server:/var/www/monitoring-dashboard/

# Install dependencies & build
npm install
npm run build

# Build output ada di folder dist/
```

### Step 3: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/monitoring-dashboard
```

**Paste konfigurasi ini:**

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/monitoring-dashboard/dist;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Cache static assets
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

**Enable site:**

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/monitoring-dashboard /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 4: Setup SSL (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal test
sudo certbot renew --dry-run
```

### Step 5: Setup Firewall

```bash
# Allow HTTP & HTTPS
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## 🚀 Option 2: Static Hosting (Netlify/Vercel)

### Netlify Deployment

1. **Build project locally:**
   ```bash
   npm run build
   ```

2. **Deploy via Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=dist
   ```

3. **Or drag & drop:**
   - Login ke [Netlify](https://netlify.com)
   - Drag folder `dist/` ke dashboard
   - Done!

**Netlify Configuration** (`netlify.toml`):

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd /path/to/project
vercel --prod
```

**Vercel Configuration** (`vercel.json`):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 🚀 Option 3: Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### nginx.conf (for Docker)

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Docker Commands

```bash
# Build image
docker build -t monitoring-dashboard .

# Run container
docker run -d -p 80:80 --name monitoring monitoring-dashboard

# With docker-compose
docker-compose up -d
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
```

---

## 🚀 Option 4: cPanel Shared Hosting

### Step 1: Build Locally

```bash
npm run build
# Output: dist/ folder
```

### Step 2: Upload via FTP/cPanel

1. Login ke cPanel
2. Buka **File Manager**
3. Navigate ke `public_html/`
4. Upload semua file dari folder `dist/`
5. Extract jika upload sebagai zip

### Step 3: Setup .htaccess

Create `.htaccess` di `public_html/`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# Enable Gzip compression
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript application/json
</IfModule>

# Browser caching
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType image/jpg "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/gif "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
</IfModule>
```

---

## ⚙️ Environment Configuration

**IMPORTANT:** Update Supabase URL di `src/lib/supabase.ts`:

```typescript
const supabaseUrl = 'https://wtxuzwkxabhojtarjtmz.supabase.co';
const supabaseAnonKey = 'your-anon-key-here';
```

Atau gunakan environment variables (`.env`):

```bash
VITE_SUPABASE_URL=https://wtxuzwkxabhojtarjtmz.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Update `src/lib/supabase.ts`:

```typescript
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

---

## 🔒 Security Checklist

- [ ] Enable HTTPS/SSL
- [ ] Setup firewall rules
- [ ] Configure CORS di Supabase
- [ ] Restrict database RLS policies
- [ ] Enable rate limiting di Nginx
- [ ] Setup monitoring & backups
- [ ] Use strong admin password
- [ ] Regular security updates

---

## 🔧 Troubleshooting

### 404 Error on Refresh

**Solution:** Configure rewrites untuk SPA routing

- **Nginx:** `try_files $uri $uri/ /index.html;`
- **Apache:** `.htaccess` dengan RewriteRule
- **Netlify/Vercel:** Sudah auto-configured

### API Connection Failed

**Check:**
1. Supabase URL & Key benar
2. CORS enabled di Supabase
3. Firewall tidak block port 443
4. Network connectivity

### Assets Not Loading

**Check:**
1. File permissions: `chmod -R 755 dist/`
2. Nginx config: `root` path benar
3. Clear browser cache
4. Check console errors

---

## 📊 Performance Optimization

### Enable Gzip Compression

**Nginx:**
```nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript;
```

**Apache (.htaccess):**
```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>
```

### Enable Browser Caching

**Nginx:**
```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### CDN Setup (Optional)

- Cloudflare (Free)
- AWS CloudFront
- BunnyCDN

---

## 📱 Update/Redeploy

### VPS:

```bash
cd /var/www/monitoring-dashboard
git pull origin main
npm install
npm run build
sudo systemctl restart nginx
```

### Docker:

```bash
docker-compose down
docker-compose up -d --build
```

### Static Hosting:

```bash
npm run build
netlify deploy --prod --dir=dist
# or
vercel --prod
```

---

## 🆘 Support

- Check logs: `sudo journalctl -u nginx -f`
- Test config: `sudo nginx -t`
- Check permissions: `ls -la /var/www/monitoring-dashboard`
- Monitor resources: `htop`

---

## ✅ Post-Deployment Checklist

- [ ] Website accessible via domain
- [ ] HTTPS enabled and working
- [ ] Dashboard loads correctly
- [ ] Login/authentication works
- [ ] Server metrics displaying
- [ ] Agent installation script downloadable
- [ ] Edge functions responding
- [ ] Services status updating

---

**Need help?** Check application logs or Supabase dashboard for errors.
