# Translation Session Server - Installation Guide

## Voraussetzungen

- Hetzner Server mit Ubuntu 22.04/24.04
- SSH-Zugang zum Server
- Azure Account mit Speech Services
- GitHub Account
- Domain (optional, aber empfohlen)

---

## Phase 2: Docker Installation auf dem Server

### 1. Via SSH verbinden

```bash
ssh root@DEINE_SERVER_IP
```

### 2. System aktualisieren

```bash
apt update && apt upgrade -y
```

### 3. Docker installieren

```bash
# Docker Repository hinzufügen
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker installieren
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Docker starten und aktivieren
systemctl enable docker
systemctl start docker

# Testen
docker --version
docker compose version
```

### 4. Projektverzeichnis erstellen

```bash
mkdir -p /opt/translation-server
cd /opt/translation-server
```

---

## Phase 3: Projekt auf Server kopieren

### Option A: Via Git (empfohlen)

```bash
# Git installieren falls nötig
apt install -y git

# Repository klonen (ersetze mit deinem Repo)
cd /opt
git clone https://github.com/DEIN_USERNAME/translation-server.git
cd translation-server
```

### Option B: Via SCP (direkt von deinem Computer)

```bash
# Von deinem lokalen Computer aus:
scp -r ./translation-server root@DEINE_SERVER_IP:/opt/
```

---

## Phase 4: Konfiguration

### 1. .env Datei erstellen

```bash
cd /opt/translation-server
cp .env.example .env
nano .env
```

Fülle alle Werte aus:

```env
# Datenbank (sichere Passwörter generieren!)
POSTGRES_USER=translation_user
POSTGRES_PASSWORD=SICHERES_PASSWORT_HIER
POSTGRES_DB=translation_db
DATABASE_URL=postgresql://translation_user:SICHERES_PASSWORT_HIER@db:5432/translation_db

# Backend Secret (generieren mit: openssl rand -hex 32)
SECRET_KEY=DEIN_64_ZEICHEN_SECRET

# Azure Speech Services
AZURE_SPEECH_KEY=dein_azure_speech_key
AZURE_SPEECH_REGION=westeurope

# Azure Translator
AZURE_TRANSLATOR_KEY=dein_azure_translator_key
AZURE_TRANSLATOR_REGION=westeurope
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/

# URLs (für Produktion mit Domain)
NEXT_PUBLIC_API_URL=https://deine-domain.de
NEXT_PUBLIC_WS_URL=wss://deine-domain.de
FRONTEND_URL=https://deine-domain.de

# Domain
DOMAIN=deine-domain.de
EMAIL=deine-email@example.com
```

### 2. Secret Key generieren

```bash
openssl rand -hex 32
```

Kopiere das Ergebnis in die .env als SECRET_KEY.

---

## Phase 5: Starten

### 1. Docker Images bauen und starten

```bash
cd /opt/translation-server
docker compose up -d --build
```

### 2. Status prüfen

```bash
docker compose ps
docker compose logs -f
```

### 3. Testen

```bash
# Health Check
curl http://localhost/health

# Im Browser öffnen (mit Server-IP)
# http://DEINE_SERVER_IP
```

---

## Phase 6: SSL mit Let's Encrypt (für Domain)

### 1. Domain DNS konfigurieren

Bei deinem Domain-Provider:
- A-Record: `@` → `DEINE_SERVER_IP`
- A-Record: `www` → `DEINE_SERVER_IP`

### 2. Certbot installieren

```bash
apt install -y certbot
```

### 3. SSL-Zertifikat holen

```bash
# Temporär Nginx stoppen
docker compose stop nginx

# Zertifikat holen
certbot certonly --standalone -d deine-domain.de -d www.deine-domain.de --email deine-email@example.com --agree-tos

# Zertifikate kopieren
mkdir -p /opt/translation-server/nginx/ssl
cp -L /etc/letsencrypt/live/deine-domain.de/fullchain.pem /opt/translation-server/nginx/ssl/
cp -L /etc/letsencrypt/live/deine-domain.de/privkey.pem /opt/translation-server/nginx/ssl/
```

### 4. Nginx für HTTPS konfigurieren

Bearbeite `nginx/nginx.conf`:
- Kommentiere die HTTP->HTTPS Redirect Zeilen ein
- Kommentiere die SSL Zeilen ein
- Ändere `server_name` zu deiner Domain

### 5. Neustart

```bash
docker compose up -d
```

---

## Phase 7: GitHub Actions einrichten

### 1. Repository Secrets hinzufügen

In GitHub: Settings → Secrets and variables → Actions → New repository secret

- `SERVER_HOST`: Deine Server IP
- `SERVER_USER`: root (oder dein SSH-Benutzer)
- `SERVER_SSH_KEY`: Dein privater SSH-Key

### 2. Repository Variables hinzufügen

Settings → Secrets and variables → Actions → Variables

- `NEXT_PUBLIC_API_URL`: https://deine-domain.de
- `NEXT_PUBLIC_WS_URL`: wss://deine-domain.de

### 3. GitHub Container Registry aktivieren

Der Workflow nutzt GHCR automatisch. Stelle sicher, dass dein Repository public ist oder du entsprechende Berechtigungen hast.

---

## Wartung

### Logs anzeigen

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx
```

### Neustart

```bash
docker compose restart
```

### Update

```bash
cd /opt/translation-server
git pull
docker compose up -d --build
```

### Backup der Datenbank

```bash
docker compose exec db pg_dump -U translation_user translation_db > backup_$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Container startet nicht

```bash
docker compose logs [service_name]
```

### Datenbank-Verbindung fehlgeschlagen

```bash
# In DB-Container einloggen
docker compose exec db psql -U translation_user -d translation_db
```

### Ports bereits belegt

```bash
# Prüfen welcher Prozess Port 80 nutzt
lsof -i :80
```

### SSL-Zertifikat erneuern

```bash
certbot renew
docker compose restart nginx
```
