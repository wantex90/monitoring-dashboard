# Terminal Setup & Troubleshooting

Panduan lengkap untuk menggunakan fitur Terminal di dashboard monitoring.

---

## 🎯 **Cara Kerja Terminal**

```
Dashboard (Browser)
    ↓ HTTP POST /api/commands
Backend API Server
    ↓ INSERT ke database (status: pending)
PostgreSQL Database
    ↑ Agent poll setiap 5 detik
Python Agent (di server)
    ↓ Execute command
    ↓ UPDATE database (status: completed, output)
Dashboard
    ↑ Poll setiap 1 detik
Display output
```

---

## ⚡ **Quick Start**

### **1. Pastikan Backend API Running**

```bash
# Development
npm run dev:server

# Production (VPS)
sudo systemctl status monitoring-api
```

### **2. Pastikan Agent Installed**

Agent harus running di server yang mau di-remote:

```bash
# Check if agent running
ps aux | grep server-agent.py

# Check agent logs
journalctl -u monitoring-agent -f
```

### **3. Test Terminal**

1. Buka dashboard
2. Pilih server
3. Click icon Terminal
4. Ketik command: `ls -la`
5. Enter / Click Execute
6. Wait ~5-30 seconds
7. Output muncul

---

## 🔧 **Error: Command Timeout**

### **Error Message:**

```
⏱️  Command timeout - no response from server agent

🔧 Troubleshooting:
1. Check if server agent is running: python3 server-agent.py
2. Verify agent token is correct
3. Check server network connectivity
4. View agent logs for errors
```

### **Penyebab & Solusi:**

#### **1. Agent Tidak Running**

**Check:**
```bash
ssh user@server-ip
ps aux | grep server-agent.py
```

**Fix:**
```bash
# Start agent manually
python3 server-agent.py

# Or use systemd service
sudo systemctl start monitoring-agent
sudo systemctl enable monitoring-agent
```

#### **2. Agent Token Salah**

Agent pakai token untuk authenticate ke backend API.

**Check agent config:**
```bash
nano server-agent.py

# Cari baris:
AGENT_TOKEN = "abc123..."
```

**Fix:**
- Token harus sama dengan yang ada di database
- Generate token baru di dashboard → Server → View Token
- Update `AGENT_TOKEN` di agent script
- Restart agent

#### **3. Backend API Tidak Jalan**

**Check:**
```bash
# Test API health
curl http://localhost:3001/health

# Response harus:
{"status":"ok","timestamp":"..."}
```

**Fix:**
```bash
# Restart backend
sudo systemctl restart monitoring-api

# Check logs
sudo journalctl -u monitoring-api -f
```

#### **4. Database Connection Failed**

**Check:**
```bash
# Test PostgreSQL
sudo -u postgres psql -d monitoring

# Inside psql:
SELECT COUNT(*) FROM server_commands WHERE status = 'pending';
```

**Fix:**
```bash
# Restart PostgreSQL
sudo systemctl restart postgresql

# Check connection string in .env
cat /var/www/monitoring-dashboard/.env | grep DATABASE_URL
```

#### **5. Network Issues**

Agent tidak bisa reach backend API.

**Check:**
```bash
# From server yang dimonitor
curl -I https://yourdomain.com/api/health

# Atau
curl -I http://your-vps-ip:3001/health
```

**Fix:**
- Pastikan firewall allow port 80/443
- Pastikan domain/IP correct
- Check Nginx proxy configuration

---

## 🔍 **Debugging Step by Step**

### **Step 1: Verify Backend API**

```bash
# SSH ke VPS dashboard
ssh root@dashboard-vps-ip

# Check API status
sudo systemctl status monitoring-api

# Test endpoint
curl http://localhost:3001/health
```

**Expected output:**
```json
{"status":"ok","timestamp":"2025-11-24T..."}
```

### **Step 2: Verify Database**

