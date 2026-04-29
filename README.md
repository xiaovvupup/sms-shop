# Activation SMS Platform

基于 Next.js 14 + TypeScript + Tailwind + shadcn/ui + Prisma + PostgreSQL 的激活码sms系统。

## 功能概览

- 用户输入激活码，服务端校验并防并发重复核销
- 用户可在站内按地区选择支付宝 / 微信支付购买激活码，到账后自动发码
- 服务端向 SMS（SMS-Activate 兼容）申请号码
- 前端展示手机号并每 5 秒轮询会话状态
- 收到短信后自动提取 4-8 位验证码并展示
- 激活码支持美国 / 英国两种类型，按类型申请对应地区号码
- 激活码在第一次成功收到验证码后失效
- 管理员后台（登录、激活码管理、会话管理）
- 管理员可按地区批量生成激活码，单码检查、失效、恢复可用状态
- 管理员可按订单号手动确认到账并立即发码
- 管理员可一键查询 HeroSMS 余额，低余额可邮件告警
- 每日自动巡检：unused 低于阈值自动补码并邮件发送 txt
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

如果使用 Neon / Vercel 这类托管数据库，建议同时配置：

- `DATABASE_URL`: 应用运行时连接字符串，可使用池化连接
- `DIRECT_URL`: Prisma migration 直连字符串，建议使用非池化直连

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

### activation_code.kind

- `us`
- `uk`

说明：`us` 激活码会调用 HeroSMS 的美国地区参数申请号码；`uk` 激活码会调用英国地区参数申请号码。

### sms_session.status

- `pending`
- `number_acquired`
- `waiting_sms`
- `code_received`
- `timeout`
- `failed`
- `cancelled`

### payment_order.status

- `pending`
- `delivered`
- `expired`
- `cancelled`

## API 列表

### 用户接口

- `POST /api/payment-orders`
- `GET /api/payment-orders/:orderId`
- `POST /api/redeem-code`
- `GET /api/session/:sessionId`
- `POST /api/session/:sessionId/start`
- `POST /api/session/:sessionId/change-number`

### 管理接口

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `POST /api/admin/codes/generate`
- `POST /api/admin/codes/check`
- `POST /api/admin/codes/invalidate`
- `POST /api/admin/codes/restore`
- `POST /api/admin/payment-orders/check`
- `POST /api/admin/payment-orders/confirm`
- `GET /api/admin/sms/balance`
- `GET /api/admin/codes`
- `GET /api/admin/sessions`

### Webhook

- `GET /api/webhooks/payment/zpay`
- `POST /api/webhooks/payment`
- `POST /api/webhooks/sms`

### Cron

- `GET /api/cron/daily-maintenance`

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

## 接入 SMS 说明

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

## Vercel + Neon 说明

- Vercel 构建命令使用 `npm run vercel-build`
- 该命令会执行 `prisma migrate deploy`，因此生产环境必须能连上 PostgreSQL
- 如果 `DATABASE_URL` 使用了池化连接，建议额外设置 `DIRECT_URL` 为 Neon 的直连字符串，避免迁移阶段报错
- 若只想先验证前端部署，也可以暂时把 Vercel Build Command 改为 `prisma generate && next build`，等数据库环境变量确认无误后再恢复
- 项目内置每日定时任务（`/api/cron/daily-maintenance`），在 Vercel 中由 `vercel.json` crons 自动触发
- 建议配置 `CRON_SECRET`，并确保 Vercel 项目也配置同名环境变量

## 自动补码与邮件提醒配置

可选环境变量：

- `AUTO_GENERATE_UNUSED_THRESHOLD`：unused 低于该值触发自动补码（默认 `20`）
- `AUTO_GENERATE_BATCH_SIZE`：每次自动补码数量（默认 `400`）
- `LOW_BALANCE_THRESHOLD_USD`：低余额阈值（默认 `1`）
- `MAIL_ENABLED`：是否启用邮件（`true/false`）
- `MAIL_SMTP_HOST` / `MAIL_SMTP_PORT` / `MAIL_SMTP_SECURE` / `MAIL_SMTP_USER` / `MAIL_SMTP_PASS`
- `MAIL_FROM` / `MAIL_TO`

## 支付与地区配置

可选环境变量：

- `SMS_SERVICE_CODE_US` / `SMS_SERVICE_CODE_UK`：分别覆盖美国、英国的 HeroSMS 服务代码；未配置时回落到 `SMS_SERVICE_CODE`
- `SMS_COUNTRY_CODE_US` / `SMS_COUNTRY_CODE_UK`：分别配置美国、英国的 HeroSMS 国家参数
- `PAYMENT_ORDER_EXPIRE_MINUTES`：支付订单保留激活码的分钟数，默认 `15`
- `PAYMENT_SITE_NAME`：订单标题前缀，发送给 ZPay 展示
- `ZPAY_API_BASE_URL`：ZPay 网关地址，默认 `https://zpayz.cn`
- `ZPAY_PID`：ZPay 商户 ID
- `ZPAY_KEY`：ZPay 商户密钥
- `ZPAY_ALIPAY_CID`：ZPay 支付宝渠道 ID，可选；如果你后台绑定了固定支付宝通道，建议填写
- `PAYMENT_QR_PAYLOAD_US` / `PAYMENT_QR_PAYLOAD_UK`：支付二维码内容，支持使用 `{{orderNo}}` 和 `{{amount}}` 占位
- `PAYMENT_QR_LABEL_US` / `PAYMENT_QR_LABEL_UK`：二维码标题文案
- `PAYMENT_WEBHOOK_SECRET`：支付回调接口 `/api/webhooks/payment` 的签名密钥

