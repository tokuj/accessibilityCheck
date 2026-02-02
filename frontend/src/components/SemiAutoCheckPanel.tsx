/**
 * SemiAutoCheckPanel コンポーネント
 *
 * Requirements: wcag-coverage-expansion 5.1, 5.2, 5.3, 5.5, 5.6
 * Task 11.1: SemiAutoCheckPanelコンポーネントを実装
 *
 * - カード形式で半自動チェック項目を一覧表示
 * - 各カードにスクリーンショット、HTML抜粋、質問を表示
 * - 選択肢ボタン（適切/不適切/判断不能）を表示
 * - 進捗バーで完了状況を表示
 * - スキップボタンで後回しを可能に
 * - 「自動テストのみ」オプション時はパネルを非表示
 */

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpIcon from '@mui/icons-material/Help';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';

import {
  type SemiAutoItem,
  type SemiAutoAnswer,
  type SemiAutoProgress,
  SEMI_AUTO_ANSWER_LABELS,
} from '../types/semi-auto-check';

interface SemiAutoCheckPanelProps {
  /** 半自動チェック項目リスト */
  items: SemiAutoItem[];
  /** 現在表示中の項目インデックス */
  currentIndex: number;
  /** 回答時のコールバック */
  onAnswer: (itemId: string, answer: SemiAutoAnswer) => void;
  /** スキップ時のコールバック */
  onSkip: (itemId: string) => void;
  /** 完了時のコールバック */
  onComplete: () => void;
  /** 進捗状況 */
  progress?: SemiAutoProgress;
  /** 全項目完了フラグ */
  isComplete?: boolean;
  /** パネル非表示フラグ（自動テストのみ時） */
  hidden?: boolean;
  /** 前回の回答を表示するか */
  showPreviousAnswer?: boolean;
}

/**
 * SemiAutoCheckPanel - 半自動チェックパネル
 * @requirement 5.1 - 半自動確認が可能な項目をリストアップ
 * @requirement 5.2 - スクリーンショット、HTML抜粋、質問を表示
 * @requirement 5.3 - 選択肢で回答を記録
 * @requirement 5.5 - スキップボタンで後回し可能
 * @requirement 5.6 - 進捗状況を表示
 */
export function SemiAutoCheckPanel({
  items,
  currentIndex,
  onAnswer,
  onSkip,
  onComplete,
  progress,
  isComplete = false,
  hidden = false,
  showPreviousAnswer = false,
}: SemiAutoCheckPanelProps) {
  // 非表示の場合は何も表示しない
  if (hidden) {
    return null;
  }

  // 項目がない場合
  if (items.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <AssignmentTurnedInIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          確認項目がありません
        </Typography>
        <Typography variant="body2" color="text.secondary">
          自動テストで検出された項目に半自動確認が必要なものはありませんでした。
        </Typography>
      </Paper>
    );
  }

  // 全項目完了の場合
  if (isComplete) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <DoneAllIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
        <Typography variant="h6" color="success.main" gutterBottom>
          すべての項目を確認しました
        </Typography>
        {progress && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {progress.completed} 項目の確認が完了しました
          </Typography>
        )}
        <Button
          variant="contained"
          color="primary"
          onClick={onComplete}
          startIcon={<CheckCircleIcon />}
        >
          完了
        </Button>
      </Paper>
    );
  }

  const currentItem = items[currentIndex];
  if (!currentItem) {
    return null;
  }

  const progressValue = progress
    ? (progress.completed / progress.total) * 100
    : (currentIndex / items.length) * 100;

  const handleAnswer = (answer: SemiAutoAnswer) => {
    onAnswer(currentItem.id, answer);
  };

  const handleSkip = () => {
    onSkip(currentItem.id);
  };

  return (
    <Paper sx={{ p: 2 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">半自動チェック</Typography>
        {progress && (
          <Typography variant="body2" color="text.secondary">
            {progress.completed} / {progress.total}
          </Typography>
        )}
      </Box>

      {/* 進捗バー */}
      <LinearProgress
        variant="determinate"
        value={progressValue}
        sx={{ mb: 2, height: 8, borderRadius: 4 }}
        aria-valuenow={progressValue}
        aria-valuemin={0}
        aria-valuemax={100}
      />

      {/* 確認カード */}
      <Card variant="outlined">
        <CardContent>
          {/* WCAG成功基準 */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
            {currentItem.wcagCriteria.map((criterion) => (
              <Chip
                key={criterion}
                label={criterion}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>

          {/* 要素の説明 */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {currentItem.elementDescription}
          </Typography>

          {/* 質問 */}
          <Typography variant="h6" sx={{ my: 2 }}>
            {currentItem.question}
          </Typography>

          <Divider sx={{ my: 2 }} />

          {/* スクリーンショット */}
          {currentItem.screenshot && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <img
                src={currentItem.screenshot}
                alt="要素のスクリーンショット"
                style={{
                  maxWidth: '100%',
                  maxHeight: 200,
                  border: '1px solid #ccc',
                  borderRadius: 4,
                }}
              />
            </Box>
          )}

          {/* HTML抜粋 */}
          <Box
            sx={{
              backgroundColor: 'grey.100',
              p: 2,
              borderRadius: 1,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              overflow: 'auto',
              maxHeight: 100,
            }}
          >
            <code>{currentItem.html}</code>
          </Box>

          {/* 前回の回答 */}
          {showPreviousAnswer && currentItem.answer && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                前回の回答: {SEMI_AUTO_ANSWER_LABELS[currentItem.answer]}
              </Typography>
            </Box>
          )}
        </CardContent>

        <Divider />

        <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
          {/* 回答ボタン */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="success"
              onClick={() => handleAnswer('appropriate')}
              startIcon={<CheckCircleIcon />}
            >
              適切
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={() => handleAnswer('inappropriate')}
              startIcon={<CancelIcon />}
            >
              不適切
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={() => handleAnswer('cannot-determine')}
              startIcon={<HelpIcon />}
            >
              判断不能
            </Button>
          </Box>

          {/* スキップボタン */}
          <Button
            variant="text"
            color="inherit"
            onClick={handleSkip}
            startIcon={<SkipNextIcon />}
          >
            スキップ
          </Button>
        </CardActions>
      </Card>
    </Paper>
  );
}
