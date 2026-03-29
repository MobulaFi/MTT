export const overrides = () => ({
  // === CANDLE STYLE PROPERTIES ===
  'mainSeriesProperties.candleStyle.upColor': '#0ECB81',
  'mainSeriesProperties.candleStyle.downColor': '#EA3943',
  'mainSeriesProperties.candleStyle.borderUpColor': '#0ECB81',
  'mainSeriesProperties.candleStyle.borderDownColor': '#EA3943',
  'mainSeriesProperties.candleStyle.wickUpColor': '#0ECB81',
  'mainSeriesProperties.candleStyle.wickDownColor': '#EA3943',
  'mainSeriesProperties.candleStyle.drawWick': true,
  'mainSeriesProperties.candleStyle.drawBorder': true,

  // === PANE BACKGROUND & GRID ===
  'paneProperties.background': '#0A0A0A',
  'paneProperties.backgroundType': 'solid',
  'paneProperties.vertGridProperties.color': '#141414',
  'paneProperties.horzGridProperties.color': '#141414',
  'paneProperties.crossHairProperties.color': '#1E1E1E',

  // === LEGEND ===
  'paneProperties.legendProperties.showLegend': true,
  'paneProperties.legendProperties.showStudyTitles': true,
  'paneProperties.legendProperties.showSeriesTitle': true,
  'paneProperties.legendProperties.showStudyValues': true,

  // === SCALES ===
  'scalesProperties.backgroundColor': '#0A0A0A',
  'scalesProperties.lineColor': '#1A1A1A',
  'scalesProperties.textColor': '#606060',
  'scalesProperties.fontSize': 11,
  'scalesProperties.showSeriesLastValue': true,
  'priceScaleProperties.showSeriesLastValue': true,

  // === SYMBOL WATERMARK ===
  'symbolWatermarkProperties.visibility': false,

  // === TIME SCALE ===
  'timeScale.rightOffset': 5,
  'timeScale.barSpacing': 6,
  'timeScale.borderColor': '#1A1A1A',
  'timeScale.visible': true,
});
