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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { ImpactBadge } from './ImpactBadge';
import { AIChatButton } from './AIChatButton';
import { NodeDetails } from './NodeDetails';
import type { PageResult, NodeInfo } from '../types/accessibility';
import type { ChatContext } from '../utils/chat-storage';

interface ViolationsTableProps {
  pages: PageResult[];
  /** WCAGフィルタ（Task 11.2） */
  wcagFilter?: string | null;
}

export function ViolationsTable({ pages, wcagFilter }: ViolationsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // ノード選択状態を違反ごとに管理 @requirement 7.5
  const [selectedNodes, setSelectedNodes] = useState<Record<string, number | undefined>>({});

  const allViolations = pages.flatMap((page) =>
    page.violations.map((v, idx) => ({
      key: `${page.name}-${v.id}-${idx}`,
      toolSource: v.toolSource || 'axe-core',
      pageName: page.name,
      pageUrl: page.url,
      id: v.id,
      description: v.description,
      impact: v.impact,
      nodeCount: v.nodeCount,
      wcagCriteria: v.wcagCriteria,
      helpUrl: v.helpUrl,
      nodes: v.nodes,
    }))
  );

  // WCAGフィルタリング（Task 11.2）
  const filteredViolations = wcagFilter
    ? allViolations.filter((v) => v.wcagCriteria.includes(wcagFilter))
    : allViolations;

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

  // ノード選択ハンドラ @requirement 7.5
  const handleNodeSelect = (violationKey: string, nodeIndex: number) => {
    setSelectedNodes((prev) => ({
      ...prev,
      [violationKey]: nodeIndex,
    }));
  };

  if (filteredViolations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">
          {wcagFilter ? `WCAG ${wcagFilter} に該当する違反はありません` : '違反はありません'}
        </Typography>
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
          {filteredViolations.map((violation) => {
            const isExpanded = expandedRows.has(violation.key);
            const hasNodes = violation.nodes && violation.nodes.length > 0;
            return (
              <Fragment key={violation.key}>
                <TableRow>
                  <TableCell sx={{ width: 40 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleExpand(violation.key)}
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
                {hasNodes && (
                  <TableRow>
                    <TableCell colSpan={10} sx={{ py: 0, px: 2 }}>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <Box sx={{ py: 2 }}>
                          <NodeDetails
                            nodes={violation.nodes as NodeInfo[]}
                            expanded={true}
                            onToggle={() => handleToggleExpand(violation.key)}
                            selectedNodeIndex={selectedNodes[violation.key]}
                            onNodeSelect={(index) => handleNodeSelect(violation.key, index)}
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
