# Aether — Copilot Remote Control

<p align="center">
  <img src="https://img.shields.io/badge/self--hosted-yes-blue" alt="self-hosted" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node >= 18" />
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="MIT" />
</p>

GitHub Copilot CLI をブラウザ・Androidアプリからリモート操作できるセルフホスト型Webアプリ。  
Self-hosted web app to remotely control GitHub Copilot CLI from browser & Android.

```
┌─────────────────┐                   ┌───────────────┐     ACP/stdio     ┌──────────────┐
│  Browser         │   Socket.IO      │               │ ◄───────────────► │              │
│  Android App     │ ◄──────────────► │  Aether       │                   │  Copilot CLI │
│  (multi-client)  │                  │  (start.js)   │                   │  (--acp)     │
└─────────────────┘                   └───────────────┘                   └──────────────┘
```

## Getting Started

### 前提条件 / Prerequisites

- **Node.js 18+**
- **GitHub Copilot CLI** がインストール済み（`copilot --version` で確認）

### 方法 1: 直接実行

```bash
git clone https://github.com/<your-username>/aether.git
cd aether
npm install
node start.js
```

→ `http://localhost:8787` にアクセス → 初回はアカウント作成

### 方法 2: Docker

```bash
git clone https://github.com/<your-username>/aether.git
cd aether
docker compose up -d
```

### 方法 3: systemd サービス

```bash
sudo cp aether@.service /etc/systemd/system/
sudo systemctl enable --now aether@$USER
```

### Android アプリ

[Releases](../../releases) から APK をダウンロード → インストール → サーバーURL入力 → ログイン

## 機能 / Features

| Feature | Web | Android |
|---------|-----|---------|
| Prompt & Chat | ✅ | ✅ |
| Model selection (16+ models) | ✅ | ✅ |
| Mode switching (Agent/Plan) | ✅ | ✅ |
| Permission management | ✅ | ✅ |
| Slash commands | ✅ | ✅ |
| Tool call display (collapsible) | ✅ | ✅ |
| Thinking process (collapsible) | ✅ | ✅ |
| Markdown rendering | ✅ | ✅ |
| Session management | ✅ | ✅ |
| YOLO levels | ✅ | ✅ |
| Usage stats | ✅ | ✅ |
| Dark/Light theme | ✅ | ✅ |
| Multi-client sync | ✅ | ✅ |
| Chat history replay | ✅ | ✅ |
| Biometric app lock | — | ✅ |

## 環境変数 / Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8787` | Server port |
| `COPILOT_PATH` | `copilot` | Path to Copilot CLI binary |
| `COPILOT_CWD` | `process.cwd()` | Default working directory |
| `COPILOT_ARGS` | | Extra CLI arguments |
| `WORKSPACE_IDLE_TIMEOUT_MS` | `1800000` | Idle timeout (30 min) |

## セキュリティ / Security

- ユーザー名/パスワード認証（scrypt ハッシュ）
- JWT トークンベースのセッション管理
- 認証情報は `data/` ディレクトリにローカル保存
- **インターネット公開時は必ずリバースプロキシ (nginx等) + HTTPS を使用してください**

## Android APK ビルド

```bash
cd android
./gradlew assembleRelease    # or assembleDebug
# → app/build/outputs/apk/
```

## Tech Stack

- **Server**: Node.js + Express + Socket.IO v4 + [ACP SDK](https://github.com/nickarora/acp-sdk)
- **Web**: Vanilla JS + marked.js + highlight.js
- **Android**: Kotlin + Jetpack Compose + Material 3 + Markwon
- **Auth**: scrypt + JWT (no external DB)

## License

MIT
