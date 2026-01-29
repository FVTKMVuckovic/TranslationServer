#!/bin/bash
# ===========================================
# Translation Session Server - Setup Script
# Für Ubuntu 24.04 auf Hetzner
# ===========================================

set -e

echo "🚀 Translation Session Server Setup"
echo "===================================="
echo ""

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# System aktualisieren
echo -e "${YELLOW}[1/6] System aktualisieren...${NC}"
apt update && apt upgrade -y

# Benötigte Pakete installieren
echo -e "${YELLOW}[2/6] Pakete installieren...${NC}"
apt install -y ca-certificates curl gnupg git

# Docker Repository hinzufügen
echo -e "${YELLOW}[3/6] Docker Repository einrichten...${NC}"
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker installieren
echo -e "${YELLOW}[4/6] Docker installieren...${NC}"
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Docker starten und aktivieren
systemctl enable docker
systemctl start docker

# Firewall konfigurieren (UFW)
echo -e "${YELLOW}[5/6] Firewall konfigurieren...${NC}"
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Projektverzeichnis erstellen
echo -e "${YELLOW}[6/6] Projektverzeichnis vorbereiten...${NC}"
mkdir -p /opt/translation-server
mkdir -p /var/www/certbot

echo ""
echo -e "${GREEN}✅ Setup abgeschlossen!${NC}"
echo ""
echo "Docker Version:"
docker --version
echo ""
echo "Docker Compose Version:"
docker compose version
echo ""
echo "Nächste Schritte:"
echo "1. Projekt nach /opt/translation-server kopieren"
echo "2. .env Datei konfigurieren"
echo "3. docker compose up -d --build"
