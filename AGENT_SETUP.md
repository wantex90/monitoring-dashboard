# Server Monitoring Agent - Setup Guide

Complete guide for installing and configuring the server monitoring agent.

## Quick Install (Recommended)

One-command installation for all Linux distributions:

```bash
curl -sSL https://your-domain.com/install-agent.sh | sudo bash
```

Or download and run:

```bash
wget https://your-domain.com/install-agent.sh
sudo bash install-agent.sh
```

**Supported Operating Systems:**
- Ubuntu / Debian / Linux Mint
- CentOS / RHEL / AlmaLinux / Rocky Linux
- Fedora
- openSUSE / SLES
- Arch Linux / Manjaro
- Alpine Linux

The installer will automatically:
- Detect your OS and distribution
- Install Python 3 and required dependencies
- Install monitoring agent
- Create systemd service
- Enable auto-start on boot

After installation, follow the **Configuration** section below.

---

## Manual Installation (Alternative)

If you prefer manual installation or the quick install doesn't work:

### Prerequisites

Server requirements:
- **Python 3.7+** installed
- **pip** (Python package manager)
- **systemd** (for auto-start service)
- **SSH access** with sudo permissions

### Step 1: Copy Files to Server

```bash
# From your local machine
scp install-agent.sh root@YOUR_SERVER_IP:/root/
ssh root@YOUR_SERVER_IP

# Run installer
sudo bash install-agent.sh
```

---

## Configuration

After installation (both quick or manual):

### Step 1: Add Server in Dashboard

1. Login to monitoring dashboard:
   - URL: `http://your-dashboard-url.com`
   - Email: `admin@admin.com`
   - Password: `admin123456`

2. Click **"Add Server"** button

3. Fill in server details:
   ```
   Name: Production Server 01
   Host: 192.168.1.100 (IP or hostname)
   SSH User: root (or user with sudo)
   SSH Password: your_ssh_password
   SSH Port: 22
   ```

4. Click **"Add Server"**

5. **Copy the Server ID** from the URL or server card
   - Example: `?server=abc123def456`
   - Server ID is: `abc123def456`

### Step 2: Configure Agent

On your server, run:

```bash
sudo /opt/server-monitor/configure.sh
```

When prompted, enter your Server ID:
```
Enter Server ID: abc123def456
```

### Step 3: Start Agent

```bash
sudo systemctl start monitor-agent
```

### Step 4: Verify Installation

Check if agent is running:

```bash
sudo systemctl status monitor-agent
```

Expected output:
```
● monitor-agent.service - Server Monitoring Agent
     Loaded: loaded (/etc/systemd/system/monitor-agent.service; enabled)
     Active: active (running) since...
```

View real-time logs:

```bash
sudo journalctl -u monitor-agent -f
```

Expected logs:
```
✓ Metrics sent - CPU: 15.2% | RAM: 45.8% | Disk: 32.1%
✓ Updated 7 services
```

---

## Verify in Dashboard

1. Refresh dashboard web page
2. Server card should display:
   - **Status**: Online (green)
   - **CPU, RAM, Disk usage**: Real-time data
   - **Services**: List of detected services
   - **Last Seen**: "Just now" or recent timestamp

---

## Management Commands

### Stop Agent
```bash
systemctl stop monitor-agent
```

### Start Agent
```bash
systemctl start monitor-agent
```

### Restart Agent
```bash
systemctl restart monitor-agent
```

### Disable Auto-Start
```bash
systemctl disable monitor-agent
```

### View Logs
```bash
# Real-time logs
journalctl -u monitor-agent -f

# Last 100 lines
journalctl -u monitor-agent -n 100

# Logs from today
journalctl -u monitor-agent --since today
```

---

## Testing Terminal Feature

After agent is running:

1. Click **Terminal** icon on server card
2. Type command, examples:
   ```
   df -h
   free -m
   uptime
   ps aux | head -20
   ```
3. Press **Enter**
4. Agent will execute and return results in 5-10 seconds

### Command Timeout

- Commands timeout after **60 seconds**
- If command doesn't finish, you'll see "Command timed out" error
- For long-running commands, use SSH directly

---

## What Agent Monitors

- CPU Usage (percentage)
- Memory Usage (total, used, percent)
- Disk Usage (total, used, percent)
- Network Traffic (sent/received bytes)
- System Load Average
- Services Status (nginx, mysql, redis, docker, etc)

## Services Monitored

Default monitored services:
- nginx
- apache2
- mysql
- postgresql
- redis-server
- docker
- sshd

To customize, edit line 100 in `server-agent.py`:
```python
services = ['nginx', 'apache2', 'mysql', 'postgresql',
            'redis-server', 'docker', 'sshd', 'YOUR_SERVICE']
```

---

## Security Notes

1. **SSH Credentials**: Stored encrypted in database
2. **Agent Communication**: Via HTTPS to Supabase
3. **Command Execution**: Only from authenticated admin users
4. **Sudo Permission**: Agent needs sudo for service restart

### Recommended Security Settings

1. **Firewall**: Allow only outbound HTTPS (port 443)
2. **SSH**: Use SSH key auth instead of password
3. **User**: Create dedicated user for agent (not root)
4. **Monitoring**: Review command logs regularly

---

## Multi-Server Setup

To monitor multiple servers:

1. Repeat **Step 1** to add new server
2. Copy `server-agent.py` to new server
3. **IMPORTANT**: Use different **SERVER_ID** for each server
4. Install and configure as per Steps 2-4

---

## Troubleshooting

### Agent not sending metrics

**Check 1**: Is agent running?
```bash
systemctl status monitor-agent
```

**Check 2**: View logs
```bash
journalctl -u monitor-agent -n 50
```

**Check 3**: Is Server ID correct?
- Verify in database or dashboard URL

### Commands not being sent

**Check 1**: Is agent checking commands?
```bash
journalctl -u monitor-agent -f
# Look for: "✓ Updated X services"
```

**Check 2**: Network connection?
```bash
ping 8.8.8.8
curl https://ctfzlgsazqzzewnahvao.supabase.co
```

### Service detection inaccurate

**Issue**: Some services not detected
**Solution**: Edit `server-agent.py` line 100 and add service names

---

## Uninstall

```bash
# Stop and disable service
systemctl stop monitor-agent
systemctl disable monitor-agent

# Remove service file
rm /etc/systemd/system/monitor-agent.service

# Reload systemd
systemctl daemon-reload

# Remove agent file
rm /root/server-agent.py

# Remove from dashboard (use dashboard UI)
```

---

## Support

If you encounter issues:
1. Check logs: `journalctl -u monitor-agent -n 100`
2. Verify credentials in dashboard
3. Test network connectivity
4. Review security settings (firewall, SELinux)

---

**Happy Monitoring!**
