#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy.sh — Déploiement automatisé de FriseChrono sur Ubuntu 25.04
#              Backend Express + Frontend React (build statique)
#              MongoDB local, Nginx reverse-proxy, Cloudflare Tunnel
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage (en tant que root ou avec sudo) :
#   chmod +x deploy.sh && sudo ./deploy.sh
#
# Pré-requis : Ubuntu 25.04, accès root, un repo Git avec le code FriseChrono
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─────────────────── CONFIGURATION ───────────────────
APP_NAME="frisechrono"
DOMAIN="frisechrono.galaxy-pro.fr"
APP_DIR="/opt/${APP_NAME}"
APP_USER="frisechrono"
REPO_URL=""                          # ← À remplir avec ton URL Git
BRANCH="main"
NODE_VERSION="22"                    # LTS
BACKEND_PORT=5001
MONGO_DB_NAME="frisechrono"

# ─── Couleurs ───
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[  OK]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

# ─── Vérifications ───
[[ $EUID -ne 0 ]] && error "Ce script doit être exécuté en root (sudo ./deploy.sh)"
[[ -z "$REPO_URL" ]] && error "Renseigne REPO_URL dans le script (ligne 28)"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Déploiement FriseChrono — ${DOMAIN}        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════
# 1. MISE À JOUR SYSTÈME
# ═══════════════════════════════════════════════════════════
info "Mise à jour du système…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
ok "Système à jour"

# ═══════════════════════════════════════════════════════════
# 2. DÉPENDANCES SYSTÈME
# ═══════════════════════════════════════════════════════════
info "Installation des paquets nécessaires…"
apt-get install -y -qq \
  curl wget gnupg2 ca-certificates lsb-release \
  git build-essential nginx ufw fail2ban \
  software-properties-common apt-transport-https
ok "Paquets installés"

# ═══════════════════════════════════════════════════════════
# 3. NODE.JS (via NodeSource)
# ═══════════════════════════════════════════════════════════
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_VERSION" ]]; then
  info "Installation de Node.js ${NODE_VERSION}.x…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y -qq nodejs
fi
ok "Node.js $(node -v) — npm $(npm -v)"

# ═══════════════════════════════════════════════════════════
# 4. MONGODB 8.0
# ═══════════════════════════════════════════════════════════
if ! command -v mongod &>/dev/null; then
  info "Installation de MongoDB 8.0…"
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
    gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -qq
  apt-get install -y -qq mongodb-org
fi
systemctl enable mongod --now
ok "MongoDB $(mongod --version | head -1 | awk '{print $3}')"

# ═══════════════════════════════════════════════════════════
# 5. UTILISATEUR APPLICATIF
# ═══════════════════════════════════════════════════════════
if ! id "$APP_USER" &>/dev/null; then
  info "Création de l'utilisateur ${APP_USER}…"
  useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" "$APP_USER"
fi
ok "Utilisateur ${APP_USER}"

# ═══════════════════════════════════════════════════════════
# 6. CLONE / PULL DU CODE
# ═══════════════════════════════════════════════════════════
if [[ -d "${APP_DIR}/.git" ]]; then
  info "Mise à jour du code (git pull)…"
  cd "$APP_DIR"
  git fetch --all
  git reset --hard "origin/${BRANCH}"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  info "Clone du repo…"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi
ok "Code source à jour"

# ═══════════════════════════════════════════════════════════
# 7. FICHIER .ENV (backend)
# ═══════════════════════════════════════════════════════════
ENV_FILE="${APP_DIR}/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  info "Création du fichier .env de production…"
  JWT_SECRET=$(openssl rand -hex 32)
  cat > "$ENV_FILE" <<EOF
# ── Production ──
PORT=${BACKEND_PORT}
MONGODB_URI=mongodb://127.0.0.1:27017/${MONGO_DB_NAME}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://${DOMAIN}
NODE_ENV=production
EOF
  warn "Un JWT_SECRET aléatoire a été généré. Vérifie ${ENV_FILE}"
else
  ok ".env existant conservé"
fi

# ═══════════════════════════════════════════════════════════
# 8. INSTALLATION DES DÉPENDANCES & BUILD
# ═══════════════════════════════════════════════════════════
info "Installation des dépendances backend…"
cd "${APP_DIR}/backend"
npm ci --production --silent 2>/dev/null || npm install --production --silent
ok "Dépendances backend"

info "Installation et build du frontend…"
cd "${APP_DIR}/frontend"
npm ci --silent 2>/dev/null || npm install --silent
npx vite build
ok "Frontend compilé → ${APP_DIR}/frontend/dist"

# ═══════════════════════════════════════════════════════════
# 9. PERMISSIONS
# ═══════════════════════════════════════════════════════════
chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
ok "Permissions"

