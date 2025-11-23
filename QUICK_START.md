# Quick Start - SSH Installer Service

## Option 1: Local Testing (Quick!)

```bash
# Install dependencies
pip3 install flask flask-cors paramiko

# Run service
python3 ssh-installer-service.py
```

Service starts on `http://localhost:5000`

Frontend automatically connects to `localhost:5000` for development.

## Option 2: Deploy to Production

### Railway (Recommended - Free)

1. Push to GitHub
2. Go to [Railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub"
4. Select your repo
5. Add environment variables:
   - `SUPABASE_URL`: Your Supabase URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key
6. Railway auto-detects Python and runs the service
7. Get your Railway URL (e.g., `https://xxx.railway.app`)

Update `.env` in frontend:
```bash
VITE_SSH_INSTALLER_URL=https://your-app.railway.app/install
```

### VPS (DigitalOcean, AWS, etc)

```bash
# SSH to your VPS
ssh user@your-vps-ip

# Install dependencies
sudo apt update
sudo apt install python3-pip
pip3 install -r requirements-installer.txt

# Run as systemd service
sudo nano /etc/systemd/system/ssh-installer.service
```

Paste:
```ini
[Unit]
Description=SSH Installer Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ssh-installer
Environment="SUPABASE_URL=https://ctfzlgsazqzzewnahvao.supabase.co"
Environment="SUPABASE_ANON_KEY=your-anon-key"
ExecStart=/usr/bin/python3 /opt/ssh-installer/ssh-installer-service.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ssh-installer
sudo systemctl start ssh-installer
sudo systemctl status ssh-installer
```

Update `.env`:
```bash
VITE_SSH_INSTALLER_URL=http://your-vps-ip:5000/install
```

## Test Installation

```bash
curl -X POST http://localhost:5000/install \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "192.168.1.100",
    "port": 22,
    "username": "root",
    "password": "your-password"
  }'
```

## Without Installer Service

If you don't want to run the installer service, just use **Manual mode**:

1. Click "Add Server"
2. Switch to "Manual" tab
3. Copy installation command
4. SSH to target server
5. Run the command
6. Agent auto-registers!

Done! 🚀
