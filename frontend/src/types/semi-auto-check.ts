/**
 * 半自動チェック型定義（フロントエンド用）
 *
 * Requirements: wcag-coverage-expansion 5.1, 5.2, 5.3, 5.6
 * - 半自動チェック項目の型
 * - 回答タイプ
 * - 進捗状況
 */

/**
 * 半自動チェックの回答タイプ
 * @requirement 5.3 - ユーザーが選択肢を選択した場合、回答を記録
 */
export type SemiAutoAnswer = 'appropriate' | 'inappropriate' | 'cannot-determine';

/**
 * 半自動チェック項目
 * @requirement 5.2 - 各半自動チェック項目についてスクリーンショット、HTML抜粋、質問を表示
 */
export interface SemiAutoItem {
  /** 一意なID */
  id: string;
  /** 元のルールID */
  ruleId: string;
  /** WCAG成功基準 */
  wcagCriteria: string[];
  /** 確認用の質問文 */
  question: string;
  /** スクリーンショット（Base64、オプション） */
  screenshot?: string;
  /** HTML抜粋 */
  html: string;
  /** 人間が読める要素説明 */
  elementDescription: string;
  /** CSSセレクタ */
  selector: string;
  /** ユーザーの回答 */
  answer?: SemiAutoAnswer;
  /** 回答日時 */
  answeredAt?: string;
}

/**
 * 進捗状況
 * @requirement 5.6 - 進捗状況（完了数/全体数）を表示
 */
export interface SemiAutoProgress {
  /** 完了した項目数 */
  completed: number;
  /** 全体の項目数 */
  total: number;
}

/**
 * 回答のラベル（日本語）
 */
export const SEMI_AUTO_ANSWER_LABELS: Record<SemiAutoAnswer, string> = {
  appropriate: '適切',
  inappropriate: '不適切',
  'cannot-determine': '判断不能',
};
