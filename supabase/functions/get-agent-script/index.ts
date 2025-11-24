Deno.serve(async (req: Request) => {
  const agentScript = `#!/usr/bin/env python3
import psutil
import time
import platform
import os
import sys
import json
import subprocess
import urllib.request
from datetime import datetime
from supabase import create_client

SUPABASE_URL = "https://wtxuzwkxabhojtarjtmz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eHV6d2t4YWJob2p0YXJqdG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjY1ODQsImV4cCI6MjA3OTUwMjU4NH0.xHEJxcdg7QgzsyLEnA9PRXCVPj2n56IYtykDpbHaQIU"

class ServerAgent:
    def __init__(self):
        self.supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.hostname = platform.node()
        self.public_ip = self.get_public_ip()
        self.server_id = None
        self.last_metrics_time = 0
        self.last_services_time = 0
        self.last_commands_time = 0
        self.register_or_get_server()

    def get_public_ip(self):
        try:
            response = urllib.request.urlopen('https://api.ipify.org', timeout=5)
            return response.read().decode('utf8')
        except:
            return \"unknown\"

    def get_private_ip(self):
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((\"8.8.8.8\", 80))
            private_ip = s.getsockname()[0]
            s.close()
            return private_ip
        except:
            return \"unknown\"

    def get_system_info(self):
        try:
            # CPU Info
            cpu_count = psutil.cpu_count(logical=False) or psutil.cpu_count()
            cpu_model = \"Unknown\"
            try:
                if platform.system() == \"Linux\":
                    with open('/proc/cpuinfo', 'r') as f:
                        for line in f:
                            if 'model name' in line:
                                cpu_model = line.split(':')[1].strip()
                                break
            except:
                pass

            # Memory
            memory = psutil.virtual_memory()

            # Disk
            disk = psutil.disk_usage('/')

            # Uptime & Boot Time
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            uptime_seconds = int(time.time() - psutil.boot_time())

            return {
                'cpu_model': cpu_model,
                'cpu_cores': cpu_count,
                'total_ram': memory.total,
                'total_disk': disk.total,
                'architecture': platform.machine(),
                'public_ip': self.public_ip,
                'private_ip': self.get_private_ip(),
                'uptime_seconds': uptime_seconds,
                'boot_time': boot_time.isoformat(),
                'kernel_version': platform.release()
            }
        except Exception as e:
            print(f\"Error collecting system info: {e}\")
            return {}

    def register_or_get_server(self):
        try:
            result = self.supabase.table('servers').select('*').eq('hostname', self.hostname).execute()
            if result.data and len(result.data) > 0:
                self.server_id = result.data[0]['id']
                print(f\"Server found: {self.server_id}\")
                self.update_system_info()
            else:
                server_name = f\"{self.hostname}-{self.public_ip.replace('.', '-')}\"
                os_info = {
                    \"system\": platform.system(),
                    \"release\": platform.release(),
                    \"version\": platform.version(),
                    \"machine\": platform.machine()
                }

                system_info = self.get_system_info()

                insert_result = self.supabase.table('servers').insert({
                    'name': server_name,
                    'hostname': self.hostname,
                    'provider': self.public_ip,
                    'status': 'online',
                    'os_info': os_info,
                    **system_info
                }).execute()
                if insert_result.data and len(insert_result.data) > 0:
                    self.server_id = insert_result.data[0]['id']
                    print(f\"Server registered: {self.server_id}\")
                else:
                    print(\"Failed to register server\")
                    sys.exit(1)
        except Exception as e:
            print(f\"Registration error: {e}\")
            sys.exit(1)

    def update_system_info(self):
        try:
            system_info = self.get_system_info()
            system_info['last_seen'] = datetime.utcnow().isoformat()
            system_info['status'] = 'online'
            self.supabase.table('servers').update(system_info).eq('id', self.server_id).execute()
        except Exception as e:
            print(f\"Update system info error: {e}\")

    def update_last_seen(self):
        try:
            self.update_system_info()
        except Exception as e:
            print(f\"Update last_seen error: {e}\")

    def get_system_metrics(self):
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        network = psutil.net_io_counters()

        load_avg = list(os.getloadavg()) if hasattr(os, 'getloadavg') else [0, 0, 0]

        return {
            \"server_id\": self.server_id,
            \"cpu_usage\": float(cpu_percent),
            \"memory_total\": int(memory.total),
            \"memory_used\": int(memory.used),
            \"memory_percent\": float(memory.percent),
            \"disk_total\": int(disk.total),
            \"disk_used\": int(disk.used),
            \"disk_percent\": float(disk.percent),
            \"network_sent\": int(network.bytes_sent),
            \"network_recv\": int(network.bytes_recv),
            \"load_average\": load_avg,
            \"timestamp\": datetime.utcnow().isoformat()
        }

    def get_services_status(self):
        services = ['apache2', 'nginx', 'mysql', 'postgresql', 'redis-server', 'docker', 'ssh']
        services_status = []

        for service in services:
            try:
                is_active = os.popen(f'systemctl is-active {service} 2>/dev/null').read().strip()
                is_enabled = os.popen(f'systemctl is-enabled {service} 2>/dev/null').read().strip()

                if is_active in ['active', 'inactive', 'failed']:
                    status_map = {
                        'active': 'running',
                        'inactive': 'stopped',
                        'failed': 'failed'
                    }
                    status = status_map.get(is_active, 'unknown')
                    enabled = is_enabled == 'enabled'

                    services_status.append({
                        'server_id': self.server_id,
                        'service_name': service,
                        'status': status,
                        'enabled': enabled
                    })
            except Exception as e:
                print(f\"Service {service} error: {e}\")

        return services_status

    def execute_command(self, command):
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                return {'status': 'completed', 'output': result.stdout or 'Command completed successfully'}
            else:
                return {'status': 'failed', 'output': result.stderr or f'Command failed with exit code {result.returncode}'}
        except subprocess.TimeoutExpired:
            return {'status': 'failed', 'output': 'Command timeout (30s)'}
        except Exception as e:
            return {'status': 'failed', 'output': f'Error: {str(e)}'}

    def process_commands(self):
        try:
            result = self.supabase.table('server_commands').select('*').eq('server_id', self.server_id).eq('status', 'pending').execute()

            if result.data and len(result.data) > 0:
                for cmd_data in result.data:
                    cmd_id = cmd_data['id']
                    command = cmd_data['command']

                    print(f\"Executing: {command}\")

                    self.supabase.table('server_commands').update({
                        'status': 'executing',
                        'executed_at': datetime.utcnow().isoformat()
                    }).eq('id', cmd_id).execute()

                    result = self.execute_command(command)

                    self.supabase.table('server_commands').update({
                        'status': result['status'],
                        'output': result['output']
                    }).eq('id', cmd_id).execute()

                    print(f\"Result: {result['status']}\")
        except Exception as e:
            print(f\"Commands processing error: {e}\")

    def send_metrics(self):
        try:
            metrics = self.get_system_metrics()
            self.supabase.table('server_metrics').insert(metrics).execute()
            self.update_last_seen()
            print(f\"✓ CPU: {metrics['cpu_usage']:.1f}% | RAM: {metrics['memory_percent']:.1f}% | Disk: {metrics['disk_percent']:.1f}%\")
        except Exception as e:
            print(f\"Metrics error: {e}\")

    def send_services_status(self):
        try:
            services = self.get_services_status()
            if services:
                self.supabase.table('server_services').delete().eq('server_id', self.server_id).execute()
                self.supabase.table('server_services').insert(services).execute()
                running = len([s for s in services if s['status'] == 'running'])
                print(f\"✓ Services: {running}/{len(services)} running\")
        except Exception as e:
            print(f\"Services error: {e}\")

    def run(self):
        print(\"=\"*50)
        print(\"🚀 Server Monitoring Agent Started\")
        print(\"=\"*50)
        print(f\"Server ID: {self.server_id}\")
        print(f\"Hostname: {self.hostname}\")
        print(f\"Public IP: {self.public_ip}\")
        print(\"=\"*50)

        while True:
            try:
                current_time = time.time()

                if current_time - self.last_metrics_time >= 30:
                    self.send_metrics()
                    self.last_metrics_time = current_time

                if current_time - self.last_services_time >= 60:
                    self.send_services_status()
                    self.last_services_time = current_time

                if current_time - self.last_commands_time >= 2:
                    self.process_commands()
                    self.last_commands_time = current_time

                time.sleep(1)
            except KeyboardInterrupt:
                print(\"\\\\n🛑 Agent stopped by user\")
                break
            except Exception as e:
                print(f\"❌ Error: {e}\")
                time.sleep(5)

if __name__ == \"__main__\":
    agent = ServerAgent()
    agent.run()
`;

  return new Response(agentScript, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
});