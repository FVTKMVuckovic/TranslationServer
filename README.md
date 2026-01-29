# Translation Session Server

Ein professionelles Echtzeit-Übersetzungssystem für Schulungen und Präsentationen.

## Features

- 🎤 **Speech-to-Text**: Echtzeit-Transkription mit Azure Speech Services
- 🌍 **Mehrsprachige Übersetzung**: Deutsch → Englisch, Serbisch (kyrillisch)
- 🔊 **Text-to-Speech**: Audio-Ausgabe für Teilnehmer
- 📱 **Mobile-optimiert**: QR-Code zum schnellen Beitreten
- 🔐 **Sicher**: 2FA-Authentifizierung, interne Datenbank
- ⚡ **Echtzeit**: WebSocket-basierte Kommunikation

## Architektur

```
┌──────────────────────────────────────────────────┐
│                 Hetzner Server                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │   Nginx    │──│  Frontend  │──│  Backend   │ │
│  │  (Proxy)   │  │  (Next.js) │  │  (FastAPI) │ │
│  └────────────┘  └────────────┘  └────────────┘ │
│                        │              │         │
│                        └──────┬───────┘         │
│                               │                 │
│                      ┌────────────────┐         │
│                      │   PostgreSQL   │         │
│                      │   (intern)     │         │
│                      └────────────────┘         │
└──────────────────────────────────────────────────┘
```

## Quick Start

### Voraussetzungen

- Docker & Docker Compose
- Azure Speech Services Account
- Azure Translator Account

### Installation

1. Repository klonen:
```bash
git clone https://github.com/yourusername/translation-server.git
cd translation-server
```

2. Konfiguration:
```bash
cp .env.example .env
# .env bearbeiten und alle Werte ausfüllen
```

3. Starten:
```bash
docker compose up -d
```

4. Öffnen: http://localhost

## Benutzung

### Als Session-Leiter

1. Account erstellen unter `/login`
2. Optional: 2FA aktivieren
3. Neue Session starten
4. QR-Code/Link an Teilnehmer verteilen
5. Mikrofon aktivieren und sprechen

### Als Teilnehmer

1. QR-Code scannen oder Session-Code eingeben
2. Sprache wählen (English / Српски)
3. Live-Übersetzung empfangen

## API Dokumentation

Nach dem Start verfügbar unter: http://localhost:8000/docs

## Technologie-Stack

- **Backend**: Python, FastAPI, SQLAlchemy
- **Frontend**: Next.js 14, React, TailwindCSS
- **Datenbank**: PostgreSQL
- **AI Services**: Azure Speech Services, Azure Translator
- **Infrastruktur**: Docker, Nginx, GitHub Actions

## Lizenz

MIT

---

Entwickelt mit ❤️ für bessere Kommunikation
