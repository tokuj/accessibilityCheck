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
import { AIChatButton } from './AIChatButton';
import type { PageResult } from '../types/accessibility';
import type { ChatContext } from '../utils/chat-storage';

interface PassesTableProps {
  pages: PageResult[];
}

export function PassesTable({ pages }: PassesTableProps) {
  const allPasses = pages.flatMap((page) =>
    page.passes.map((p) => ({ ...p, pageName: page.name, pageUrl: page.url }))
  );

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
            <TableCell>ツール</TableCell>
            <TableCell>ページ</TableCell>
            <TableCell>ルールID</TableCell>
            <TableCell>説明</TableCell>
            <TableCell>ノード数</TableCell>
            <TableCell>WCAG項番</TableCell>
            <TableCell>詳細</TableCell>
            <TableCell>AI</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allPasses.map((pass, idx) => (
            <TableRow key={`${pass.pageName}-${pass.id}-${idx}`}>
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
              <TableCell align="center">{pass.nodeCount}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {pass.wcagCriteria.map((criteria) => (
                    <Chip
                      key={criteria}
                      label={criteria}
                      size="small"
                      variant="outlined"
                      color="success"
                    />
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
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
