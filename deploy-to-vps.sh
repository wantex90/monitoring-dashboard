#!/bin/bash

################################################################################
# Server Monitoring Dashboard - VPS Deployment Script
#
# Supports: Ubuntu 20.04+, Debian 10+
# Usage: sudo bash deploy-to-vps.sh your-domain.com
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN=${1:-""}
INSTALL_DIR="/var/www/monitoring-dashboard"
NGINX_CONFIG="/etc/nginx/sites-available/monitoring-dashboard"

# Banner
echo -e "${BLUE}"
cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║      SERVER MONITORING DASHBOARD - VPS DEPLOYMENT         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root${NC}"
    echo "Please run: sudo bash $0"
    exit 1
fi

# Check domain parameter
if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}No domain specified. Using IP address.${NC}"
    SERVER_IP=$(curl -s https://api.ipify.org)
    echo -e "${GREEN}Server IP: $SERVER_IP${NC}"
    read -p "Continue with IP address? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Deployment cancelled. Usage: sudo bash $0 your-domain.com"
        exit 1
    fi
else
    echo -e "${GREEN}Domain: $DOMAIN${NC}"
fi

echo ""
echo -e "${BLUE}Starting deployment...${NC}"
echo ""

# Step 1: Update system
echo -e "${YELLOW}[1/8] Updating system...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# Step 2: Install Nginx
echo -e "${YELLOW}[2/8] Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt-get install -y nginx
    systemctl enable nginx
    systemctl start nginx
fi
echo -e "${GREEN}✓ Nginx installed${NC}"

# Step 3: Install Node.js
echo -e "${YELLOW}[3/8] Installing Node.js...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi
echo -e "${GREEN}✓ Node.js $(node --version) installed${NC}"

# Step 4: Prepare directory
echo -e "${YELLOW}[4/8] Preparing installation directory...${NC}"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# If project files exist in current directory, copy them
if [ -f "../package.json" ]; then
    echo "  → Copying project files..."
    cp -r ../* . 2>/dev/null || true
elif [ ! -f "package.json" ]; then
    echo -e "${YELLOW}  → Project files not found${NC}"
    echo "  → Please upload project files to $INSTALL_DIR"
    echo "  → Then run: cd $INSTALL_DIR && npm install && npm run build"
    exit 1
fi

# Step 5: Install dependencies & build
echo -e "${YELLOW}[5/8] Building application...${NC}"
if [ -f "package.json" ]; then
    npm install --silent
    npm run build
    echo -e "${GREEN}✓ Application built successfully${NC}"
else
    echo -e "${RED}✗ package.json not found${NC}"
    exit 1
fi

# Step 6: Configure Nginx
echo -e "${YELLOW}[6/8] Configuring Nginx...${NC}"

if [ -z "$DOMAIN" ]; then
    # IP-based configuration
    cat > $NGINX_CONFIG << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/monitoring-dashboard/dist;
    index index.html;

    server_name _;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF
else
    # Domain-based configuration
    cat > $NGINX_CONFIG << EOF
server {
    listen 80;
    listen [::]:80;

    server_name $DOMAIN www.$DOMAIN;

    root /var/www/monitoring-dashboard/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF
fi

# Enable site
ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/monitoring-dashboard

# Remove default site if using IP
if [ -z "$DOMAIN" ]; then
    rm -f /etc/nginx/sites-enabled/default
fi

# Test and reload Nginx
nginx -t
systemctl reload nginx

echo -e "${GREEN}✓ Nginx configured${NC}"

# Step 7: Setup firewall
echo -e "${YELLOW}[7/8] Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 'Nginx Full' > /dev/null 2>&1 || true
    echo -e "${GREEN}✓ Firewall configured${NC}"
else
    echo -e "${YELLOW}⚠ UFW not installed, skipping firewall setup${NC}"
fi

# Step 8: SSL Setup (if domain provided)
if [ ! -z "$DOMAIN" ]; then
    echo -e "${YELLOW}[8/8] Setting up SSL certificate...${NC}"

    if ! command -v certbot &> /dev/null; then
        echo "  → Installing Certbot..."
        apt-get install -y certbot python3-certbot-nginx
    fi

    read -p "Do you want to install SSL certificate now? (y/n): " install_ssl

    if [ "$install_ssl" = "y" ]; then
        echo "  → Getting SSL certificate..."
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --register-unsafely-without-email
        echo -e "${GREEN}✓ SSL certificate installed${NC}"
    else
        echo -e "${YELLOW}⚠ SSL setup skipped${NC}"
        echo "  → To install SSL later, run:"
        echo "    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    fi
else
    echo -e "${YELLOW}[8/8] SSL setup skipped (no domain)${NC}"
fi

# Create update script
cat > $INSTALL_DIR/update.sh << 'UPDATE_EOF'
#!/bin/bash
cd /var/www/monitoring-dashboard
git pull origin main 2>/dev/null || echo "Not a git repository"
npm install
npm run build
systemctl reload nginx
echo "Dashboard updated successfully!"
UPDATE_EOF
chmod +x $INSTALL_DIR/update.sh

# Completion
echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║          DEPLOYMENT COMPLETED SUCCESSFULLY!                ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

if [ -z "$DOMAIN" ]; then
    echo -e "${GREEN}✓ Dashboard accessible at:${NC}"
    echo -e "  ${BLUE}http://$SERVER_IP${NC}"
else
    echo -e "${GREEN}✓ Dashboard accessible at:${NC}"
    if [ "$install_ssl" = "y" ]; then
        echo -e "  ${BLUE}https://$DOMAIN${NC}"
        echo -e "  ${BLUE}https://www.$DOMAIN${NC}"
    else
        echo -e "  ${BLUE}http://$DOMAIN${NC}"
        echo -e "  ${BLUE}http://www.$DOMAIN${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}Default Credentials:${NC}"
echo "  Email: admin@admin.com"
echo "  Password: admin123456"
echo ""
echo -e "${RED}⚠ IMPORTANT: Change default password after first login!${NC}"
echo ""
echo -e "${YELLOW}Installation Directory:${NC}"
echo "  $INSTALL_DIR"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  Update:  sudo $INSTALL_DIR/update.sh"
echo "  Logs:    sudo journalctl -u nginx -f"
echo "  Status:  sudo systemctl status nginx"
echo "  Restart: sudo systemctl restart nginx"
echo ""
echo -e "${YELLOW}Nginx Config:${NC}"
echo "  $NGINX_CONFIG"
echo ""
echo -e "${GREEN}Enjoy your Server Monitoring Dashboard!${NC}"
echo ""
