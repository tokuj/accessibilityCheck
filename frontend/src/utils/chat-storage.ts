/**
 * インラインAI対話機能のsessionStorageユーティリティ
 * 対話履歴の保存・取得を管理する
 */

// sessionStorageのキープレフィックス
export const STORAGE_KEY_PREFIX = 'a11y_chat_history_';

// 分析対象URLを保存するキー
const TARGET_URL_KEY = 'a11y_chat_target_url';

// 履歴の最大件数
export const MAX_HISTORY_ENTRIES = 20;

/**
 * 対話コンテキストの型定義
 */
export interface ChatContext {
  type: 'score' | 'lighthouse' | 'violation' | 'pass' | 'incomplete' | 'improvement' | 'recommendation' | 'issue' | 'wcag';
  ruleId?: string;
  wcagCriteria?: string[];
  data: Record<string, unknown>;
  label: string;
}

/**
 * 参照リンクの型定義（Grounding対応：ドメイン情報を含む）
 */
export interface ReferenceLink {
  uri: string;
  domain?: string;
  title?: string;
}

/**
 * 対話履歴エントリの型定義（Grounding対応）
 */
export interface ChatHistoryEntry {
  id: string;
  question: string;
  answer: string;
  referenceUrls?: string[];  // 後方互換性のため維持
  referenceLinks?: ReferenceLink[];  // 新しい形式（ドメイン情報を含む）
  timestamp: string;
  isInitialMessage?: boolean;
}

/**
 * コンテキストから一意のキーを生成する
 * labelを含めることで、同じruleIdでも異なるコンテキストを区別する
 * @param context - 対話コンテキスト
 * @returns 一意のキー文字列
 */
export function generateContextKey(context: ChatContext): string {
  const parts: string[] = [context.type];

  if (context.ruleId) {
    parts.push(context.ruleId);
  }

  if (context.wcagCriteria && context.wcagCriteria.length > 0) {
    parts.push(context.wcagCriteria.join('-'));
  }

  // labelを追加して一意性を確保
  if (context.label) {
    parts.push(context.label);
  }

  return parts.join('_');
}

/**
 * sessionStorageから履歴を取得する
 * @param contextKey - コンテキストキー
 * @returns 履歴エントリの配列（履歴がない場合は空配列）
 */
export function getHistory(contextKey: string): ChatHistoryEntry[] {
  const storageKey = `${STORAGE_KEY_PREFIX}${contextKey}`;

  try {
    const stored = sessionStorage.getItem(storageKey);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as ChatHistoryEntry[];
  } catch {
    // JSONパースエラーの場合は空配列を返す
    return [];
  }
}

/**
 * 履歴をsessionStorageに保存する
 * 20件を超える場合は古いエントリから削除する
 * @param contextKey - コンテキストキー
 * @param history - 保存する履歴
 */
export function saveHistory(contextKey: string, history: ChatHistoryEntry[]): void {
  const storageKey = `${STORAGE_KEY_PREFIX}${contextKey}`;

  // 20件を超える場合は古いエントリを削除
  const trimmedHistory = history.length > MAX_HISTORY_ENTRIES
    ? history.slice(history.length - MAX_HISTORY_ENTRIES)
    : history;

  sessionStorage.setItem(storageKey, JSON.stringify(trimmedHistory));
}

/**
 * 現在の分析対象URLを取得する
 * @returns 保存されているURL、なければnull
 */
export function getCurrentTargetUrl(): string | null {
  return sessionStorage.getItem(TARGET_URL_KEY);
}

/**
 * 分析対象URLを設定する
 * @param url - 分析対象URL
 */
export function setCurrentTargetUrl(url: string): void {
  sessionStorage.setItem(TARGET_URL_KEY, url);
}

/**
 * 分析対象URLが変更されたかどうかを判定する
 * @param newUrl - 新しいURL
 * @returns URLが変更された場合はtrue
 */
export function hasTargetUrlChanged(newUrl: string): boolean {
  const currentUrl = getCurrentTargetUrl();
  return currentUrl !== null && currentUrl !== newUrl;
}

/**
 * すべてのチャット履歴をクリアする
 * STORAGE_KEY_PREFIXで始まるキーをすべて削除
 */
export function clearAllChatHistory(): void {
  const keysToRemove: string[] = [];

  // sessionStorageからプレフィックスで始まるキーを収集
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  // 収集したキーを削除
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}
