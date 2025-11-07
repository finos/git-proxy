FROM httpd:2.4

RUN apt-get update && apt-get install -y \
    git \
    apache2-utils \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY httpd.conf /usr/local/apache2/conf/httpd.conf
COPY git-capture-wrapper.py /usr/local/bin/git-capture-wrapper.py

RUN htpasswd -cb /usr/local/apache2/conf/.htpasswd admin admin123 \
  && htpasswd -b /usr/local/apache2/conf/.htpasswd testuser user123

COPY init-repos.sh /usr/local/bin/init-repos.sh

RUN chmod +x /usr/local/bin/init-repos.sh \
  && chmod +x /usr/local/bin/git-capture-wrapper.py \
  && mkdir -p /var/git-captures \
  && chown www-data:www-data /var/git-captures \
  && /usr/local/bin/init-repos.sh

EXPOSE 8080

CMD ["httpd-foreground"]
