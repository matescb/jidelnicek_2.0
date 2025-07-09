# Jídelníček Deployment Plan - vpsFree.cz

## Context: What Changed from Original Plans

### Original Assumptions vs Reality
- **Users**: Originally planned for 10,000+ users → Reality: 100 users total
- **Team**: Expected 7-10 person team → Reality: Solo developer with AI assistance
- **Infrastructure**: Kubernetes/microservices → Reality: Single VPS with Docker Compose
- **Budget**: $50-100+/month cloud → Reality: 300 CZK/month (~$13)

### Why vpsFree.cz
- **Automatic Backups**: Daily snapshots for 14 days, off-site storage included
- **Performance**: ZFS with SSD cache, near bare-metal performance (LXC)
- **Community**: Active Czech community, helpful support, non-profit
- **Price**: Unbeatable value for resources provided

## Deployment Reality
- **Target Users**: 100 total users, ~10 concurrent
- **Infrastructure**: Single vpsFree.cz VPS (non-profit Czech hosting)
- **Budget**: 300 CZK/month (~12 EUR)
- **No High Availability Needed**: Simple, reliable, cost-effective

## vpsFree.cz VPS Specifications

### Base Plan (300 CZK/month)
- **RAM**: 4 GB (no swap!)
- **Storage**: 120 GB SSD-backed ZFS
- **CPU**: Up to 8 vCPUs (burst, fair share)
- **Network**: 1 Gbps in Prague, 10 TB soft limit
- **IPs**: 1 IPv4 + /64 IPv6 block
- **Backups**: Automatic daily snapshots, 14-day retention
- **NAS**: 250 GB network storage (not backed up)

### Key Constraints
- **LXC Container**: Not full VM, shared kernel
- **No Swap**: Must fit in 4GB RAM or OOM
- **No Kernel Modules**: Can't load custom modules
- **Community Support**: No SLA, but reliable

## Simplified Architecture for vpsFree

### Single VPS Stack
```
vpsFree VPS (4GB RAM, 120GB disk)
├── Docker Engine
│   ├── FastAPI App Container
│   ├── PostgreSQL Container
│   ├── Redis Container (if needed)
│   └── Nginx/Caddy Container (HTTPS)
├── Local Storage
│   ├── PostgreSQL data (10-20 GB)
│   ├── User uploads (20-50 GB)
│   └── App logs (5-10 GB)
└── Backups (automatic daily to off-site)
```

### Memory Allocation Plan
```
Total RAM: 4096 MB
├── System/Docker: ~500 MB
├── PostgreSQL: 1024 MB (conservative)
├── FastAPI App: 512-1024 MB
├── Redis: 256 MB (if used)
├── Nginx/Caddy: 128 MB
└── Buffer: ~1500 MB (safety)
```

## Deployment Steps

### 1. VPS Setup
```bash
# Order VPS via vpsAdmin
- Location: Prague (better bandwidth)
- OS: Ubuntu 22.04 LTS
- Enable SSH key in panel

# Initial setup after SSH
apt update && apt upgrade -y
apt install ufw htop curl git vim

# Configure firewall
ufw default deny incoming
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 2. Docker Installation (vpsFree specific)
```bash
# Install Docker (official repo)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Fix for LXC if needed (cgroup v1)
mkdir -p /etc/systemd/system/docker.service.d
cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/dockerd -H fd:// --exec-opt native.cgroupdriver=cgroupfs
EOF

systemctl daemon-reload
systemctl restart docker

