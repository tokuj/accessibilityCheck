import { useState, Fragment } from 'react';
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
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import Tooltip from '@mui/material/Tooltip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { ImpactBadge } from './ImpactBadge';
import { AIChatButton } from './AIChatButton';
import { NodeDetails } from './NodeDetails';
import type { PageResult, NodeInfo, ClassificationReason } from '../types/accessibility';
import type { ChatContext } from '../utils/chat-storage';

interface IncompleteTableProps {
  pages: PageResult[];
}

const CLASSIFICATION_REASON_LABELS: Record<ClassificationReason, string> = {
  'manual-review': '手動確認が必要',
  'insufficient-data': '情報不足',
  'partial-support': '部分的サポート',
};

export function IncompleteTable({ pages }: IncompleteTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const allIncomplete = pages.flatMap((page) =>
    page.incomplete.map((i, idx) => ({
      key: `${page.name}-${i.id}-${idx}`,
      ...i,
      pageName: page.name,
      pageUrl: page.url,
    }))
  );

  const handleToggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (allIncomplete.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">要確認項目はありません</Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 40 }} />
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
          {allIncomplete.map((item) => {
            const isExpanded = expandedRows.has(item.key);
            const hasNodes = item.nodes && item.nodes.length > 0;
            return (
              <Fragment key={item.key}>
                <TableRow>
                  <TableCell sx={{ width: 40 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleExpand(item.key)}
                      disabled={!hasNodes}
                      aria-label={
                        isExpanded
                          ? 'ノード情報を折りたたむ'
                          : 'ノード情報を展開'
                      }
                    >
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.toolSource || 'axe-core'}
                      size="small"
                      variant="outlined"
                      color={
                        item.toolSource === 'pa11y' ? 'secondary' :
                        item.toolSource === 'lighthouse' ? 'warning' : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>{item.pageName}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <code>{item.id}</code>
                      {item.classificationReason && (
                        <Tooltip
                          title={CLASSIFICATION_REASON_LABELS[item.classificationReason]}
                          arrow
                        >
                          <InfoOutlinedIcon
                            fontSize="small"
                            color="action"
                            data-testid="classification-reason-tooltip"
                            sx={{ cursor: 'help' }}
                          />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>{item.description}</TableCell>
                  <TableCell>
                    <ImpactBadge impact={item.impact} />
                  </TableCell>
                  <TableCell align="center">{item.nodeCount}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {item.wcagCriteria.map((criteria) => (
                        <Box key={criteria} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <Chip
                            label={criteria}
                            size="small"
                            variant="outlined"
                            color="warning"
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
                    <Link href={item.helpUrl} target="_blank" rel="noopener">
                      参照
                    </Link>
                  </TableCell>
                  <TableCell>
                    <AIChatButton
                      context={{
                        type: 'incomplete',
                        ruleId: item.id,
                        wcagCriteria: item.wcagCriteria,
                        data: {
                          ruleId: item.id,
                          description: item.description,
                          impact: item.impact,
                          nodeCount: item.nodeCount,
                          toolSource: item.toolSource,
                        },
                        label: item.id,
                      } as ChatContext}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
                {hasNodes && (
                  <TableRow>
                    <TableCell colSpan={10} sx={{ py: 0, px: 2 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2 }}>
                          <NodeDetails
                            nodes={item.nodes as NodeInfo[]}
                            expanded={true}
                            onToggle={() => handleToggleExpand(item.key)}
                          />
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
