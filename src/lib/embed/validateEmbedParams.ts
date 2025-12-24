export type EmbedResolution = '1s' | '5s' | '15s' | '30s' | '1minute' | '5minute' | '15minute' | '1hour' | '1day' | '1week' | '1month';
export type EmbedChartType = 'price' | 'mc' | 'volume';
export type EmbedTheme = 'Navy' | 'Frog' | 'Abyss' | 'Light';

export interface EmbedParams {
  resolution: EmbedResolution;
  chart_type: EmbedChartType;
  theme?: EmbedTheme;
  bg_color?: string;
  candle_up_color?: string;
  candle_down_color?: string;
  embed: '1'; 
}

export interface EmbedConfig {
  resolution: EmbedResolution;
  chartType: EmbedChartType;
  theme?: EmbedTheme;
  bgColor?: string;
  candleUpColor?: string;
  candleDownColor?: string;
}

function isLightColor(hexColor: string): boolean {
  if (!hexColor) return false;
  
  // Remove # if present
  const color = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  
  // Handle 3-character hex
  const fullColor = color.length === 3 
    ? color.split('').map(c => c + c).join('')
    : color;
  
  // Convert to RGB
  const r = parseInt(fullColor.substring(0, 2), 16);
  const g = parseInt(fullColor.substring(2, 4), 16);
  const b = parseInt(fullColor.substring(4, 6), 16);
  
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5;
}

const ALLOWED_RESOLUTIONS: EmbedResolution[] = [
  '1s', '5s', '15s', '30s',
  '1minute', '5minute', '15minute',
  '1hour', '1day', '1week', '1month'
];
const ALLOWED_CHART_TYPES: EmbedChartType[] = ['price', 'mc', 'volume'];
const ALLOWED_THEMES: EmbedTheme[] = ['Navy', 'Frog', 'Abyss', 'Light'];

const THEME_COLORS: Record<EmbedTheme, string> = {
  Navy: '#121319',
  Frog: '#0F1010',
  Abyss: '#070D13',
  Light: '#FFFFFF',
};

function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
}


function sanitizeHexColor(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const trimmed = color.trim();
  
  // Remove # if present
  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  
  // Check if valid hex (3 or 6 characters)
  if (/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(withoutHash)) {
    // Always return with # prefix
    return `#${withoutHash.toLowerCase()}`;
  }
  
  return undefined;
}

export function mapResolutionToTradingView(resolution: EmbedResolution): string {
  const mapping: Record<EmbedResolution, string> = {
    '1s': '1S',
    '5s': '5S',
    '15s': '15S',
    '30s': '30S',
    '1minute': '1',
    '5minute': '5',
    '15minute': '15',
    '1hour': '60',
    '1day': '1D',
    '1week': '1W',
    '1month': '1M',
  };
  return mapping[resolution];
}

export function validateEmbedParams(searchParams: URLSearchParams): EmbedConfig | null {
  // embed=1 is mandatory
  const embed = searchParams.get('embed');
  if (embed !== '1') {
    return null;
  }

  // Resolution: 1s,5s,15s,30s,1minute,5minute,15minute,1hour,1day,1week,1month (default: 1hour)
  const resolutionParam = searchParams.get('resolution');
  const resolution: EmbedResolution = resolutionParam && ALLOWED_RESOLUTIONS.includes(resolutionParam as EmbedResolution)
    ? (resolutionParam as EmbedResolution)
    : '1hour';

  // Chart type: price | mc | volume (default: price)
  const chartTypeParam = searchParams.get('chart_type');
  const chartType: EmbedChartType = chartTypeParam && ALLOWED_CHART_TYPES.includes(chartTypeParam as EmbedChartType)
    ? (chartTypeParam as EmbedChartType)
    : 'price';

  const themeParam = searchParams.get('theme');
  const theme: EmbedTheme | undefined = themeParam && ALLOWED_THEMES.includes(themeParam as EmbedTheme)
    ? (themeParam as EmbedTheme)
    : undefined;

  const bgColorParam = searchParams.get('bg_color');
  let bgColor: string;
  if (bgColorParam) {
    bgColor = sanitizeHexColor(bgColorParam) || THEME_COLORS.Navy;
  } else if (theme) {
    bgColor = THEME_COLORS[theme];
  } else {
    bgColor = THEME_COLORS.Navy;
  }

  const candleUpColor = sanitizeHexColor(searchParams.get('candle_up_color') || undefined);
  const candleDownColor = sanitizeHexColor(searchParams.get('candle_down_color') || undefined);

  return {
    resolution,
    chartType,
    theme,
    bgColor,
    candleUpColor,
    candleDownColor,
  };
}


export function getThemeFromBgColor(bgColor?: string): 'light' | 'dark' {
  if (!bgColor) return 'dark';
  return isLightColor(bgColor) ? 'light' : 'dark';
}