```bash
# Connect to database
sudo -u postgres psql -d monitoring

# Check servers table
SELECT id, name, agent_token, status FROM servers;

# Check pending commands
SELECT * FROM server_commands WHERE status = 'pending';

# Exit
\q
```

### **Step 3: Verify Agent**

```bash
# SSH ke server yang dimonitor
ssh user@monitored-server-ip

# Check if agent running
ps aux | grep server-agent.py

# Check agent file
cat server-agent.py | grep API_URL
cat server-agent.py | grep AGENT_TOKEN
```

### **Step 4: Test Command Manually**

```bash
# Di server yang dimonitor
# Stop agent dulu
pkill -f server-agent.py

# Run manual dengan debug
python3 server-agent.py
```

Watch output untuk errors.

### **Step 5: Test End-to-End**

```bash
# Create command via API
curl -X POST http://localhost:3001/api/commands \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "server_id": "uuid-here",
    "command": "echo hello"
  }'

# Check database
sudo -u postgres psql -d monitoring -c \
  "SELECT * FROM server_commands ORDER BY created_at DESC LIMIT 1;"

# Wait for agent to process (5-30 seconds)

# Check result
sudo -u postgres psql -d monitoring -c \
  "SELECT * FROM server_commands ORDER BY created_at DESC LIMIT 1;"
```

**Status should change:**
- `pending` → `completed` (success)
- `pending` → `failed` (error)

---

## 📊 **Agent Configuration**

### **Minimal Agent Script:**

```python
import requests
import subprocess
import time
import json

API_URL = "https://yourdomain.com/api"  # Or http://ip:3001/api
AGENT_TOKEN = "your-server-agent-token-here"
SERVER_ID = "uuid-of-this-server"

headers = {
    'X-Agent-Token': AGENT_TOKEN,
    'Content-Type': 'application/json'
}

while True:
    try:
        # Get pending commands
        response = requests.get(
            f"{API_URL}/servers/{SERVER_ID}/commands?status=pending",
            headers=headers,
            timeout=10
        )

        if response.ok:
            commands = response.json()

            for cmd in commands:
                # Execute command
                result = subprocess.run(
                    cmd['command'],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=300
                )

                # Update result
                requests.patch(
                    f"{API_URL}/commands/{cmd['id']}",
                    headers=headers,
                    json={
                        'status': 'completed' if result.returncode == 0 else 'failed',
                        'output': result.stdout + result.stderr,
                        'exit_code': result.returncode
                    }
                )

        time.sleep(5)  # Poll every 5 seconds

    except Exception as e:
        print(f"Error: {e}")
        time.sleep(10)
```

### **Environment Variables:**

Bisa juga pakai environment variables:

```bash
export API_URL="https://yourdomain.com/api"
export AGENT_TOKEN="your-token"
export SERVER_ID="uuid"

python3 server-agent.py
```

```python
import os

API_URL = os.getenv('API_URL', 'http://localhost:3001/api')
AGENT_TOKEN = os.getenv('AGENT_TOKEN')
SERVER_ID = os.getenv('SERVER_ID')
```

---

## 🚀 **Production Setup**

### **1. Create Systemd Service**

```bash
sudo nano /etc/systemd/system/monitoring-agent.service
```

```ini
[Unit]
Description=Server Monitoring Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/monitoring
Environment="API_URL=https://yourdomain.com/api"
Environment="AGENT_TOKEN=your-token-here"
Environment="SERVER_ID=uuid-here"
ExecStart=/usr/bin/python3 /opt/monitoring/server-agent.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### **2. Enable & Start**

```bash
sudo systemctl daemon-reload
sudo systemctl enable monitoring-agent
sudo systemctl start monitoring-agent
sudo systemctl status monitoring-agent
```

### **3. View Logs**

```bash
# Real-time logs
sudo journalctl -u monitoring-agent -f

# Last 100 lines
sudo journalctl -u monitoring-agent -n 100

