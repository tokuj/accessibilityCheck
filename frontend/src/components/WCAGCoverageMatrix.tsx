/**
 * WCAGCoverageMatrix コンポーネント
 *
 * Requirements: wcag-coverage-expansion 7.1, 7.2, 7.3, 7.4, 7.5
 * Task 12.1: WCAGCoverageMatrixコンポーネントを実装
 *
 * - 全WCAG成功基準をテーブル形式で表示
 * - 各基準のテスト状態と結果を表示
 * - 検出に使用したツールを表示
 * - 適合レベル別カバレッジ率のサマリーを表示
 * - 「自動/半自動/手動」カテゴリを色分けして表示
 * - CSVエクスポートボタンを表示
 */

import { useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';
import DownloadIcon from '@mui/icons-material/Download';
import AssessmentIcon from '@mui/icons-material/Assessment';

import type {
  CoverageMatrix,
  CriterionStatus,
  TestMethod,
  TestResult,
} from '../types/wcag-coverage';
import {
  TEST_METHOD_LABELS,
  TEST_RESULT_LABELS,
  TEST_METHOD_COLORS,
  TEST_RESULT_COLORS,
} from '../types/wcag-coverage';

interface WCAGCoverageMatrixProps {
  /** カバレッジマトリクスデータ */
  matrix: CoverageMatrix;
  /** CSVエクスポート時のコールバック */
  onExportCSV?: (matrix: CoverageMatrix) => void;
}

type SortKey = 'criterion' | 'level' | 'title' | 'method' | 'result';
type SortDirection = 'asc' | 'desc';
type LevelFilter = 'all' | 'A' | 'AA' | 'AAA';
type ResultFilter = 'all' | TestResult;
type MethodFilter = 'all' | TestMethod;

/**
 * WCAGCoverageMatrix - WCAGカバレッジマトリクス表示コンポーネント
 * @requirement 7.1 - WCAGカバレッジマトリクスを生成
 * @requirement 7.3 - WCAG適合レベル（A/AA/AAA）ごとのカバレッジ率を計算して表示
 * @requirement 7.5 - 「自動/半自動/手動」カテゴリを色分けして表示
 */
export function WCAGCoverageMatrix({
  matrix,
  onExportCSV,
}: WCAGCoverageMatrixProps) {
  // ソート状態
  const [sortKey, setSortKey] = useState<SortKey>('criterion');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // フィルタ状態
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');

  // ソートハンドラー
  const handleSort = useCallback((key: SortKey) => {
    setSortDirection((prev) => {
      if (sortKey === key) {
        return prev === 'asc' ? 'desc' : 'asc';
      }
      return 'asc';
    });
    setSortKey(key);
  }, [sortKey]);

  // フィルタ済み・ソート済みのデータ
  const filteredAndSortedCriteria = useMemo(() => {
    let result = [...matrix.criteria];

    // フィルタリング
    if (levelFilter !== 'all') {
      result = result.filter((c) => c.level === levelFilter);
    }
    if (resultFilter !== 'all') {
      result = result.filter((c) => c.result === resultFilter);
    }
    if (methodFilter !== 'all') {
      result = result.filter((c) => c.method === methodFilter);
    }

    // ソート
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'criterion':
          comparison = a.criterion.localeCompare(b.criterion, undefined, { numeric: true });
          break;
        case 'level':
          const levelOrder = { A: 1, AA: 2, AAA: 3 };
          comparison = levelOrder[a.level] - levelOrder[b.level];
          break;
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'method':
          comparison = a.method.localeCompare(b.method);
          break;
        case 'result':
          comparison = a.result.localeCompare(b.result);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [matrix.criteria, levelFilter, resultFilter, methodFilter, sortKey, sortDirection]);

  // CSVエクスポートハンドラー
  const handleExportCSV = useCallback(() => {
    if (onExportCSV) {
      onExportCSV(matrix);
      return;
    }

    // デフォルトのCSVダウンロード処理
    const lines: string[] = [];
    lines.push('成功基準,タイトル,レベル,テスト方法,結果,検出ツール');

    for (const status of matrix.criteria) {
      const toolsStr = status.tools.length > 0 ? status.tools.join('; ') : '-';
      const line = [
        status.criterion,
        `"${status.title.replace(/"/g, '""')}"`,
        status.level,
        TEST_METHOD_LABELS[status.method],
        TEST_RESULT_LABELS[status.result],
        toolsStr,
      ].join(',');
      lines.push(line);
    }

    lines.push('');
    lines.push('カバレッジサマリー');
    lines.push(`Level A,${matrix.summary.levelA.covered}/${matrix.summary.levelA.total}`);
    lines.push(`Level AA,${matrix.summary.levelAA.covered}/${matrix.summary.levelAA.total}`);
    lines.push(`Level AAA,${matrix.summary.levelAAA.covered}/${matrix.summary.levelAAA.total}`);

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wcag-coverage-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }, [matrix, onExportCSV]);

  // カバレッジ率を計算
  const calculatePercentage = (covered: number, total: number): string => {
    if (total === 0) return '0.0';
    return ((covered / total) * 100).toFixed(1);
  };

  // 空の状態
  if (matrix.criteria.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          カバレッジデータがありません
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AssessmentIcon color="primary" />
        <Typography variant="h6">WCAGカバレッジマトリクス</Typography>
      </Box>

      {/* カバレッジサマリー */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          カバレッジサマリー
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <CoverageSummaryItem
            label="Level A"
            covered={matrix.summary.levelA.covered}
            total={matrix.summary.levelA.total}
            percentage={calculatePercentage(
              matrix.summary.levelA.covered,
              matrix.summary.levelA.total
            )}
          />
          <CoverageSummaryItem
            label="Level AA"
            covered={matrix.summary.levelAA.covered}
            total={matrix.summary.levelAA.total}
            percentage={calculatePercentage(
              matrix.summary.levelAA.covered,
              matrix.summary.levelAA.total
            )}
          />
          <CoverageSummaryItem
            label="Level AAA"
            covered={matrix.summary.levelAAA.covered}
            total={matrix.summary.levelAAA.total}
            percentage={calculatePercentage(
              matrix.summary.levelAAA.covered,
              matrix.summary.levelAAA.total
            )}
          />
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* フィルタとエクスポート */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="level-filter-label">レベルフィルタ</InputLabel>
          <Select
            labelId="level-filter-label"
            id="level-filter"
            value={levelFilter}
            label="レベルフィルタ"
            onChange={(e) => setLevelFilter(e.target.value as LevelFilter)}
            inputProps={{ 'aria-label': 'レベルフィルタ' }}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="A">A</MenuItem>
            <MenuItem value="AA">AA</MenuItem>
            <MenuItem value="AAA">AAA</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="result-filter-label">結果フィルタ</InputLabel>
          <Select
            labelId="result-filter-label"
            id="result-filter"
            value={resultFilter}
            label="結果フィルタ"
            onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
            inputProps={{ 'aria-label': '結果フィルタ' }}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="pass">合格</MenuItem>
            <MenuItem value="fail">違反</MenuItem>
            <MenuItem value="needs-review">要確認</MenuItem>
            <MenuItem value="not-applicable">該当なし</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="method-filter-label">テスト方法フィルタ</InputLabel>
          <Select
            labelId="method-filter-label"
            id="method-filter"
            value={methodFilter}
            label="テスト方法フィルタ"
            onChange={(e) => setMethodFilter(e.target.value as MethodFilter)}
            inputProps={{ 'aria-label': 'テスト方法フィルタ' }}
          >
            <MenuItem value="all">すべて</MenuItem>
            <MenuItem value="auto">自動テスト</MenuItem>
            <MenuItem value="semi-auto">半自動確認</MenuItem>
            <MenuItem value="manual">手動テスト</MenuItem>
            <MenuItem value="not-tested">未テスト</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportCSV}
          aria-label="CSVエクスポート"
        >
          CSVエクスポート
        </Button>
      </Box>

      {/* テーブル */}
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table aria-label="WCAGカバレッジマトリクス" size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sortDirection={sortKey === 'criterion' ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortKey === 'criterion'}
                  direction={sortKey === 'criterion' ? sortDirection : 'asc'}
                  onClick={() => handleSort('criterion')}
                >
                  成功基準
                </TableSortLabel>
              </TableCell>
              <TableCell
                sortDirection={sortKey === 'level' ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortKey === 'level'}
                  direction={sortKey === 'level' ? sortDirection : 'asc'}
                  onClick={() => handleSort('level')}
                >
                  レベル
                </TableSortLabel>
              </TableCell>
              <TableCell
                sortDirection={sortKey === 'title' ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortKey === 'title'}
                  direction={sortKey === 'title' ? sortDirection : 'asc'}
                  onClick={() => handleSort('title')}
                >
                  タイトル
                </TableSortLabel>
              </TableCell>
              <TableCell
                sortDirection={sortKey === 'method' ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortKey === 'method'}
                  direction={sortKey === 'method' ? sortDirection : 'asc'}
                  onClick={() => handleSort('method')}
                >
                  テスト方法
                </TableSortLabel>
              </TableCell>
              <TableCell
                sortDirection={sortKey === 'result' ? sortDirection : false}
              >
                <TableSortLabel
                  active={sortKey === 'result'}
                  direction={sortKey === 'result' ? sortDirection : 'asc'}
                  onClick={() => handleSort('result')}
                >
                  結果
                </TableSortLabel>
              </TableCell>
              <TableCell>検出ツール</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedCriteria.map((criterion) => (
              <CriterionRow key={criterion.criterion} criterion={criterion} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* フィルタ結果が空の場合 */}
      {filteredAndSortedCriteria.length === 0 && (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography color="text.secondary">
            フィルタ条件に一致する項目がありません
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

/**
 * カバレッジサマリーアイテム
 */
interface CoverageSummaryItemProps {
  label: string;
  covered: number;
  total: number;
  percentage: string;
}

function CoverageSummaryItem({
  label,
  covered,
  total,
  percentage,
}: CoverageSummaryItemProps) {
  const percentValue = parseFloat(percentage);

  return (
    <Box sx={{ minWidth: 150 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2">
          {covered} / {total}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinearProgress
          variant="determinate"
          value={percentValue}
          sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
        />
        <Typography variant="body2" sx={{ minWidth: 45 }}>
          {percentage}%
        </Typography>
      </Box>
    </Box>
  );
}

/**
 * 成功基準行
 */
interface CriterionRowProps {
  criterion: CriterionStatus;
}

function CriterionRow({ criterion }: CriterionRowProps) {
  const resultColor = TEST_RESULT_COLORS[criterion.result];
  const methodColor = TEST_METHOD_COLORS[criterion.method];

  // 結果に応じた行の背景色
  const getRowBackgroundColor = () => {
    switch (criterion.result) {
      case 'fail':
        return 'rgba(211, 47, 47, 0.08)';
      case 'needs-review':
        return 'rgba(237, 108, 2, 0.08)';
      default:
        return undefined;
    }
  };

  return (
    <TableRow
      sx={{ backgroundColor: getRowBackgroundColor() }}
      data-result={criterion.result}
      aria-label={`${criterion.criterion} ${criterion.title}`}
    >
      <TableCell>
        <Typography variant="body2" fontFamily="monospace">
          {criterion.criterion}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip
          label={criterion.level}
          size="small"
          variant="outlined"
          color={criterion.level === 'AAA' ? 'secondary' : 'default'}
        />
      </TableCell>
      <TableCell>{criterion.title}</TableCell>
      <TableCell>
        <Chip
          label={TEST_METHOD_LABELS[criterion.method]}
          size="small"
          color={methodColor as 'primary' | 'warning' | 'default'}
          variant={criterion.method === 'not-tested' ? 'outlined' : 'filled'}
          data-method={criterion.method}
        />
      </TableCell>
      <TableCell>
        <Chip
          label={TEST_RESULT_LABELS[criterion.result]}
          size="small"
          color={resultColor}
          variant={criterion.result === 'not-applicable' ? 'outlined' : 'filled'}
        />
      </TableCell>
      <TableCell>
        <Typography variant="body2" color="text.secondary">
          {criterion.tools.length > 0 ? criterion.tools.join(', ') : '-'}
        </Typography>
      </TableCell>
    </TableRow>
  );
}
