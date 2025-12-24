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
  'paneProperties.background': '#0F1016',
  'paneProperties.backgroundType': 'solid',
  'paneProperties.vertGridProperties.color': '#22242D',
  'paneProperties.horzGridProperties.color': '#22242D',
  'paneProperties.crossHairProperties.color': '#2A2E39',

  // === LEGEND ===
  'paneProperties.legendProperties.showLegend': true,
  'paneProperties.legendProperties.showStudyTitles': true,
  'paneProperties.legendProperties.showSeriesTitle': true,
  'paneProperties.legendProperties.showStudyValues': true,

  // === SCALES ===
  'scalesProperties.backgroundColor': '#121319',
  'scalesProperties.lineColor': '#2A2E39',
  'scalesProperties.textColor': '#8C8F9D',
  'scalesProperties.fontSize': 11,
  'scalesProperties.showSeriesLastValue': true,
  'priceScaleProperties.showSeriesLastValue': true,

  // === SYMBOL WATERMARK ===
  'symbolWatermarkProperties.visibility': false,

  // === TIME SCALE ===
  'timeScale.rightOffset': 5,
  'timeScale.barSpacing': 6,
  'timeScale.borderColor': '#2A2E39',
  'timeScale.visible': true,
});