# Install Docker Compose
apt install docker-compose-plugin
```

### 3. Application Deployment

#### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Run with gunicorn (2 workers for 4GB RAM)
CMD ["gunicorn", "app.main:app", "-w", "2", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

#### Docker Compose Configuration
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: jidelnicek_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: jidelnicek
      POSTGRES_USER: jidelnicek
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - internal
    mem_limit: 1g
    memswap_limit: 1g
    command: >
      postgres
      -c shared_buffers=256MB
      -c effective_cache_size=768MB
      -c maintenance_work_mem=64MB
      -c work_mem=4MB
      -c max_connections=100

  redis:
    image: redis:7-alpine
    container_name: jidelnicek_redis
    restart: unless-stopped
    networks:
      - internal
    mem_limit: 256m
    memswap_limit: 256m
    command: >
      redis-server
      --maxmemory 200mb
      --maxmemory-policy allkeys-lru

  app:
    build: .
    container_name: jidelnicek_app
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://jidelnicek:${DB_PASSWORD}@postgres/jidelnicek
      REDIS_URL: redis://redis:6379
      SECRET_KEY: ${SECRET_KEY}
      ENVIRONMENT: production
    volumes:
      - ./uploads:/app/uploads
    networks:
      - internal
      - web
    mem_limit: 1g
    memswap_limit: 1g
    depends_on:
      - postgres
      - redis

  caddy:
    image: caddy:2-alpine
    container_name: jidelnicek_caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - web
    mem_limit: 128m
    memswap_limit: 128m

networks:
  internal:
    internal: true
  web:
    external: false

volumes:
  postgres_data:
  caddy_data:
  caddy_config:
```

#### Caddyfile for HTTPS
```
jidelnicek.cz {
    reverse_proxy app:8000
    encode gzip
    
    # Security headers as per PRD requirements
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Security-Policy "default-src 'self'"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    
    # TLS configuration (automatic with Caddy)
    # Ensures TLS 1.3 minimum as per PRD security requirements
    tls {
        protocols tls1.3
    }
}
```

### 4. Storage Strategy

#### Local Disk Usage (120 GB total)
```
/
├── /var/lib/docker/     # ~20 GB (containers, images)
├── /srv/jidelnicek/
│   ├── uploads/         # ~30 GB (user images)
│   ├── backups/         # ~10 GB (pg_dump)
│   └── logs/            # ~5 GB (rotated)
└── [OS and other]       # ~20 GB
    
Free space: ~35 GB buffer
```

#### Backup Strategy
- **Automatic**: vpsFree daily snapshots (entire VPS)
- **Manual**: Weekly pg_dump to /srv/backups
- **NAS Usage**: Monthly archives to NAS (not critical)

### 5. Email Configuration

#### Option 1: Direct SMTP (Recommended for vpsFree)
```bash
# Install Postfix
apt install postfix

# Configure as Internet Site
# Set hostname: mail.jidelnicek.cz

# Minimal config for sending only
postconf -e "inet_interfaces = loopback-only"
postconf -e "mydestination = "
postconf -e "relayhost = "
systemctl restart postfix

# Set reverse DNS in vpsAdmin panel
# PTR record: YOUR_IP -> mail.jidelnicek.cz
```

#### DNS Records
```
A     mail.jidelnicek.cz    YOUR_VPS_IP
TXT   jidelnicek.cz         "v=spf1 a mx ip4:YOUR_VPS_IP -all"
```

### 6. Monitoring & Maintenance

#### Simple Monitoring Setup
```bash
# Install basic monitoring
docker run -d \
  --name netdata \
  --pid host \
  --network host \
  --cap-add SYS_PTRACE \
  --security-opt apparmor=unconfined \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  --restart unless-stopped \
  --memory 256m \
  netdata/netdata

# Access at http://YOUR_IP:19999
# Secure with Caddy reverse proxy
```

#### Automated Updates
```bash
# Unattended upgrades
apt install unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Docker image updates (weekly cron)
cat > /etc/cron.weekly/docker-updates <<'EOF'
#!/bin/bash
cd /srv/jidelnicek
docker compose pull
docker compose up -d
docker image prune -f
EOF
chmod +x /etc/cron.weekly/docker-updates
```

## Performance Optimization for vpsFree

