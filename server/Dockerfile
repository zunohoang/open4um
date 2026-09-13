ARG NODE_IMAGE=node:24.21.0-alpine3.24@sha256:be80f76cf40ec8e42b9bec49f60a55e0660f30af58d3e5a25530785b30ea67e2

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM ${NODE_IMAGE} AS production-dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM alpine:3.24@sha256:28bd5fe8b56d1bd048e5babf5b10710ebe0bae67db86916198a6eec434943f8b AS runtime
RUN apk add --no-cache ca-certificates libstdc++ \
  && addgroup -S -g 10001 abslider \
  && adduser -S -D -H -u 10001 -G abslider abslider

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY --from=production-dependencies --chown=abslider:abslider /app/node_modules ./node_modules
COPY --from=build --chown=abslider:abslider /app/dist ./dist

USER abslider
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["/usr/local/bin/node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT || 4000}/api/v1/health/ready`).then((response) => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]
CMD ["/usr/local/bin/node", "dist/server.js"]
