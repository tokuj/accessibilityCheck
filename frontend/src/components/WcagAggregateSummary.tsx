/**
 * WcagAggregateSummaryコンポーネント
 * WCAG項番別の集約サマリー表示
 * @requirement 2.1, 2.2, 2.3, 2.4, 2.5 - WCAG基準でのアグリゲートレポート
 * @task 7.1 - WCAG項番別の集約サマリーUIを実装する
 */
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ListAltIcon from '@mui/icons-material/ListAlt';
import type { RuleResult, ToolSource } from '../types/accessibility';
import { getWcagLevel, type WcagLevel } from '../utils/wcag-mapping';

/**
 * WCAG項番別集約アイテム
 */
interface WcagSummaryItem {
  /** WCAG基準番号（例: "1.4.3"） */
  criterion: string;
  /** WCAGレベル */
  level: WcagLevel;
  /** 総違反件数 */
  totalCount: number;
  /** ツール別検出件数 */
  toolCounts: {
    'axe-core': number;
    'pa11y': number;
    'lighthouse': number;
  };
}

/**
 * WcagAggregateSummaryコンポーネントのProps
 */
export interface WcagAggregateSummaryProps {
  /** 全違反結果 */
  violations: RuleResult[];
  /** WCAG項番クリック時のコールバック */
  onWcagFilter?: (criterion: string) => void;
}

/**
 * WCAGレベルに応じたChipカラーを返す
 */
const getLevelColor = (level: WcagLevel): 'success' | 'primary' | 'secondary' | 'default' => {
  switch (level) {
    case 'A':
      return 'success';
    case 'AA':
      return 'primary';
    case 'AAA':
      return 'secondary';
    default:
      return 'default';
  }
};

/**
 * ツールに応じたChipカラーを返す
 */
const getToolColor = (tool: ToolSource): 'default' | 'secondary' | 'warning' => {
  switch (tool) {
    case 'pa11y':
      return 'secondary';
    case 'lighthouse':
      return 'warning';
    default:
      return 'default';
  }
};

/**
 * WCAG項番を数値的にソートするための比較関数
 */
const compareWcagCriteria = (a: string, b: string): number => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
};

/**
 * WCAG項番別の集約サマリーコンポーネント
 */
export function WcagAggregateSummary({
  violations,
  onWcagFilter,
}: WcagAggregateSummaryProps) {
  /**
   * 違反をWCAG項番でグループ化し、ツール別カウントを集計
   */
  const summaryItems = useMemo<WcagSummaryItem[]>(() => {
    // WCAG項番 -> ツール別カウントのマップ
    const criterionMap = new Map<string, { 'axe-core': number; 'pa11y': number; 'lighthouse': number }>();

    for (const violation of violations) {
      for (const criterion of violation.wcagCriteria) {
        if (!criterion) continue;

        if (!criterionMap.has(criterion)) {
          criterionMap.set(criterion, {
            'axe-core': 0,
            'pa11y': 0,
            'lighthouse': 0,
          });
        }

        const counts = criterionMap.get(criterion)!;
        const tool = violation.toolSource;
        if (tool === 'axe-core' || tool === 'pa11y' || tool === 'lighthouse') {
          counts[tool]++;
        }
      }
    }

    // WcagSummaryItem配列に変換
    const items: WcagSummaryItem[] = [];
    for (const [criterion, toolCounts] of criterionMap.entries()) {
      const totalCount = toolCounts['axe-core'] + toolCounts['pa11y'] + toolCounts['lighthouse'];
      items.push({
        criterion,
        level: getWcagLevel(criterion),
        totalCount,
        toolCounts,
      });
    }

    // ソート: 違反件数降順 -> WCAG項番昇順
    items.sort((a, b) => {
      if (a.totalCount !== b.totalCount) {
        return b.totalCount - a.totalCount; // 件数降順
      }
      return compareWcagCriteria(a.criterion, b.criterion); // WCAG項番昇順
    });

    return items;
  }, [violations]);

  // 違反がない場合
  if (summaryItems.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
        <Typography variant="body2">WCAG項番別の違反はありません</Typography>
      </Box>
    );
  }

  const handleClick = (criterion: string) => {
    onWcagFilter?.(criterion);
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* セクションヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ListAltIcon sx={{ color: 'info.main', fontSize: 20 }} />
        <Typography variant="subtitle2" fontWeight="bold">
          WCAG項番別サマリー
        </Typography>
      </Box>

      {/* サマリーリスト */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {summaryItems.map((item) => (
          <Box
            key={item.criterion}
            data-testid="wcag-summary-item"
            onClick={() => handleClick(item.criterion)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              cursor: onWcagFilter ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              '&:hover': onWcagFilter
                ? {
                    bgcolor: 'action.hover',
                    borderColor: 'primary.main',
                  }
                : {},
            }}
          >
            {/* WCAG項番 */}
            <Typography
              variant="body2"
              fontWeight="bold"
              sx={{ minWidth: 50 }}
            >
              {item.criterion}
            </Typography>

            {/* WCAGレベルバッジ */}
            <Chip
              data-testid={`wcag-level-badge-${item.criterion}`}
              label={item.level}
              size="small"
              color={getLevelColor(item.level)}
              sx={{ minWidth: 40 }}
            />

            {/* 合計件数 */}
            <Typography
              variant="body2"
              color="error.main"
              fontWeight="bold"
              sx={{ minWidth: 50 }}
            >
              {item.totalCount}件
            </Typography>

            {/* ツール別件数 */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', flex: 1 }}>
              {(Object.entries(item.toolCounts) as [ToolSource, number][])
                .filter(([, count]) => count > 0)
                .map(([tool, count]) => (
                  <Chip
                    key={tool}
                    label={`${tool}: ${count}`}
                    size="small"
                    variant="outlined"
                    color={getToolColor(tool)}
                    sx={{ fontSize: '0.7rem', height: 22 }}
                  />
                ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
