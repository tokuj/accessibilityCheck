import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import BuildIcon from '@mui/icons-material/Build';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import type { RuleResult, AISummary } from '../types/accessibility';
import { sortViolationsByImpact } from '../utils/scoreCalculator';

interface ImprovementListProps {
  violations: RuleResult[];
  aiSummary?: AISummary;
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

export function ImprovementList({ violations, aiSummary }: ImprovementListProps) {
  const sortedViolations = sortViolationsByImpact(violations);
  const topViolations = sortedViolations.slice(0, 5);

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
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
          </Box>

          {/* 全体評価 */}
          <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
            {aiSummary.overallAssessment}
          </Typography>

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
                    <Typography
                      component="li"
                      key={index}
                      variant="body2"
                      sx={{ mb: 0.5, lineHeight: 1.6 }}
                    >
                      {improvement}
                    </Typography>
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
                    <Typography
                      component="li"
                      key={index}
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5, lineHeight: 1.6 }}
                    >
                      {recommendation}
                    </Typography>
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
                      <Typography
                        variant="subtitle2"
                        fontWeight="bold"
                        sx={{ mb: 1.5, color: 'error.main' }}
                      >
                        {issue.ruleId}
                      </Typography>

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
    </Box>
  );
}
