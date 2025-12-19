# DNS Manager

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

一个统一的 DNS 管理系统，支持多个 DNS 服务商（Cloudflare、阿里云 DNS、DNSPod 等），提供现代化的 Web 管理界面。

**Language / 语言 / 言語**: [English](./README.md) | 简体中文 | [日本語](./README.ja.md)

## 截图

> 截图即将推出

<!--
![仪表盘](./docs/screenshots/dashboard.png)
![域名管理](./docs/screenshots/domains.png)
![记录管理](./docs/screenshots/records.png)
-->

## 功能特点

- **多服务商支持**：在单一仪表盘中管理多个 DNS 服务商的记录
- **安全认证**：支持 GitHub OAuth 认证（NextAuth.js）
- **统一仪表盘**：概览所有服务商、域名和记录
- **实时同步**：从服务商同步域名和记录
- **现代化 UI**：使用 shadcn/ui 组件和 Tailwind CSS 构建
- **响应式设计**：支持桌面和移动设备

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript 5.0 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 数据库 | SQLite + Drizzle ORM |
| 认证 | NextAuth.js v5 |
| 表单处理 | react-hook-form |

## 支持的 DNS 服务商

| 服务商 | 状态 | 备注 |
|--------|------|------|
| Cloudflare | 已支持 | 完整 API 支持，含代理状态 |
| 阿里云 DNS | 已支持 | 完整 API 支持 |
| 腾讯云 DNSPod | 已支持 | 完整 API 支持 |
| AWS Route53 | 即将推出 | 计划中 |
| GoDaddy | 即将推出 | 计划中 |

## 快速开始

### 环境要求

- Node.js 20+
- npm 或 pnpm
- GitHub OAuth 应用（用于认证）

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/Alice-easy/DNS-New.git
cd DNS-New
```

2. 安装依赖：

```bash
npm install
```

3. 配置环境变量：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，填入你的凭证：

```env
# NextAuth
AUTH_SECRET="你的密钥"
AUTH_URL="http://localhost:3000"

# GitHub OAuth
GITHUB_CLIENT_ID="你的 GitHub Client ID"
GITHUB_CLIENT_SECRET="你的 GitHub Client Secret"
```

4. 初始化数据库：

```bash
mkdir -p data
npm run db:push
```

5. 启动开发服务器：

```bash
npm run dev
```

6. 在浏览器中打开 [http://localhost:3000](http://localhost:3000)

### 创建 GitHub OAuth 应用

1. 前往 [GitHub 开发者设置](https://github.com/settings/developers)
2. 点击「New OAuth App」
3. 填写信息：
   - Application name: `DNS Manager`
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. 将 Client ID 和 Client Secret 复制到 `.env.local` 文件

## 项目结构

```
dns-manager/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # 仪表盘页面
│   │   ├── api/auth/           # NextAuth API 路由
│   │   └── login/              # 登录页面
│   ├── components/
│   │   ├── ui/                 # shadcn/ui 组件
│   │   └── layout/             # 布局组件
│   ├── lib/
│   │   ├── db/                 # 数据库（Drizzle）
│   │   ├── providers/          # DNS 服务商适配器
│   │   └── auth.ts             # NextAuth 配置
│   └── server/                 # Server Actions
├── data/                       # SQLite 数据库
└── drizzle.config.ts           # Drizzle 配置
```

## DNS 服务商架构

系统使用适配器模式来支持多个 DNS 服务商：

```typescript
interface IDNSProvider {
  readonly meta: ProviderMeta;
  validateCredentials(): Promise<boolean>;
  listDomains(): Promise<ProviderDomain[]>;
  getDomain(domainId: string): Promise<ProviderDomain>;
  listRecords(domainId: string): Promise<ProviderRecord[]>;
  createRecord(domainId: string, record: CreateRecordInput): Promise<ProviderRecord>;
  updateRecord(domainId: string, recordId: string, record: UpdateRecordInput): Promise<ProviderRecord>;
  deleteRecord(domainId: string, recordId: string): Promise<void>;
}
```

### 添加新服务商

1. 在 `src/lib/providers/` 目录下创建新的适配器文件
2. 实现 `IDNSProvider` 接口
3. 在 `src/lib/providers/index.ts` 中注册服务商

## 脚本命令

```bash
npm run dev          # 启动开发服务器
npm run build        # 构建生产版本
npm run start        # 启动生产服务器
npm run lint         # 运行 ESLint
npm run db:push      # 推送数据库 Schema
npm run db:studio    # 打开 Drizzle Studio
npm run db:generate  # 生成数据库迁移
```

## 开发路线图

### 第一阶段（MVP）

- [x] 项目搭建（Next.js、shadcn/ui、Drizzle）
- [x] 认证系统（NextAuth.js + GitHub）
- [x] 仪表盘布局
- [x] Cloudflare 服务商适配器
- [x] 域名和记录管理界面

### 第二阶段

- [x] 阿里云 DNS 适配器
- [x] DNSPod 适配器
- [ ] 批量操作（导入/导出）
- [ ] 操作日志界面

### 第三阶段

- [ ] DNS 监控
- [ ] 变更检测
- [ ] 告警通知
- [ ] 智能 DNS（地理路由）

## 参与贡献

欢迎贡献代码！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add some amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开 Pull Request

## 开源许可

本项目基于 MIT 许可证开源 - 详见 [LICENSE](LICENSE) 文件。

## 致谢

- [Next.js](https://nextjs.org/) - React 框架
- [shadcn/ui](https://ui.shadcn.com/) - 精美的 UI 组件
- [Drizzle ORM](https://orm.drizzle.team/) - TypeScript ORM
- [NextAuth.js](https://authjs.dev/) - Next.js 认证方案
