# Build context: repository root.  docker build -f apps/dashboard/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/
RUN npm ci -w @hookflow/dashboard --include-workspace-root=false
COPY apps/dashboard apps/dashboard
ARG VITE_API_URL=http://localhost:3200
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @hookflow/dashboard

FROM nginx:1.27-alpine
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
