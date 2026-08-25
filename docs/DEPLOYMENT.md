# BusinessHub — Production Deployment (Ubuntu VPS)

Guide for deploying BusinessHub to a fresh Ubuntu 22.04/24.04 VPS with Node.js, MySQL, PM2, Nginx and HTTPS.

---

## 1. Server basics

```bash
sudo apt update && sudo apt upgrade -y
sudo adduser deploy
sudo usermod -aG sudo deploy
# copy your SSH key, then disable password/root login in /etc/ssh/sshd_config
sudo ufw allow OpenSSH
```

## 2. Install Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

## 3. Install & harden MySQL 8

```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
sudo mysql
```

```sql
CREATE DATABASE businesshub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'businesshub'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON businesshub.* TO 'businesshub'@'localhost';
FLUSH PRIVILEGES;
```

## 4. Get the code & configure

```bash
cd /var/www
sudo git clone <your-repo-url> businesshub && sudo chown deploy:deploy businesshub
cd businesshub
npm run install-all
```

**backend/.env**

```ini
DATABASE_URL="mysql://businesshub:STRONG_PASSWORD_HERE@localhost:3306/businesshub"
PORT=5000
NODE_ENV=production
JWT_SECRET="<openssl rand -hex 32 output>"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="https://your-domain.com"
```

> In production the Express app also serves `frontend/dist`, so `VITE_API_URL` can stay empty and API calls go to `/api` on the same origin.

## 5. Run production migrations & build

```bash
cd backend
npm run db:deploy        # applies prisma/migrations — never use migrate dev on prod
# optional demo data: npm run db:seed   (skip on real deployments)
```

```bash
cd ../frontend
npm run build            # outputs frontend/dist
```

## 6. Run Express with PM2

```bash
sudo npm i -g pm2
cd backend
pm2 start src/server.js --name businesshub-api
pm2 save
pm2 startup systemd      # run the printed command once
pm2 monit                # live monitoring
pm2 logs businesshub-api
```

## 7. Configure Nginx (reverse proxy + static)

`sudo nano /etc/nginx/sites-available/businesshub`:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 5m;

    # Basic rate limiting for auth endpoints
    location /api/auth/ {
        limit_req zone=auth burst=10 nodelay;
        proxy_pass http://127.0.0.1:5000;
        include proxy_params;
    }

    # API → Express
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend static files
    root /var/www/businesshub/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }
}
```

Define the rate-limit zone once in `/etc/nginx/conf.d/ratelimit.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/businesshub /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Domain & SSL

1. Point DNS A records (`your-domain.com`, `www`) at the VPS IP.
2. Issue a free certificate:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
# auto-renewal is installed by default; verify:
sudo certbot renew --dry-run
```

Certbot rewrites the Nginx server block to HTTPS with redirects.

## 9. Firewall

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Only 22/80/443 are exposed; MySQL and PM2 stay local.

## 10. Updating the application

```bash
cd /var/www/businesshub
git pull

npm --prefix backend install
npm --prefix frontend install

cd backend && npm run db:deploy     # if migrations changed
cd ../frontend && npm run build     # rebuild SPA

pm2 restart businesshub-api         # zero-downtime reload
```

Rollback: `git checkout <previous-tag>` then repeat the steps.

## 11. Backups

Daily dump + 7-day rotation via cron:

```bash
sudo mkdir -p /var/backups/businesshub
sudo crontab -e
```

```
0 2 * * * mysqldump -u businesshub -p'STRONG_PASSWORD' --single-transaction businesshub | gzip > /var/backups/businesshub/bh_$(date +\%F).sql.gz
0 3 * * * find /var/backups/businesshub -name '*.sql.gz' -mtime +7 -delete
```

Restore:

```bash
gunzip < bh_2026-01-01.sql.gz | mysql -u businesshub -p businesshub
```

Optionally sync `/var/backups/businesshub` to object storage.

## 12. Health checks & logs

- App health: `https://your-domain.com/api/health`
- PM2: `pm2 status`, `pm2 logs businesshub-api`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
- Disk/DB watch: `df -h`, `mysqladmin -u businesshub -p status`
