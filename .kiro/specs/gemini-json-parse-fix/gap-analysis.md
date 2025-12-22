# Gap Analysis: gemini-json-parse-fix

## 1. 現状調査

### 1.1 対象ファイル・モジュール

| ファイル | 役割 | 影響範囲 |
|---------|------|---------|
| `server/services/gemini.ts` | Gemini API呼び出し・レスポンスパース | 直接変更対象 |
| `server/services/gemini.test.ts` | GeminiServiceのユニットテスト | テスト追加対象 |
| `server/analyzers/types.ts` | AISummary型定義 | フォールバックフラグ追加の可能性 |
| `server/services/secret-manager.ts` | Result型・エラー型パターン | 参照（パターン流用） |

### 1.2 既存アーキテクチャパターン

**Result型パターン**:
```typescript
export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E };
```
- `secret-manager.ts`で定義され、`gemini.ts`で再利用
- GeminiError型は既に3種類（api_error, timeout, rate_limit）を定義

**エラーハンドリング**:
- try-catchブロックでエラーを捕捉
- console.errorでログ出力
- Result型でエラーを呼び出し元に返却

**定数定義パターン**:
```typescript
const GEMINI_MODEL = 'gemini-2.0-flash';
const API_TIMEOUT_MS = 30000;
```
- ファイル先頭で定数を定義（変更容易性確保）

### 1.3 現行コードの問題点

1. **`parseGeminiResponse`関数（269-321行目）**:
   - `JSON.parse(text)`を直接実行
   - パース失敗時は`null`を返却し、呼び出し元でエラー化
   - サニタイズ処理なし
   - エラー詳細（位置情報等）をログ出力していない

2. **`maxOutputTokens`（69行目）**:
   - 現在2048に設定
   - 大量の違反がある場合、レスポンスが途中で切れる可能性

3. **リトライ機構**:
   - 現在は実装なし
   - タイムアウト・ネットワークエラー時に即座に失敗

---

## 2. 要件の技術的実現性分析

### 2.1 要件-資産マッピング

| 要件 | 既存資産 | ギャップ | 複雑度 |
|------|---------|---------|--------|
| R1: JSONサニタイズ | なし | **Missing** - 新規実装必要 | 中 |
| R2: maxOutputTokens増加 | 定数定義あり | **簡単** - 値変更のみ | 低 |
| R3: フォールバック処理 | countByImpact関数あり | **Missing** - 新規実装必要 | 中 |
| R4: エラー処理強化 | GeminiError型あり | **Partial** - リトライ機構追加 | 中 |
| R5: テスト追加 | テストファイルあり | **Extension** - ケース追加 | 低 |

### 2.2 技術的課題

#### JSONサニタイズの難しさ

Gemini APIのJSON応答問題は業界で既知の課題（[Google AI Forum](https://discuss.ai.google.dev/t/json-responses-and-plaintext-responses-with-json-doesnt-have-proper-double-quotations-escaping/33926)）:

1. **未エスケープの引用符**: `howToFix`フィールドにコード例（`"<img alt=\"...\">"`)が含まれる場合
2. **制御文字**: 改行(`\n`)、タブ(`\t`)が文字列内に未エスケープで存在
3. **バックスラッシュ**: Windowsパスやエスケープシーケンスの二重エスケープ問題
4. **Markdownバッククォート**: `responseMimeType: 'application/json'`を指定しても稀に発生

**Research Needed**:
- JSON5ライブラリの導入可否（より寛容なパース）
- 正規表現ベースのサニタイズが安全に実装可能か

#### フォールバックAISummary

既存の`countByImpact`関数を活用可能:
```typescript
function countByImpact(violations: RuleResult[]): ImpactSummary
```

フォールバックメッセージのテンプレート化が必要。

#### リトライ機構

プロジェクト内に既存のリトライパターンなし。新規実装が必要。

**Research Needed**:
- 指数バックオフの実装パターン
- リトライ対象エラーの判定基準（タイムアウト、5xx、ネットワークエラー）

---

## 3. 実装アプローチオプション

### Option A: 既存ファイル拡張

**対象**: `server/services/gemini.ts`のみを変更

**変更内容**:
1. `sanitizeJsonString`関数を同ファイル内に追加
2. `parseGeminiResponse`を拡張してサニタイズ呼び出し
3. `generateFallbackSummary`関数を追加
4. `MAX_OUTPUT_TOKENS`定数を4096に変更
5. リトライロジックを`generateAISummary`内に埋め込み

