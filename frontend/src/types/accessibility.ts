export type Impact = 'critical' | 'serious' | 'moderate' | 'minor';

export type ToolSource = 'axe-core' | 'pa11y' | 'lighthouse';

export interface RuleResult {
  id: string;
  description: string;
  impact?: Impact;
  nodeCount: number;
  helpUrl: string;
  wcagCriteria: string[];
  toolSource: ToolSource;
}

export interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
}

export interface ToolInfo {
  name: string;
  version: string;
  duration: number;
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa?: number;
}

// AI総評の影響度サマリー
export interface ImpactSummary {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}

// 検出された問題の詳細（構造化された改善提案）
export interface DetectedIssue {
  ruleId: string;           // ルールID（例: color-contrast）
  whatIsHappening: string;  // 何が起きているか
  whatIsNeeded: string;     // 修正に必要なもの
  howToFix: string;         // どう修正するか
}

// AI総評（Gemini Flash生成）
export interface AISummary {
  overallAssessment: string;
  detectedIssues: DetectedIssue[];
  prioritizedImprovements: string[];
  specificRecommendations: string[];
  impactSummary: ImpactSummary;
  generatedAt: string;
}

export interface AccessibilityReport {
  generatedAt: string;
  summary: {
    totalViolations: number;
    totalPasses: number;
    totalIncomplete: number;
  };
  pages: PageResult[];
  screenshot?: string;
  toolsUsed?: ToolInfo[];
  lighthouseScores?: LighthouseScores;
  aiSummary?: AISummary;
}

// 認証タイプ
export type AuthType = 'none' | 'cookie' | 'bearer' | 'basic' | 'form';

// 認証設定
export interface AuthConfig {
  type: AuthType;
  // Cookie認証 - "name=value; name2=value2" 形式
  cookies?: string;
  // Bearer Token認証
  token?: string;
  // Basic認証
  username?: string;
  password?: string;
  // フォームログイン
  loginUrl?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  successUrlPattern?: string;
}

export interface AnalyzeRequest {
  url: string;
  auth?: AuthConfig;
  sessionId?: string;
  passphrase?: string;
}

export interface AnalyzeResponse {
  status: 'completed' | 'error';
  report?: AccessibilityReport;
  error?: string;
}

// SSEイベント型定義

/**
 * SSEログイベント
 * 分析中の一般的なログメッセージを送信
 */
export interface LogEvent {
  type: 'log';
  message: string;
  timestamp: string;
}

/**
 * SSE進捗イベント
 * 分析ステップの進捗状況を送信
 */
export interface ProgressEvent {
  type: 'progress';
  step: number;
  total: number;
  stepName: string;
}

/**
 * SSE違反検出イベント
 * 違反が検出されたときに送信
 */
export interface ViolationEvent {
  type: 'violation';
  rule: string;
  impact: Impact;
  count: number;
}

/**
 * SSE完了イベント
 * 分析完了時にレポートを送信
 */
export interface CompleteEvent {
  type: 'complete';
  report: AccessibilityReport;
}

/**
 * SSEエラーイベント
 * エラー発生時に送信
 */
export interface ErrorEvent {
  type: 'error';
  message: string;
  code: string;
}

/**
 * SSEセッション期限切れイベント
 * 401/403エラー検出時に送信
 */
export interface SessionExpiredEvent {
  type: 'session_expired';
  message: string;
}

/**
 * 全SSEイベントのユニオン型
 */
export type SSEEvent = LogEvent | ProgressEvent | ViolationEvent | CompleteEvent | ErrorEvent | SessionExpiredEvent;

/**
 * ログエントリ（UI表示用）
 */
export interface LogEntry {
  timestamp: string;
  type: 'info' | 'progress' | 'violation' | 'error' | 'complete';
  message: string;
}

/**
 * 分析進捗状態（UI表示用）
 */
export interface AnalysisProgressState {
  logs: LogEntry[];
  status: 'idle' | 'analyzing' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
}

// ============================================
// セッション管理関連の型定義（Task 4）
// ============================================

/**
 * セッションメタデータ（バックエンドと同期）
 */
export interface SessionMetadata {
  /** セッションID（UUID） */
  id: string;
  /** セッション名 */
  name: string;
  /** 対象ドメイン */
  domain: string;
  /** 作成日時（ISO 8601） */
  createdAt: string;
  /** 更新日時（ISO 8601） */
  updatedAt: string;
  /** 有効期限（ISO 8601、オプション） */
  expiresAt?: string;
  /** スキーマバージョン */
  schemaVersion: number;
  /** 認証タイプ */
  authType: AuthType;
  /** 自動削除フラグ */
  autoDestroy: boolean;
}

/**
 * セッション一覧表示用アイテム
 */
export interface SessionListItem {
  id: string;
  name: string;
  domain: string;
  authType: AuthType;
  expiresAt?: string;
  isExpired: boolean;
}

/**
 * 認証状態
 */
export type AuthStatus = 'unauthenticated' | 'authenticated' | 'expired';

/**
 * SessionManagerUIの状態
 */
export interface SessionManagerState {
  sessions: SessionListItem[];
  selectedSessionId: string | null;
  authStatus: AuthStatus;
  isLoading: boolean;
  error: string | null;
}
