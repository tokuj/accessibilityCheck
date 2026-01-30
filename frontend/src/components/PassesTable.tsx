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

interface PassesTableProps {
  pages: PageResult[];
}

export function PassesTable({ pages }: PassesTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const allPasses = pages.flatMap((page) =>
    page.passes.map((p, idx) => ({
      key: `${page.name}-${p.id}-${idx}`,
      ...p,
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

  if (allPasses.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">パスした項目はありません</Typography>
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
          {allPasses.map((pass) => {
            const isExpanded = expandedRows.has(pass.key);
            const hasNodes = pass.nodes && pass.nodes.length > 0;
            return (
              <Fragment key={pass.key}>
                <TableRow>
                  <TableCell sx={{ width: 40 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleToggleExpand(pass.key)}
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
                      label={pass.toolSource || 'axe-core'}
                      size="small"
                      variant="outlined"
                      color={
                        pass.toolSource === 'pa11y' ? 'secondary' :
                        pass.toolSource === 'lighthouse' ? 'warning' : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>{pass.pageName}</TableCell>
                  <TableCell>
                    <code>{pass.id}</code>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 300 }}>{pass.description}</TableCell>
                  <TableCell>
                    {pass.impact ? (
                      <ImpactBadge impact={pass.impact} />
                    ) : (
                      <Typography color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">{pass.nodeCount}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {pass.wcagCriteria.map((criteria) => (
                        <Box key={criteria} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <Chip
                            label={criteria}
                            size="small"
                            variant="outlined"
                            color="success"
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
                    <Link href={pass.helpUrl} target="_blank" rel="noopener">
                      参照
                    </Link>
                  </TableCell>
                  <TableCell>
                    <AIChatButton
                      context={{
                        type: 'pass',
                        ruleId: pass.id,
                        wcagCriteria: pass.wcagCriteria,
                        data: {
                          ruleId: pass.id,
                          description: pass.description,
                          nodeCount: pass.nodeCount,
                          toolSource: pass.toolSource,
                        },
                        label: pass.id,
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
                            nodes={pass.nodes as NodeInfo[]}
                            expanded={true}
                            onToggle={() => handleToggleExpand(pass.key)}
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
