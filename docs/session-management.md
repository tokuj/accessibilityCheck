# セッション管理機能

## 概要

セッション管理機能は、認証が必要なWebページのアクセシビリティ検証を効率化するための機能です。従来は認証情報（Cookie、トークン等）を手動で取得してツールに設定する必要がありましたが、この機能を使用することで以下が可能になります。

- ブラウザ上で通常通りログインするだけで認証状態を自動記録
- 記録した認証セッションを再利用して検証を実行
- 複数の認証セッション（管理者、一般ユーザー等）を管理

## セキュリティ

### 暗号化

セッションデータはAES-256-GCMで暗号化されて保存されます。

- 暗号化アルゴリズム: AES-256-GCM（認証付き暗号化）
- 鍵導出: PBKDF2-SHA256（310,000反復）
- パスフレーズ: ユーザーが設定し、メモリ内のみで処理

### データ保護

- 生のパスワードやクレデンシャルは保存されません
- セッションファイルには認証後のCookieとトークンのみが含まれます
- autoDestroyオプションを使用すると検証後にセッションを自動削除できます

### 制限事項

- セッションファイルはローカルストレージに保存されます
- 開発環境でのみインタラクティブログインが利用可能です
- Cloud Run等のheadless環境ではインタラクティブログインは使用できません

## 使用方法

### 1. インタラクティブログイン（開発環境）

1. フロントエンドで「ログイン記録」ボタンをクリック
2. ログインURL（例: https://example.com/login）を入力
3. 開いたブラウザウィンドウで通常通りログイン
4. ログイン完了後「ログイン完了」ボタンをクリック
5. セッション名（例: admin-session）を入力
6. パスフレーズを設定して保存

### 2. セッションの再利用

1. セッションドロップダウンから保存済みセッションを選択
2. パスフレーズを入力
3. 通常通りURLを入力して検証を開始
4. 認証済み状態でアクセシビリティ検証が実行されます

### 3. セッションの管理

- **一覧表示**: ドロップダウンで保存済みセッション一覧を確認
- **詳細表示**: セッションにホバーでドメイン、認証タイプ、有効期限を確認
- **削除**: 削除ボタンで不要なセッションを削除
- **再認証**: 期限切れセッションは「再認証」ボタンで更新

## API仕様

### Session Management API

#### GET /api/sessions

セッション一覧を取得します。

**レスポンス**

```json
[
  {
    "id": "uuid",
    "name": "admin-session",
    "domain": "example.com",
    "createdAt": "2025-12-20T10:00:00Z",
    "updatedAt": "2025-12-20T10:00:00Z",
    "expiresAt": "2025-12-21T10:00:00Z",
    "schemaVersion": 1,
    "authType": "form",
    "autoDestroy": false
  }
]
```

#### POST /api/sessions

セッションを作成します。

**リクエスト**

```json
{
  "name": "session-name",
  "passphrase": "your-passphrase",
  "storageState": {
    "cookies": [...],
    "origins": [...]
  },
  "options": {
    "autoDestroy": false,
    "expiresAt": "2025-12-21T10:00:00Z"
  }
}
```

**レスポンス**

```json
{
  "id": "uuid",
  "name": "session-name",
  "domain": "example.com",
  ...
}
```

#### DELETE /api/sessions/:id

セッションを削除します。

#### POST /api/sessions/:id/load

セッションを復号化して読み込みます。

**リクエスト**

```json
{
  "passphrase": "your-passphrase"
}
```

**レスポンス**

```json
{
  "storageState": {
    "cookies": [...],
    "origins": [...]
  }
}
```

### Interactive Login API（開発環境専用）

#### POST /api/auth/interactive-login

ログインセッションを開始します。

**リクエスト**

```json
{
  "loginUrl": "https://example.com/login"
}
```

#### POST /api/auth/capture-session

セッションをキャプチャして保存します。

**リクエスト**

```json
{
  "sessionName": "session-name",
  "passphrase": "your-passphrase"
}
```

#### DELETE /api/auth/interactive-login

ログインセッションをキャンセルします。

## エラーハンドリング

| ステータス | 説明 |
|-----------|------|
| 400 | パスフレーズ空、セッション名無効 |
| 401 | パスフレーズ不正（復号化失敗） |
| 404 | セッションが存在しない |
| 409 | セッション名重複 |
| 500 | I/Oエラー |
| 503 | headedブラウザ環境が利用不可 |

## ファイル構造

セッションデータは以下のディレクトリに保存されます。

```text
server/data/sessions/
├── index.json           # セッションメタデータ一覧
├── {session-id-1}.enc   # 暗号化セッションファイル
└── {session-id-2}.enc
```

暗号化ファイルの構造:

```text
[64-byte PBKDF2 salt][12-byte IV][ciphertext][16-byte auth tag]
```

## 制限事項

- セッション数上限: 20
- セッション名: 1-50文字
- パスフレーズ: 空文字列は不可

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| ALLOW_HEADED_BROWSER | headedブラウザの使用を許可 | false |
| SESSION_DATA_DIR | セッションデータの保存先 | server/data/sessions |
