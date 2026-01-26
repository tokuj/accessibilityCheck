import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { ImpactBadge } from './ImpactBadge';
import { AIChatButton } from './AIChatButton';
import type { PageResult } from '../types/accessibility';
import type { ChatContext } from '../utils/chat-storage';

interface ViolationsTableProps {
  pages: PageResult[];
}

export function ViolationsTable({ pages }: ViolationsTableProps) {
  const allViolations = pages.flatMap((page) =>
    page.violations.map((v) => ({
      toolSource: v.toolSource || 'axe-core',
      pageName: page.name,
      pageUrl: page.url,
      id: v.id,
      description: v.description,
      impact: v.impact,
      nodeCount: v.nodeCount,
      wcagCriteria: v.wcagCriteria,
      helpUrl: v.helpUrl,
    }))
  );

  if (allViolations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">違反はありません</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ツール</TableCell>
            <TableCell>ページ</TableCell>
            <TableCell>ルールID</TableCell>
            <TableCell>説明</TableCell>
            <TableCell>影響度</TableCell>
            <TableCell>ノード数</TableCell>
            <TableCell>WCAG項番</TableCell>
            <TableCell>詳細</TableCell>
            <TableCell>AI</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allViolations.map((violation, idx) => (
            <TableRow key={`${violation.pageName}-${violation.id}-${idx}`}>
              <TableCell>
                <Chip
                  label={violation.toolSource || 'axe-core'}
                  size="small"
                  variant="outlined"
                  color={
                    violation.toolSource === 'pa11y' ? 'secondary' :
                    violation.toolSource === 'lighthouse' ? 'warning' : 'default'
                  }
                />
              </TableCell>
              <TableCell>{violation.pageName}</TableCell>
              <TableCell>
                <code>{violation.id}</code>
              </TableCell>
              <TableCell sx={{ minWidth: 250 }}>{violation.description}</TableCell>
              <TableCell>
                <ImpactBadge impact={violation.impact} />
              </TableCell>
              <TableCell align="center">{violation.nodeCount}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {violation.wcagCriteria.map((criteria) => (
                    <Box key={criteria} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <Chip
                        label={criteria}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                      <AIChatButton
                        context={{
                          type: 'wcag',
                          wcagCriteria: [criteria],
                          data: { criterion: criteria },
                          label: `WCAG ${criteria}`,
                        } as ChatContext}
                        size="small"
                      />
                    </Box>
                  ))}
                </Box>
              </TableCell>
              <TableCell>
                <Link href={violation.helpUrl} target="_blank" rel="noopener">
                  参照
                </Link>
              </TableCell>
              <TableCell>
                <AIChatButton
                  context={{
                    type: 'violation',
                    ruleId: violation.id,
                    wcagCriteria: violation.wcagCriteria,
                    data: {
                      ruleId: violation.id,
                      description: violation.description,
                      impact: violation.impact,
                      nodeCount: violation.nodeCount,
                      toolSource: violation.toolSource,
                    },
                    label: violation.id,
                  } as ChatContext}
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
