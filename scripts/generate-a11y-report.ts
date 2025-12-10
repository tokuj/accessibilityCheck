import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * インテージ公式サイト アクセシビリティレポート生成スクリプト
 * 違反・パス・要確認の全項目を詳細に記録
 */

// テスト対象ページ
const TEST_PAGES = [
  { name: 'トップページ', url: 'https://www.intage.co.jp/' },
  { name: '会社情報', url: 'https://www.intage.co.jp/company/' },
  { name: 'サービス', url: 'https://www.intage.co.jp/service/' },
  { name: 'お問い合わせ', url: 'https://www.intage.co.jp/contact/' },
  { name: 'ニュース', url: 'https://www.intage.co.jp/news/' },
];

// WCAG AA準拠タグ
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// WCAG項番とその説明のマッピング
const WCAG_CRITERIA: Record<string, string> = {
  '1.1.1': '非テキストコンテンツ',
  '1.2.1': '音声のみ及び映像のみ（収録済）',
  '1.2.2': 'キャプション（収録済）',
  '1.2.3': '音声解説又はメディアに対する代替（収録済）',
  '1.2.4': 'キャプション（ライブ）',
  '1.2.5': '音声解説（収録済）',
  '1.3.1': '情報及び関係性',
  '1.3.2': '意味のある順序',
  '1.3.3': '感覚的な特徴',
  '1.3.4': '表示の向き',
  '1.3.5': '入力目的の特定',
  '1.4.1': '色の使用',
  '1.4.2': '音声の制御',
  '1.4.3': 'コントラスト（最低限）',
  '1.4.4': 'テキストのサイズ変更',
  '1.4.5': '文字画像',
  '1.4.10': 'リフロー',
  '1.4.11': '非テキストのコントラスト',
  '1.4.12': 'テキストの間隔',
  '1.4.13': 'ホバー又はフォーカスで表示されるコンテンツ',
  '2.1.1': 'キーボード',
  '2.1.2': 'キーボードトラップなし',
  '2.1.4': '文字キーのショートカット',
  '2.2.1': 'タイミング調整可能',
  '2.2.2': '一時停止、停止、非表示',
  '2.3.1': '3回の閃光、又は閾値以下',
  '2.4.1': 'ブロックスキップ',
  '2.4.2': 'ページタイトル',
  '2.4.3': 'フォーカス順序',
  '2.4.4': 'リンクの目的（コンテキスト内）',
  '2.4.5': '複数の手段',
  '2.4.6': '見出し及びラベル',
  '2.4.7': 'フォーカスの可視化',
  '2.5.1': 'ポインタのジェスチャ',
  '2.5.2': 'ポインタのキャンセル',
  '2.5.3': 'ラベルを含む名前',
  '2.5.4': '動きによる起動',
  '3.1.1': 'ページの言語',
  '3.1.2': '一部分の言語',
  '3.2.1': 'フォーカス時',
  '3.2.2': '入力時',
  '3.2.3': '一貫したナビゲーション',
  '3.2.4': '一貫した識別性',
  '3.3.1': 'エラーの特定',
  '3.3.2': 'ラベル又は説明',
  '3.3.3': 'エラー修正の提案',
  '3.3.4': 'エラー回避（法的、金融、データ）',
  '4.1.1': '構文解析',
  '4.1.2': '名前、役割、値',
  '4.1.3': 'ステータスメッセージ',
};

interface RuleResult {
  id: string;
  description: string;
  impact?: string;
  nodeCount: number;
  helpUrl: string;
  wcagCriteria: string[];
}

interface PageResult {
  name: string;
  url: string;
  violations: RuleResult[];
  passes: RuleResult[];
  incomplete: RuleResult[];
}

/**
 * axe-coreのタグからWCAG項番を抽出
 */
function extractWcagCriteria(tags: string[]): string[] {
  const criteria: string[] = [];

  for (const tag of tags) {
    // wcag111, wcag143 などのパターンを抽出
    const match = tag.match(/^wcag(\d)(\d)(\d+)$/);
    if (match) {
      const criterion = `${match[1]}.${match[2]}.${match[3]}`;
      if (!criteria.includes(criterion)) {
        criteria.push(criterion);
      }
    }
  }

  return criteria.sort();
}

/**
 * WCAG項番をフォーマット（説明付き）
 */
function formatWcagCriteria(criteria: string[]): string {
  if (criteria.length === 0) return '-';

  return criteria.map(c => {
    const desc = WCAG_CRITERIA[c];
    return desc ? `${c}` : c;
  }).join(', ');
}

