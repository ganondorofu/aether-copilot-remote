/* Aether i18n — English / Japanese */
const I18N = {
  en: {
    // Auth
    auth_subtitle_setup: 'Create your account to get started',
    auth_subtitle_login: 'Sign in to continue',
    auth_submit_setup: 'Create Account',
    auth_submit_login: 'Sign In',
    auth_user_placeholder: 'Username',
    auth_pass_placeholder: 'Password',
    auth_error_conn: 'Connection error: ',
    auth_error_fail: 'Failed',
    auth_error_prefix: 'Error: ',
    // Sidebar
    sidebar_empty: 'No sessions yet',
    logout: 'Logout',
    // Header / badges
    badge_connecting: 'connecting',
    badge_connected: 'connected',
    badge_running: 'running',
    badge_disconnected: 'disconnected',
    badge_error: 'error',
    // YOLO levels
    yolo_normal: 'Normal',
    yolo_trust_reads: 'Trust reads',
    yolo_trust_most: 'Trust most',
    yolo_yolo: 'YOLO',
    // Buttons / tooltips
    btn_theme: 'Theme',
    btn_settings: 'Settings',
    btn_new_session: 'New session',
    btn_menu: 'Menu',
    btn_browse: 'Browse',
    btn_attach: 'Attach file',
    btn_send: 'Send (Ctrl+Enter)',
    btn_cancel: 'Cancel',
    btn_scroll_bottom: 'Scroll to bottom',
    btn_select: 'Select',
    btn_create: 'Create',
    btn_logout: 'Logout',
    // Dialogs
    dlg_new_session: 'New Session',
    dlg_working_dir: 'Working Directory',
    dlg_title_optional: 'Title (optional)',
    dlg_placeholder_cwd: '/path/to/project',
    dlg_placeholder_title: 'Session name',
    dlg_browse_dir: 'Browse Directory',
    // Settings
    settings_title: 'Settings',
    settings_empty: 'No configuration options available',
    // Plan
    plan_title: 'Plan',
    // Chat
    prompt_placeholder: 'Message... ( / for commands)',
    thinking: 'Thinking...',
    thought_chars: 'Thought ({0} chars)',
    show_details: 'Show details',
    hide_details: 'Hide details',
    done_label: 'Done ({0})',
    auto_approved: 'Auto-approved: {0} ({1})',
    busy: 'Busy',
    // Permission
    perm_title: 'Permission Required',
    perm_reject_placeholder: 'Reject with feedback...',
    perm_reject: 'Reject',
    // Date groups
    date_today: 'Today',
    date_yesterday: 'Yesterday',
    date_prev_7: 'Previous 7 Days',
    date_prev_30: 'Previous 30 Days',
    date_older: 'Older',
    // Usage
    usage_quota: 'Quota',
    usage_premium: 'Premium',
    // Misc
    model_placeholder: 'Model',
    perm_level: 'Permission Level',
    copilot_remote: 'Copilot Remote Control',
    lang_label: 'EN',
  },
  ja: {
    auth_subtitle_setup: 'アカウントを作成してください',
    auth_subtitle_login: 'サインインしてください',
    auth_submit_setup: 'アカウント作成',
    auth_submit_login: 'サインイン',
    auth_user_placeholder: 'ユーザー名',
    auth_pass_placeholder: 'パスワード',
    auth_error_conn: '接続エラー: ',
    auth_error_fail: '失敗しました',
    auth_error_prefix: 'エラー: ',
    sidebar_empty: 'セッションがありません',
    logout: 'ログアウト',
    badge_connecting: '接続中',
    badge_connected: '接続済み',
    badge_running: '実行中',
    badge_disconnected: '切断',
    badge_error: 'エラー',
    yolo_normal: '通常',
    yolo_trust_reads: '読取を信頼',
    yolo_trust_most: 'ほぼ信頼',
    yolo_yolo: 'YOLO',
    btn_theme: 'テーマ',
    btn_settings: '設定',
    btn_new_session: '新規セッション',
    btn_menu: 'メニュー',
    btn_browse: '参照',
    btn_attach: 'ファイル添付',
    btn_send: '送信 (Ctrl+Enter)',
    btn_cancel: 'キャンセル',
    btn_scroll_bottom: '一番下へ',
    btn_select: '選択',
    btn_create: '作成',
    btn_logout: 'ログアウト',
    dlg_new_session: '新規セッション',
    dlg_working_dir: '作業ディレクトリ',
    dlg_title_optional: 'タイトル（任意）',
    dlg_placeholder_cwd: '/path/to/project',
    dlg_placeholder_title: 'セッション名',
    dlg_browse_dir: 'ディレクトリ参照',
    settings_title: '設定',
    settings_empty: '設定オプションはありません',
    plan_title: 'プラン',
    prompt_placeholder: 'メッセージ… ( / でコマンド)',
    thinking: '思考中…',
    thought_chars: '思考 ({0}文字)',
    show_details: '詳細を表示',
    hide_details: '詳細を非表示',
    done_label: '完了 ({0})',
    auto_approved: '自動承認: {0} ({1})',
    busy: '処理中',
    perm_title: '権限が必要です',
    perm_reject_placeholder: 'フィードバック付きで拒否…',
    perm_reject: '拒否',
    date_today: '今日',
    date_yesterday: '昨日',
    date_prev_7: '過去7日間',
    date_prev_30: '過去30日間',
    date_older: 'それ以前',
    usage_quota: '残量',
    usage_premium: 'プレミアム',
    model_placeholder: 'モデル',
    perm_level: '権限レベル',
    copilot_remote: 'Copilot リモートコントロール',
    lang_label: 'JA',
  },
};

let _lang = localStorage.getItem('aether-lang') || (navigator.language.startsWith('ja') ? 'ja' : 'en');

function t(key, ...args) {
  let s = (I18N[_lang] && I18N[_lang][key]) || I18N.en[key] || key;
  args.forEach((v, i) => { s = s.replace(`{${i}}`, v); });
  return s;
}

function setLang(lang) {
  _lang = lang;
  localStorage.setItem('aether-lang', lang);
}

function getLang() { return _lang; }
