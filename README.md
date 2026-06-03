# 信用卡账单管理器 (Credit Card Manager)

一个本地优先的信用卡账单管理应用，支持账单记录、分期计算、提前还款分析等功能。

## 功能特性

- 💳 **账单管理** — 记录信用卡消费、还款、分期
- 📊 **账单总览** — 按卡、按月的账单汇总视图
- 🔢 **分期计算器** — 支持多期数、多费率的分期方案对比
- 💰 **提前还款分析** — 计算提前还款 vs 分期的实际节省
- 📈 **费用统计** — 可视化消费分类与趋势
- 🔒 **本地存储** — 数据存储在本地 SQLite，不上传云端
- 📱 **跨平台** — Web 端 + Android 端（Capacitor）

## 技术栈

| 技术 | 用途 |
|------|------|
| **React 18** | 用户界面 |
| **TypeScript** | 类型安全 |
| **Vite 6** | 构建工具 |
| **Tailwind CSS** | 样式 |
| **Zustand** | 状态管理 |
| **Zod** | 数据验证 |
| **Capacitor 8** | Android 打包 |
| **SQLite** | 本地持久化 |
| **Vitest** | 单元测试 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 构建生产版本
npm run build
```

### Android 打包

```bash
npx cap sync
npx cap open android
```

然后在 Android Studio 中运行或签名打包。

## 项目结构

```
src/
├── components/     # UI 组件
│   ├── Overview.tsx
│   ├── Detail.tsx
│   ├── Analysis.tsx
│   ├── InstallmentForm.tsx
│   ├── InstallmentPlanView.tsx
│   ├── EarlySettlementModal.tsx
│   ├── FeeStatistics.tsx
│   └── ...
├── utils/          # 工具函数
│   ├── database.ts
│   ├── installment.ts
│   ├── validation.ts
│   ├── currency.ts
│   └── date.ts
├── store.ts        # Zustand 状态管理
├── types.ts        # TypeScript 类型定义
├── constants.ts    # 常量配置
└── styles/         # 全局样式
```

## 许可证

[GNU General Public License v3.0](LICENSE)
