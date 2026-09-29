#!/usr/bin/env bash
# Jalankan SEKALI di EC2 (Ubuntu 22.04/24.04): bash setup-ec2.sh
set -euo pipefail

# 1) Swap 2GB (t2/t3.micro hanya 1GB RAM)
if ! swapon --show | grep -q swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# 2) Firewall host + fail2ban (proteksi brute-force SSH)
sudo apt-get install -y fail2ban ufw
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 3000/tcp
sudo ufw --force enable

# 3) Folder + .env (secret dibuat di server, TIDAK di git)
mkdir -p ~/app && cd ~/app
if [ ! -f .env ]; then
  cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 16)
GRAFANA_PASSWORD=$(openssl rand -hex 12)
ENV
  chmod 600 .env
fi
echo "Selesai. LOGOUT lalu LOGIN lagi agar group docker aktif."
echo "Password Grafana: $(grep GRAFANA_PASSWORD ~/app/.env)"

