# 阶段 1: 依赖安装
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 阶段 2: 构建阶段
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 注意：SQLite 路径在构建时可能需要占位或通过环境变量注入
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# 阶段 3: 运行阶段
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# 创建数据目录以存储 SQLite 数据库
RUN mkdir -p /app/data && chown -R node:node /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# 启动命令
CMD ["node", "server.js"]
