#!/bin/bash

################################################################################
# Server Monitoring Agent - Universal Installer
#
# Supports: Ubuntu, Debian, CentOS, RHEL, AlmaLinux, Rocky Linux, Fedora,
#           openSUSE, Arch Linux, and more
#
# Usage: curl -sSL https://your-domain.com/install-agent.sh | sudo bash
#        Or: wget -qO- https://your-domain.com/install-agent.sh | sudo bash
#        Or: sudo bash install-agent.sh
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/server-monitor"
SERVICE_NAME="monitor-agent"
AGENT_FILE="server-agent.py"

# Arguments from command line or defaults
SUPABASE_URL="${1:-https://wtxuzwkxabhojtarjtmz.supabase.co}"
SUPABASE_KEY="${2:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eHV6d2t4YWJob2p0YXJqdG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjY1ODQsImV4cCI6MjA3OTUwMjU4NH0.xHEJxcdg7QgzsyLEnA9PRXCVPj2n56IYtykDpbHaQIU}"

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║       SERVER MONITORING AGENT - UNIVERSAL INSTALLER       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo $0"
    exit 1
fi

echo -e "${GREEN}✓ Running as root${NC}"
echo -e "${GREEN}✓ Auto-registration mode enabled${NC}"

# Check and cleanup old installation
cleanup_old_agent() {
    if [ -d "$INSTALL_DIR" ] || systemctl list-unit-files | grep -q "$SERVICE_NAME"; then
        echo ""
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}  Existing agent installation detected!${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "${BLUE}Removing old installation...${NC}"

        # Change to safe directory before cleanup
        cd /tmp

        # Stop service if running
        if systemctl is-active --quiet $SERVICE_NAME 2>/dev/null; then
            echo "  → Stopping service..."
            systemctl stop $SERVICE_NAME 2>/dev/null || true
        fi

        # Disable service if enabled
        if systemctl is-enabled --quiet $SERVICE_NAME 2>/dev/null; then
            echo "  → Disabling service..."
            systemctl disable $SERVICE_NAME 2>/dev/null || true
        fi

        # Remove service file
        if [ -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
            echo "  → Removing systemd service..."
            rm -f /etc/systemd/system/$SERVICE_NAME.service
        fi

        # Reload systemd
        systemctl daemon-reload 2>/dev/null || true

        # Remove installation directory
        if [ -d "$INSTALL_DIR" ]; then
            echo "  → Removing installation directory..."
            rm -rf $INSTALL_DIR
        fi

        echo -e "${GREEN}✓ Old installation removed${NC}"
        echo ""
        echo -e "${GREEN}Proceeding with fresh installation...${NC}"
        echo ""
    fi
}

# Detect OS and distribution
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
        OS_NAME=$NAME
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
        OS_NAME=$(cat /etc/redhat-release)
    else
        OS=$(uname -s)
        OS_NAME=$OS
    fi

    echo -e "${BLUE}Detected OS: ${OS_NAME}${NC}"
    echo ""
}

# Install Python and pip based on OS
install_dependencies() {
    echo -e "${YELLOW}Installing dependencies...${NC}"

    case "$OS" in
        ubuntu|debian|linuxmint|pop)
            echo "  → Using APT package manager"
            export DEBIAN_FRONTEND=noninteractive
            apt-get update -qq
            apt-get install -y -qq python3 python3-pip curl wget > /dev/null 2>&1
            ;;

        centos|rhel|rocky|almalinux)
            echo "  → Using YUM/DNF package manager"
            if command -v dnf &> /dev/null; then
                dnf install -y python3 python3-pip curl wget -q
            else
                yum install -y python3 python3-pip curl wget -q
            fi
            ;;

        fedora)
            echo "  → Using DNF package manager"
            dnf install -y python3 python3-pip curl wget -q
            ;;

        opensuse*|sles)
            echo "  → Using Zypper package manager"
            zypper install -y python3 python3-pip curl wget
            ;;

        arch|manjaro)
            echo "  → Using Pacman package manager"
            pacman -Sy --noconfirm python python-pip curl wget
            ;;

        alpine)
            echo "  → Using APK package manager"
            apk add --no-cache python3 py3-pip curl wget
            ;;

        *)
            echo -e "${YELLOW}  → Unknown OS, attempting generic install...${NC}"
            if command -v apt-get &> /dev/null; then
                apt-get update -qq && apt-get install -y python3 python3-pip curl wget
            elif command -v yum &> /dev/null; then
                yum install -y python3 python3-pip curl wget
            elif command -v dnf &> /dev/null; then
                dnf install -y python3 python3-pip curl wget
            else
                echo -e "${RED}Could not detect package manager. Please install Python 3 and pip manually.${NC}"
                exit 1
            fi
            ;;
    esac

    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Install Python packages
