# Build context: repository root.  docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci -w @hookflow/api --include-workspace-root=false
COPY apps/api apps/api
RUN npm run build -w @hookflow/api && npm prune --omit=dev -w @hookflow/api

FROM node:22-alpine
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/package.json apps/api/package.json
WORKDIR /repo/apps/api
USER node
EXPOSE 3200
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
