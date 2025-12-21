/**
 * フォーム解析機能の型定義（Task 3.1）
 *
 * バックエンド（server/auth/types.ts）の型定義と同期
 * フロントエンド固有のパネル状態管理型も定義
 */

/**
 * フォームフィールド候補
 * 解析で検出された入力フィールドやボタンの情報
 */
export interface FormFieldCandidate {
  /** CSSセレクタ */
  selector: string;
  /** ラベル要素のテキスト（存在する場合） */
  label: string | null;
  /** placeholder属性の値（存在する場合） */
  placeholder: string | null;
  /** name属性の値（存在する場合） */
  name: string | null;
  /** id属性の値（存在する場合） */
  id: string | null;
  /** type属性の値（email, password, submit等） */
  type: string;
  /** 検出の信頼度スコア（0.0〜1.0） */
  confidence: number;
}

/**
 * フォーム解析結果
 * ログインページから検出されたフォーム要素一覧
 */
export interface FormAnalysisResult {
  /** ユーザー名入力フィールドの候補 */
  usernameFields: FormFieldCandidate[];
  /** パスワード入力フィールドの候補 */
  passwordFields: FormFieldCandidate[];
  /** 送信ボタンの候補 */
  submitButtons: FormFieldCandidate[];
  /** 全体の信頼度 */
  confidence: 'high' | 'medium' | 'low';
}

/**
 * 選択されたフォームセレクタ
 * ユーザーが確定した各要素のセレクタとログインURL
 */
export interface SelectedFormSelectors {
  /** ログインページのURL */
  loginUrl: string;
  /** ユーザー名フィールドのセレクタ */
  usernameSelector: string;
  /** パスワードフィールドのセレクタ */
  passwordSelector: string;
  /** 送信ボタンのセレクタ */
  submitSelector: string;
}

/**
 * フォーム解析エラー
 * UIで表示するエラーの種別とメッセージ
 */
export type FormAnalysisError =
  | { type: 'invalid_url'; message: string }
  | { type: 'network_error'; message: string }
  | { type: 'timeout'; message: string }
  | { type: 'no_form_found'; message: string }
  | { type: 'analysis_failed'; message: string };

/**
 * フォーム解析パネルの状態
 * FormAnalyzerPanelコンポーネントで管理する状態
 */
export interface FormAnalyzerPanelState {
  /** ログインページのURL */
  loginUrl: string;
  /** 解析中フラグ */
  isAnalyzing: boolean;
  /** 解析結果（成功時） */
  analysisResult: FormAnalysisResult | null;
  /** エラー（失敗時） */
  error: FormAnalysisError | null;
  /** ユーザーが選択したセレクタ */
  selectedSelectors: SelectedFormSelectors | null;
}

/**
 * フォーム解析APIレスポンス
 */
export interface AnalyzeFormResponse {
  success: boolean;
  result?: FormAnalysisResult;
  error?: {
    type: string;
    message: string;
  };
}