install_python_packages() {
    echo -e "${YELLOW}Installing Python packages...${NC}"

    # Upgrade pip first
    python3 -m pip install --upgrade pip -q 2>/dev/null || true

    # Install required packages
    pip3 install psutil supabase -q 2>/dev/null || \
    python3 -m pip install psutil supabase -q

    echo -e "${GREEN}✓ Python packages installed${NC}"
}

# Download agent script
download_agent() {
    echo -e "${YELLOW}Setting up agent...${NC}"

    # Create installation directory
    mkdir -p $INSTALL_DIR

    # Download agent from Supabase Edge Function
    echo "  → Downloading latest agent..."
    if curl -sSL "${SUPABASE_URL}/functions/v1/download-agent" -o $INSTALL_DIR/$AGENT_FILE 2>/dev/null; then
        echo -e "${GREEN}✓ Agent downloaded from server${NC}"
    else
        echo -e "${YELLOW}⚠ Download failed, using embedded version...${NC}"
        # Fallback: Create agent script
        cat > $INSTALL_DIR/$AGENT_FILE << 'AGENT_EOF'
#!/usr/bin/env python3
import psutil
import time
import platform
import os
import sys
import urllib.request
from datetime import datetime
from supabase import create_client, Client

SUPABASE_URL = "SUPABASE_URL_PLACEHOLDER"
SUPABASE_KEY = "SUPABASE_KEY_PLACEHOLDER"

class ServerAgent:
    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.hostname = platform.node()
        self.public_ip = self.get_public_ip()
        self.server_id = None
        self.last_metrics_time = 0
        self.register_or_get_server()

    def get_public_ip(self):
        try:
            response = urllib.request.urlopen('https://api.ipify.org', timeout=5)
            return response.read().decode('utf8')
        except:
            return "unknown"

    def register_or_get_server(self):
        try:
            result = self.supabase.table('servers').select('*').eq('hostname', self.hostname).maybeSingle().execute()
            if result.data:
                self.server_id = result.data['id']
                print(f"Server found: {self.server_id}")
            else:
                server_name = f"{self.hostname}-{self.public_ip.replace('.', '-')}"
                insert_result = self.supabase.table('servers').insert({
                    'name': server_name,
                    'hostname': self.hostname,
                    'ip_address': self.public_ip,
                    'os_info': f"{platform.system()} {platform.release()}",
                    'status': 'online',
                    'created_by': '00000000-0000-0000-0000-000000000000'
                }).execute()
                if insert_result.data and len(insert_result.data) > 0:
                    self.server_id = insert_result.data[0]['id']
                    print(f"Server registered: {self.server_id}")
        except Exception as e:
            print(f"Registration error: {e}")
            sys.exit(1)

    def get_system_metrics(self):
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        network = psutil.net_io_counters()
        load_avg = os.getloadavg()[0] if hasattr(os, 'getloadavg') else 0
        return {
            "server_id": self.server_id,
            "cpu_usage": cpu_percent,
            "memory_total": memory.total,
            "memory_used": memory.used,
            "memory_percent": memory.percent,
            "disk_total": disk.total,
            "disk_used": disk.used,
            "disk_percent": disk.percent,
            "network_sent": network.bytes_sent,
            "network_received": network.bytes_recv,
            "load_average": load_avg,
            "recorded_at": datetime.utcnow().isoformat()
        }

    def send_metrics(self):
        try:
            metrics = self.get_system_metrics()
            self.supabase.table('server_metrics').insert(metrics).execute()
            print(f"Metrics sent - CPU: {metrics['cpu_usage']:.1f}% | RAM: {metrics['memory_percent']:.1f}%")
        except Exception as e:
            print(f"Metrics error: {e}")

    def run(self):
        print("Agent started!")
        while True:
            current_time = time.time()
            if current_time - self.last_metrics_time >= 30:
                self.send_metrics()
                self.last_metrics_time = current_time
            time.sleep(1)

if __name__ == "__main__":
    agent = ServerAgent()
    agent.run()
AGENT_EOF

        # Replace placeholders using a safer method
        # Escape special characters in variables
        ESCAPED_URL=$(echo "$SUPABASE_URL" | sed 's/[\/&]/\\&/g')
        ESCAPED_KEY=$(echo "$SUPABASE_KEY" | sed 's/[\/&]/\\&/g')

        sed -i "s|SUPABASE_URL_PLACEHOLDER|$ESCAPED_URL|g" $INSTALL_DIR/$AGENT_FILE
        sed -i "s|SUPABASE_KEY_PLACEHOLDER|$ESCAPED_KEY|g" $INSTALL_DIR/$AGENT_FILE

        echo -e "${GREEN}✓ Agent configured for auto-registration${NC}"
    fi

    chmod +x $INSTALL_DIR/$AGENT_FILE

    echo -e "${GREEN}✓ Agent installed to $INSTALL_DIR${NC}"
}

