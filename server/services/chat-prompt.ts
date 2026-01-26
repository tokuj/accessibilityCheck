/**
 * インラインAI対話機能のプロンプトビルダー（認知設計ベース）
 * 5要素（前提、状況、目的、動機、制約）を含むプロンプトテンプレートを生成する
 * @requirement 9.1-9.5 - プロンプトエンジニアリング（認知設計）
 */

/**
 * 対話コンテキストの型定義（フロントエンドと共有）
 */
export interface ChatContext {
  type: 'score' | 'lighthouse' | 'violation' | 'pass' | 'incomplete' | 'improvement' | 'recommendation' | 'issue' | 'wcag';
  ruleId?: string;
  wcagCriteria?: string[];
  data: Record<string, unknown>;
  label: string;
}

/**
 * 生成されたプロンプトの型定義
 * ※ Grounding対応によりreferenceUrlは削除（動的に取得）
 */
export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * 共通の制約（全テンプレートで使用）
 */
const COMMON_CONSTRAINTS = `
【制約】
- 日本語で簡潔に回答する
- 与えられた情報のみを使用し、推測しない
- 情報が不足している場合はWeb検索結果を参照する
- 存在しないURLを生成しない
- 参照URLは実際にWeb検索で取得したもののみを使用する
- 信頼性の高いソース（W3C、MDN、デジタル庁ガイドライン等）を優先する
- AIの内部処理（Web検索を行います、検索結果を参照しますなど）について言及しない`;

/**
 * 共通の前提（全テンプレートで使用）
 */
const COMMON_PREMISE = `
【前提】
- この診断結果はaxe-core、pa11y、Lighthouseによる自動アクセシビリティ検査ツールの出力である
- アクセシビリティは障害を持つユーザーがWebを利用するために必要
- WCAG（Web Content Accessibility Guidelines）は国際標準のガイドライン
- 与えられた情報のみを使用し、推測しない
- 情報が不足している場合はWeb検索結果を参照する`;

/**
 * 影響度の日本語マッピング
 */
const IMPACT_JA: Record<string, string> = {
  critical: '致命的',
  serious: '深刻',
  moderate: '中程度',
  minor: '軽微',
};

/**
 * コンテキストから状況セクションを生成
 */
function buildSituationSection(context: ChatContext): string {
  const parts = ['【状況】'];
  const data = context.data as Record<string, unknown>;

  // 検出ツール（データソース）
  if (data.toolSource) {
    parts.push(`- 検出ツール: ${data.toolSource}`);
  }

  parts.push(`- 項目タイプ: ${context.type}`);

  if (context.ruleId) {
    parts.push(`- ルールID: ${context.ruleId}`);
  }

  if (context.wcagCriteria && context.wcagCriteria.length > 0) {
    parts.push(`- WCAG基準: ${context.wcagCriteria.join(', ')}`);
  }

  // 影響度
  if (data.impact) {
    const impactStr = String(data.impact);
    parts.push(`- 影響度: ${IMPACT_JA[impactStr] || impactStr}`);
  }

  // ツールからのメッセージ（description）
  if (data.description) {
    parts.push(`- ツールからのメッセージ: ${data.description}`);
  }

  // 検出ノード数
  if (data.nodeCount !== undefined) {
    parts.push(`- 検出ノード数: ${data.nodeCount}件`);
  }

  // 参照ドキュメント
  if (data.helpUrl) {
    parts.push(`- ツール参照ドキュメント: ${data.helpUrl}`);
  }

  parts.push(`- 項目ラベル: ${context.label}`);

  return parts.join('\n');
}

/**
 * 違反（violation）用のプロンプトテンプレート
 */
function buildViolationPrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const data = context.data as Record<string, unknown>;
  const toolSource = data.toolSource || 'アクセシビリティ診断ツール';

  return `${COMMON_PREMISE}

${situation}

【目的】
- ${toolSource}が検出したこの問題について、正確で実用的な回答を提供する
- 具体的な修正例（コード例を含む）を提示する

【動機】
- 開発者がアクセシビリティ問題を理解し、修正できるようにする
- ユーザーへの影響を具体的に伝える
${COMMON_CONSTRAINTS}`;
}

