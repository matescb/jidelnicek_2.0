# Nginx Configuration for Jídelníček 2.0

This directory contains all Nginx configuration files for the Jídelníček 2.0 application.

## Directory Structure

```
nginx/
├── nginx.conf              # Main Nginx configuration
├── conf.d/                 # Server configurations
│   ├── default.conf        # HTTP server configuration
│   ├── ssl.conf           # SSL/TLS best practices
│   ├── monitoring.conf    # Monitoring endpoints
│   └── letsencrypt.conf.template  # Template for Let's Encrypt
├── ssl/                   # SSL certificates and keys
├── generate-dhparam.sh    # Generate DH parameters
├── setup-ssl.sh          # SSL setup wizard
└── logrotate.conf        # Log rotation configuration
```

## Features

### 1. Reverse Proxy Configuration
- Routes API requests to FastAPI backend
- WebSocket support for real-time features
- Static file serving with caching
- Media file serving with security restrictions

### 2. Security Features
- Hidden Nginx version
- Comprehensive security headers
- Rate limiting for API and authentication endpoints
- Request size limits (5MB for uploads)
- CORS configuration
- Request ID generation for tracking

### 3. Performance Optimization
- Optimized for VPS with 256MB memory limit
- Gzip compression
- Connection pooling
- Efficient buffering settings
- Static file caching

### 4. SSL/TLS Support
- TLS 1.2 and 1.3 only
- Strong cipher suites
- OCSP stapling
- HSTS headers
- Certificate transparency

### 5. Monitoring
- Health check endpoints
- Nginx status page
- Prometheus-compatible metrics
- Request logging with timing information

## Usage

### Basic Setup

1. The Nginx configuration is automatically loaded when using docker-compose:
   ```bash
   docker-compose up -d nginx
   ```

2. Access the application:
   - HTTP: http://localhost:80
   - HTTPS: https://localhost:443 (when SSL is configured)
   - Monitoring: http://localhost:8080/nginx_status

### SSL/TLS Setup

#### Option 1: Self-Signed Certificate (Development)
```bash
cd docker/nginx
./setup-ssl.sh
# Choose option 2 for self-signed certificate
```

#### Option 2: Let's Encrypt (Production)
```bash
cd docker/nginx
./setup-ssl.sh
# Choose option 3 to prepare for Let's Encrypt

# After DNS is configured:
./ssl/letsencrypt/obtain-certificate.sh yourdomain.com admin@yourdomain.com
```

#### Generate DH Parameters
```bash
cd docker/nginx
./generate-dhparam.sh
```

### Configuration Files

#### Main Configuration (nginx.conf)
- Worker processes: 1 (optimized for 256MB VPS)
- Worker connections: 512
- Client max body size: 5MB
- Comprehensive security headers
- Rate limiting zones

#### Default Server (conf.d/default.conf)
- API routing with rate limiting
- WebSocket support at /ws/
- Static files at /static/ (30-day cache)
- Media files at /media/ (7-day cache)
- Health checks at /health and /nginx-health

#### SSL Configuration (conf.d/ssl.conf)
- Modern TLS configuration
- Strong cipher suites
- OCSP stapling
- Security headers

#### Monitoring (conf.d/monitoring.conf)
- Nginx status at :8080/nginx_status
- Health check at :8080/health
- Metrics at :8080/metrics

## Endpoints

### Application Endpoints
- `/api/*` - FastAPI backend
- `/docs` - API documentation
- `/redoc` - Alternative API docs
- `/static/*` - Static files
- `/media/*` - User uploads
- `/ws/*` - WebSocket connections

### Monitoring Endpoints
- `/nginx-health` - Basic health check
- `/health` - Application health check
- `:8080/nginx_status` - Nginx statistics
- `:8080/metrics` - Prometheus metrics

### Special Endpoints
- `/.well-known/security.txt` - Security contact
- `/robots.txt` - Search engine rules
- `/.well-known/acme-challenge/` - Let's Encrypt

## Rate Limiting

- API endpoints: 10 requests/second
- Login/Register: 5 requests/minute
- File uploads: 2 requests/second
- General: 20 requests/second

## Log Rotation

To enable log rotation on the host:
```bash
sudo cp docker/nginx/logrotate.conf /etc/logrotate.d/jidelnicek-nginx
sudo logrotate -f /etc/logrotate.d/jidelnicek-nginx
```

## Troubleshooting

### Check Nginx Configuration
```bash
docker exec jidelnicek_nginx nginx -t
```

### View Logs
```bash
docker logs jidelnicek_nginx
docker exec jidelnicek_nginx tail -f /var/log/nginx/error.log
docker exec jidelnicek_nginx tail -f /var/log/nginx/access.log
```

### Reload Configuration
```bash
docker exec jidelnicek_nginx nginx -s reload
```

### Test Health Endpoints
```bash
curl http://localhost/nginx-health
curl http://localhost:8080/nginx_status
```

## Security Considerations

1. Always use HTTPS in production
2. Keep certificates up to date
3. Regularly update Nginx image
4. Monitor rate limit logs
5. Review security headers periodically
6. Use strong DH parameters (4096-bit for production)

## Performance Tuning

For production deployment:
1. Adjust worker_connections based on available memory
2. Fine-tune rate limits based on usage patterns
3. Configure CDN for static assets
4. Enable HTTP/2 when using SSL
5. Monitor memory usage and adjust limits