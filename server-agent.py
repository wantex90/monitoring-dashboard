#!/usr/bin/env python3
"""
Server Monitoring Agent - Enhanced Version
This agent monitors server metrics and executes commands from the monitoring dashboard.

Requirements:
- Python 3.7+
- pip install psutil supabase paramiko

Usage:
1. Copy this script to your server
2. Install dependencies: pip3 install psutil supabase paramiko
3. Configure the CONFIGURATION section below
4. Run: python3 server-agent.py
5. For production: Use systemd or screen/tmux to keep it running
"""

import psutil
import time
import json
import platform
import subprocess
import os
import sys
from datetime import datetime
from supabase import create_client, Client
import paramiko

# ===== CONFIGURATION =====
# Get these from your .env file
SUPABASE_URL = "https://ctfzlgsazqzzewnahvao.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0ZnpsZ3NhenF6emV3bmFodmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTE0ODUsImV4cCI6MjA3OTM4NzQ4NX0.jhwWZVeWIWpeKZQC3b8fX00YeNRNyxfy03IJqDPi0WY"

# IMPORTANT: Set your server ID after adding server in dashboard
SERVER_ID = "YOUR_SERVER_ID_HERE"

# Monitoring settings
METRICS_INTERVAL = 30  # Send metrics every 30 seconds
COMMAND_CHECK_INTERVAL = 5  # Check for commands every 5 seconds
# ========================

class ServerAgent:
    def __init__(self):
        if SERVER_ID == "YOUR_SERVER_ID_HERE":
            print("ERROR: Please set SERVER_ID in the configuration!")
            print("Steps:")
            print("1. Add server in dashboard")
            print("2. Copy the server ID from the URL or database")
            print("3. Set SERVER_ID in this script")
            sys.exit(1)

        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.server_id = SERVER_ID
        self.last_metrics_time = 0
        self.last_command_check = 0

        print("=" * 60)
        print("  Server Monitoring Agent Started")
        print("=" * 60)
        print(f"Server ID: {self.server_id}")
        print(f"Hostname: {platform.node()}")
        print(f"OS: {platform.system()} {platform.release()}")
        print(f"Metrics Interval: {METRICS_INTERVAL}s")
        print(f"Command Check Interval: {COMMAND_CHECK_INTERVAL}s")
        print("=" * 60)

    def get_system_metrics(self):
        """Collect system metrics"""
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
        """Get status of common services"""
        services = ['nginx', 'apache2', 'mysql', 'postgresql', 'redis-server', 'docker', 'sshd']
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
        """Send metrics to Supabase"""
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
        """Update service statuses in database"""
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
        """Check for pending commands and execute them"""
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
        """Execute a command and update the result"""
        command_id = command['id']
        cmd_type = command['command_type']
        cmd = command['command']

        print(f"📝 Executing command: {cmd}")

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
        """Update server status"""
        try:
            self.supabase.table('servers').update({
                'status': status,
                'last_seen': datetime.utcnow().isoformat()
            }).eq('id', self.server_id).execute()
        except Exception as e:
            print(f"✗ Error updating server status: {e}")

    def run(self):
        """Main agent loop"""
        try:
            while True:
                current_time = time.time()

                # Send metrics
                if current_time - self.last_metrics_time >= METRICS_INTERVAL:
                    self.send_metrics()
                    self.update_services()
                    self.update_server_status('online')
                    self.last_metrics_time = current_time

                # Check for commands
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
