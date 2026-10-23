# PDF renderer for Render's free web service (architecture.md ADR-08).
# The Playwright image already contains Chromium and its system libraries.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs ./

USER pwuser
EXPOSE 8080
CMD ["node", "server.mjs"]
