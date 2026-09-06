FROM wordpress:latest

# Labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/cocart-headless/next-woo"
LABEL org.opencontainers.image.description="WordPress with WooCommerce for headless Next.js"
LABEL org.opencontainers.image.licenses="MIT"

# Install WP-CLI
RUN curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
    && chmod +x wp-cli.phar \
    && mv wp-cli.phar /usr/local/bin/wp

# Copy plugin and theme to staging location (volume overwrites /var/www/html)
COPY next-revalidate /usr/src/next-revalidate
COPY theme /usr/src/nextjs-headless

# Copy the setup scripts
COPY setup.sh /usr/local/bin/setup-wordpress.sh
COPY entrypoint.sh /usr/local/bin/custom-entrypoint.sh
COPY apache2-foreground-wrapper.sh /usr/local/bin/apache2-foreground-wrapper.sh
RUN chmod +x /usr/local/bin/setup-wordpress.sh /usr/local/bin/custom-entrypoint.sh /usr/local/bin/apache2-foreground-wrapper.sh

ENTRYPOINT ["/usr/local/bin/custom-entrypoint.sh"]
CMD ["apache2-foreground-wrapper.sh"]
