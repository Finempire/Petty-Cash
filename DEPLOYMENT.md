# Petty Cash Management System – Deployment Guide

## Prerequisites

- Node.js v22+ (requires `node:sqlite` built-in)
- npm 10+
- Linux/macOS/Windows server

## Project Structure

```
petty-cash/
├── client/          # React frontend (Vite)
├── server/          # Express backend
│   ├── data/        # SQLite database (auto-created)
│   ├── uploads/     # Uploaded invoice and payment proof files
│   └── src/
│       ├── db/      # Schema and seed scripts
│       └── routes/  # API endpoints
└── DEPLOYMENT.md
```

## Quick Start (Development)

```bash
# 1. Backend
cd server
cp .env.example .env    # Edit PORT, JWT_SECRET, NODE_ENV
npm install
node src/db/seed.js     # Seed test data (optional)
npm run dev             # Starts on http://localhost:5001

# 2. Frontend
cd client
npm install
npm run dev             # Starts on http://localhost:5173
```

## Environment Variables

### Server (`server/.env`)

| Variable     | Default        | Description                    |
| ------------ | -------------- | ------------------------------ |
| `PORT`       | `5001`         | API server port                |
| `JWT_SECRET` | (required)     | Secret key for JWT signing     |
| `NODE_ENV`   | `development`  | Set to `production` in prod    |

## Production Build

### Frontend

```bash
cd client
npm run build      # Outputs to client/dist/
```

### Backend

```bash
cd server
NODE_ENV=production node src/index.js
```

## Production Deployment (Ubuntu + PM2 + Nginx)

### 1. Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Install PM2

```bash
sudo npm install -g pm2
```

### 3. Clone and Setup

```bash
cd /opt
git clone <repo-url> petty-cash
cd petty-cash

# Backend
cd server
npm install --omit=dev
cp .env.example .env
# Edit .env: set JWT_SECRET, NODE_ENV=production

# Seed database (first time only)
node src/db/seed.js

# Frontend
cd ../client
npm install
npm run build
```

### 4. Start with PM2

```bash
cd /opt/petty-cash/server
pm2 start src/index.js --name petty-cash-api
pm2 save
pm2 startup   # Auto-start on reboot
```

### 5. Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name petty.yourdomain.com;

    # Frontend (built files)
    root /opt/petty-cash/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M;
    }
}
```

### 6. SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d petty.yourdomain.com
```

## Database

- SQLite database auto-creates at `server/data/petty_cash.db`
- Schema applied on every server start (uses `CREATE TABLE IF NOT EXISTS`)
- Back up this file regularly: `cp data/petty_cash.db data/backup_$(date +%Y%m%d).db`

## Test Credentials (from seed)

| Role           | Email                      | Password    |
| -------------- | -------------------------- | ----------- |
| Store Manager  | store@textileco.com        | store123    |
| Runner Boy     | runner@textileco.com       | runner123   |
| Accountant     | accounts@textileco.com     | accounts123 |
| CEO            | ceo@textileco.com          | ceo123      |

## Health Check

```bash
curl http://localhost:5001/api/health
# {"status":"OK","time":"..."}
```