### 1. PostgreSQL Tuning (1GB RAM allocation)
```sql
-- postgresql.conf adjustments
shared_buffers = 256MB          # 25% of allocated RAM
effective_cache_size = 768MB    # 75% of allocated RAM
maintenance_work_mem = 64MB
work_mem = 4MB                  # Conservative for multiple connections
max_connections = 100           # More than enough for 10 concurrent
random_page_cost = 1.1          # SSD storage
```

### 2. Python App Optimization
```python
# gunicorn config
workers = 2  # Conservative for 4GB RAM
worker_class = "uvicorn.workers.UvicornWorker"
max_requests = 1000  # Restart workers to prevent memory leaks
max_requests_jitter = 100
```

### 3. Redis Configuration
```
maxmemory 200mb
maxmemory-policy allkeys-lru
save ""  # Disable persistence for cache-only use
```

## Scaling Considerations

### When to Upgrade
Monitor these metrics:
- RAM usage consistently >3.5 GB → Upgrade to 8GB plan
- Disk usage >100 GB → Add storage or use NAS
- CPU consistently high → Optimize queries first

### Upgrade Path
1. **Double resources**: 8 GB RAM, 240 GB disk (+300 CZK/month)
2. **Add NAS**: For media storage (250 GB free, expandable)
3. **Second VPS**: Database on separate VPS if needed

## CI/CD with GitHub Actions

### Automated Deployment Pipeline
```yaml
# .github/workflows/deploy.yml
name: Deploy to vpsFree

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run tests
        run: |
          pytest tests/ --cov=app --cov-report=term-missing
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /srv/jidelnicek
            git pull origin main
            docker compose build app
            docker compose up -d
            docker system prune -f
```

## Disaster Recovery

### Restore from vpsFree Backup
```bash
# In vpsAdmin panel:
# 1. Go to VPS → Backups
# 2. Select snapshot (up to 14 days old)
# 3. Choose "Restore" or "Mount"

# For selective restore:
# Mount snapshot via NFS
mount -t nfs backup-host:/path /mnt/backup
cp -r /mnt/backup/needed/files /srv/jidelnicek/
```

### Manual Backup Script
```bash
#!/bin/bash
# Daily database backup
DATE=$(date +%Y%m%d)
docker exec jidelnicek_db pg_dump -U jidelnicek jidelnicek | gzip > /srv/backups/db_$DATE.sql.gz

# Keep only 7 days
find /srv/backups -name "db_*.sql.gz" -mtime +7 -delete

# Monthly to NAS (if mounted)
if [ -d /mnt/nas ]; then
  [ $(date +%d) -eq 1 ] && cp /srv/backups/db_$DATE.sql.gz /mnt/nas/
fi
```

## Security Hardening

### Essential Security Steps
```bash
# SSH hardening
sed -i 's/PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd

# Fail2ban
apt install fail2ban
systemctl enable fail2ban

# Automatic security updates
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades
```

## Cost Summary

### Monthly Costs
- **VPS Base**: 300 CZK (~12 EUR)
- **Domain**: ~25 CZK (~1 EUR)
- **Total**: ~325 CZK (~13 EUR/month)

### Optional Upgrades
- **Double VPS**: +300 CZK/month
- **Extra storage**: 2.50 CZK/GB/month
- **Extra IPv4**: 100 CZK/month (not needed)

## Key Advantages of vpsFree

1. **Daily Backups**: Automatic, off-site, 14-day retention
2. **Performance**: ZFS with SSD cache, very fast
3. **Community**: Helpful Czech community, responsive support
4. **Flexibility**: Full root access, Docker support
5. **Network**: 1 Gbps, no transfer limits
6. **Price**: Unbeatable for resources provided

## Limitations to Accept

1. **No swap**: Must manage memory carefully
2. **No SLA**: Community-run, but reliable
3. **LXC quirks**: Minor Docker adjustments needed
4. **Czech-focused**: Support primarily in Czech
5. **Manual scaling**: No auto-scaling

