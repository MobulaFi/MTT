// import type { ResolutionString } from '../../../../public/static/charting_library/charting_library/';

import type { ResolutionString } from '../../../public/static/charting_library/charting_library';
import type { ReactNode } from 'react';
export const ENABLED_FEATURES = ['show_spread_operators', 'header_resolutions', 'seconds_resolution', 'left_toolbar' , 'create_volume_indicator_by_default_once'];

export const DISABLED_FEATURES = [
  'symbol_info',
  'volume_force_overlay',
  'symbol_search_hot_key',

  'display_market_status',
  'compare_symbol',
  'show_interval_dialog_on_key_press',
  // "header_widget",
  // "header_settings",
  'header_undo_redo',
  // "header_screenshot",
  // "header_saveload",
];

export const timeframes = {
  '1s': '1S',
  '5s': '5S',
  '15s': '15S',
  '30s': '30S',
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
};

export const CHART_TYPES = {
  BARS: 0,
  CANDLES: 1,
  LINE: 2,
  AREA: 3,
  HEIKIN_ASHI: 8,
  HOLLOW_CANDLES: 9,
  BASELINE: 10,
};

export interface ChartTypeOption {
  value: number;
  label: string;
  icon?: ReactNode;
}

export const chartTypeOptions: ChartTypeOption[] = [
  {
    value: CHART_TYPES.BARS,
    label: 'Bars',
  },
  {
    value: CHART_TYPES.CANDLES,
    label: 'Candles',
  },
  {
    value: CHART_TYPES.HOLLOW_CANDLES,
    label: 'Hollow candles',
  },
  {
    value: CHART_TYPES.LINE,
    label: 'Line',
  },
  {
    value: CHART_TYPES.AREA,
    label: 'Area',
  },
  {
    value: CHART_TYPES.BASELINE,
    label: 'Baseline',
  },
  {
    value: CHART_TYPES.HEIKIN_ASHI,
    label: 'Heikin-Ashi',
  },
];

export const showOrdersOptions: { label: string; key: string }[] = [
  {
    label: 'Position',
    key: 'position',
  },
  {
    label: 'Limit Order',
    key: 'limitOrder',
  },
  {
    label: 'TP/SL',
    key: 'tpSl',
  },
];

export const favorites = {
  intervals: [
    '1' as ResolutionString,
    '3' as ResolutionString,
    '5' as ResolutionString,
    '15' as ResolutionString,
    '30' as ResolutionString,
    '60' as ResolutionString,
    '120' as ResolutionString,
    '240' as ResolutionString,
    '1D' as ResolutionString,
    '1W' as ResolutionString,
    '1M' as ResolutionString,
  ],
  chartTypes: [],
};
