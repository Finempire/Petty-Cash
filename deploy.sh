#!/bin/bash
set -e

echo "=== Petty Cash Deployment Script ==="
echo "=== Server: Linode Ubuntu ==="

# 1. System Update
echo "[1/8] Updating system packages..."
apt-get update -y && apt-get upgrade -y

# 2. Install Node.js 22
echo "[2/8] Installing Node.js 22..."
if ! node --version 2>/dev/null | grep -q "v22"; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# 3. Install Nginx
echo "[3/8] Installing Nginx..."
apt-get install -y nginx
systemctl enable nginx

# 4. Install PM2
echo "[4/8] Installing PM2..."
npm install -g pm2

# 5. Clone repo
echo "[5/8] Cloning repository..."
APP_DIR="/opt/petty-cash"
if [ -d "$APP_DIR" ]; then
    echo "Directory exists, pulling latest..."
    cd "$APP_DIR" && git pull origin main
else
    git clone https://github.com/Finempire/Petty-Cash.git "$APP_DIR"
fi
cd "$APP_DIR"

# 6. Setup Backend
echo "[6/8] Setting up backend..."
cd "$APP_DIR/server"
npm install --production

# Create .env if not exists
if [ ! -f .env ]; then
cat > .env << 'ENVEOF'
PORT=5001
JWT_SECRET=petty_cash_prod_secret_2026_linode
CORS_ORIGINS=http://45.79.121.173
ENVEOF
echo ".env created"
fi

# Ensure data directory exists
mkdir -p data

# Seed DB if fresh install
if [ ! -f data/petty_cash.db ]; then
    echo "Seeding database..."
    node src/db/seed.js 2>/dev/null || echo "Seed script ran (may have pre-existing data)"
fi

# 7. Build Frontend
echo "[7/8] Building frontend..."
cd "$APP_DIR/client"
npm install

# Create .env for build
cat > .env << 'ENVEOF'
VITE_API_URL=http://45.79.121.173/api
ENVEOF

npm run build
echo "Frontend built successfully"

# 8. Configure Nginx
echo "[8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/petty-cash << 'NGINXEOF'
server {
    listen 80;
    server_name 45.79.121.173;

    # Frontend - serve static files
    root /opt/petty-cash/client/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/petty-cash /etc/nginx/sites-enabled/petty-cash
rm -f /etc/nginx/sites-enabled/default

# Test and restart Nginx
nginx -t && systemctl restart nginx

# Start backend with PM2
echo "Starting backend with PM2..."
cd "$APP_DIR/server"
pm2 delete petty-cash-api 2>/dev/null || true
pm2 start src/index.js --name petty-cash-api
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# Open firewall
echo "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable 2>/dev/null || true

echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "  App URL: http://45.79.121.173"
echo "  API URL: http://45.79.121.173/api"
echo "============================================"
echo ""
echo "To update later: cd /opt/petty-cash && git pull && cd client && npm run build && pm2 restart petty-cash-api"
