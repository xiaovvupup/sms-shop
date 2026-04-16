# Activation SMS Platform

基于 Next.js 14 + TypeScript + Tailwind + shadcn/ui + Prisma + PostgreSQL 的激活码短信接码系统。

## 功能概览

- 用户输入激活码，服务端校验并防并发重复核销
- 服务端向 HeroSMS（SMS-Activate 兼容）申请号码
- 前端展示手机号并每 5 秒轮询会话状态
- 收到短信后自动提取 4-8 位验证码并展示
- 激活码一次性使用
- 管理员后台（登录、激活码管理、会话管理）
- 支持 webhook 扩展接收短信
- 统一 JSON 响应、日志、限流、超时处理、审计日志

## 技术栈

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS + shadcn/ui 风格组件
- PostgreSQL + Prisma ORM
- Node.js 服务端逻辑

## 快速启动

1. 复制环境变量：

```bash
cp .env.example .env
```

2. 启动 PostgreSQL（Docker）：

```bash
npm run db:up
```

3. 初始化：

```bash
npm run init
```

仅第一次启动或 Prisma schema 发生变化时需要执行 `npm run init`。

4. 启动开发环境：

```bash
npm run dev
```

你也可以一条命令启动数据库并进入开发模式：

```bash
npm run dev:local
```

管理员账号变更（修改 `.env` 中 `ADMIN_SEED_EMAIL/ADMIN_SEED_PASSWORD`）后，请执行：

```bash
npm run admin:sync
```

5. 访问：

- 用户端: `http://localhost:3000`
- 管理后台: `http://localhost:3000/admin/login`

## 数据库常用命令

```bash
npm run db:up
npm run db:down
npm run db:logs
npm run db:ps
npm run admin:sync
npm run codes:sync
```

## 激活码 TXT 快照

- 默认文件路径：`./data/activation-codes.txt`
- 每次后台批量生成激活码后自动刷新
- 激活码失效（`used/expired/disabled`）会自动从该文件移除
- 如需手动重建可运行：`npm run codes:sync`

## 默认管理员

- 邮箱：`ADMIN_SEED_EMAIL`（默认 `admin@example.com`）
- 密码：`ADMIN_SEED_PASSWORD`（默认 `ChangeMe123!`）

请上线前强制修改。

## 目录结构

```text
app/
  (public)/page.tsx
  (public)/redeem-form.tsx
  session/[sessionId]/page.tsx
  session/[sessionId]/session-client.tsx
  admin/login/page.tsx
  admin/(protected)/layout.tsx
  admin/(protected)/codes/page.tsx
  admin/(protected)/sessions/page.tsx
  api/redeem-code/route.ts
  api/session/[sessionId]/route.ts
  api/admin/login/route.ts
  api/admin/logout/route.ts
  api/admin/codes/route.ts
  api/admin/codes/generate/route.ts
  api/admin/sessions/route.ts
  api/webhooks/sms/route.ts
lib/
  api/route-helpers.ts
  auth/
  core/
  db/prisma.ts
  repositories/
  services/
  sms/herosms-client.ts
  validators/schemas.ts
prisma/
  schema.prisma
  seed.ts
scripts/init.sh
Dockerfile
```

## 核心状态机

### activation_code.status

- `unused`
- `reserved`
- `used`
- `expired`
- `disabled`

说明：只有会话进入 `code_received` 才会把激活码置为 `used`。若会话超时/失败/取消，会自动回退为 `unused`。

### sms_session.status

- `pending`
- `number_acquired`
- `waiting_sms`
- `code_received`
- `timeout`
- `failed`
- `cancelled`

## API 列表

### 用户接口

- `POST /api/redeem-code`
- `GET /api/session/:sessionId`
- `POST /api/session/:sessionId/start`
- `POST /api/session/:sessionId/change-number`

### 管理接口

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `POST /api/admin/codes/generate`
- `GET /api/admin/codes`
- `GET /api/admin/sessions`

### Webhook

- `POST /api/webhooks/sms`

## 统一 JSON 响应格式

```json
{
  "success": true,
  "code": "OK",
  "message": "OK",
  "data": {},
  "requestId": "uuid",
  "timestamp": "2026-04-16T12:00:00.000Z"
}
```

## 接入 HeroSMS 说明

- `SMS_API_BASE_URL` 默认 `https://hero-sms.com/stubs/handler_api.php`
- 号码申请：`action=getNumberV2`
- 状态查询：`action=getStatusV2`
- 完成会话：`action=setStatus&id=...&status=6`
- 取消会话：`action=setStatus&id=...&status=8`

## 生产建议

- 将内存限流替换为 Redis 限流
- 使用队列/Worker 解耦短信轮询任务
- 管理员鉴权升级为双因素认证 + RBAC
- 审计日志导出到 ELK/ClickHouse
- webhook 增加签名验签与重放防护