# Errors only
sudo journalctl -u monitoring-agent -p err
```

---

## 🔐 **Security Notes**

### **1. Command Execution Risks**

Terminal execute commands as **root** (atau user yang run agent).

**Risks:**
- Malicious commands dapat destroy server
- Sensitive data bisa leaked
- System bisa di-compromise

**Mitigations:**
- Restrict terminal access ke trusted admins only
- Log semua commands yang executed
- Implement command whitelist/blacklist
- Review commands before execution

### **2. Agent Token Security**

Agent token = full access ke execute commands.

**Best Practices:**
- Generate strong random tokens (32+ chars)
- Rotate tokens regularly
- Store tokens securely (environment variables)
- Never commit tokens to git
- Use different token per server

### **3. API Security**

**Backend API protection:**
- JWT authentication untuk dashboard
- Agent token verification
- Rate limiting
- Input validation
- SQL injection prevention (parameterized queries)

---

## 📝 **Common Commands**

### **Safe Commands:**

```bash
# System info
ls -la
pwd
whoami
hostname
uname -a
df -h
free -h
top -bn1

# Service status
systemctl status nginx
systemctl status postgresql
systemctl list-units --type=service

# Logs
tail -n 50 /var/log/nginx/error.log
journalctl -u nginx -n 50

# Network
netstat -tulpn
ss -tulpn
ip addr show
```

### **Dangerous Commands (Use with Caution):**

```bash
# System changes
systemctl restart nginx
systemctl stop postgresql
reboot
shutdown -h now

# File operations
rm -rf /path/to/dir
chmod 777 /path
chown user:group /path

# Package management
apt-get update
apt-get upgrade
apt-get install package
```

---

## 🎯 **Best Practices**

### **1. Command Logging**

Log semua commands untuk audit:

```sql
SELECT
  c.command,
  c.status,
  c.executed_at,
  s.name as server_name,
  u.email as executed_by
FROM server_commands c
JOIN servers s ON c.server_id = s.id
LEFT JOIN user_profiles u ON c.executed_by = u.user_id
ORDER BY c.created_at DESC
LIMIT 100;
```

### **2. Command Timeouts**

Set timeout untuk prevent hanging:

```python
result = subprocess.run(
    cmd['command'],
    shell=True,
    capture_output=True,
    text=True,
    timeout=300  # 5 minutes max
)
```

### **3. Error Handling**

Agent harus robust dan continue running on errors:

```python
while True:
    try:
        # Process commands
        pass
    except requests.RequestException as e:
        print(f"Network error: {e}")
        time.sleep(30)  # Wait longer on network errors
    except Exception as e:
        print(f"Unexpected error: {e}")
        time.sleep(10)
```

### **4. Health Checks**

Agent report health status:

```python
# Periodic health check
last_health_check = time.time()

if time.time() - last_health_check > 60:
    requests.post(
        f"{API_URL}/servers/{SERVER_ID}/heartbeat",
        headers=headers
    )
    last_health_check = time.time()
```

---

## ✅ **Checklist**

- [ ] Backend API running (`systemctl status monitoring-api`)
- [ ] PostgreSQL running (`systemctl status postgresql`)
- [ ] Agent installed on monitored server
- [ ] Agent token configured correctly
- [ ] Agent service running (`systemctl status monitoring-agent`)
- [ ] Network connectivity verified
- [ ] API URL correct in agent config
- [ ] Test command executed successfully
- [ ] Logs monitored for errors
- [ ] Security measures implemented

---

## 🆘 **Still Having Issues?**

### **Quick Diagnostic:**

```bash
# On dashboard VPS
curl http://localhost:3001/health

# On monitored server
curl https://yourdomain.com/api/health

# Check database
sudo -u postgres psql -d monitoring -c \
  "SELECT COUNT(*) FROM server_commands WHERE status = 'pending';"

# Check agent logs
sudo journalctl -u monitoring-agent -n 50
```

### **Get Help:**

1. Check logs first (backend + agent)
2. Verify all components running
3. Test each component individually
4. Check network connectivity
5. Review configuration

---

**Terminal fixed!** Sekarang commands bisa diexecute remote via dashboard. 🚀
