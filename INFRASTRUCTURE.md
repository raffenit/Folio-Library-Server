# 📚 Media Server Manager (Docker + Caddy)

This folder contains the core configuration for the home media server, providing access to Kavita, Audiobookshelf, Folio, Dockhand, and n8n via a Caddy reverse proxy over Tailscale.

## 🛠 Quick Commands

Open a terminal in this folder to run these:

**Start everything (from `docker-files/`):**

```bash
./start-all.sh
```

**Or manually:**

```bash
cd ../infrastructure && docker compose up -d
cd ../Folio-Library-Server && docker compose up -d
cd ../ai-smart-home && docker compose up -d
```

Stop Servers:     `docker compose down`

Check Status:     `docker compose ps`

View Live Logs:   `docker compose logs -f`

Update Apps:      `docker compose pull && docker compose up -d`



## 🌐 Access Points



Kavita: http://100.100.67.105:8050

Audiobookshelf: http://100.100.67.105:81

Folio PWA: http://100.100.67.105:3001

Dockhand: http://100.100.67.105:8080

n8n (Workflows): http://100.100.67.105:5679

Direct (Backup): localhost:5000 or localhost:13378



## 📂 Folder Structure & Volumes



The docker-compose.yml maps your library into the containers from `/mnt/media/Library/`.

When adding libraries inside the apps, use these Internal Paths:

### Kavita Volumes:

`/mnt/media/Library/EBooks` ➔ `/Books/ebooks`

`/mnt/media/Library/GraphicNovels` ➔ `/Books/graphicnovels`

`/mnt/media/Library/Comics` ➔ `/Books/comics`

`/mnt/media/Library/Manga` ➔ `/Books/manga`

Config stored in: `./kavita_data`

### Audiobookshelf Volumes:

`/mnt/media/Library/Audio/Audiobooks` ➔ `/audiobooks`

`/mnt/media/Library/Audio/Podcasts` ➔ `/podcasts`

Config stored in: `./abs_config` and `./abs_metadata`



## ⚠️ Maintenance Reminders



* **Caddyfile Changes:** If you edit the Caddyfile, restart Caddy from the `infrastructure/` stack: `cd ../infrastructure && docker compose restart caddy`
* **Port Conflicts:** If you get a "Bind for 0.0.0.0:8050 failed" error, check for existing processes with `sudo ss -tlnp | grep 8050`.
* **Tailscale:** Ensure Tailscale is running on this host machine, or the 100.x.x.x IPs will not resolve from other devices.