# Create reconfiguration script (if needed)
create_config_script() {
    cat > $INSTALL_DIR/reconfigure.sh << 'CONFIG_EOF'
#!/bin/bash

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "═══════════════════════════════════════════════════════"
echo "       SERVER MONITORING AGENT - CONFIGURATION"
echo "═══════════════════════════════════════════════════════"
echo -e "${NC}"
echo ""
echo "To get your Server ID:"
echo "1. Login to dashboard: admin@admin.com / admin123456"
echo "2. Click 'Add Server'"
echo "3. Fill in server details"
echo "4. Copy the Server ID from the URL or server card"
echo ""
echo -e "${YELLOW}Example: If URL is ?server=abc123, then ID is: abc123${NC}"
echo ""
read -p "Enter Server ID: " server_id

if [ -z "$server_id" ]; then
    echo -e "${RED}Error: Server ID cannot be empty${NC}"
    exit 1
fi

sed -i "s|SERVER_ID_PLACEHOLDER|$server_id|g" /opt/server-monitor/server-agent.py

echo ""
echo -e "${GREEN}✓ Configuration complete!${NC}"
echo ""
echo "Start the agent with:"
echo "  sudo systemctl start monitor-agent"
echo ""
echo "View status:"
echo "  sudo systemctl status monitor-agent"
echo ""
echo "View logs:"
echo "  sudo journalctl -u monitor-agent -f"
echo ""
CONFIG_EOF

    chmod +x $INSTALL_DIR/reconfigure.sh
    echo -e "${GREEN}✓ Reconfiguration script created${NC}"
}

# Create systemd service
create_systemd_service() {
    echo -e "${YELLOW}Creating systemd service...${NC}"

    cat > /etc/systemd/system/$SERVICE_NAME.service << EOF
[Unit]
Description=Server Monitoring Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/$AGENT_FILE
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable $SERVICE_NAME

    echo -e "${GREEN}✓ Systemd service created and enabled${NC}"
}

# Create uninstaller
create_uninstaller() {
    cat > $INSTALL_DIR/uninstall.sh << 'UNINSTALL_EOF'
#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Uninstalling Server Monitoring Agent...${NC}"
echo ""

read -p "Are you sure you want to uninstall? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Uninstall cancelled."
    exit 0
fi

echo "Stopping service..."
systemctl stop monitor-agent 2>/dev/null || true

echo "Disabling service..."
systemctl disable monitor-agent 2>/dev/null || true

echo "Removing service file..."
rm -f /etc/systemd/system/monitor-agent.service

echo "Reloading systemd..."
systemctl daemon-reload

echo "Removing installation directory..."
rm -rf /opt/server-monitor

echo ""
echo -e "${GREEN}✓ Server Monitoring Agent uninstalled successfully${NC}"
echo ""
echo "Note: Python packages (psutil, supabase, paramiko) were not removed."
echo "To remove them manually: pip3 uninstall psutil supabase paramiko"
echo ""
UNINSTALL_EOF

    chmod +x $INSTALL_DIR/uninstall.sh
}

# Main installation flow
main() {
    cleanup_old_agent
    detect_os
    install_dependencies
    install_python_packages
    download_agent
    create_config_script
    create_systemd_service
    create_uninstaller

    echo ""
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║            INSTALLATION COMPLETED SUCCESSFULLY!            ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""

    echo -e "${GREEN}✓ Agent configured and ready!${NC}"
    echo ""
    echo -e "${YELLOW}Starting monitoring agent with auto-registration...${NC}"
    systemctl start $SERVICE_NAME
    sleep 5

    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "${GREEN}✓ Agent started successfully!${NC}"
        echo ""
        echo "The agent will automatically:"
        echo "  • Register this server in your dashboard"
        echo "  • Start sending metrics every 30 seconds"
        echo "  • Monitor system services"
        echo ""
        echo "View real-time logs:"
        echo -e "  ${BLUE}sudo journalctl -u $SERVICE_NAME -f${NC}"
        echo ""
        echo -e "${GREEN}Check your dashboard - server should appear in ~30 seconds!${NC}"
    else
        echo -e "${RED}✗ Agent failed to start${NC}"
        echo ""
        echo "Check logs for details:"
        echo -e "  ${BLUE}sudo journalctl -u $SERVICE_NAME -n 50${NC}"
        echo ""
        echo "Common issues:"
        echo "  • Network connection to Supabase"
        echo "  • Python dependencies missing"
        echo ""
        echo "Restart after fixing:"
        echo -e "  ${BLUE}sudo systemctl restart $SERVICE_NAME${NC}"
    fi

    echo ""
    echo -e "${YELLOW}Management Commands:${NC}"
    echo "  Start:   sudo systemctl start $SERVICE_NAME"
    echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
    echo "  Restart: sudo systemctl restart $SERVICE_NAME"
    echo "  Status:  sudo systemctl status $SERVICE_NAME"
    echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
    echo ""
    echo -e "${YELLOW}Uninstall:${NC}"
    echo "  sudo $INSTALL_DIR/uninstall.sh"
    echo ""
    echo -e "${GREEN}Installation directory: $INSTALL_DIR${NC}"
    echo ""
}

# Run main installation
main
