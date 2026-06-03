<div align="center">

# 💳 信用卡管家

**Credit Card Manager — 本地优先的信用卡账单管理工具**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vite.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor)](https://capacitorjs.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/davidwil11111/credit-card-manager/pulls)

</div>

一个**完全本地运行**的信用卡账单管理应用，无需注册、无需联网、不上传任何数据。支持多卡管理、账单周期追踪、分期计算、提前还款分析、POS 手续费核算等功能。

---

## 📸 功能一览

### 💳 多卡管理
- 添加/编辑多张信用卡，支持 20+ 家银行主题配色
- 自定义账单日、还款日（固定日 or 账单日后 X 天）
- 临时额度管理（含过期日期）
- 卡片状态一目了然：已还 / 待还 / 逾期

### 📊 账单总览
- 按卡片、按月的账单汇总
- 自动计算账单周期（近 12 期 + 未出账单）
- 实时统计：总额度 / 已用额度 / 可用额度 / 使用率
- 逾期卡片高亮提醒

### 💰 分期计算器
- 支持 **3/6/9/12/18/24/36** 期灵活分期
- 年化利率自动换算为月供
- 每期本金、利息、剩余本金明细表
- 分期状态跟踪（待还 / 已还 / 逾期）

### 📈 提前还款分析
- 计算剩余本金、逾期利息、利息减免
- 提前还款总额 vs 继续分期的成本对比
- 帮助判断「提前还清是否划算」

### 🧮 POS 手续费核算
- 预设多种费率模型（标准费率 / 优惠费率 / 大额专用 / 线上快捷）
- 每个 POS 机支持多通道（刷卡/插卡/闪付/支付宝/微信）
- 自动计算手续费、实际到账金额

### 📋 费用统计与分析
- 消费金额 vs 手续费的柱状图
- 按渠道（刷卡/插卡/闪付/扫码）的支出分布
- 各卡片手续费排名
- 月度趋势折线图

### 🔐 数据安全
- **本地存储** — 使用 SQLite（Capacitor）存储，数据不出手机
- **零云服务** — 无需注册、无需登录、无后端服务器
- **自动备份** — 自动保留最近 5 份备份
- **导入/导出** — JSON 格式数据迁移

---

## 🛠️ 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| **框架** | React 18 + TypeScript | 用户界面与类型安全 |
| **构建** | Vite 6 | 极速开发与构建 |
| **样式** | Tailwind CSS 3.4 | 原子化 CSS |
| **状态管理** | Zustand 5 | 轻量全局状态 |
| **数据验证** | Zod 3 | 运行时类型校验 |
| **本地持久化** | Capacitor SQLite | Android 本地数据库 |
| **移动端** | Capacitor 8 | Web → Android 打包 |
| **测试** | Vitest 3 + jsdom | 单元测试 |
| **图标** | Lucide React | 开源图标库 |

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9

### 安装 & 运行

```bash
# 克隆仓库
git clone https://github.com/davidwil11111/credit-card-manager.git
cd credit-card-manager

# 安装依赖
npm install

# 启动开发服务器（浏览器访问 http://localhost:5173）
npm run dev

# 运行测试
npm test

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

### 📱 Android 打包（可选）

```bash
# 同步 Web 代码到 Android 项目
npx cap sync

# 用 Android Studio 打开
npx cap open android
```

在 Android Studio 中连接设备或启动模拟器，点击 **Run** 即可安装到手机。

---

## 📁 项目结构

```
credit-card-manager/
├── src/
│   ├── components/           # UI 组件
│   │   ├── Overview.tsx      # 首页：卡片总览
│   │   ├── Detail.tsx        # 单卡详情与交易列表
│   │   ├── Analysis.tsx      # 数据分析仪表盘
│   │   ├── CreditCardForm.tsx # 添加/编辑信用卡
│   │   ├── TransactionForm.tsx# 添加交易记录
│   │   ├── InstallmentForm.tsx# 分期创建表单
│   │   ├── InstallmentPlanView.tsx # 分期方案详情
│   │   ├── EarlySettlementModal.tsx # 提前还款弹窗
│   │   ├── FeeStatistics.tsx # 手续费统计图表
│   │   ├── LogViewer.tsx     # 日志查看器
│   │   ├── SplashScreen.tsx  # 启动屏
│   │   └── ui/
│   │       └── Modal.tsx     # 通用弹窗
│   ├── utils/
│   │   ├── database.ts       # SQLite 数据库操作（CRUD + 备份）
│   │   ├── installment.ts    # 分期计算引擎
│   │   ├── installment.test.ts # 分期计算单元测试
│   │   ├── validation.ts     # Zod 数据校验
│   │   ├── currency.ts       # 金额格式化
│   │   ├── date.ts           # 日期工具函数
│   │   ├── date.test.ts      # 日期工具测试
│   │   ├── logger.ts         # 日志系统
│   │   └── notifications.ts  # 本地通知（Capacitor）
│   ├── store.ts              # Zustand 全局状态
│   ├── types.ts              # TypeScript 类型定义
│   ├── constants.ts          # 常量与辅助函数
│   └── styles/
│       └── index.css         # Tailwind 入口 + 自定义样式
├── App.tsx                   # 应用根组件
├── index.tsx                 # 入口文件
├── index.html                # HTML 模板
├── capacitor.config.ts       # Capacitor 配置
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.js
└── postcss.config.mjs
```

---

## 🧪 测试

```bash
# 运行所有测试
npm test

# 监听模式
npx vitest --watch

# 带覆盖率报告
npx vitest --coverage
```

主要测试覆盖：
- `utils/installment.test.ts` — 分期计算逻辑（等额本息、提前还款）
- `utils/date.test.ts` — 日期工具函数
- `constants.test.ts` — 常量与账单周期计算

---

## 🤝 参与贡献

欢迎提交 Issue 和 PR！

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/amazing-feature`
3. 提交改动：`git commit -m 'feat: add amazing feature'`
4. 推送到分支：`git push origin feat/amazing-feature`
5. 提交 Pull Request

### 开发建议

- 类型定义在 `types.ts`，修改时保持 Zod schema 同步（`utils/validation.ts`）
- 分期计算核心逻辑在 `utils/installment.ts`，修改后运行 `npm test`
- 数据库迁移在 `utils/database.ts` 的 `migrateDatabase()` 中处理
- 全局状态走 Zustand store（`store.ts`），避免 prop drilling

---

## 📄 许可证

[GNU General Public License v3.0](LICENSE) — 你可以自由使用、修改和分发，但衍生项目也必须以 GPL v3 开源。

---

<div align="center">
Made with ❤️  |  <a href="https://github.com/davidwil11111/credit-card-manager/issues">反馈问题</a>  |  <a href="https://github.com/davidwil11111/credit-card-manager/discussions">讨论区</a>
</div>
