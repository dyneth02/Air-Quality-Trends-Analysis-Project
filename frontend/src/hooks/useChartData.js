export function buildForecastRows(byCity) {
  const rows = {}
  if (!byCity) return []
  for (const [city, series] of Object.entries(byCity)) {
    const arr = Array.isArray(series) ? series : []
    arr.forEach((p) => {
      const key = p.ts
      rows[key] = rows[key] || { ts: key }
      const y = Number(p.yhat ?? p.y)
      const loRaw = Number(p.yhat_lower ?? p.lower ?? y)
      const hiRaw = Number(p.yhat_upper ?? p.upper ?? y)
      const lo = Math.max(0, loRaw)
      const hi = Math.max(lo, hiRaw)
      rows[key][city] = y
      rows[key][`${city}_lo`] = lo
      rows[key][`${city}_hi`] = hi
    })
  }
  return Object.values(rows).sort((a, b) => a.ts.localeCompare(b.ts))
}

export function buildComparisonCombined(cmpChartData) {
  const cities = Object.keys(cmpChartData || {})
  if (cities.length === 0) return []
  const merged = {}
  cities.forEach((cityName) => {
    const series = cmpChartData[cityName] || []
    series.forEach((p) => {
      const key = p.ts
      if (!merged[key]) merged[key] = { ts: key }
      merged[key][cityName] = p.pm25
    })
  })
  return Object.values(merged).sort((a, b) => String(a.ts).localeCompare(String(b.ts)))
}


