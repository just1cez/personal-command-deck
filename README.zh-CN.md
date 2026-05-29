# Personal Command Deck

一个本地优先的个人执行桌面，基于 React、Vite、TypeScript 和 Electron 构建。

Personal Command Deck 的目标不是做一个复杂管理后台，而是做一个每天打开就能进入状态的小型个人指挥台：看到现在最重要的事，开始专注，暂存想法，盯住临近事项，并在收工时轻量复盘。

## 功能

- 今日专注：显示本轮目标、专注计时、完成率、累计专注时间和临近提醒。
- Top 3 与普通待办：把今天最重要的三件事和普通任务分开，并支持手动排序。
- 项目推进：每个项目只显示下一步动作，而不是一堆长期目标。
- 快捷入口：自定义常用工具、文档、邮箱、日历、GitHub、AI 工具等链接。
- 天气：支持按本地定位或城市查询天气。
- 每日名言池：本地管理名言，每天固定显示一句。
- 灵感暂存箱：快速收纳临时想法，之后再整理。
- 提醒与倒计时：记录账单、deadline、生日、面试、旅行等日期。
- 收工复盘：默认本地总结，也可以选择接入 AI API。
- 本地备份：支持导出和导入 JSON 备份。

## 本地优先

应用数据保存在桌面端或浏览器运行时的 localStorage 中，不需要账号，也不依赖托管后端。

可选 AI 总结的 API Key 也保存在本机 localStorage。对于个人本地工具来说比较方便，但它不是加密保险箱。

## AI 总结

收工复盘区域可以选择调用 OpenAI-compatible 的 Chat Completions API。

内置提供商预设：

- OpenAI
- DeepSeek
- Moonshot
- 自定义 OpenAI-compatible 地址

启用后，应用会自动根据当前指挥台数据生成提示词，包括任务、项目、暂存箱、提醒、专注分钟和复盘输入。未启用时，会继续使用本地总结。

## 开发

安装依赖：

```bash
npm install
```

运行 Web 版本：

```bash
npm run dev
```

运行 Electron 桌面开发版：

```bash
npm run dev:desktop
```

代码检查：

```bash
npm run lint
```

构建 Web 资源：

```bash
npm run build
```

构建 Windows 桌面安装包：

```bash
npm run dist:desktop
```

安装包和解压后的桌面应用会生成在 `release/` 目录。该目录已被 Git 忽略。

## 仓库规则

仓库只提交源码和项目配置，不提交：

- `node_modules/`
- `dist/`
- `release/`
- 本地 API Key
- 本地指挥台数据

如果要分发安装包，建议通过 GitHub Releases 上传生成的 `.exe`，不要直接提交到仓库。

## 技术栈

- React
- TypeScript
- Vite
- Electron
- electron-builder
- lucide-react