/**
 * スコア（score）用のプロンプトテンプレート
 */
function buildScorePrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const data = context.data as Record<string, unknown>;

  // 総合スコアの場合とカテゴリスコアの場合で参照プロパティを分岐
  const scoreValue = data.totalScore || data.score || data.value || '';
  const isOverall = Boolean(data.isOverallScore);

  // 追加情報
  const passCount = data.passCount;
  const violationCount = data.violationCount;
  const categoryName = data.categoryName || data.category || '';

  let additionalInfo = '';
  if (isOverall && passCount !== undefined && violationCount !== undefined) {
    additionalInfo = `
- パス件数: ${passCount}件
- 違反件数: ${violationCount}件
- スコア算出方法: axe-core・pa11y・Lighthouseによる総合診断結果
- 算出式: パス数 ÷ (パス数 + 違反数) × 100`;
  }
  if (categoryName) {
    additionalInfo += `
- カテゴリ: ${categoryName}`;
  }

  // 総合スコアの場合は算出式を目的に含める
  const scoreExplanation = isOverall && passCount !== undefined && violationCount !== undefined
    ? `
- 回答の冒頭で必ず以下の算出式を説明する：「${passCount} ÷ (${passCount} + ${violationCount}) × 100 = ${scoreValue}点」
- このツール（axe-core・pa11y・Lighthouse）による診断結果であることを明記する`
    : '';

  return `${COMMON_PREMISE}

${situation}
- スコア値: ${scoreValue}${additionalInfo}

【目的】${scoreExplanation}
- スコアの意味と算出根拠を説明する
- 改善アドバイスを提供する

【動機】
- 開発者がスコアの意味を理解し、改善の優先順位を判断できるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * Lighthouse用のプロンプトテンプレート
 */
function buildLighthousePrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const score = (context.data as Record<string, unknown>).score || '';
  const category = (context.data as Record<string, unknown>).category || context.label;

  return `${COMMON_PREMISE}

${situation}
- Lighthouseカテゴリ: ${category}
- スコア: ${score}

【目的】
- Lighthouseスコアの意味と算出根拠を説明する
- 改善アドバイスを提供する

【動機】
- 開発者がLighthouseの評価基準を理解し、サイト品質を向上できるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * WCAG基準（wcag）用のプロンプトテンプレート
 */
function buildWcagPrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const criterion = context.wcagCriteria?.[0] || '';

  return `${COMMON_PREMISE}

${situation}

【目的】
- WCAG基準「${criterion}」の目的と意味を説明する
- 具体的な達成方法と一般的な違反例を提示する

【動機】
- 開発者がWCAG基準を正しく理解し、準拠したWebサイトを構築できるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * 改善提案（improvement）用のプロンプトテンプレート
 */
function buildImprovementPrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const suggestion = (context.data as Record<string, unknown>).suggestion || context.label;

  return `${COMMON_PREMISE}

${situation}
- 改善提案: ${suggestion}

【目的】
- この改善が必要な理由を説明する
- 具体的な実装手順を提供する

【動機】
- 開発者が改善の優先順位を判断し、効率的に対応できるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * 推奨事項（recommendation）用のプロンプトテンプレート
 */
function buildRecommendationPrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const recommendation = (context.data as Record<string, unknown>).recommendation || context.label;

  return `${COMMON_PREMISE}

${situation}
- 推奨事項: ${recommendation}

【目的】
- この推奨の背景と効果を説明する
- 実践するための具体的なステップを提供する

【動機】
- 開発者が長期的なアクセシビリティ改善に取り組めるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * 検出問題（issue）用のプロンプトテンプレート
 */
function buildIssuePrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const data = context.data as Record<string, unknown>;
  const whatIsHappening = data.whatIsHappening || '';
  const whatIsNeeded = data.whatIsNeeded || '';
  const howToFix = data.howToFix || '';

  return `${COMMON_PREMISE}

${situation}
- 何が起きているか: ${whatIsHappening}
- 修正に必要なもの: ${whatIsNeeded}
- 修正方法: ${howToFix}

