/**
 * WCAGマッピングユーティリティ
 * WCAG 2.1の78基準のレベル判定機能を提供
 * @requirement 2.5 - WCAGレベル表示
 * @task 5.1 - WCAG 2.1全基準のレベル判定機能を実装する
 */

/**
 * WCAGレベル
 */
export type WcagLevel = 'A' | 'AA' | 'AAA' | 'unknown';

/**
 * WCAG基準情報
 */
export interface WcagCriterionInfo {
  /** 基準番号（例: "1.1.1"） */
  criterion: string;
  /** レベル */
  level: WcagLevel;
  /** 基準名（日本語） */
  name: string;
}

/**
 * WCAG 2.1 全78基準のマッピングテーブル
 * Level A: 30基準、Level AA: 20基準、Level AAA: 28基準
 */
const WCAG_CRITERIA: WcagCriterionInfo[] = [
  // 1. 知覚可能
  // 1.1 テキストによる代替
  { criterion: '1.1.1', level: 'A', name: '非テキストコンテンツ' },

  // 1.2 時間依存メディア
  { criterion: '1.2.1', level: 'A', name: '音声のみ及び映像のみ（収録済み）' },
  { criterion: '1.2.2', level: 'A', name: 'キャプション（収録済み）' },
  { criterion: '1.2.3', level: 'A', name: '音声解説、又はメディアに対する代替（収録済み）' },
  { criterion: '1.2.4', level: 'AA', name: 'キャプション（ライブ）' },
  { criterion: '1.2.5', level: 'AA', name: '音声解説（収録済み）' },
  { criterion: '1.2.6', level: 'AAA', name: '手話（収録済み）' },
  { criterion: '1.2.7', level: 'AAA', name: '拡張音声解説（収録済み）' },
  { criterion: '1.2.8', level: 'AAA', name: 'メディアに対する代替（収録済み）' },
  { criterion: '1.2.9', level: 'AAA', name: '音声のみ（ライブ）' },

  // 1.3 適応可能
  { criterion: '1.3.1', level: 'A', name: '情報及び関係性' },
  { criterion: '1.3.2', level: 'A', name: '意味のあるシーケンス' },
  { criterion: '1.3.3', level: 'A', name: '感覚的な特徴' },
  { criterion: '1.3.4', level: 'AA', name: '表示の向き' }, // WCAG 2.1
  { criterion: '1.3.5', level: 'AA', name: '入力目的の特定' }, // WCAG 2.1
  { criterion: '1.3.6', level: 'AAA', name: '目的の特定' }, // WCAG 2.1

  // 1.4 判別可能
  { criterion: '1.4.1', level: 'A', name: '色の使用' },
  { criterion: '1.4.2', level: 'A', name: '音声の制御' },
  { criterion: '1.4.3', level: 'AA', name: 'コントラスト（最低限）' },
  { criterion: '1.4.4', level: 'AA', name: 'テキストのサイズ変更' },
  { criterion: '1.4.5', level: 'AA', name: '文字画像' },
  { criterion: '1.4.6', level: 'AAA', name: 'コントラスト（高度）' },
  { criterion: '1.4.7', level: 'AAA', name: '小さな背景音、又は背景音なし' },
  { criterion: '1.4.8', level: 'AAA', name: '視覚的提示' },
  { criterion: '1.4.9', level: 'AAA', name: '文字画像（例外なし）' },
  { criterion: '1.4.10', level: 'AA', name: 'リフロー' }, // WCAG 2.1
  { criterion: '1.4.11', level: 'AA', name: '非テキストのコントラスト' }, // WCAG 2.1
  { criterion: '1.4.12', level: 'AA', name: 'テキストの間隔' }, // WCAG 2.1
  { criterion: '1.4.13', level: 'AA', name: 'ホバー又はフォーカスで表示されるコンテンツ' }, // WCAG 2.1

  // 2. 操作可能
  // 2.1 キーボード操作可能
  { criterion: '2.1.1', level: 'A', name: 'キーボード' },
  { criterion: '2.1.2', level: 'A', name: 'キーボードトラップなし' },
  { criterion: '2.1.3', level: 'AAA', name: 'キーボード（例外なし）' },
  { criterion: '2.1.4', level: 'A', name: '文字キーのショートカット' }, // WCAG 2.1

  // 2.2 十分な時間
  { criterion: '2.2.1', level: 'A', name: 'タイミング調整可能' },
  { criterion: '2.2.2', level: 'A', name: '一時停止、停止、非表示' },
  { criterion: '2.2.3', level: 'AAA', name: 'タイミング非依存' },
  { criterion: '2.2.4', level: 'AAA', name: '中断' },
  { criterion: '2.2.5', level: 'AAA', name: '再認証' },
  { criterion: '2.2.6', level: 'AAA', name: 'タイムアウト' }, // WCAG 2.1

  // 2.3 発作と身体的反応
  { criterion: '2.3.1', level: 'A', name: '3回の閃光、又は閾値以下' },
  { criterion: '2.3.2', level: 'AAA', name: '3回の閃光' },
  { criterion: '2.3.3', level: 'AAA', name: 'インタラクションによるアニメーション' }, // WCAG 2.1

  // 2.4 ナビゲーション可能
  { criterion: '2.4.1', level: 'A', name: 'ブロックスキップ' },
  { criterion: '2.4.2', level: 'A', name: 'ページタイトル' },
  { criterion: '2.4.3', level: 'A', name: 'フォーカス順序' },
  { criterion: '2.4.4', level: 'A', name: 'リンクの目的（コンテキスト内）' },
  { criterion: '2.4.5', level: 'AA', name: '複数の手段' },
  { criterion: '2.4.6', level: 'AA', name: '見出し及びラベル' },
  { criterion: '2.4.7', level: 'AA', name: 'フォーカスの可視化' },
  { criterion: '2.4.8', level: 'AAA', name: '現在位置' },
  { criterion: '2.4.9', level: 'AAA', name: 'リンクの目的（リンクのみ）' },
  { criterion: '2.4.10', level: 'AAA', name: 'セクション見出し' },

  // 2.5 入力モダリティ (WCAG 2.1)
  { criterion: '2.5.1', level: 'A', name: 'ポインタジェスチャ' },
  { criterion: '2.5.2', level: 'A', name: 'ポインタキャンセル' },
  { criterion: '2.5.3', level: 'A', name: 'ラベルを含む名前' },
  { criterion: '2.5.4', level: 'A', name: '動きによる起動' },
  { criterion: '2.5.5', level: 'AAA', name: 'ターゲットのサイズ' },
  { criterion: '2.5.6', level: 'AAA', name: '入力メカニズムの共存' },

  // 3. 理解可能
  // 3.1 読みやすさ
  { criterion: '3.1.1', level: 'A', name: 'ページの言語' },
  { criterion: '3.1.2', level: 'AA', name: '一部分の言語' },
  { criterion: '3.1.3', level: 'AAA', name: '一般的ではない用語' },
  { criterion: '3.1.4', level: 'AAA', name: '略語' },
  { criterion: '3.1.5', level: 'AAA', name: '読解レベル' },
  { criterion: '3.1.6', level: 'AAA', name: '発音' },

  // 3.2 予測可能
  { criterion: '3.2.1', level: 'A', name: 'フォーカス時' },
  { criterion: '3.2.2', level: 'A', name: '入力時' },
  { criterion: '3.2.3', level: 'AA', name: '一貫したナビゲーション' },
  { criterion: '3.2.4', level: 'AA', name: '一貫した識別性' },
  { criterion: '3.2.5', level: 'AAA', name: '要求による変化' },

  // 3.3 入力支援
  { criterion: '3.3.1', level: 'A', name: 'エラーの特定' },
  { criterion: '3.3.2', level: 'A', name: 'ラベル又は説明' },
  { criterion: '3.3.3', level: 'AA', name: 'エラー修正の提案' },
  { criterion: '3.3.4', level: 'AA', name: 'エラー回避（法的、金融、データ）' },
  { criterion: '3.3.5', level: 'AAA', name: 'ヘルプ' },
  { criterion: '3.3.6', level: 'AAA', name: 'エラー回避（すべて）' },

  // 4. 堅牢
  // 4.1 互換性
  { criterion: '4.1.1', level: 'A', name: '構文解析' },
  { criterion: '4.1.2', level: 'A', name: '名前、役割、値' },
  { criterion: '4.1.3', level: 'AA', name: 'ステータスメッセージ' }, // WCAG 2.1
];

/**
 * 基準番号からレベルへの高速ルックアップ用Map
 */
const criterionToInfoMap = new Map<string, WcagCriterionInfo>(
  WCAG_CRITERIA.map((info) => [info.criterion, info])
);

/**
 * WCAG基準番号からレベルを取得
 * @param criterion 基準番号（例: "1.4.3"）
 * @returns レベル（A/AA/AAA）、不明な場合は"unknown"
 */
export function getWcagLevel(criterion: string): WcagLevel {
  const info = criterionToInfoMap.get(criterion);
  return info?.level ?? 'unknown';
}

/**
 * WCAG基準番号から詳細情報を取得
 * @param criterion 基準番号（例: "1.4.3"）
 * @returns 基準情報、存在しない場合はnull
 */
export function getWcagInfo(criterion: string): WcagCriterionInfo | null {
  return criterionToInfoMap.get(criterion) ?? null;
}

/**
 * 全WCAG基準のリストを取得
 * @returns 全78基準の配列
 */
export function getAllWcagCriteria(): WcagCriterionInfo[] {
  return [...WCAG_CRITERIA];
}
