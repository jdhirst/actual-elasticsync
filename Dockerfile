FROM node:22-slim

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

COPY src/ ./src/

VOLUME ["/app/data"]

CMD ["node", "src/scheduler.js"]
