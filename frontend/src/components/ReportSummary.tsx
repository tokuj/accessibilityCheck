import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import LinkIcon from '@mui/icons-material/Link';
import BuildIcon from '@mui/icons-material/Build';
import { ScoreCard } from './ScoreCard';
import { ImprovementList } from './ImprovementList';
import { ViolationsTable } from './ViolationsTable';
import { PassesTable } from './PassesTable';
import { IncompleteTable } from './IncompleteTable';
import { LighthouseScores } from './LighthouseScores';
import type { AccessibilityReport, RuleResult } from '../types/accessibility';
import { calculateScores } from '../utils/scoreCalculator';

interface ReportSummaryProps {
  report: AccessibilityReport;
  url: string;
  onClose: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`detail-tabpanel-${index}`}
      aria-labelledby={`detail-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export function ReportSummary({ report, url, onClose }: ReportSummaryProps) {
  const [tabValue, setTabValue] = useState(0);
  const scores = calculateScores(report);

  // Collect all violations
  const allViolations: RuleResult[] = report.pages.flatMap((page) => page.violations);

  // Truncate URL for display
  const displayUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;

  return (
    <Card sx={{ maxWidth: 1400, mx: 'auto', mb: 4 }}>
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

        {/* Screenshot */}
        {report.screenshot && (
          <Box sx={{ mb: 3, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <img
              src={report.screenshot}
              alt="ページスクリーンショット"
              style={{ width: '100%', display: 'block' }}
            />
          </Box>
        )}

        {/* Tools Used */}
        {report.toolsUsed && report.toolsUsed.length > 0 && (
          <Box sx={{ mb: 3, p: 2, bgcolor: 'info.lighter', borderRadius: 2, border: '1px solid', borderColor: 'info.light' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BuildIcon sx={{ fontSize: 18, color: 'info.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                分析ツール
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              {report.toolsUsed.map((tool) => (
                <Chip
                  key={tool.name}
                  label={`${tool.name} v${tool.version}`}
                  size="small"
                  variant="outlined"
                  color={
                    tool.name === 'pa11y' ? 'secondary' :
                    tool.name === 'lighthouse' ? 'warning' : 'default'
                  }
                />
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                合計実行時間: {(report.toolsUsed.reduce((sum, t) => sum + t.duration, 0) / 1000).toFixed(1)}秒
              </Typography>
            </Box>
          </Box>
        )}

        {/* Score Card */}
        <ScoreCard totalScore={scores.totalScore} categories={scores.categories} />

        {/* Lighthouse Scores */}
        {report.lighthouseScores && (
          <Box sx={{ mt: 3 }}>
            <LighthouseScores scores={report.lighthouseScores} />
          </Box>
        )}

        {/* Divider */}
        <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />

        {/* Improvement List */}
        <ImprovementList summary={scores.summary} violations={allViolations} />

        {/* Divider */}
        <Box sx={{ my: 4, borderBottom: 1, borderColor: 'divider' }} />

        {/* Detail Tabs */}
        <Typography variant="h6" sx={{ mb: 2 }}>
          詳細結果
        </Typography>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={tabValue}
            onChange={(_, newValue) => setTabValue(newValue)}
            aria-label="詳細結果タブ"
          >
            <Tab
              label={`違反 (${report.summary.totalViolations})`}
              id="detail-tab-0"
              aria-controls="detail-tabpanel-0"
            />
            <Tab
              label={`パス (${report.summary.totalPasses})`}
              id="detail-tab-1"
              aria-controls="detail-tabpanel-1"
            />
            <Tab
              label={`要確認 (${report.summary.totalIncomplete})`}
              id="detail-tab-2"
              aria-controls="detail-tabpanel-2"
            />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <ViolationsTable pages={report.pages} />
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          <PassesTable pages={report.pages} />
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          <IncompleteTable pages={report.pages} />
        </TabPanel>
      </CardContent>
    </Card>
  );
}
