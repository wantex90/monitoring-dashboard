# Server Monitoring Agent - Installation Guide

## Quick Installation (Recommended)

### Method 1: Direct Install via curl (EASIEST!)

```bash
curl -sSL https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-installer | sudo bash
```

### Method 2: Direct Install via wget

```bash
wget -qO- https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-installer | sudo bash
```

### Method 3: Download and Install

```bash
# Download installer
wget https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-installer -O install-agent.sh

# Make executable
chmod +x install-agent.sh

# Run installer
sudo ./install-agent.sh
```

## URLs

- **Installer Script**: `https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-installer`
- **Python Agent**: `https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-agent-script`

## What the Installer Does

1. Detects your OS automatically (Ubuntu, Debian, CentOS, etc.)
2. Installs Python 3 and required dependencies
3. Installs Python packages (psutil, supabase)
4. Creates monitoring agent at `/opt/server-monitor/`
5. Sets up systemd service for auto-start
6. Starts the agent automatically

## Agent Features

- **Auto Registration**: Automatically registers server in your dashboard
- **System Metrics**: CPU, Memory, Disk, Network usage (sent every 30 seconds)
- **Service Monitoring**: Detects and monitors common services
- **Auto Start**: Runs automatically on server boot
- **Lightweight**: Minimal resource usage

## Verification

Check if agent is running:
```bash
sudo systemctl status monitor-agent
```

View real-time logs:
```bash
sudo journalctl -u monitor-agent -f
```

Check agent version:
```bash
cat /opt/server-monitor/server-agent.py | head -5
```

## Management Commands

Start agent:
```bash
sudo systemctl start monitor-agent
```

Stop agent:
```bash
sudo systemctl stop monitor-agent
```

Restart agent:
```bash
sudo systemctl restart monitor-agent
```

Enable auto-start:
```bash
sudo systemctl enable monitor-agent
```

Disable auto-start:
```bash
sudo systemctl disable monitor-agent
```

## Uninstallation

```bash
sudo /opt/server-monitor/uninstall.sh
```

## Troubleshooting

### Agent not starting

Check logs:
```bash
sudo journalctl -u monitor-agent -n 50
```

Common issues:
- Network connectivity to Supabase
- Python dependencies not installed
- Firewall blocking outbound connections

### Manual installation of dependencies

```bash
sudo pip3 install --upgrade psutil supabase
```

### Test agent manually

```bash
cd /opt/server-monitor
sudo python3 server-agent.py
```

## File Locations

- Agent script: `/opt/server-monitor/server-agent.py`
- Service file: `/etc/systemd/system/monitor-agent.service`
- Uninstaller: `/opt/server-monitor/uninstall.sh`

## Requirements

- Linux-based OS (Ubuntu, Debian, CentOS, etc.)
- Python 3.6 or higher
- Internet connection
- Root/sudo access

## Support

For issues or questions, check the logs first:
```bash
sudo journalctl -u monitor-agent -f
```

The agent will automatically appear in your dashboard within 30 seconds of starting.
