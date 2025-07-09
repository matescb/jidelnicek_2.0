#!/bin/bash
# SSL/TLS Setup Script for Jídelníček 2.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SSL_DIR="./ssl"
LETSENCRYPT_DIR="/etc/letsencrypt"
WEBROOT_DIR="/var/www/letsencrypt"

echo -e "${BLUE}=== Jídelníček 2.0 SSL/TLS Setup ===${NC}"
echo ""

# Function to display menu
show_menu() {
    echo "Choose an option:"
    echo "1) Prepare SSL directory structure"
    echo "2) Generate self-signed certificate (development)"
    echo "3) Prepare for Let's Encrypt"
    echo "4) Generate dhparam.pem"
    echo "5) Full SSL setup (all of the above)"
    echo "6) Exit"
}

# Create SSL directory structure
create_ssl_structure() {
    echo -e "${GREEN}Creating SSL directory structure...${NC}"
    
    mkdir -p "$SSL_DIR"
    mkdir -p "$SSL_DIR/certs"
    mkdir -p "$SSL_DIR/private"
    mkdir -p "$SSL_DIR/csr"
    
    # Set appropriate permissions
    chmod 755 "$SSL_DIR"
    chmod 755 "$SSL_DIR/certs"
    chmod 700 "$SSL_DIR/private"
    chmod 755 "$SSL_DIR/csr"
    
    echo -e "${GREEN}SSL directory structure created.${NC}"
}

# Generate self-signed certificate
generate_self_signed() {
    echo -e "${YELLOW}Generating self-signed certificate for development...${NC}"
    
    # Check if certificate already exists
    if [ -f "$SSL_DIR/certs/self-signed.crt" ]; then
        read -p "Self-signed certificate already exists. Regenerate? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    # Generate private key and certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/private/self-signed.key" \
        -out "$SSL_DIR/certs/self-signed.crt" \
        -subj "/C=CZ/ST=Prague/L=Prague/O=Jidelnicek/CN=localhost"
    
    # Generate chain file (same as cert for self-signed)
    cp "$SSL_DIR/certs/self-signed.crt" "$SSL_DIR/certs/self-signed-chain.pem"
    
    # Set permissions
    chmod 600 "$SSL_DIR/private/self-signed.key"
    chmod 644 "$SSL_DIR/certs/self-signed.crt"
    chmod 644 "$SSL_DIR/certs/self-signed-chain.pem"
    
    echo -e "${GREEN}Self-signed certificate generated successfully.${NC}"
    echo ""
    echo "Certificate: $SSL_DIR/certs/self-signed.crt"
    echo "Private Key: $SSL_DIR/private/self-signed.key"
    echo "Chain File:  $SSL_DIR/certs/self-signed-chain.pem"
}

# Prepare for Let's Encrypt
prepare_letsencrypt() {
    echo -e "${BLUE}Preparing for Let's Encrypt...${NC}"
    
    # Create webroot directory for ACME challenges
    echo -e "${GREEN}Creating webroot directory for ACME challenges...${NC}"
    mkdir -p "./letsencrypt-webroot"
    
    # Create Let's Encrypt directories
    mkdir -p "$SSL_DIR/letsencrypt"
    
    # Create renewal configuration template
    cat > "$SSL_DIR/letsencrypt/renewal-config.template" << 'EOF'
# Let's Encrypt renewal configuration template
# Copy this to /etc/letsencrypt/renewal/YOUR_DOMAIN.conf

# Account information
account = YOUR_ACCOUNT_ID
server = https://acme-v02.api.letsencrypt.org/directory

# Certificate details
cert = /etc/letsencrypt/live/YOUR_DOMAIN/cert.pem
privkey = /etc/letsencrypt/live/YOUR_DOMAIN/privkey.pem
chain = /etc/letsencrypt/live/YOUR_DOMAIN/chain.pem
fullchain = /etc/letsencrypt/live/YOUR_DOMAIN/fullchain.pem

# Options used in renewal
[renewalparams]
authenticator = webroot
webroot_path = /var/www/letsencrypt
server = https://acme-v02.api.letsencrypt.org/directory
EOF
    
    # Create certbot command script
    cat > "$SSL_DIR/letsencrypt/obtain-certificate.sh" << 'EOF'
#!/bin/bash
# Obtain Let's Encrypt certificate

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

# Run certbot
docker run --rm \
    -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
    -v "$(pwd)/letsencrypt-webroot:/var/www/letsencrypt" \
    -v "$(pwd)/docker/nginx/conf.d:/etc/nginx/conf.d" \
    certbot/certbot certonly \
    --webroot -w /var/www/letsencrypt \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --force-renewal

if [ $? -eq 0 ]; then
    echo "Certificate obtained successfully!"
    echo "Now update your Nginx configuration to use the new certificate."
else
    echo "Failed to obtain certificate."
    exit 1
fi
EOF
    
    chmod +x "$SSL_DIR/letsencrypt/obtain-certificate.sh"
    
    # Create renewal script
    cat > "$SSL_DIR/letsencrypt/renew-certificates.sh" << 'EOF'
#!/bin/bash
# Renew Let's Encrypt certificates

# Run certbot renewal
docker run --rm \
    -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
    -v "$(pwd)/letsencrypt-webroot:/var/www/letsencrypt" \
    certbot/certbot renew \
    --webroot -w /var/www/letsencrypt

# Reload Nginx if renewal was successful
if [ $? -eq 0 ]; then
    docker exec jidelnicek_nginx nginx -s reload
    echo "Certificates renewed and Nginx reloaded."
else
    echo "Certificate renewal failed."
    exit 1
fi
EOF
    
    chmod +x "$SSL_DIR/letsencrypt/renew-certificates.sh"
    
    # Create cron job template
    cat > "$SSL_DIR/letsencrypt/crontab.template" << 'EOF'
# Let's Encrypt certificate renewal
# Add this to your system crontab or user crontab

# Check for renewal twice daily
0 0,12 * * * cd /path/to/jidelnicek && ./docker/nginx/ssl/letsencrypt/renew-certificates.sh >> /var/log/letsencrypt-renewal.log 2>&1
EOF
    
    echo -e "${GREEN}Let's Encrypt preparation complete.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Update domain DNS to point to your server"
    echo "2. Ensure ports 80 and 443 are open"
    echo "3. Run: ${SSL_DIR}/letsencrypt/obtain-certificate.sh YOUR_DOMAIN YOUR_EMAIL"
    echo "4. Update Nginx configuration to use the obtained certificates"
    echo "5. Add the cron job for automatic renewal"
}

# Generate dhparam
generate_dhparam() {
    if [ -f "./generate-dhparam.sh" ]; then
        ./generate-dhparam.sh
    else
        echo -e "${RED}generate-dhparam.sh not found!${NC}"
        exit 1
    fi
}

# Main menu loop
while true; do
    show_menu
    read -p "Enter choice [1-6]: " choice
    
    case $choice in
        1)
            create_ssl_structure
            ;;
        2)
            create_ssl_structure
            generate_self_signed
            ;;
        3)
            create_ssl_structure
            prepare_letsencrypt
            ;;
        4)
            generate_dhparam
            ;;
        5)
            create_ssl_structure
            generate_self_signed
            prepare_letsencrypt
            generate_dhparam
            echo -e "${GREEN}Full SSL setup complete!${NC}"
            ;;
        6)
            echo -e "${BLUE}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Please try again.${NC}"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done