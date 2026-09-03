# Image d'UrbanFlow : l'API et le client, servis par le meme serveur.
#
# Deux etages. Le premier construit le client — c'est le seul moment ou les
# dependances de developpement sont necessaires. Le second n'embarque que le
# serveur, ses dependances de production et le client construit.
FROM docker.io/oven/bun:1-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json index.html bunfig.toml ./
COPY src ./src
COPY public ./public
# Le script de construction et son greffon de resolution : les copier un par
# un plutot que le dossier entier garde l'image affranchie de l'outillage de
# test et de generation, qui n'a rien a y faire.
COPY scripts/build.ts scripts/served-as-is.ts ./scripts/
RUN bun scripts/build.ts

FROM docker.io/oven/bun:1-alpine

WORKDIR /app

# Les dependances d'abord : cette couche n'est reconstruite que si le manifeste
# change, pas a chaque modification du code.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Le serveur execute directement le TypeScript : ni compilation, ni artefact
# intermediaire. Le contrat de donnees est partage avec le client, le serveur ne
# tourne pas sans lui.
COPY server ./server
COPY src/types.ts ./src/types.ts
COPY --from=build /app/dist ./dist

# Le certificat est genere au premier demarrage s'il manque : voir entrypoint.sh.
COPY infra/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && apk add --no-cache openssl

# La base vit dans un volume : le conteneur reste jetable, comptes et trajets
# survivent a sa recreation.
ENV DATABASE_PATH=/data/urbanflow.db
# Sans cela le serveur n'ecouterait que la boucle locale du conteneur.
ENV API_HOST=0.0.0.0
ENV API_PORT=4000
ENV NODE_ENV=production
ENV WEB_ROOT=/app/dist
ENV TLS_CERT_PATH=/certs/cert.pem
ENV TLS_KEY_PATH=/certs/key.pem

RUN mkdir -p /data /certs
VOLUME ["/data", "/certs"]
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- --no-check-certificate https://127.0.0.1:4000/api/health > /dev/null || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["bun", "server/src/index.ts"]