# ═══════════════════════════════════════════════════════════
# 10. SERVICE SYSTEMD (backend)
# ═══════════════════════════════════════════════════════════
info "Configuration du service systemd…"
cat > /etc/systemd/system/${APP_NAME}.service <<EOF
[Unit]
Description=FriseChrono Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=${APP_DIR}/backend/.env
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}

# Sécurité
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${APP_NAME}"
systemctl restart "${APP_NAME}"
sleep 2

# Vérifier que le backend répond
if curl -sf "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
  ok "Backend démarré sur le port ${BACKEND_PORT}"
else
  warn "Le backend ne répond pas encore — vérifie : journalctl -u ${APP_NAME} -f"
fi

# ═══════════════════════════════════════════════════════════
# 11. NGINX — Reverse Proxy + fichiers statiques
# ═══════════════════════════════════════════════════════════
info "Configuration Nginx…"
cat > /etc/nginx/sites-available/${APP_NAME} <<'NGINX'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    # ─── Frontend (fichiers statiques Vite build) ───
    root APP_DIR_PLACEHOLDER/frontend/dist;
    index index.html;

    # Compression gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript
               text/xml application/xml image/svg+xml;

    # Cache des assets statiques (Vite ajoute des hash aux noms)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ─── API → Backend Express ───
    location /api/ {
        proxy_pass http://127.0.0.1:BACKEND_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeout pour les requêtes longues
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;

        # Taille max des requêtes (frises volumineuses)
        client_max_body_size 15M;
    }

    # ─── SPA fallback — toutes les routes → index.html ───
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Bloquer les fichiers cachés
    location ~ /\. {
        deny all;
        return 404;
    }
}
NGINX

# Remplacer les placeholders
sed -i "s|DOMAIN_PLACEHOLDER|${DOMAIN}|g" /etc/nginx/sites-available/${APP_NAME}
sed -i "s|APP_DIR_PLACEHOLDER|${APP_DIR}|g" /etc/nginx/sites-available/${APP_NAME}
sed -i "s|BACKEND_PORT_PLACEHOLDER|${BACKEND_PORT}|g" /etc/nginx/sites-available/${APP_NAME}

ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx
ok "Nginx configuré"

# ═══════════════════════════════════════════════════════════
# 12. FIREWALL (UFW)
# ═══════════════════════════════════════════════════════════
info "Configuration du pare-feu…"
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp    # Nginx (Cloudflare Tunnel s'y connecte en local)
ufw --force enable
ok "UFW actif (SSH + HTTP uniquement)"

# ═══════════════════════════════════════════════════════════
# 13. FAIL2BAN
# ═══════════════════════════════════════════════════════════
info "Configuration Fail2Ban…"
cat > /etc/fail2ban/jail.d/${APP_NAME}.conf <<EOF
[sshd]
enabled  = true
port     = ssh
maxretry = 5
bantime  = 3600

[nginx-http-auth]
enabled  = true
maxretry = 5
bantime  = 3600
EOF

systemctl enable fail2ban --now
systemctl restart fail2ban
ok "Fail2Ban actif"

# ═══════════════════════════════════════════════════════════
# 14. CLOUDFLARE TUNNEL (cloudflared)
# ═══════════════════════════════════════════════════════════
info "Installation de cloudflared…"
if ! command -v cloudflared &>/dev/null; then
  curl -fsSL https://pkg.cloudflare.com/cloudflared-ascii.gpg | \
    gpg --dearmor -o /usr/share/keyrings/cloudflared.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloudflared.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/cloudflared.list
  apt-get update -qq
  apt-get install -y -qq cloudflared
fi
ok "cloudflared $(cloudflared --version 2>&1 | awk '{print $3}')"

# ─── Authentification du tunnel ───
CRED_DIR="/root/.cloudflared"
if [[ ! -f "${CRED_DIR}/cert.pem" ]]; then
  echo ""
  warn "═══ ÉTAPE MANUELLE REQUISE ═══"
  echo -e "${YELLOW}  Exécute la commande suivante pour te connecter à Cloudflare :${NC}"
  echo ""
  echo -e "    ${CYAN}cloudflared tunnel login${NC}"
  echo ""
  echo -e "${YELLOW}  Un lien s'ouvrira dans ton navigateur. Connecte-toi et autorise.${NC}"
  echo -e "${YELLOW}  Puis relance ce script pour continuer.${NC}"
  echo ""
  exit 0
fi

# ─── Créer le tunnel s'il n'existe pas ───
TUNNEL_NAME="${APP_NAME}-tunnel"
if ! cloudflared tunnel list 2>/dev/null | grep -q "$TUNNEL_NAME"; then
  info "Création du tunnel '${TUNNEL_NAME}'…"
  cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "$TUNNEL_NAME" | awk '{print $1}')
if [[ -z "$TUNNEL_ID" ]]; then
  error "Impossible de trouver l'ID du tunnel. Vérifie avec : cloudflared tunnel list"