说明：

- 如果配置了 `ZPAY_PID`、`ZPAY_KEY`，用户页会直接生成真实 ZPay 支付宝二维码，并通过 ZPay 回调 `/api/webhooks/payment/zpay` 自动发码。
- 如果 ZPay 未配置，页面仍会退回到占位二维码模式，适合纯前端演示或手动确认到账场景。
- 当前接入按 ZPay 官方 `mapi.php` / `api.php?act=order` 实现，已接通支付宝；微信支付按钮目前只提示“暂未接入，建议使用支付宝支付”，不会创建订单。
- 当前右上角关闭激活码弹窗只在前端做隐藏，不再触发数据库写入。

## 本地测试项目

建议按下面两个阶段测试，先测业务，再测真实支付。

### 1. 不接 ZPay，先测业务流程

这种方式最适合本地开发，优点是不需要真实商户号，也不需要内网穿透。

步骤：

1. 复制环境变量并启动数据库：

```bash
cp .env.example .env
npm run db:up
npm run init
```

2. 不填写 `.env` 里的 `ZPAY_PID`、`ZPAY_KEY`

3. 启动开发服务：

```bash
npm run dev
```

4. 打开用户页：

- 用户端：`http://localhost:3000`
- 管理后台：`http://localhost:3000/admin/login`

5. 在用户页点击“支付宝支付”创建订单

- 这时页面会显示占位二维码，不会真的收款
- 订单会先锁定一枚对应地区的激活码
- 你可以复制订单号，到后台手动确认到账

6. 在管理后台测试发码：

- 进入激活码管理页
- 在“订单检查 / 手动确认到账”区域输入订单号
- 先点“检查订单”
- 再点“手动确认到账”
- 回到用户页，弹窗会显示激活码

7. 用拿到的激活码继续测试接码流程：

- 在首页输入激活码进行校验
- 成功后进入 session 页面
- 点击“开始接收验证码”
- 系统会按激活码地区调用 HeroSMS 获取号码和短信

说明：

- 如果你只是在调前后端逻辑，这一套已经足够。
- 当前“关闭激活码弹窗”只会在前端隐藏，不会写数据库。

### 2. 接 ZPay，测试真实支付

这种方式会真正创建 ZPay 支付宝订单，并依赖 ZPay 异步回调自动发码。

准备条件：

- 你已经有可用的 ZPay 商户 ID 和商户密钥
- 你已经在 ZPay 后台开通了支付宝渠道
- 本地服务可以被公网访问，因为 ZPay 的 `notify_url` 必须是外网可访问地址

推荐做法：

1. 启动本地项目：

```bash
npm run db:up
npm run dev
```

2. 用内网穿透把本地 `3000` 暴露出去，例如任选一种：

```bash
cloudflared tunnel --url http://localhost:3000
```

或

```bash
ngrok http 3000
```

3. 把穿透后的公网地址写进 `.env`：

```bash
APP_BASE_URL=https://你的公网地址
ZPAY_API_BASE_URL=https://zpayz.cn
ZPAY_PID=你的商户ID
ZPAY_KEY=你的商户密钥
ZPAY_ALIPAY_CID=你的支付宝渠道ID
PAYMENT_SITE_NAME=你的站点名称
```

4. 重启开发服务，让环境变量生效：

```bash
npm run dev
```

5. 在用户页创建订单并扫码支付

- 页面会显示真实 ZPay 支付宝二维码
- 支付成功后，ZPay 会 `GET` 到：

```text
https://你的公网地址/api/webhooks/payment/zpay
```

- 我们的服务收到回调后会自动把订单改成已到账，并发放对应地区激活码

6. 如果你付了款但页面还没更新：

- 先看本地终端有没有 webhook 日志或报错
- 再到后台输入订单号，点“检查订单”
- 后台会触发一次 ZPay 查单并补发状态

### 3. 怎么确认 ZPay 是否真的接通

满足下面几点，就说明支付链路已经通了：

- 用户页下单后显示的是支付宝真实二维码，而不是占位二维码
- 订单支付后几秒内自动切到“付款成功”
- 弹窗里出现激活码
- 管理后台按订单号查询时能看到同一笔订单状态为“已发码”

### 4. 本地调试时常见问题

- 页面一直显示占位二维码：
  说明 `ZPAY_PID` 或 `ZPAY_KEY` 没生效，或者服务没重启。
- 扫码支付成功，但前端不更新：
  大概率是 `APP_BASE_URL` 不是公网可访问地址，导致 ZPay 打不进 webhook。
- 后台“检查订单”也查不到已支付：
  看订单是否真的调用了真实 ZPay；如果是旧订单或占位订单，后台不会凭空变成已支付。
- 单独执行 `npx tsc --noEmit` 报 `.next/types` 缺失：
  先跑一次 `npm run build` 或启动一次 `npm run dev`，因为这个项目的 tsconfig 包含了 `.next/types/**/*.ts`。

### 5. 当前实现边界

- 当前接的是 ZPay 官方易支付风格接口，真实支付方式为支付宝。
- 微信支付暂未接入；用户点击微信按钮时，前端会直接提示“暂未接入，建议使用支付宝支付”。
- ZPay 文档里 `notify_url` 不支持带参数，因此当前通过 `param` 回传本地订单 ID，并额外用商户订单号兜底匹配订单。

邮件启用后：

- 自动补码会附带 `txt` 发送本次生成的激活码列表
- 余额低于阈值会发送告警邮件
