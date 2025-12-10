import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

interface UrlInputProps {
  onAnalyze: (url: string) => void;
  disabled?: boolean;
  compact?: boolean;
  initialValue?: string;
}

export function UrlInput({ onAnalyze, disabled, compact = false, initialValue = '' }: UrlInputProps) {
  const [url, setUrl] = useState(initialValue);

  const validateUrl = (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      return;
    }

    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    if (!validateUrl(targetUrl)) {
      return;
    }

    onAnalyze(targetUrl);
  };

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: compact ? '100%' : { xs: '90%', sm: '600px', md: '700px' },
        maxWidth: '700px',
        mx: 'auto',
        px: 2,
        py: 0.5,
        borderRadius: '50px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        backgroundColor: 'white',
        border: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      <IconButton sx={{ p: 1, color: 'text.secondary' }} disabled>
        <AddIcon />
      </IconButton>
      <InputBase
        sx={{
          ml: 1,
          flex: 1,
          fontSize: '1rem',
          '& input::placeholder': {
            color: 'text.secondary',
            opacity: 0.7,
          },
        }}
        placeholder="分析したいURLを入力してください..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        disabled={disabled}
      />
      <IconButton sx={{ p: 1, color: 'text.secondary' }} disabled>
        <MenuBookIcon />
      </IconButton>
      <Box sx={{ width: '1px', height: 24, bgcolor: 'divider', mx: 1 }} />
      <IconButton
        type="submit"
        disabled={disabled || !url.trim()}
        sx={{
          p: 1.5,
          bgcolor: url.trim() ? 'primary.main' : 'grey.300',
          color: 'white',
          '&:hover': {
            bgcolor: url.trim() ? 'primary.dark' : 'grey.300',
          },
          '&.Mui-disabled': {
            bgcolor: 'grey.300',
            color: 'white',
          },
        }}
      >
        <ArrowUpwardIcon />
      </IconButton>
    </Paper>
  );
}