fi
ok "Tunnel : ${TUNNEL_NAME} (${TUNNEL_ID})"

# ─── Configuration du tunnel ───
info "Configuration du tunnel Cloudflare…"
mkdir -p /etc/cloudflared
cat > /etc/cloudflared/config.yml <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${CRED_DIR}/${TUNNEL_ID}.json

ingress:
  # Tout le trafic vers ${DOMAIN} → Nginx local
  - hostname: ${DOMAIN}
    service: http://localhost:80
    originRequest:
      noTLSVerify: true
  # 404 pour le reste
  - service: http_status:404
EOF
ok "Config tunnel → /etc/cloudflared/config.yml"

# ─── Enregistrement DNS ───
info "Ajout du CNAME DNS pour ${DOMAIN}…"
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN" 2>/dev/null || \
  warn "CNAME déjà existant ou erreur DNS — vérifie sur le dashboard Cloudflare"

# ─── Service systemd pour cloudflared ───
info "Installation du service cloudflared…"
cloudflared service install 2>/dev/null || true
systemctl enable cloudflared --now
systemctl restart cloudflared
ok "Tunnel Cloudflare actif"

# ═══════════════════════════════════════════════════════════
# 15. SCRIPT DE MISE À JOUR (redeploy)
# ═══════════════════════════════════════════════════════════
info "Création du script de mise à jour…"
cat > /usr/local/bin/${APP_NAME}-update <<'UPDATE'
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="APP_DIR_PLACEHOLDER"
APP_NAME="APP_NAME_PLACEHOLDER"

echo "🔄 Mise à jour de FriseChrono…"

cd "$APP_DIR"
git fetch --all
git reset --hard origin/main
git pull origin main

echo "📦 Backend…"
cd "${APP_DIR}/backend"
npm ci --production --silent 2>/dev/null || npm install --production --silent

echo "🏗️  Frontend…"
cd "${APP_DIR}/frontend"
npm ci --silent 2>/dev/null || npm install --silent
npx vite build

echo "🔐 Permissions…"
chown -R APP_USER_PLACEHOLDER:APP_USER_PLACEHOLDER "$APP_DIR"

echo "♻️  Redémarrage…"
systemctl restart APP_NAME_PLACEHOLDER

sleep 2
if curl -sf http://localhost:BACKEND_PORT_PLACEHOLDER/api/health >/dev/null; then
  echo "✅ FriseChrono mis à jour et opérationnel."
else
  echo "⚠️  Le backend ne répond pas. Vérifie : journalctl -u APP_NAME_PLACEHOLDER -f"
fi
UPDATE

sed -i "s|APP_DIR_PLACEHOLDER|${APP_DIR}|g" /usr/local/bin/${APP_NAME}-update
sed -i "s|APP_NAME_PLACEHOLDER|${APP_NAME}|g" /usr/local/bin/${APP_NAME}-update
sed -i "s|APP_USER_PLACEHOLDER|${APP_USER}|g" /usr/local/bin/${APP_NAME}-update
sed -i "s|BACKEND_PORT_PLACEHOLDER|${BACKEND_PORT}|g" /usr/local/bin/${APP_NAME}-update
chmod +x /usr/local/bin/${APP_NAME}-update
ok "Script de mise à jour → ${APP_NAME}-update"

# ═══════════════════════════════════════════════════════════
# 16. LOGROTATE
# ═══════════════════════════════════════════════════════════
cat > /etc/logrotate.d/${APP_NAME} <<EOF
/var/log/${APP_NAME}/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
ok "Logrotate configuré"

# ═══════════════════════════════════════════════════════════
# RÉSUMÉ FINAL
# ═══════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        ✅  DÉPLOIEMENT TERMINÉ AVEC SUCCÈS              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Domaine     :${NC} https://${DOMAIN}"
echo -e "  ${CYAN}Backend     :${NC} http://localhost:${BACKEND_PORT} (interne)"
echo -e "  ${CYAN}Frontend    :${NC} ${APP_DIR}/frontend/dist (via Nginx)"
echo -e "  ${CYAN}Tunnel      :${NC} ${TUNNEL_NAME} (${TUNNEL_ID})"
echo ""
echo -e "  ${YELLOW}Commandes utiles :${NC}"
echo -e "    ${CYAN}frisechrono-update${NC}              Mettre à jour depuis Git"
echo -e "    ${CYAN}systemctl status frisechrono${NC}    État du backend"
echo -e "    ${CYAN}journalctl -u frisechrono -f${NC}    Logs backend en temps réel"
echo -e "    ${CYAN}systemctl status cloudflared${NC}    État du tunnel"
echo -e "    ${CYAN}systemctl status nginx${NC}          État de Nginx"
echo -e "    ${CYAN}systemctl status mongod${NC}         État de MongoDB"
echo ""
