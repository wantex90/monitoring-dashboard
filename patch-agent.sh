#!/bin/bash

echo "======================================"
echo "  Patching Server Monitoring Agent"
echo "======================================"
echo ""

if [ "$EUID" -ne 0 ]; then
    echo "Error: This script must be run as root"
    echo "Please run: sudo bash $0"
    exit 1
fi

INSTALL_DIR="/opt/server-monitor"

if [ ! -f "$INSTALL_DIR/server-agent.py" ]; then
    echo "Error: Agent not found at $INSTALL_DIR"
    echo "Please install the agent first"
    exit 1
fi

echo "Stopping agent..."
systemctl stop monitor-agent

echo "Creating fixed version..."
cat > $INSTALL_DIR/server-agent.py << 'EOF'
#!/usr/bin/env python3
"""
Server Monitoring Agent - Auto Registration Version
"""

import psutil
import time
import json
import platform
import subprocess
import os
import sys
import socket
import urllib.request
from datetime import datetime
from supabase import create_client, Client

SUPABASE_URL = "https://wtxuzwkxabhojtarjtmz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eHV6d2t4YWJob2p0YXJqdG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjY1ODQsImV4cCI6MjA3OTUwMjU4NH0.xHEJxcdg7QgzsyLEnA9PRXCVPj2n56IYtykDpbHaQIU"

METRICS_INTERVAL = 30
COMMAND_CHECK_INTERVAL = 5

