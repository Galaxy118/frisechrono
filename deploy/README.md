# Déploiement FriseChrono — VPS Ubuntu 25.04 + Cloudflare Tunnel

## Architecture

```
Navigateur → Cloudflare CDN → Cloudflare Tunnel → VPS
                                                    ├─ Nginx :80
                                                    │   ├─ /api/*  → Express :5001
                                                    │   └─ /*      → frontend/dist (statique)
                                                    ├─ Node.js (backend Express)
                                                    └─ MongoDB :27017
```

## Pré-requis

- VPS Ubuntu 25.04 avec accès root (SSH)
- Un domaine géré par Cloudflare (`frisechrono.galaxy-pro.fr`)
- Le code poussé sur un repo Git (GitHub / GitLab)

## Déploiement initial

### 1. Pousser le code sur Git

```bash
cd /Users/arielnoteris/Desktop/Projet/frisechrono
git init
git add -A
git commit -m "Initial commit"
git remote add origin git@github.com:TON_USER/frisechrono.git
git push -u origin main
```

### 2. Se connecter au VPS

```bash
ssh root@IP_DU_VPS
```

### 3. Préparer et lancer le script

```bash
# Récupérer le script
curl -O https://raw.githubusercontent.com/TON_USER/frisechrono/main/deploy/deploy.sh
chmod +x deploy.sh

# ⚠️  Éditer REPO_URL dans le script (ligne 28)
nano deploy.sh

# Lancer
sudo ./deploy.sh
```

### 4. Première exécution — Cloudflare Login

Le script s'arrêtera pour te demander de te connecter à Cloudflare :

```bash
cloudflared tunnel login
```

Un lien apparaîtra — ouvre-le dans ton navigateur, autorise le domaine, puis relance :

```bash
sudo ./deploy.sh
```

## Mise à jour

Après chaque `git push` sur `main`, connecte-toi au VPS et lance :

```bash
sudo frisechrono-update
```

Ce script :
1. Pull le dernier code
2. Installe les nouvelles dépendances
3. Rebuild le frontend
4. Redémarre le backend
5. Vérifie le health check

## Commandes utiles

| Commande | Description |
|---|---|
| `systemctl status frisechrono` | État du backend |
| `journalctl -u frisechrono -f` | Logs backend en temps réel |
| `systemctl restart frisechrono` | Redémarrer le backend |
| `systemctl status cloudflared` | État du tunnel Cloudflare |
| `systemctl status nginx` | État de Nginx |
| `systemctl status mongod` | État de MongoDB |
| `frisechrono-update` | Mise à jour depuis Git |

## Structure sur le VPS

```
/opt/frisechrono/
├── backend/
│   ├── .env              ← Config production (auto-générée)
│   ├── server.js
│   ├── config/
│   ├── models/
│   ├── routes/
│   └── node_modules/
└── frontend/
    ├── dist/             ← Build statique servi par Nginx
    └── ...

/etc/nginx/sites-available/frisechrono    ← Config Nginx
/etc/systemd/system/frisechrono.service   ← Service backend
/etc/cloudflared/config.yml               ← Config tunnel
/usr/local/bin/frisechrono-update         ← Script de mise à jour
```

## Sécurité

- **Cloudflare Tunnel** : pas de port exposé publiquement (même le 80/443)
- **UFW** : seuls SSH et HTTP local autorisés
- **Fail2Ban** : protection brute-force SSH et Nginx
- **systemd sandboxing** : `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`
- **JWT_SECRET** : généré aléatoirement au premier déploiement

## Dépannage

### Le backend ne démarre pas
```bash
journalctl -u frisechrono -n 50 --no-pager
```

### MongoDB ne démarre pas
```bash
systemctl status mongod
journalctl -u mongod -n 20 --no-pager
```

### Le tunnel ne fonctionne pas
```bash
systemctl status cloudflared
cloudflared tunnel list
cloudflared tunnel info frisechrono-tunnel
```

### Tester en local sur le VPS
```bash
curl http://localhost:5001/api/health    # Backend
curl http://localhost/                   # Nginx → Frontend
```
