import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const AGENT_SCRIPT = `#!/usr/bin/env python3
import psutil
import time
import platform
import os
import sys
import urllib.request
from datetime import datetime
from supabase import create_client, Client

SUPABASE_URL = "https://wtxuzwkxabhojtarjtmz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0eHV6d2t4YWJob2p0YXJqdG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MjY1ODQsImV4cCI6MjA3OTUwMjU4NH0.xHEJxcdg7QgzsyLEnA9PRXCVPj2n56IYtykDpbHaQIU"

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
        load_avg = os.getloadavg() if hasattr(os, 'getloadavg') else [0, 0, 0]
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
            "load_average": list(load_avg),
            "recorded_at": datetime.utcnow().isoformat()
        }

    def get_services_status(self):
        services = []
        common_services = [
            'apache2', 'nginx', 'httpd', 'mysql', 'mariadb',
            'postgresql', 'redis', 'docker', 'sshd', 'ssh',
            'mongod', 'elasticsearch', 'rabbitmq-server'
        ]

        import subprocess
        for service_name in common_services:
            try:
                result = subprocess.run(
                    ['systemctl', 'is-active', service_name],
                    capture_output=True,
                    text=True,
                    timeout=2
                )
                status_output = result.stdout.strip()

                if status_output == 'active':
                    is_enabled = subprocess.run(
                        ['systemctl', 'is-enabled', service_name],
                        capture_output=True,
                        text=True,
                        timeout=2
                    ).stdout.strip() == 'enabled'

                    services.append({
                        'server_id': self.server_id,
                        'service_name': service_name,
                        'status': 'running',
                        'enabled': is_enabled
                    })
                elif status_output == 'inactive':
                    services.append({
                        'server_id': self.server_id,
                        'service_name': service_name,
                        'status': 'stopped',
                        'enabled': False
                    })
                elif status_output == 'failed':
                    services.append({
                        'server_id': self.server_id,
                        'service_name': service_name,
                        'status': 'failed',
                        'enabled': False
                    })
            except:
                continue

        return services

    def update_services(self):
        try:
            services = self.get_services_status()
            if services:
                self.supabase.table('server_services').delete().eq('server_id', self.server_id).execute()
                self.supabase.table('server_services').insert(services).execute()
                print(f"Services updated: {len(services)} services found")
        except Exception as e:
            print(f"Services update error: {e}")

    def send_metrics(self):
        try:
            metrics = self.get_system_metrics()
            self.supabase.table('server_metrics').insert(metrics).execute()
            print(f"Metrics sent - CPU: {metrics['cpu_usage']:.1f}% | RAM: {metrics['memory_percent']:.1f}%")
        except Exception as e:
            print(f"Metrics error: {e}")

    def run(self):
        print("Agent started!")
        last_services_update = 0
        while True:
            current_time = time.time()
            if current_time - self.last_metrics_time >= 30:
                self.send_metrics()
                self.last_metrics_time = current_time

            if current_time - last_services_update >= 60:
                self.update_services()
                last_services_update = current_time

            time.sleep(1)

if __name__ == "__main__":
    agent = ServerAgent()
    agent.run()
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    return new Response(AGENT_SCRIPT, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain",
        "Content-Disposition": "attachment; filename=server-agent.py",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});