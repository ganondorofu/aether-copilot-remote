# Aether — Copilot Remote Control

GitHub Copilot CLI をブラウザ・Androidアプリからリモート操作するWebアプリケーション。

```
┌─────────────────┐                   ┌───────────────┐     ACP/stdio     ┌──────────────┐
│  Browser         │   Socket.IO      │               │ ◄───────────────► │              │
│  Android App     │ ◄──────────────► │  Server       │                   │  Copilot CLI │
│  (clients)       │   (multi-client) │  (start.js)   │                   │  (--acp)     │
└─────────────────┘                   └───────────────┘                   └──────────────┘
```

## 特徴

- 🌐 **マルチクライアント** — Web・モバイルから同時接続、同じワークスペースを共有
- 🔒 **認証** — ユーザー名/パスワード認証 + JWTトークン
- 📱 **Androidアプリ** — Material 3 Kotlin/Compose、生体認証ロック対応
- 💬 **リアルタイム通信** — Socket.IO v4 による双方向メッセージング
- 🔄 **リプレイ** — 再接続時にチャット履歴を自動復元
- 🤖 **フル機能** — モデル/モード切替、YOLO設定、ツール実行、パーミッション管理
- 📂 **セッション管理** — 複数セッション、ディレクトリ指定、リネーム、削除

## クイックスタート

### 1. サーバー起動

```bash
cd copilot-remote-ui
npm install
node start.js          # http://localhost:8787
```

初回アクセス時にアカウント作成画面が表示されます。

### 2. 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `PORT` | `8787` | サーバーポート |
| `COPILOT_PATH` | `copilot` | Copilot CLI のパス |
| `COPILOT_CWD` | `process.cwd()` | デフォルト作業ディレクトリ |
| `COPILOT_ARGS` | `` | Copilot CLI 追加引数 |
| `WORKSPACE_IDLE_TIMEOUT_MS` | `1800000` | ワークスペースアイドルタイムアウト (30分) |

### 3. Web クライアント

ブラウザで `http://localhost:8787` にアクセス → ログイン → チャット開始。

### 4. Android クライアント

```bash
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

## 機能一覧

| 機能 | Web | Android |
|------|-----|---------|
| プロンプト送信 | ✅ | ✅ |
| モデル選択 (16+モデル) | ✅ | ✅ |
| モード切替 (Agent/Plan) | ✅ | ✅ |
| パーミッション応答 | ✅ | ✅ |
| スラッシュコマンド | ✅ | ✅ |
| ツール実行表示 (折りたたみ) | ✅ | ✅ |
| 思考プロセス (折りたたみ) | ✅ | ✅ |
| Markdownレンダリング | ✅ | ✅ |
| セッション管理 | ✅ | ✅ |
| YOLO設定 | ✅ | ✅ |
| 使用量表示 | ✅ | ✅ |
| ダーク/ライトテーマ | ✅ | ✅ |
| 生体認証ロック | — | ✅ |
| マルチクライアント同期 | ✅ | ✅ |
| チャット履歴リプレイ | ✅ | ✅ |

## Socket.IO プロトコル

### クライアント → サーバー

| イベント | 説明 |
|---------|------|
| `auto_connect` | ワークスペース自動接続 |
| `prompt` | プロンプト送信 |
| `permission_response` | パーミッション応答 |
| `cancel` | 実行キャンセル |
| `set_mode` / `set_model` | モード/モデル変更 |
| `set_yolo` | YOLO レベル変更 |
| `create_session` | 新規セッション作成 (CWD指定可) |
| `switch_session` / `delete_session` | セッション操作 |

### サーバー → クライアント (`msg` イベント)

| type | 説明 |
|------|------|
| `init` | ワークスペース初期化情報 |
| `chunk` | テキストチャンク (agent/thought/user) |
| `tool` / `tool_update` | ツール実行状態 |
| `permission` | パーミッション要求 |
| `permission_resolved` | パーミッション解決通知 |
| `session_created` / `session_switched` | セッション変更通知 |
| `replay_start` / `replay_end` | リプレイ開始/終了 |
| `usage` | トークン使用量 |

## 技術スタック

- **Server**: Node.js + Express + Socket.IO v4 + ACP SDK
- **Web**: Vanilla JS + Socket.IO client
- **Android**: Kotlin + Jetpack Compose + Material 3 + Socket.IO Java Client + Markwon
- **Auth**: bcrypt + JWT
- **Data**: JSON ファイルベース永続化

## ライセンス

MIT
