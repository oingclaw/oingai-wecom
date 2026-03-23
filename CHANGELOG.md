# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-03-24

### Added
- 添加 `README_CN.md` 中文文档
- 添加 `.gitignore` 文件
- 添加 `LICENSE` (MIT) 许可证
- 添加 `CONTRIBUTING.md` 贡献指南

### Security
- 完成安全审查，确认无硬编码密钥或敏感路径泄露
- 日志输出仅限插件注册信息，不涉及用户隐私

## [0.0.1] - 2026-03-22

### Added
- 初始版本
- `oingai_wecom_send` 工具：双模式消息发送（Bot WS + Agent API fallback）
- `oingai_wecom_session_resolve` 工具：会话格式解析
- 支持自动检测 Bot WS 频率限制并提供 Agent API fallback 建议