# Image de l'API UrbanFlow.
#
# L'image officielle Bun suffit : le serveur execute directement le TypeScript,
# il n'y a donc ni etape de compilation ni artefact intermediaire a produire.
# C'est la meme propriete qui rend la boucle de developpement immediate en
# local — l'image ne fait que la transposer.
FROM docker.io/oven/bun:1-alpine

WORKDIR /app

# Les dependances d'abord : cette couche n'est reconstruite que si le manifeste
# change, pas a chaque modification du code.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Le contrat de donnees est partage par le client et l'API : le serveur ne
# compile pas sans lui.
COPY server ./server
COPY src/types.ts ./src/types.ts

# La base vit dans un volume : le conteneur reste jetable, les comptes et les
# trajets survivent a sa recreation.
ENV DATABASE_PATH=/data/urbanflow.db
# Sans cela, le serveur n'ecouterait que sur la boucle locale du conteneur,
# donc serait injoignable depuis l'exterieur.
ENV API_HOST=0.0.0.0
ENV API_PORT=4000

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health > /dev/null || exit 1

CMD ["bun", "server/src/index.ts"]