async function generateReport(): Promise<void> {
  console.log('アクセシビリティレポート生成を開始します...\n');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const results: PageResult[] = [];
  let totalViolations = 0;
  let totalPasses = 0;
  let totalIncomplete = 0;

  for (const targetPage of TEST_PAGES) {
    console.log(`スキャン中: ${targetPage.name} (${targetPage.url})`);

    try {
      await page.goto(targetPage.url, { waitUntil: 'networkidle', timeout: 60000 });

      const scanResults = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();

      const violations: RuleResult[] = scanResults.violations.map((v) => ({
        id: v.id,
        description: v.description,
        impact: v.impact || 'unknown',
        nodeCount: v.nodes.length,
        helpUrl: v.helpUrl,
        wcagCriteria: extractWcagCriteria(v.tags),
      }));

      const passes: RuleResult[] = scanResults.passes.map((p) => ({
        id: p.id,
        description: p.description,
        nodeCount: p.nodes.length,
        helpUrl: p.helpUrl,
        wcagCriteria: extractWcagCriteria(p.tags),
      }));

      const incomplete: RuleResult[] = scanResults.incomplete.map((i) => ({
        id: i.id,
        description: i.description,
        impact: i.impact || 'unknown',
        nodeCount: i.nodes.length,
        helpUrl: i.helpUrl,
        wcagCriteria: extractWcagCriteria(i.tags),
      }));

      results.push({
        name: targetPage.name,
        url: targetPage.url,
        violations,
        passes,
        incomplete,
      });

      totalViolations += violations.length;
      totalPasses += passes.length;
      totalIncomplete += incomplete.length;

      console.log(`  → 違反: ${violations.length}件, パス: ${passes.length}件, 要確認: ${incomplete.length}件`);
    } catch (error) {
      console.error(`  → エラー: ${error}`);
      results.push({
        name: targetPage.name,
        url: targetPage.url,
        violations: [],
        passes: [],
        incomplete: [],
      });
    }
  }

  await browser.close();

  // レポート生成
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];

  let markdown = `# インテージ公式サイト アクセシビリティレポート

## 概要

| 項目 | 値 |
|------|-----|
| 実行日時 | ${dateStr} ${timeStr} |
| 対象ページ数 | ${TEST_PAGES.length} |
| 検証基準 | WCAG 2.1 Level AA |

### 全体サマリー

| 区分 | 件数 |
|------|------|
| 違反（Violations） | ${totalViolations}件 |
| パス（Passes） | ${totalPasses}件 |
| 要確認（Incomplete） | ${totalIncomplete}件 |

## ページ別サマリー

| ページ | 違反 | パス | 要確認 |
|--------|------|------|--------|
`;

  for (const result of results) {
    markdown += `| ${result.name} | ${result.violations.length} | ${result.passes.length} | ${result.incomplete.length} |\n`;
  }

  markdown += `\n---\n\n## ページ別詳細\n\n`;

  for (const result of results) {
    markdown += `### ${result.name}\n\n`;
    markdown += `- **URL**: ${result.url}\n`;
    markdown += `- **違反**: ${result.violations.length}件\n`;
    markdown += `- **パス**: ${result.passes.length}件\n`;
    markdown += `- **要確認**: ${result.incomplete.length}件\n\n`;

    // 違反セクション
    markdown += `#### 違反（Violations）\n\n`;
    if (result.violations.length > 0) {
      markdown += `| ルールID | 説明 | 影響度 | WCAG項番 | 対象要素数 |\n`;
      markdown += `|---------|------|--------|---------|----------|\n`;
      for (const v of result.violations) {
        markdown += `| [${v.id}](${v.helpUrl}) | ${v.description} | ${v.impact} | ${formatWcagCriteria(v.wcagCriteria)} | ${v.nodeCount} |\n`;
      }
    } else {
      markdown += `違反は検出されませんでした。\n`;
    }
    markdown += '\n';

    // パスセクション
    markdown += `#### パス（Passes）\n\n`;
    if (result.passes.length > 0) {
      markdown += `| ルールID | 説明 | WCAG項番 |\n`;
      markdown += `|---------|------|----------|\n`;
      for (const p of result.passes) {
        markdown += `| [${p.id}](${p.helpUrl}) | ${p.description} | ${formatWcagCriteria(p.wcagCriteria)} |\n`;
      }
    } else {
      markdown += `パスした項目はありません。\n`;
    }
    markdown += '\n';

    // 要確認セクション
    markdown += `#### 要確認（Incomplete）\n\n`;
    if (result.incomplete.length > 0) {
      markdown += `| ルールID | 説明 | 影響度 | WCAG項番 | 対象要素数 |\n`;
      markdown += `|---------|------|--------|---------|----------|\n`;
      for (const i of result.incomplete) {
        markdown += `| [${i.id}](${i.helpUrl}) | ${i.description} | ${i.impact} | ${formatWcagCriteria(i.wcagCriteria)} | ${i.nodeCount} |\n`;
      }
    } else {
      markdown += `要確認の項目はありません。\n`;
    }
    markdown += '\n---\n\n';
  }

  // WCAG項番リファレンス
  markdown += `## WCAG項番リファレンス\n\n`;
  markdown += `| 項番 | 説明 |\n`;
  markdown += `|------|------|\n`;

  // 使用された項番のみを表示
  const usedCriteria = new Set<string>();
  for (const result of results) {
    for (const v of result.violations) {
      v.wcagCriteria.forEach(c => usedCriteria.add(c));
    }
    for (const p of result.passes) {
      p.wcagCriteria.forEach(c => usedCriteria.add(c));
    }
    for (const i of result.incomplete) {
      i.wcagCriteria.forEach(c => usedCriteria.add(c));
    }
  }

  const sortedCriteria = Array.from(usedCriteria).sort((a, b) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) return aParts[i] - bParts[i];
    }
    return 0;
  });

  for (const c of sortedCriteria) {
    const desc = WCAG_CRITERIA[c] || '（説明なし）';
    markdown += `| ${c} | ${desc} |\n`;
  }

  markdown += `\n---\n\n`;
  markdown += `## 影響度の説明\n\n`;
  markdown += `| 影響度 | 説明 |\n`;
  markdown += `|--------|------|\n`;
  markdown += `| critical | 致命的。一部のユーザーがコンテンツにアクセスできない |\n`;
  markdown += `| serious | 深刻。多くのユーザーに影響を与える |\n`;
  markdown += `| moderate | 中程度。一部のユーザーに影響を与える |\n`;
  markdown += `| minor | 軽微。ユーザー体験に若干の影響 |\n\n`;

  markdown += `---\n\n`;
  markdown += `*このレポートは axe-core を使用して自動生成されました*\n`;

  // ファイル保存
  const outputDir = path.join(__dirname, '..', 'test-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `a11y-report-${dateStr}.md`);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  console.log(`\nレポートを生成しました: ${outputPath}`);
}

generateReport().catch(console.error);