**Trade-offs**:
- ✅ 変更ファイル数最小（1ファイル）
- ✅ 既存のimport/export変更なし
- ❌ gemini.tsが肥大化（現在322行 → 推定450行以上）
- ❌ サニタイズ・リトライの再利用性低下

### Option B: 新規ユーティリティ作成

**対象**: 新規ファイルを作成して責務分離

**新規ファイル**:
- `server/services/json-sanitizer.ts`: JSONサニタイズユーティリティ
- `server/utils/retry.ts`: 汎用リトライヘルパー

**変更ファイル**:
- `server/services/gemini.ts`: 新ユーティリティをimportして使用
- `server/analyzers/types.ts`: AISummaryに`isFallback?: boolean`追加

**Trade-offs**:
- ✅ 単一責任原則の遵守
- ✅ JSONサニタイザー・リトライは他でも再利用可能
- ✅ テストが容易（各ユーティリティを独立テスト）
- ❌ ファイル数増加（3ファイル変更 + 2ファイル新規）
- ❌ 初期実装コスト高め

### Option C: ハイブリッドアプローチ（推奨）

**方針**:
- 本修正の範囲に留める変更は`gemini.ts`内で完結
- 将来の再利用性を考慮しつつ、過度な抽象化は避ける

**変更内容**:
1. `sanitizeGeminiJsonResponse`関数を`gemini.ts`内に追加（Gemini固有のため）
2. `generateFallbackSummary`関数を`gemini.ts`内に追加
3. リトライは`generateAISummary`内で1回のみの簡易実装
4. `MAX_OUTPUT_TOKENS`定数を追加・変更
5. `GeminiError`型に`parse_error`を追加

**Trade-offs**:
- ✅ 変更範囲が明確（gemini.ts + types.ts + テスト）
- ✅ 過度な抽象化なし
- ✅ 将来的に分離が必要になれば容易にリファクタリング可能
- ❌ リトライ機構は他で再利用不可（必要になれば分離）

---

## 4. 工数・リスク評価

### 工数: **S（1-3日）**

**根拠**:
- 変更対象は明確（主にgemini.ts）
- 既存パターン（Result型、エラー型）を踏襲可能
- 外部依存の追加なし（JSON5等は不採用想定）
- テストの雛形あり

### リスク: **Medium（中程度）**

**リスク要因**:
| リスク | 影響 | 軽減策 |
|--------|------|--------|
| サニタイズが有効なJSONを破壊 | 高 | 十分なテストケース、段階的適用 |
| フォールバックが頻発 | 中 | ログ監視、アラート設定 |
| リトライによるレイテンシ増加 | 低 | リトライ1回のみ、タイムアウト短縮 |

**Research Needed（設計フェーズで調査）**:
1. Gemini APIの`finishReason`フィールドでトランケーション検出可否
2. サニタイズ正規表現の安全性検証
3. Cloud Runログでのエラー詳細の可視化方法

---

## 5. 設計フェーズへの推奨事項

### 推奨アプローチ: **Option C（ハイブリッド）**

**理由**:
- 変更範囲が最小限で、既存アーキテクチャとの一貫性を維持
- 将来的な拡張（別サービス追加等）時にリファクタリング余地を残す
- プロジェクトの規模（単一バックエンド）に適切

### 設計フェーズで決定すべき事項

1. **サニタイズ戦略**:
   - 正規表現ベース vs 文字単位パース
   - 対象文字の範囲（制御文字のみ or 全Unicode）

2. **フォールバックメッセージ**:
   - 日本語テンプレートの文言
   - `isFallback`フラグの追加可否

3. **リトライ条件**:
   - リトライ対象エラー（timeout, 5xx, network）
   - バックオフ間隔（1秒固定 or 指数）

4. **ログ出力レベル**:
   - パースエラー時のログ詳細度
   - 元レスポンステキストの部分出力長

---

## 参考資料

- [Gemini API JSON Escaping Issue - Google AI Forum](https://discuss.ai.google.dev/t/json-responses-and-plaintext-responses-with-json-doesnt-have-proper-double-quotations-escaping/33926)
- [Gemini CLI JSON Parse Error - GitHub Issue](https://github.com/google-gemini/gemini-cli/issues/4277)
- [Gemini Structured Output Special Characters - GitHub Issue](https://github.com/googleapis/python-genai/issues/1238)
