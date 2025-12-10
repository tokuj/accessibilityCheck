import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1a1a2e',
      light: '#4a4a6a',
      dark: '#0a0a1e',
    },
    secondary: {
      main: '#6c63ff',
    },
    error: {
      main: '#ef4444',
      light: '#fecaca',
      dark: '#b91c1c',
    },
    warning: {
      main: '#f59e0b',
      light: '#fde68a',
      dark: '#b45309',
    },
    success: {
      main: '#10b981',
      light: '#a7f3d0',
      dark: '#047857',
    },
    info: {
      main: '#3b82f6',
    },
    background: {
      default: '#f8f9ff',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1a2e',
      secondary: '#6b7280',
    },
  },
  typography: {
    fontFamily: '"Inter", "Noto Sans JP", "Roboto", "Helvetica", "Arial", sans-serif',
    h3: {
      fontWeight: 700,
    },
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
    subtitle2: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8f9ff',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export const impactColors: Record<string, string> = {
  critical: '#ef4444',
  serious: '#f59e0b',
  moderate: '#fbbf24',
  minor: '#3b82f6',
};
