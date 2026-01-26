import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import BuildIcon from '@mui/icons-material/Build';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DownloadIcon from '@mui/icons-material/Download';
import type { RuleResult, AISummary } from '../types/accessibility';
import { sortViolationsByImpact } from '../utils/scoreCalculator';
import { exportAISummaryToCsv } from '../utils/csvExport';
import { AIChatButton } from './AIChatButton';
import type { ChatContext } from '../utils/chat-storage';

interface ImprovementListProps {
  violations: RuleResult[];
  aiSummary?: AISummary;
  targetUrl?: string;
}

const impactLabels: Record<string, string> = {
  critical: '致命的',
  serious: '重大',
  moderate: '中程度',
  minor: '軽微',
};

const impactColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'error.light', text: 'error.dark' },
  serious: { bg: 'warning.light', text: 'warning.dark' },
  moderate: { bg: 'info.light', text: 'info.dark' },
  minor: { bg: 'grey.200', text: 'text.secondary' },
};

export function ImprovementList({ violations, aiSummary, targetUrl = '' }: ImprovementListProps) {
  const sortedViolations = sortViolationsByImpact(violations);
  const topViolations = sortedViolations.slice(0, 5);

  // Snackbar状態（Task 6.1）
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // AI総評CSVダウンロードが可能かどうか
  const canDownloadCsv = aiSummary && aiSummary.detectedIssues && aiSummary.detectedIssues.length > 0;

  // CSVダウンロードハンドラ
  const handleDownloadCsv = () => {
    if (canDownloadCsv) {
      try {
        exportAISummaryToCsv(aiSummary.detectedIssues, targetUrl);
        setSnackbar({
          open: true,
          message: 'CSVファイルのダウンロードを開始しました',
          severity: 'success',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'CSVダウンロード中にエラーが発生しました';
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error',
        });
      }
    }
  };

  // Snackbarを閉じる
  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  return (
    <Box>
      {/* AI総評セクション - Gemini成功時のみ表示 */}
      {aiSummary && (
        <Box
          sx={{
            bgcolor: 'primary.50',
            borderRadius: 2,
            p: 3,
            mb: 3,
            border: '1px solid',
            borderColor: 'primary.200',
          }}
        >
          <Box data-testid="ai-summary-header" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 22 }} />
            <Typography variant="subtitle1" fontWeight="bold">
              AI総評
            </Typography>
            <Chip
              label="Gemini Flash"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 1, fontSize: '0.7rem', height: 20 }}
            />
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadCsv}
              disabled={!canDownloadCsv}
              sx={{ fontSize: '0.75rem' }}
            >
              CSVダウンロード
            </Button>
          </Box>

          {/* 全体評価 */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
            <Typography variant="body1" sx={{ lineHeight: 1.7, flex: 1 }}>
              {aiSummary.overallAssessment}
            </Typography>
            <AIChatButton
              context={{
                type: 'improvement',
                data: { overallAssessment: aiSummary.overallAssessment },
                label: '全体評価',
              } as ChatContext}
              size="small"
            />
          </Box>

        {/* AI総評の詳細 */}
        <>
            {/* 影響度サマリー */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
              {Object.entries(aiSummary.impactSummary).map(([impact, count]) => (
                count > 0 && (
                  <Box
                    key={impact}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: impactColors[impact]?.bg || 'grey.200',
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      sx={{ color: impactColors[impact]?.text || 'text.secondary' }}
                    >
                      {impactLabels[impact] || impact}:
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      sx={{ color: impactColors[impact]?.text || 'text.secondary' }}
                    >
                      {count}件
                    </Typography>
                  </Box>
                )
              ))}
            </Box>

            {/* 優先改善ポイント */}
            {aiSummary.prioritizedImprovements.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <PriorityHighIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                  <Typography variant="subtitle2" fontWeight="bold">
                    優先改善ポイント
                  </Typography>
                </Box>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {aiSummary.prioritizedImprovements.map((improvement, index) => (
                    <Box
                      component="li"
                      key={index}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
                    >
                      <Typography variant="body2" sx={{ lineHeight: 1.6, flex: 1 }}>
                        {improvement}
                      </Typography>
                      <AIChatButton
                        context={{
                          type: 'improvement',
                          data: { improvement, index },
                          label: `改善ポイント${index + 1}`,
                        } as ChatContext}
                        size="small"
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* 具体的な推奨事項 */}
            {aiSummary.specificRecommendations.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <LightbulbIcon sx={{ color: 'info.main', fontSize: 18 }} />
                  <Typography variant="subtitle2" fontWeight="bold">
                    具体的な推奨事項
                  </Typography>
                </Box>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {aiSummary.specificRecommendations.map((recommendation, index) => (
                    <Box
                      component="li"
                      key={index}
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ lineHeight: 1.6, flex: 1 }}
                      >
                        {recommendation}
                      </Typography>
                      <AIChatButton
                        context={{
                          type: 'recommendation',
                          data: { recommendation, index },
                          label: `推奨事項${index + 1}`,
                        } as ChatContext}
                        size="small"
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* 検出された問題の詳細（構造化表示） */}
            {aiSummary.detectedIssues && aiSummary.detectedIssues.length > 0 && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <BuildIcon sx={{ color: 'error.main', fontSize: 18 }} />
                  <Typography variant="subtitle2" fontWeight="bold">
                    検出された問題と修正方法
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {aiSummary.detectedIssues.map((issue, index) => (
                    <Box
                      key={`issue-${issue.ruleId}-${index}`}
                      sx={{
                        p: 2,
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        <Typography
                          variant="subtitle2"
                          fontWeight="bold"
                          sx={{ color: 'error.main', flex: 1 }}
                        >
                          {issue.ruleId}
                        </Typography>
                        <AIChatButton
                          context={{
                            type: 'issue',
                            ruleId: issue.ruleId,
                            data: {
                              ruleId: issue.ruleId,
                              whatIsHappening: issue.whatIsHappening,
                              whatIsNeeded: issue.whatIsNeeded,
                              howToFix: issue.howToFix,
                            },
                            label: issue.ruleId,
                          } as ChatContext}
                          size="small"
                        />
                      </Box>

                      {/* 何が起きているか */}
                      <Box sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <ErrorOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            何が起きているか
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ pl: 2.5 }}>
                          {issue.whatIsHappening}
                        </Typography>
                      </Box>

                      {/* 修正に必要なもの */}
                      <Box sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <HelpOutlineIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            修正に必要なもの
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ pl: 2.5 }}>
                          {issue.whatIsNeeded}
                        </Typography>
                      </Box>

                      {/* どう修正するか */}
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <CheckCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
                          <Typography variant="caption" color="text.secondary" fontWeight="bold">
                            どう修正するか
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            pl: 2.5,
                            whiteSpace: 'pre-wrap',
                            fontFamily: issue.howToFix.includes('`') ? 'monospace' : 'inherit',
                          }}
                        >
                          {issue.howToFix}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </>
        </Box>
      )}

      {/* 改善提案（違反リスト） */}
      {topViolations.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <ErrorOutlineIcon sx={{ color: 'warning.main', fontSize: 20 }} />
            <Typography variant="subtitle2" fontWeight="bold">
              改善提案
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {topViolations.map((violation, index) => (
              <Box key={`${violation.id}-${index}`} sx={{ display: 'flex', gap: 2 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 'bold',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </Box>
                <Box>
                  <Typography variant="body2">
                    {violation.description}
                    {violation.impact && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          ml: 1,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: impactColors[violation.impact]?.bg || 'grey.200',
                          color: impactColors[violation.impact]?.text || 'text.secondary',
                        }}
                      >
                        {impactLabels[violation.impact] || violation.impact}
                      </Typography>
                    )}
                  </Typography>
                  {violation.wcagCriteria.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      WCAG: {violation.wcagCriteria.join(', ')}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
          {sortedViolations.length > 5 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              他 {sortedViolations.length - 5} 件の改善提案があります
            </Typography>
          )}
        </Box>
      )}
      {/* Snackbar for CSV download notifications (Task 6.1) */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={snackbar.severity === 'success' ? 3000 : 6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
