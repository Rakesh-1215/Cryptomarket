export function buildForecastChartData(history = [], currentPrice = 0, predictedPrice = 0, horizon = 5) {
  if (!history.length) {
    return {
      series: [],
      historical: [],
      forecast: [],
      minValue: 0,
      maxValue: 0,
      range: 1,
    };
  }

  const historicalSeries = history.map((point, index) => ({
    ...point,
    index,
    type: "historical",
    price: Number(point.price) || 0,
  }));

  const latestPrice = Number(currentPrice) || historicalSeries.at(-1)?.price || 0;
  const targetPrice = Number(predictedPrice) || latestPrice;
  const futurePoints = [];
  const step = Math.max(1, horizon);

  for (let i = 1; i <= step; i += 1) {
    const fraction = i / (step + 1);
    const price = latestPrice + (targetPrice - latestPrice) * fraction;
    const date = new Date(history.at(-1)?.date || Date.now());
    date.setDate(date.getDate() + i);
    futurePoints.push({
      date: date.toISOString().slice(0, 10),
      price,
      type: "forecast",
      index: history.length + i - 1,
    });
  }

  const allSeries = [...historicalSeries, ...futurePoints];
  const values = allSeries.map((point) => point.price);
  const minValue = Math.min(...values, 0);
  const maxValue = Math.max(...values, 1);
  const range = maxValue - minValue || 1;

  const series = allSeries.map((point, index) => {
    const x = historicalSeries.length > 1
      ? (index / Math.max(allSeries.length - 1, 1)) * 100
      : 50;
    const y = 100 - ((point.price - minValue) / range) * 100;
    return { ...point, x, y };
  });

  return {
    series,
    historical: series.filter((point) => point.type === "historical"),
    forecast: series.filter((point) => point.type === "forecast"),
    minValue,
    maxValue,
    range,
  };
}