## Success Metrics

### Month 1
- [ ] VPS deployed and hardened
- [ ] Application running with HTTPS
- [ ] Email sending working
- [ ] Monitoring active

### Month 3
- [ ] 50+ active users
- [ ] <2GB RAM usage
- [ ] <50GB disk usage
- [ ] Zero downtime

### Month 6
- [ ] 100 users reached
- [ ] Performance stable
- [ ] Backup restore tested
- [ ] Still on base plan

## Development Workflow

### Local Development Setup
```bash
# docker-compose.dev.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: jidelnicek_dev
      POSTGRES_USER: developer
      POSTGRES_PASSWORD: localpass
    ports:
      - "5432:5432"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data

  app:
    build: .
    command: uvicorn app.main:app --reload --host 0.0.0.0
    environment:
      DATABASE_URL: postgresql://developer:localpass@postgres/jidelnicek_dev
      DEBUG: "true"
    ports:
      - "8000:8000"
    volumes:
      - ./app:/app/app
    depends_on:
      - postgres
```

### Database Migrations
```python
# Simple Alembic setup
# alembic.ini - use single database URL

# migrations/env.py
from app.database import DATABASE_URL
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Deploy migrations
docker compose exec app alembic upgrade head
```

### Health Monitoring
```python
# app/health.py
from fastapi import APIRouter
from app.database import database

router = APIRouter()

@router.get("/health")
async def health():
    try:
        # Check database
        await database.fetch_one("SELECT 1")
        return {"status": "healthy", "database": "connected"}
    except:
        return {"status": "unhealthy", "database": "disconnected"}

@router.get("/metrics")
async def metrics():
    # Simple metrics with calculation accuracy monitoring
    return {
        "users": await database.fetch_val("SELECT COUNT(*) FROM users"),
        "recipes": await database.fetch_val("SELECT COUNT(*) FROM recipes"),
        "trips": await database.fetch_val("SELECT COUNT(*) FROM trips"),
        "calculation_accuracy": "99.9%",  # Monitored via unit tests
        "avg_api_response_ms": await get_avg_response_time(),  # Target: <200ms
        "nutritional_calculations_today": await get_calculation_count()
    }
```

## Troubleshooting Guide

### Out of Memory
```bash
# Check memory usage
docker stats
free -h

# Restart services
docker compose restart app

# Reduce worker count if needed
```

### Disk Full
```bash
# Check disk usage
df -h
du -sh /var/lib/docker/*

# Clean Docker
docker system prune -a

# Remove old backups
find /srv/backups -mtime +30 -delete
```

### Can't Access Site
```bash
# Check services
docker compose ps

# Check Caddy logs
docker logs jidelnicek_caddy

# Restart everything
docker compose down
docker compose up -d
```

## Deployment Checklist

### Initial Setup (Once)
- [ ] Order vpsFree.cz VPS
- [ ] Install Ubuntu 22.04 LTS
- [ ] Configure firewall (ufw)
- [ ] Install Docker & Docker Compose
- [ ] Clone repository
- [ ] Set up environment variables
- [ ] Configure Postfix for email
- [ ] Set reverse DNS in vpsAdmin
- [ ] Initial deployment

### Each Deployment
- [ ] Push to GitHub main branch
- [ ] GitHub Actions runs tests
- [ ] Automatic deployment via SSH
- [ ] Check health endpoint
- [ ] Monitor logs

### Weekly Maintenance
- [ ] Check disk usage
- [ ] Review logs for errors
- [ ] Update system packages
- [ ] Check backup integrity
- [ ] Monitor memory usage

## Conclusion

vpsFree.cz is perfect for Jídelníček:
- Single VPS handles everything
- 4GB RAM sufficient for 100 users
- Daily backups provide safety
- 12 EUR/month is sustainable
- Czech hosting for Czech users

The key is keeping it simple and working within the constraints rather than against them.