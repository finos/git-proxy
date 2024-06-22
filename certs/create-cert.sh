#! /bin/bash

# Generates a self-signed certificate used for the SSL Certificate used by the GitProxy HTTPS endpoint

# The certificate expires in 10 years (9 May 2034)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -sha256 -days 3650 -nodes -subj "/C=US/ST=NY/L=New York/O=FINOS/OU=CTI/CN=localhost"
