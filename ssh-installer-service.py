#!/usr/bin/env python3
"""
SSH Installer Service - Handles automatic agent installation via SSH
Run this on a server that can SSH to target servers
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import paramiko
import os
import time
from io import StringIO

app = Flask(__name__)
CORS(app)

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://ctfzlgsazqzzewnahvao.supabase.co')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0ZnpsZ3NhenF6emV3bmFodmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MTE0ODUsImV4cCI6MjA3OTM4NzQ4NX0.jhwWZVeWIWpeKZQC3b8fX00YeNRNyxfy03IJqDPi0WY')
INSTALL_SCRIPT_URL = 'https://project-scope-and-re-e6ao.bolt.host/install-agent.sh'

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'ssh-installer'})

@app.route('/install', methods=['POST'])
def install_agent():
    data = request.json
    hostname = data.get('hostname')
    port = data.get('port', 22)
    username = data.get('username')
    password = data.get('password')

    if not all([hostname, username, password]):
        return jsonify({
            'success': False,
            'error': 'Missing required fields'
        }), 400

    log_buffer = StringIO()

    def log(msg):
        log_buffer.write(msg + '\n')
        print(msg)

    try:
        log('🔐 Connecting to server via SSH...')

        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

        ssh.connect(
            hostname=hostname,
            port=port,
            username=username,
            password=password,
            timeout=10
        )

        log('✅ SSH connection successful')
        log('📥 Downloading and executing installer...')

        install_cmd = f'curl -sSL {INSTALL_SCRIPT_URL} | bash -s -- "{SUPABASE_URL}" "{SUPABASE_ANON_KEY}"'

        log('⏳ Installing agent (this may take 1-2 minutes)...\n')

        stdin, stdout, stderr = ssh.exec_command(install_cmd, get_pty=True)

        while not stdout.channel.exit_status_ready():
            if stdout.channel.recv_ready():
                output = stdout.channel.recv(1024).decode('utf-8')
                log(output.rstrip())
            time.sleep(0.1)

        exit_code = stdout.channel.recv_exit_status()

        remaining = stdout.read().decode('utf-8')
        if remaining:
            log(remaining.rstrip())

        error_output = stderr.read().decode('utf-8')
        if error_output:
            log(error_output.rstrip())

        ssh.close()

        if exit_code == 0:
            log('\n✅ Agent installed and started successfully!')
            log('🔄 Server will appear in dashboard shortly...')

            return jsonify({
                'success': True,
                'log': log_buffer.getvalue(),
                'message': 'Agent installed successfully'
            })
        else:
            log(f'\n❌ Installation failed with exit code {exit_code}')
            return jsonify({
                'success': False,
                'log': log_buffer.getvalue(),
                'error': 'Installation script failed'
            }), 500

    except paramiko.AuthenticationException:
        log('❌ SSH authentication failed - invalid credentials')
        return jsonify({
            'success': False,
            'log': log_buffer.getvalue(),
            'error': 'SSH authentication failed'
        }), 401

    except paramiko.SSHException as e:
        log(f'❌ SSH error: {str(e)}')
        return jsonify({
            'success': False,
            'log': log_buffer.getvalue(),
            'error': f'SSH error: {str(e)}'
        }), 500

    except Exception as e:
        log(f'❌ Error: {str(e)}')
        return jsonify({
            'success': False,
            'log': log_buffer.getvalue(),
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print('='*60)
    print('  SSH Installer Service Starting')
    print('='*60)
    print(f'Supabase URL: {SUPABASE_URL}')
    print(f'Install Script: {INSTALL_SCRIPT_URL}')
    print('='*60)
    app.run(host='0.0.0.0', port=5000, debug=False)