class ServerAgent:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.hostname = platform.node()
        self.public_ip = self.get_public_ip()
        self.server_id = None
        self.last_metrics_time = 0
        self.last_command_check = 0

        print("=" * 60)
        print("  Server Monitoring Agent - Auto Registration")
        print("=" * 60)
        print(f"Hostname: {self.hostname}")
        print(f"Public IP: {self.public_ip}")
        print(f"OS: {platform.system()} {platform.release()}")
        print("=" * 60)

        self.register_or_get_server()

        print("=" * 60)
        print("  Server Monitoring Agent Started")
        print("=" * 60)
        print(f"Server ID: {self.server_id}")
        print(f"Metrics Interval: {METRICS_INTERVAL}s")
        print(f"Command Check Interval: {COMMAND_CHECK_INTERVAL}s")
        print("=" * 60)

    def get_public_ip(self):
        try:
            response = urllib.request.urlopen('https://api.ipify.org', timeout=5)
            ip = response.read().decode('utf8')
            return ip
        except:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.connect(("8.8.8.8", 80))
                ip = s.getsockname()[0]
                s.close()
                return ip
            except:
                return "unknown"

    def register_or_get_server(self):
        try:
            print(f"Checking if server exists...")
            result = self.supabase.table('servers').select('*').eq('hostname', self.hostname).maybeSingle().execute()

            if result.data:
                self.server_id = result.data['id']
                print(f"✓ Server already registered")
                print(f"  ID: {self.server_id}")
                print(f"  Updating status to online...")

                try:
                    self.supabase.table('servers').update({
                        'status': 'online',
                        'last_seen': datetime.utcnow().isoformat()
                    }).eq('id', self.server_id).execute()
                    print(f"✓ Status updated")
                except Exception as update_err:
                    print(f"⚠ Warning: Could not update status: {update_err}")
            else:
                server_name = f"{self.hostname}-monit-{self.public_ip.replace('.', '-')}"
                print(f"✓ Registering new server: {server_name}")

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
                    print(f"✓ Server registered successfully!")
                    print(f"  ID: {self.server_id}")
                    print(f"  Name: {server_name}")
                else:
                    print(f"✗ Failed to register server: No data returned")
                    print(f"✗ This might be an RLS policy issue")
                    sys.exit(1)

        except Exception as e:
            print(f"✗ Error during registration: {e}")
            print(f"✗ Check network connection and Supabase credentials")
            import traceback
            traceback.print_exc()
            sys.exit(1)

    def get_system_metrics(self):
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = psutil.net_io_counters()

            try:
                load = os.getloadavg()
                load_avg = [load[0], load[1], load[2]]
            except:
                load_avg = [0, 0, 0]

            return {
                "cpu_usage": cpu_percent,
                "memory_total": memory.total,
                "memory_used": memory.used,
                "memory_percent": memory.percent,
                "disk_total": disk.total,
                "disk_used": disk.used,
                "disk_percent": disk.percent,
                "network_sent": network.bytes_sent,
                "network_received": network.bytes_recv,
                "load_average": load_avg[0],
                "recorded_at": datetime.utcnow().isoformat()
            }
        except Exception as e:
            print(f"Error collecting metrics: {e}")
            return None

    def get_services_status(self):
        services = ['nginx', 'apache2', 'httpd', 'mysql', 'mysqld', 'mariadb',
                   'postgresql', 'redis-server', 'redis', 'docker', 'sshd',
                   'php-fpm', 'mongodb', 'mongod']
        service_statuses = []

        for service in services:
            try:
                result = subprocess.run(
                    ['systemctl', 'is-active', service],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                status = 'running' if result.stdout.strip() == 'active' else 'stopped'

                enabled_result = subprocess.run(
                    ['systemctl', 'is-enabled', service],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                auto_start = enabled_result.stdout.strip() == 'enabled'

                service_statuses.append({
                    "server_id": self.server_id,
                    "service_name": service,
                    "status": status,
                    "auto_start": auto_start,
                    "last_checked": datetime.utcnow().isoformat()
                })
            except:
                pass

        return service_statuses

    def send_metrics(self):
        try:
            metrics = self.get_system_metrics()
            if not metrics:
                return False

            metrics["server_id"] = self.server_id
            result = self.supabase.table('server_metrics').insert(metrics).execute()

            if result.data:
                print(f"✓ Metrics sent - CPU: {metrics['cpu_usage']:.1f}% | RAM: {metrics['memory_percent']:.1f}% | Disk: {metrics['disk_percent']:.1f}%")
                return True
            else:
                print(f"✗ Failed to send metrics")
                return False

        except Exception as e:
            print(f"✗ Error sending metrics: {e}")
            return False

    def update_services(self):
        try:
            services = self.get_services_status()
            if not services:
                return False

            for service in services:
                self.supabase.table('server_services').upsert(service).execute()

            print(f"✓ Updated {len(services)} services")
            return True

        except Exception as e:
            print(f"✗ Error updating services: {e}")
            return False

    def check_and_execute_commands(self):
        try:
            result = self.supabase.table('server_commands')\
                .select('*')\
                .eq('server_id', self.server_id)\
                .eq('status', 'pending')\
                .execute()

            if not result.data:
                return

            for command in result.data:
                self.execute_command(command)

        except Exception as e:
            print(f"✗ Error checking commands: {e}")

    def execute_command(self, command):
        command_id = command['id']
        cmd_type = command['command_type']
        cmd = command['command']

        print(f"�� Executing command: {cmd}")

        try:
            if cmd_type == 'execute':
                result = subprocess.run(
                    cmd,
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=60
                )

                output = result.stdout
                if result.stderr:
                    output += "\n" + result.stderr

                if not output.strip():
                    output = "Command completed successfully (no output)"

                self.supabase.table('server_commands').update({
                    'status': 'completed',
                    'output': output,
                    'executed_at': datetime.utcnow().isoformat()
                }).eq('id', command_id).execute()

                print(f"✓ Command completed successfully")

            elif cmd_type == 'service_restart':
                service_name = cmd
                result = subprocess.run(
                    ['sudo', 'systemctl', 'restart', service_name],
                    capture_output=True,
                    text=True,
                    timeout=30
                )

                output = f"Service {service_name} restarted"
                if result.stderr:
                    output += "\n" + result.stderr

                self.supabase.table('server_commands').update({
                    'status': 'completed',
                    'output': output,
                    'executed_at': datetime.utcnow().isoformat()
                }).eq('id', command_id).execute()

                print(f"✓ Service {service_name} restarted")

        except subprocess.TimeoutExpired:
            error_msg = "Command timed out after 60 seconds"
            self.supabase.table('server_commands').update({
                'status': 'failed',
                'output': error_msg,
                'executed_at': datetime.utcnow().isoformat()
            }).eq('id', command_id).execute()
            print(f"✗ {error_msg}")

        except Exception as e:
            error_msg = f"Error executing command: {str(e)}"
            self.supabase.table('server_commands').update({
                'status': 'failed',
                'output': error_msg,
                'executed_at': datetime.utcnow().isoformat()
            }).eq('id', command_id).execute()
            print(f"✗ {error_msg}")

    def update_server_status(self, status='online'):
        try:
            self.supabase.table('servers').update({
                'status': status,
                'last_seen': datetime.utcnow().isoformat()
            }).eq('id', self.server_id).execute()
        except Exception as e:
            print(f"✗ Error updating server status: {e}")

    def run(self):
        try:
            while True:
                current_time = time.time()

                if current_time - self.last_metrics_time >= METRICS_INTERVAL:
                    self.send_metrics()
                    self.update_services()
                    self.update_server_status('online')
                    self.last_metrics_time = current_time

                if current_time - self.last_command_check >= COMMAND_CHECK_INTERVAL:
                    self.check_and_execute_commands()
                    self.last_command_check = current_time

                time.sleep(1)

        except KeyboardInterrupt:
            print("\n\n" + "=" * 60)
            print("Agent stopped by user")
            print("=" * 60)
            self.update_server_status('offline')
            sys.exit(0)

        except Exception as e:
            print(f"\n✗ Fatal error: {e}")
            self.update_server_status('offline')
            sys.exit(1)

def main():
    agent = ServerAgent()
    agent.run()

if __name__ == "__main__":
    main()
EOF

chmod +x $INSTALL_DIR/server-agent.py

echo "✓ Agent patched successfully!"
echo ""
echo "Starting agent..."
systemctl start monitor-agent
sleep 3

if systemctl is-active --quiet monitor-agent; then
    echo "✓ Agent started successfully!"
    echo ""
    echo "Check status: sudo systemctl status monitor-agent"
    echo "View logs: sudo journalctl -u monitor-agent -f"
else
    echo "✗ Failed to start agent"
    echo "Check logs: sudo journalctl -u monitor-agent -n 50"
fi
