FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN node scripts/build.mjs

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --create-home --uid 10001 appuser
COPY --from=build --chown=appuser:appuser /app/dist/ ./
RUN mkdir -p data && chown -R appuser:appuser data
USER appuser
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:4321/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
