FROM node:22-alpine
WORKDIR /app
COPY apps/receiver/package.json apps/receiver/*.mjs ./
USER node
EXPOSE 4200
CMD ["node", "server.mjs"]
