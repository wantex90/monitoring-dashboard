# SSH Installer Service

Separate backend service untuk handle automatic SSH installation.

## Setup

### 1. Install Dependencies
```bash
pip3 install -r requirements-installer.txt
```

### 2. Set Environment Variables (Optional)
```bash
export SUPABASE_URL="https://ctfzlgsazqzzewnahvao.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
```

### 3. Run Service
```bash
python3 ssh-installer-service.py
```

Service runs on `http://0.0.0.0:5000`

## API Endpoint

### POST /install
Install agent via SSH

**Request:**
```json
{
  "hostname": "192.168.1.100",
  "port": 22,
  "username": "root",
  "password": "your-password"
}
```

**Response (Success):**
```json
{
  "success": true,
  "log": "... installation logs ...",
  "message": "Agent installed successfully"
}
```

## Deploy Options

### Option 1: Run on VPS
```bash
# Install
git clone ...
cd project
pip3 install -r requirements-installer.txt

# Run with systemd
sudo nano /etc/systemd/system/ssh-installer.service
```

```ini
[Unit]
Description=SSH Installer Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ssh-installer
Environment="SUPABASE_URL=https://..."
Environment="SUPABASE_ANON_KEY=..."
ExecStart=/usr/bin/python3 ssh-installer-service.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ssh-installer
sudo systemctl start ssh-installer
```

### Option 2: Docker
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements-installer.txt .
RUN pip install -r requirements-installer.txt
COPY ssh-installer-service.py .
EXPOSE 5000
CMD ["python3", "ssh-installer-service.py"]
```

### Option 3: Railway/Render
Deploy `ssh-installer-service.py` dengan requirements-installer.txt

## Frontend Integration

Update frontend to call this service instead of edge function:

```typescript
const SSH_INSTALLER_URL = 'https://your-installer-service.com/install';

const { data } = await fetch(SSH_INSTALLER_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ hostname, port, username, password })
});
```
