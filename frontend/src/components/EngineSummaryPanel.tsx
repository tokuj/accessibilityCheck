/**
 * EngineSummaryPanel コンポーネント
 *
 * Requirements: wcag-coverage-expansion 1.4, 6.3, 6.5
 * Task 13.1: エンジン別検出数サマリーコンポーネントを実装
 *
 * - 各エンジンの違反数・パス数を表示
 * - 複数エンジンで検出された違反の統合表示
 * - 検出元エンジンのリスト表示（例：「axe-core, IBM Equal Access」）
 */

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import BuildIcon from '@mui/icons-material/Build';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import type { ToolSource } from '../types/analysis-options';

/**
 * 複数エンジンで検出された違反
 * @requirement 6.3 - 統合された違反について、検出元エンジンをリスト表示
 */
export interface MultiEngineViolation {
  /** ルールID */
  ruleId: string;
  /** 違反の説明 */
  description: string;
  /** WCAG成功基準 */
  wcagCriteria: string[];
  /** 検出元エンジン一覧 */
  toolSources: ToolSource[];
  /** 影響を受けるノード数 */
  nodeCount: number;
}

interface EngineSummaryPanelProps {
  /** エンジン別サマリー */
  engineSummary: Record<ToolSource, { violations: number; passes: number }>;
  /** 複数エンジンで検出された違反一覧 */
  multiEngineViolations: MultiEngineViolation[];
  /** ソート基準（デフォルト: violations） */
  sortBy?: 'violations' | 'passes' | 'name';
  /** コンパクトモード（詳細を非表示） */
  compact?: boolean;
}

/**
 * エンジン識別子からユーザーフレンドリーな名前に変換
 * @requirement 6.3 - 検出元エンジンをリスト表示
 */
const ENGINE_LABELS: Record<ToolSource, string> = {
  'axe-core': 'axe-core',
  pa11y: 'Pa11y',
  lighthouse: 'Lighthouse',
  ibm: 'IBM Equal Access',
  alfa: 'Siteimprove Alfa',
  qualweb: 'QualWeb',
  wave: 'WAVE',
  custom: 'カスタムルール',
};

/**
 * ToolSource配列からユーザーフレンドリーな名前リストに変換
 */
function formatToolSources(sources: ToolSource[]): string {
  return sources.map((s) => ENGINE_LABELS[s] || s).join(', ');
}

/**
 * EngineSummaryPanel - エンジン別検出数サマリー表示コンポーネント
 * @requirement 1.4 - 複数エンジンが同一の違反を検出した場合、重複を排除し、検出元ツールをリストとして表示
 * @requirement 6.5 - エンジン別の検出数サマリーを表示
 */
export function EngineSummaryPanel({
  engineSummary,
  multiEngineViolations,
  sortBy = 'violations',
  compact = false,
}: EngineSummaryPanelProps) {
  // エンジンサマリーが空かどうかをチェック
  const hasData = Object.keys(engineSummary).length > 0;

  // ソート済みエンジンリスト
  const sortedEngines = useMemo(() => {
    const entries = Object.entries(engineSummary) as [
      ToolSource,
      { violations: number; passes: number }
    ][];

    return entries.sort((a, b) => {
      switch (sortBy) {
        case 'violations':
          return b[1].violations - a[1].violations;
        case 'passes':
          return b[1].passes - a[1].passes;
        case 'name':
          return ENGINE_LABELS[a[0]].localeCompare(ENGINE_LABELS[b[0]]);
        default:
          return 0;
      }
    });
  }, [engineSummary, sortBy]);

  // 合計値を計算
  const totals = useMemo(() => {
    let violations = 0;
    let passes = 0;
    for (const [, counts] of sortedEngines) {
      violations += counts.violations;
      passes += counts.passes;
    }
    return { violations, passes };
  }, [sortedEngines]);

  // 空の状態
  if (!hasData) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          エンジンサマリーデータがありません
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <BuildIcon color="primary" />
        <Typography variant="h6">エンジン別検出サマリー</Typography>
      </Box>

      {/* エンジン別テーブル */}
      <TableContainer>
        <Table
          size="small"
          aria-label="エンジン別検出サマリー"
        >
          <TableHead>
            <TableRow>
              <TableCell>エンジン</TableCell>
              <TableCell align="right">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                  <ErrorOutlineIcon fontSize="small" color="error" />
                  違反数
                </Box>
              </TableCell>
              <TableCell align="right">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                  <CheckCircleOutlineIcon fontSize="small" color="success" />
                  パス数
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedEngines.map(([engine, counts]) => (
              <TableRow
                key={engine}
                data-testid={`engine-row-${engine}`}
              >
                <TableCell>
                  <Typography variant="body2">{ENGINE_LABELS[engine]}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    data-testid="violation-count"
                    className="violation-count"
                    sx={{
                      color: counts.violations > 0 ? 'error.main' : 'text.secondary',
                      fontWeight: counts.violations > 0 ? 'bold' : 'normal',
                    }}
                  >
                    {counts.violations}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    data-testid="pass-count"
                    className="pass-count"
                    sx={{
                      color: counts.passes > 0 ? 'success.main' : 'text.secondary',
                      fontWeight: counts.passes > 0 ? 'bold' : 'normal',
                    }}
                  >
                    {counts.passes}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}

            {/* 合計行 */}
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell>
                <Typography variant="body2" fontWeight="bold">
                  合計
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  data-testid="total-violations"
                  sx={{ color: 'error.main' }}
                >
                  {totals.violations}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  data-testid="total-passes"
                  sx={{ color: 'success.main' }}
                >
                  {totals.passes}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* 複数エンジン検出違反セクション（compactモードでは非表示） */}
      {!compact && (
        <>
          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <WarningAmberIcon color="warning" />
            <Typography variant="subtitle1">複数エンジンで検出された違反</Typography>
          </Box>

          {multiEngineViolations.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              複数エンジンで検出された違反はありません
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {multiEngineViolations.map((violation) => (
                <Paper
                  key={violation.ruleId}
                  variant="outlined"
                  sx={{ p: 1.5 }}
                  data-testid={`multi-violation-${violation.ruleId}`}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                    <Chip
                      label={violation.toolSources.length}
                      size="small"
                      color="warning"
                      sx={{ minWidth: 24 }}
                    />
                    <Typography variant="body2" fontWeight="medium">
                      {violation.description}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    {violation.wcagCriteria.map((criterion) => (
                      <Chip
                        key={criterion}
                        label={criterion}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    ))}
                  </Box>

                  <Typography variant="caption" color="text.secondary">
                    検出エンジン: {formatToolSources(violation.toolSources)}
                  </Typography>
                </Paper>
              ))}
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