【目的】
- 検出された問題の詳細を解説する
- より具体的な修正例を提供する

【動機】
- 開発者が問題を正確に理解し、確実に修正できるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * パス（pass）用のプロンプトテンプレート
 */
function buildPassPrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const data = context.data as Record<string, unknown>;
  const toolSource = data.toolSource || 'アクセシビリティ診断ツール';

  return `${COMMON_PREMISE}

${situation}

【目的】
- ${toolSource}がパスと判定したこのルールについて説明する
- 維持するためのベストプラクティスを提供する

【動機】
- 開発者が良い状態を維持し、回帰を防げるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * 要確認（incomplete）用のプロンプトテンプレート
 */
function buildIncompletePrompt(context: ChatContext): string {
  const situation = buildSituationSection(context);
  const data = context.data as Record<string, unknown>;
  const toolSource = data.toolSource || 'アクセシビリティ診断ツール';

  return `${COMMON_PREMISE}

${situation}

【目的】
- ${toolSource}が「要確認」と判定したこの項目について説明する
- 手動確認を必要とする理由と確認すべきポイントを具体的に提示する

【動機】
- 開発者が効率的に手動確認を行えるようにする
${COMMON_CONSTRAINTS}`;
}

/**
 * コンテキストと質問からプロンプトを生成する
 * @param context - 対話コンテキスト
 * @param question - ユーザーの質問
 * @returns 生成されたプロンプト
 */
export function buildPrompt(context: ChatContext, question: string): BuiltPrompt {
  let systemPrompt: string;

  switch (context.type) {
    case 'violation':
      systemPrompt = buildViolationPrompt(context);
      break;
    case 'score':
      systemPrompt = buildScorePrompt(context);
      break;
    case 'lighthouse':
      systemPrompt = buildLighthousePrompt(context);
      break;
    case 'wcag':
      systemPrompt = buildWcagPrompt(context);
      break;
    case 'improvement':
      systemPrompt = buildImprovementPrompt(context);
      break;
    case 'recommendation':
      systemPrompt = buildRecommendationPrompt(context);
      break;
    case 'issue':
      systemPrompt = buildIssuePrompt(context);
      break;
    case 'pass':
      systemPrompt = buildPassPrompt(context);
      break;
    case 'incomplete':
      systemPrompt = buildIncompletePrompt(context);
      break;
    default:
      // デフォルトテンプレート（未知のタイプ用）
      const situation = buildSituationSection(context);
      systemPrompt = `${COMMON_PREMISE}

${situation}

【目的】
- ユーザーの質問に正確に回答する

【動機】
- 開発者のアクセシビリティ理解を助ける
${COMMON_CONSTRAINTS}`;
  }

  return {
    systemPrompt,
    userPrompt: question,
  };
}

/**
 * 初期メッセージ用のプロンプトを生成する（ユーザーインパクト説明用）
 * @param context - 対話コンテキスト
 * @returns 生成されたプロンプト
 * @requirement 10.1-10.4 - 初期メッセージ（ユーザーインパクト提示）
 */
export function buildInitialMessagePrompt(context: ChatContext): BuiltPrompt {
  const situation = buildSituationSection(context);
  const data = context.data as Record<string, unknown>;
  const toolSource = data.toolSource || 'アクセシビリティ診断ツール';

  const systemPrompt = `【前提】
- この情報は${toolSource}による自動アクセシビリティ検査の結果である
- ユーザーはこのアクセシビリティ項目について理解を深めたい
- 技術的な説明よりも、実際のユーザーへの影響を知りたい

${situation}

【目的】
- この項目を満たさない場合に、どのようなユーザーがどう困るのかを説明する

【動機】
- 開発者にアクセシビリティの重要性を伝える
- 具体的な困りごとの例を示すことで理解を促進する

【制約】
- 100文字以内で簡潔に
- 具体的な困りごとの例を含める
- 技術用語は最小限に
- 推測せず、Web検索結果を参照する`;

  const userPrompt = `この項目を満たさない場合、どのようなユーザーがどう困りますか？`;

  return {
    systemPrompt,
    userPrompt,
  };
}
