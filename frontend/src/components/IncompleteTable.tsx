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
import type { PageResult } from '../types/accessibility';

interface IncompleteTableProps {
  pages: PageResult[];
}

export function IncompleteTable({ pages }: IncompleteTableProps) {
  const allIncomplete = pages.flatMap((page) =>
    page.incomplete.map((i) => ({ ...i, pageName: page.name, pageUrl: page.url }))
  );

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
            <TableCell>ツール</TableCell>
            <TableCell>ページ</TableCell>
            <TableCell>ルールID</TableCell>
            <TableCell>説明</TableCell>
            <TableCell>影響度</TableCell>
            <TableCell>ノード数</TableCell>
            <TableCell>WCAG項番</TableCell>
            <TableCell>詳細</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allIncomplete.map((item, idx) => (
            <TableRow key={`${item.pageName}-${item.id}-${idx}`}>
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
                <code>{item.id}</code>
              </TableCell>
              <TableCell sx={{ maxWidth: 300 }}>{item.description}</TableCell>
              <TableCell>
                <ImpactBadge impact={item.impact} />
              </TableCell>
              <TableCell align="center">{item.nodeCount}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {item.wcagCriteria.map((criteria) => (
                    <Chip
                      key={criteria}
                      label={criteria}
                      size="small"
                      variant="outlined"
                      color="warning"
                    />
                  ))}
                </Box>
              </TableCell>
              <TableCell>
                <Link href={item.helpUrl} target="_blank" rel="noopener">
                  参照
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
