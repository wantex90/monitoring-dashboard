# Quick Install - Server Monitoring Agent

## Super Simple Installation

Jalankan 1 perintah ini di server Anda:

```bash
curl -sSL https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-installer | sudo bash
```

**ATAU** pakai wget:

```bash
wget -qO- https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-installer | sudo bash
```

## Itu Saja!

Setelah installer selesai:
- Server otomatis terdaftar di dashboard Anda
- Metrics dikirim setiap 30 detik
- Agent auto-start on boot
- Cek dashboard Anda dalam ~30 detik!

## Management Commands

```bash
# Lihat status
sudo systemctl status monitor-agent

# Lihat logs real-time
sudo journalctl -u monitor-agent -f

# Restart agent
sudo systemctl restart monitor-agent

# Stop agent
sudo systemctl stop monitor-agent

# Uninstall
sudo /opt/server-monitor/uninstall.sh
```

## URLs

Kalau mau download manual:

- **Installer**: https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-installer
- **Python Agent**: https://wtxuzwkxabhojtarjtmz.supabase.co/functions/v1/get-agent-script

## Support

Cek logs kalau ada masalah:
```bash
sudo journalctl -u monitor-agent -n 50
```

Common issues:
- Pastikan server bisa connect ke internet
- Pastikan Python 3 terinstall
- Pastikan firewall tidak block outbound connections
