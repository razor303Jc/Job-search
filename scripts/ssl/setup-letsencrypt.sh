#!/bin/bash

# Setup Let's Encrypt SSL certificates for production

DOMAIN="$1"
EMAIL="$2"

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: $0 <domain> <email>"
    echo "Example: $0 your-domain.com admin@your-domain.com"
    exit 1
fi

echo "Setting up Let's Encrypt SSL certificate for $DOMAIN..."

# Install certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y certbot python3-certbot-nginx
    elif command -v yum &> /dev/null; then
        sudo yum install -y certbot python3-certbot-nginx
    else
        echo "Please install certbot manually"
        exit 1
    fi
fi

# Create webroot directory for challenges
sudo mkdir -p /var/www/certbot

# Stop nginx temporarily
sudo systemctl stop nginx

# Obtain certificate
sudo certbot certonly \
    --standalone \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    -d "$DOMAIN" \
    -d "www.$DOMAIN"

# Start nginx
sudo systemctl start nginx

# Test certificate renewal
sudo certbot renew --dry-run

# Set up automatic renewal
if [ ! -f "/etc/cron.d/certbot" ]; then
    echo "Setting up automatic certificate renewal..."
    sudo tee /etc/cron.d/certbot > /dev/null <<EOF
0 12 * * * root test -x /usr/bin/certbot -a \! -d /run/systemd/system && perl -e 'sleep int(rand(43200))' && certbot -q renew --reload-hook "systemctl reload nginx"
EOF
fi

echo "SSL certificate setup complete!"
echo "Certificate will auto-renew every 12 hours"
echo ""
echo "Update your nginx configuration:"
echo "1. Replace 'your-domain.com' with '$DOMAIN' in nginx/conf.d/job-dorker-prod.conf"
echo "2. Reload nginx: sudo systemctl reload nginx"