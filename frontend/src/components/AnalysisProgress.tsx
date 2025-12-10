import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';

export function AnalysisProgress() {
  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 4 }}>
      <CardContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 4,
          }}
        >
          <CircularProgress size={60} sx={{ mb: 3 }} />
          <Typography variant="h6" gutterBottom>
            分析中...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Webページをスキャンしています。しばらくお待ちください。
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
