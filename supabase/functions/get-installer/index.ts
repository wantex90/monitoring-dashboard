Deno.serve(async (req: Request) => {
  const installerScript = `#!/bin/bash
set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

INSTALL_DIR="/opt/server-monitor"
SERVICE_NAME="monitor-agent"
AGENT_FILE="server-agent.py"
AGENT_URL="https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-agent-script"

echo -e "\${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║       SERVER MONITORING AGENT - UNIVERSAL INSTALLER       ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "\${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "\${RED}Error: This script must be run as root\${NC}"
    echo "Please run: sudo $0"
    exit 1
fi

echo -e "\${GREEN}✓ Running as root\${NC}"

cleanup_old_agent() {
    if [ -d "$INSTALL_DIR" ] || systemctl list-unit-files | grep -q "$SERVICE_NAME"; then
        echo -e "\${YELLOW}Removing old installation...\${NC}"
        cd /tmp
        systemctl stop $SERVICE_NAME 2>/dev/null || true
        systemctl disable $SERVICE_NAME 2>/dev/null || true
        rm -f /etc/systemd/system/$SERVICE_NAME.service
        systemctl daemon-reload 2>/dev/null || true
        rm -rf $INSTALL_DIR
        echo -e "\${GREEN}✓ Old installation removed\${NC}"
    fi
}

detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_NAME=$NAME
    else
        OS=$(uname -s)
        OS_NAME=$OS
    fi
    echo -e "\${BLUE}Detected OS: \${OS_NAME}\${NC}"
}

install_dependencies() {
    echo -e "\${YELLOW}Installing dependencies...\${NC}"
    case "$OS" in
        ubuntu|debian|linuxmint|pop)
            export DEBIAN_FRONTEND=noninteractive
            apt-get update -qq
            apt-get install -y -qq python3 python3-pip curl wget > /dev/null 2>&1
            ;;
        centos|rhel|rocky|almalinux|fedora)
            if command -v dnf &> /dev/null; then
                dnf install -y python3 python3-pip curl wget -q
            else
                yum install -y python3 python3-pip curl wget -q
            fi
            ;;
        *)
            if command -v apt-get &> /dev/null; then
                apt-get update -qq && apt-get install -y python3 python3-pip curl wget
            elif command -v yum &> /dev/null; then
                yum install -y python3 python3-pip curl wget
            else
                echo -e "\${RED}Could not detect package manager\${NC}"
                exit 1
            fi
            ;;
    esac
    echo -e "\${GREEN}✓ Dependencies installed\${NC}"
}

install_python_packages() {
    echo -e "\${YELLOW}Installing Python packages...\${NC}"
    python3 -m pip install --upgrade pip -q 2>/dev/null || true
    pip3 install psutil supabase -q 2>/dev/null || python3 -m pip install psutil supabase -q
    echo -e "\${GREEN}✓ Python packages installed\${NC}"
}

download_agent() {
    echo -e "\${YELLOW}Downloading agent...\${NC}"
    mkdir -p $INSTALL_DIR
    
    if command -v curl &> /dev/null; then
        curl -sSL $AGENT_URL -o $INSTALL_DIR/$AGENT_FILE
    else
        wget -qO $INSTALL_DIR/$AGENT_FILE $AGENT_URL
    fi
    
    chmod +x $INSTALL_DIR/$AGENT_FILE
    echo -e "\${GREEN}✓ Agent downloaded\${NC}"
}

create_systemd_service() {
    echo -e "\${YELLOW}Creating systemd service...\${NC}"
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
    echo -e "\${GREEN}✓ Service created\${NC}"
}

create_uninstaller() {
    cat > $INSTALL_DIR/uninstall.sh << 'UNINSTALL_EOF'
#!/bin/bash
read -p "Are you sure? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then exit 0; fi
systemctl stop monitor-agent 2>/dev/null || true
systemctl disable monitor-agent 2>/dev/null || true
rm -f /etc/systemd/system/monitor-agent.service
systemctl daemon-reload
rm -rf /opt/server-monitor
echo "Uninstalled successfully"
UNINSTALL_EOF
    chmod +x $INSTALL_DIR/uninstall.sh
}

main() {
    cleanup_old_agent
    detect_os
    install_dependencies
    install_python_packages
    download_agent
    create_systemd_service
    create_uninstaller
    
    echo ""
    echo -e "\${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                                                            ║"
    echo "║            INSTALLATION COMPLETED SUCCESSFULLY!            ║"
    echo "║                                                            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "\${NC}"
    echo ""
    
    echo -e "\${YELLOW}Starting agent...\${NC}"
    systemctl start $SERVICE_NAME
    sleep 3
    
    if systemctl is-active --quiet $SERVICE_NAME; then
        echo -e "\${GREEN}✓ Agent started successfully!\${NC}"
        echo ""
        echo "View logs: sudo journalctl -u $SERVICE_NAME -f"
        echo "Check your dashboard - server should appear in ~30 seconds!"
    else
        echo -e "\${RED}✗ Agent failed to start\${NC}"
        echo "Check logs: sudo journalctl -u $SERVICE_NAME -n 50"
    fi
    
    echo ""
    echo -e "\${YELLOW}Commands:\${NC}"
    echo "  Start:   sudo systemctl start $SERVICE_NAME"
    echo "  Stop:    sudo systemctl stop $SERVICE_NAME"
    echo "  Status:  sudo systemctl status $SERVICE_NAME"
    echo "  Logs:    sudo journalctl -u $SERVICE_NAME -f"
    echo "  Uninstall: sudo $INSTALL_DIR/uninstall.sh"
    echo ""
}

main
`;

  return new Response(installerScript, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
});