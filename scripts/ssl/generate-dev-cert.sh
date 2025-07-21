#!/bin/bash

# Generate self-signed SSL certificates for development

SSL_DIR="./nginx/ssl"
DOMAIN="job-dorker.local"

# Create SSL directory if it doesn't exist
mkdir -p "$SSL_DIR"

echo "Generating self-signed SSL certificate for development..."

# Generate private key
openssl genrsa -out "$SSL_DIR/dev-key.pem" 2048

# Generate certificate signing request
openssl req -new -key "$SSL_DIR/dev-key.pem" -out "$SSL_DIR/dev-csr.pem" -subj "/C=US/ST=Development/L=Development/O=Job Dorker/OU=Development/CN=$DOMAIN"

# Generate self-signed certificate
openssl x509 -req -in "$SSL_DIR/dev-csr.pem" -signkey "$SSL_DIR/dev-key.pem" -out "$SSL_DIR/dev-cert.pem" -days 365

# Clean up CSR
rm "$SSL_DIR/dev-csr.pem"

echo "SSL certificate generated successfully!"
echo "Certificate: $SSL_DIR/dev-cert.pem"
echo "Private key: $SSL_DIR/dev-key.pem"
echo ""
echo "To trust this certificate in your browser:"
echo "1. Open the certificate file: $SSL_DIR/dev-cert.pem"
echo "2. Add it to your system's trusted root certificates"
echo "3. Add '$DOMAIN' to your /etc/hosts file pointing to 127.0.0.1"
echo ""
echo "Example /etc/hosts entry:"
echo "127.0.0.1 $DOMAIN"