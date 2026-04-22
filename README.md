# SSH Manager

一款基于 Electron 的 SSH 连接管理工具，类似 Xshell，支持多标签终端、服务器管理和主题自定义。

## 功能

- 🖥️ **多标签终端** — 同时连接多台服务器，Tab 切换
- 📋 **服务器管理** — 添加、编辑、删除服务器节点
- 🔐 **认证方式** — 支持密码和 SSH 密钥认证
- 🎨 **主题定制** — 6 种预设主题 + 自定义颜色/字体
- 💾 **数据持久化** — 配置自动保存到本地
- ⌨️ **快捷键** — Cmd+W 关闭标签，ESC 关闭弹窗

## 技术栈

- Electron
- ssh2
- xterm.js (@xterm/xterm + addon-fit + addon-web-links)

## 开发

```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 打包为 macOS 应用
npx @electron/packager . "SSH Manager" --platform=darwin --arch=arm64 --out=dist --overwrite
```

## 许可证

MIT
