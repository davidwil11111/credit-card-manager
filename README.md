# 信用卡账单管理

一款基于 React + Capacitor 的 Android 信用卡账单管理应用，支持多卡管理、交易追踪、手续费统计、分期计划等功能。

## 功能

- **多卡管理** — 添加/编辑/删除信用卡，支持20家主流银行，自动匹配银行主题色
- **交易记录** — 消费、还款、贷款账单、分期等多种交易类型
- **账单周期** — 自动计算账单日/还款日，支持固定日和账单日后N天两种还款配置
- **手续费统计** — POS机费率管理，多渠道费率配置，消费手续费自动计算
- **分期计划** — 等额本息分期计算，每月还款明细，提前结清计算
- **数据可视化** — 消费趋势、费率分析、银行分布等统计图表
- **本地存储** — SQLite 持久化，数据完全保留在本地
- **数据备份** — JSON 导出/导入，自动备份
- **还款提醒** — 本地通知，逾期提醒
- **手势操作** — 左滑返回

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| 状态管理 | Zustand 5 |
| 样式 | TailwindCSS 3.4 |
| 数据库 | Capacitor SQLite |
| 原生平台 | Capacitor 8 (Android) |
| 数据校验 | Zod |
| 图标 | Lucide React |

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 同步到 Android
npm run sync

# 运行测试
npm test

# 构建
npm run build
```

## 项目结构

```
├── App.tsx                    # 应用入口
├── store.ts                   # Zustand 全局状态
├── types.ts                   # TypeScript 类型定义
├── constants.ts               # 账单计算逻辑、模拟数据
├── components/
│   ├── Overview.tsx           # 首页总览
│   ├── Detail.tsx             # 卡片详情
│   ├── Statistics.tsx         # 统计图表
│   ├── FeeStatistics.tsx      # 手续费统计
│   ├── Analysis.tsx           # 数据分析
│   ├── CreditCardForm.tsx     # 卡片表单
│   ├── TransactionForm.tsx    # 交易表单
│   ├── InstallmentForm.tsx    # 分期创建
│   ├── InstallmentPlanView.tsx # 分期详情
│   ├── EarlySettlementModal.tsx # 提前结清
│   ├── LogViewer.tsx          # 日志查看
│   ├── SplashScreen.tsx       # 启动屏
│   └── ui/Modal.tsx           # 通用弹窗组件
└── utils/
    ├── database.ts            # SQLite 数据库操作
    ├── installment.ts         # 分期计算
    ├── notifications.ts       # 本地通知
    ├── validation.ts          # Zod 数据校验
    ├── logger.ts              # 日志系统
    ├── date.ts                # 日期工具
    └── currency.ts            # 金额格式化
```

## License

MIT
