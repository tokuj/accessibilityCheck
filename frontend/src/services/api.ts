import type { AnalyzeRequest, AnalyzeResponse } from '../types/accessibility';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function analyzeUrl(request: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
