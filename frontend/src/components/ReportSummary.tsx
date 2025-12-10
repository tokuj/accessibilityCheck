import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import LinkIcon from '@mui/icons-material/Link';
import { ScoreCard } from './ScoreCard';
import { ImprovementList } from './ImprovementList';
import type { AccessibilityReport, RuleResult } from '../types/accessibility';
import { calculateScores } from '../utils/scoreCalculator';

interface ReportSummaryProps {
  report: AccessibilityReport;
  url: string;
  onClose: () => void;
}

export function ReportSummary({ report, url, onClose }: ReportSummaryProps) {
  const scores = calculateScores(report);

  // Collect all violations
  const allViolations: RuleResult[] = report.pages.flatMap((page) => page.violations);

  // Truncate URL for display
  const displayUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;

  return (
    <Card sx={{ maxWidth: 800, mx: 'auto', mb: 4 }}>
      <CardContent sx={{ p: 4 }}>
        {/* Header with URL and close button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1,
              bgcolor: 'grey.100',
              borderRadius: 2,
              maxWidth: '70%',
            }}
          >
            <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayUrl}
            </Typography>
          </Box>
          <Button
            variant="text"
            color="primary"
            onClick={onClose}
            sx={{ fontWeight: 500 }}
          >
            閉じる
          </Button>
        </Box>

        {/* Score Card */}
        <ScoreCard totalScore={scores.totalScore} categories={scores.categories} />

        {/* Divider */}
        <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />

        {/* Improvement List */}
        <ImprovementList summary={scores.summary} violations={allViolations} />
      </CardContent>
    </Card>
  );
}
