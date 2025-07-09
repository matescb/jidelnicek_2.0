#!/bin/bash
# Generate Diffie-Hellman parameters for SSL/TLS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DH_SIZE="${DH_SIZE:-2048}"
SSL_DIR="./ssl"
DH_FILE="${SSL_DIR}/dhparam.pem"

echo -e "${YELLOW}Generating Diffie-Hellman parameters for SSL/TLS...${NC}"
echo "This process may take several minutes depending on your system."
echo ""

# Create SSL directory if it doesn't exist
if [ ! -d "$SSL_DIR" ]; then
    echo -e "${GREEN}Creating SSL directory: ${SSL_DIR}${NC}"
    mkdir -p "$SSL_DIR"
fi

# Check if dhparam.pem already exists
if [ -f "$DH_FILE" ]; then
    echo -e "${YELLOW}Warning: ${DH_FILE} already exists.${NC}"
    read -p "Do you want to regenerate it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${GREEN}Keeping existing dhparam.pem file.${NC}"
        exit 0
    fi
fi

# Generate dhparam.pem
echo -e "${GREEN}Generating ${DH_SIZE}-bit DH parameters...${NC}"
openssl dhparam -out "$DH_FILE" "$DH_SIZE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully generated ${DH_FILE}${NC}"
    chmod 644 "$DH_FILE"
    
    # Verify the generated file
    echo -e "${GREEN}Verifying generated parameters...${NC}"
    openssl dhparam -in "$DH_FILE" -check -noout
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Verification successful!${NC}"
        echo ""
        echo "Next steps:"
        echo "1. The dhparam.pem file has been created in: ${SSL_DIR}/"
        echo "2. This file will be mounted to the Nginx container via docker-compose.yml"
        echo "3. When enabling SSL, ensure your certificate files are also in ${SSL_DIR}/"
    else
        echo -e "${RED}Verification failed! Please regenerate the file.${NC}"
        exit 1
    fi
else
    echo -e "${RED}Failed to generate dhparam.pem${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Note: For production use, consider using 4096-bit parameters:${NC}"
echo "DH_SIZE=4096 ./generate-dhparam.sh"