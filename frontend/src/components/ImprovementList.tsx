import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import type { RuleResult } from '../types/accessibility';
import { sortViolationsByImpact } from '../utils/scoreCalculator';

interface ImprovementListProps {
  summary: string;
  violations: RuleResult[];
}

const impactLabels: Record<string, string> = {
  critical: '致命的',
  serious: '重大',
  moderate: '中程度',
  minor: '軽微',
};

export function ImprovementList({ summary, violations }: ImprovementListProps) {
  const sortedViolations = sortViolationsByImpact(violations);
  const topViolations = sortedViolations.slice(0, 5);

  return (
    <Box>
      {/* AI総評 */}
      <Box
        sx={{
          bgcolor: 'grey.50',
          borderRadius: 2,
          p: 2,
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
          <Typography variant="subtitle2" fontWeight="bold">
            AI総評
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {summary}
        </Typography>
      </Box>

      {/* 改善提案 */}
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
              <Box key={violation.id} sx={{ display: 'flex', gap: 2 }}>
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
                          bgcolor: violation.impact === 'critical' ? 'error.light' :
                                   violation.impact === 'serious' ? 'warning.light' :
                                   'grey.200',
                          color: violation.impact === 'critical' ? 'error.dark' :
                                 violation.impact === 'serious' ? 'warning.dark' :
                                 'text.secondary',
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
