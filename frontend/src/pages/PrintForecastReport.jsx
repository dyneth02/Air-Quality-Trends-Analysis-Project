import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from 'recharts'
import { useState, useEffect } from 'react'
import { generateLlmForecastReport } from '../api'

const fmtPM = (v) => (v == null || isNaN(v) ? "-" : `${Number(v).toFixed(2)} µg/m³`)

export default function PrintForecastReport() {
    const location = useLocation()
    const navigate = useNavigate()

    // Get forecast data from navigation state
    const forecastData = location.state?.forecastData
    const chartData = location.state?.chartData
    const cities = location.state?.cities
    const horizonDays = location.state?.horizonDays
    const trainDays = location.state?.trainDays
    const showCI = location.state?.showCI
    const showCombined = location.state?.showCombined
    const selectedModel = location.state?.selectedModel

    // LLM Report state
    const [llmReport, setLlmReport] = useState(null)
    const [isGeneratingReport, setIsGeneratingReport] = useState(false)
    const [reportError, setReportError] = useState(null)

    // If no data, redirect back to workspace
    if (!forecastData) {
        navigate('/workspace')
        return null
    }

    // Function to call the backend endpoint for LLM report generation
    const generateLlmReport = async () => {
        setIsGeneratingReport(true)
        setReportError(null)
        
        try {
            const reportPayload = {
                forecastData,
                chartData,
                cities,
                horizonDays,
                trainDays,
                showCI,
                showCombined,
                selectedModel
            }
            
            const response = await generateLlmForecastReport(reportPayload)
            setLlmReport(response)
        } catch (error) {
            console.error('Error generating LLM report:', error)
            setReportError(error.response?.data?.detail || 'Failed to generate LLM report')
        } finally {
            setIsGeneratingReport(false)
        }
    }

    // Generate LLM report when component mounts
    useEffect(() => {
        generateLlmReport()
    }, [])

    const handlePrint = () => {
        window.print()
    }

    const handleBack = () => {
        navigate('/workspace')
    }

    // Generate current date
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    })

    // Get individual charts data
    const individualCharts = chartData?.individual ? Object.entries(chartData.individual) : []
    
    // Debug: Log the data structure
    console.log('🔍 PrintForecastReport Debug:')
    console.log('  chartData:', chartData)
    console.log('  chartData.individual:', chartData?.individual)
    console.log('  individualCharts:', individualCharts)
    console.log('  forecastData:', forecastData)

    // Function to calculate forecast table data
    const getForecastTableData = (cityData, cityName) => {
        if (!cityData || !Array.isArray(cityData) || cityData.length === 0 || !forecastData.summary[cityName]) return []

        const averageForecast = forecastData.summary[cityName].mean_yhat

        return cityData.map((entry, index) => {
            const deviation = entry.yhat - averageForecast
            
            // Format the timestamp to show day and time
            let timeLabel = `Day ${index + 1}`;
            if (entry.ts) {
                try {
                    const date = new Date(entry.ts);
                    const dayNumber = Math.floor(index / 24) + 1;
                    const hour = date.getHours();
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour % 12 || 12;
                    const timeStr = `${hour12}:${date.getMinutes().toString().padStart(2, '0')} ${ampm}`;
                    timeLabel = `Day ${dayNumber} @ ${timeStr}`;
                } catch (e) {
                    // Fallback to original format if timestamp parsing fails
                    timeLabel = `Day ${index + 1}`;
                }
            }
            
            return {
                day: timeLabel,
                forecast: entry.yhat,
                lowerBound: entry.yhat_lower || entry.yhat,
                upperBound: entry.yhat_upper || entry.yhat,
                deviation: deviation,
                deviationFormatted: `${deviation >= 0 ? '+' : ''}${deviation.toFixed(2)} µg/m³`
            }
        })
    }

    // Get model display name
    const getModelDisplayName = (model) => {
        const models = {
            'sarimax': 'SARIMAX (Fast, Lightweight)',
            'prophet': 'Prophet (Heavy, Powerful)'
        }
        return models[model] || 'Unknown Model'
    }

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white w-screen">
            {/* Header - Only visible on screen */}
            <div className="bg-gradient-to-r from-green-600 to-cyan-600 text-white p-6 print:hidden">
                <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleBack}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm flex items-center space-x-2"
                        >
                            <span>←</span>
                            <span>Back to Workspace</span>
                        </button>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="text-right">
                            <h1 className="text-3xl font-bold">AirSense</h1>
                            <p className="text-green-100 text-lg">AI Forecast Report</p>
                        </div>
                        <button
                            onClick={handlePrint}
                            className="px-6 py-3 bg-white text-green-600 hover:bg-gray-100 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2"
                        >
                            <span>📄</span>
                            <span>Download Report</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Report Content */}
            <div className="w-full max-w-7xl mx-auto p-6 print:p-0 print:max-w-none print:bg-white">
                {/* ===== PAGE 1: Cover + Executive Summary + Detailed Statistics ===== */}
                <div className="print:min-h-screen print:flex print:flex-col">
                    {/* Cover Section */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 mb-6 print:shadow-none print:rounded-none print:p-6 print:mb-4">
                        <div className="text-center">
                            <div className="flex items-center justify-center mb-6 print:mb-4">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-r from-green-500 to-cyan-600 flex items-center justify-center mr-4 print:w-16 print:h-16">
                                    <svg className="w-10 h-10 text-white print:w-8 print:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-5xl font-bold bg-gradient-to-r from-green-400 to-cyan-400 bg-clip-text text-transparent print:text-4xl print:text-black">
                                        AirSense
                                    </h1>
                                    <p className="text-gray-600 mt-1 text-xl print:text-lg">AI-Powered Air Quality Forecasting</p>
                                </div>
                            </div>

                            <div className="border-t border-b border-gray-200 py-6 my-6 print:py-4 print:my-4">
                                <h2 className="text-4xl font-bold text-gray-800 mb-3 print:text-3xl">
                                    AI Forecast Analysis Report
                                </h2>
                                <p className="text-gray-600 text-xl print:text-lg">
                                    Predictive air quality analysis using {getModelDisplayName(selectedModel)}
                                </p>
                            </div>

                            <div className="flex justify-center items-center space-x-8 text-gray-600 text-lg print:text-base print:space-x-6">
                                <div className="flex items-center space-x-2">
                                    <span>📅</span>
                                    <span>Generated on {currentDate}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span>🔮</span>
                                    <span>Forecast horizon: {horizonDays} days</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <span>🏙️</span>
                                    <span>{cities?.length || 0} cities forecasted</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Executive Summary */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 print:shadow-none print:rounded-none print:p-4 print:mb-4">
                        <h3 className="text-3xl font-bold text-gray-800 mb-6 print:text-2xl">Executive Summary</h3>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 print:mb-4">
                            <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-emerald-600 text-xl font-semibold mb-2 print:text-lg">BEST FORECAST</div>
                                        <div className="text-3xl font-bold text-gray-800 print:text-2xl">{forecastData.best}</div>
                                        <div className="text-emerald-600 text-base print:text-sm mt-2">Most favorable air quality outlook</div>
                                    </div>
                                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center print:w-14 print:h-14">
                                        <span className="text-white text-2xl print:text-xl">📈</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-amber-600 text-xl font-semibold mb-2 print:text-lg">CHALLENGING FORECAST</div>
                                        <div className="text-3xl font-bold text-gray-800 print:text-2xl">{forecastData.worst}</div>
                                        <div className="text-amber-600 text-base print:text-sm mt-2">Requires monitoring and action</div>
                                    </div>
                                    <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center print:w-14 print:h-14">
                                        <span className="text-white text-2xl print:text-xl">📉</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-6 print:p-4">
                            <h4 className="font-semibold text-gray-800 mb-3 text-xl print:text-lg">Forecast Overview</h4>
                            <div className="grid grid-cols-4 gap-6 print:gap-4">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600 print:text-2xl">{cities?.length || 0}</div>
                                    <div className="text-gray-600 text-base print:text-sm">Cities Forecasted</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600 print:text-2xl">{horizonDays}</div>
                                    <div className="text-gray-600 text-base print:text-sm">Forecast Days</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600 print:text-2xl">{trainDays}</div>
                                    <div className="text-gray-600 text-base print:text-sm">Training Days</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600 print:text-2xl">
                                        {Object.values(forecastData.summary || {}).reduce((acc, city) => acc + (city.n_points || 0), 0)}
                                    </div>
                                    <div className="text-gray-600 text-base print:text-sm">Forecast Points</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Statistics */}
                    <div className="bg-white rounded-2xl shadow-xl p-6 flex-1 print:shadow-none print:rounded-none print:p-4">
                        <h3 className="text-3xl font-bold text-gray-800 mb-6 print:text-2xl">Detailed Forecast Statistics</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4">
                            {Object.entries(forecastData.summary || {}).map(([city, stats]) => (
                                <div
                                    key={city}
                                    className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-lg p-6 print:p-4"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-gray-800 text-xl print:text-lg">{city}</h4>
                                        <div className={`w-4 h-4 rounded-full ${
                                            city === forecastData.best ? 'bg-emerald-500' :
                                                city === forecastData.worst ? 'bg-amber-500' :
                                                    'bg-green-500'
                                        }`} />
                                    </div>

                                    <div className="space-y-3 print:space-y-2">
                                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                                            <span className="text-gray-600 text-base print:text-sm">Average Forecast</span>
                                            <span className="font-semibold text-gray-800 text-base print:text-sm">{fmtPM(stats.mean_yhat)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                                            <span className="text-gray-600 text-base print:text-sm">Forecast Points</span>
                                            <span className="font-semibold text-gray-800 text-base print:text-sm">{stats.n_points}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-600 text-base print:text-sm">Model Used</span>
                                            <div className="text-right">
                                                <div className="font-semibold text-gray-800 text-base print:text-sm">
                                                    {getModelDisplayName(selectedModel)}
                                                </div>
                                                <div className="text-gray-500 text-sm print:text-xs">
                                                    AI Prediction
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ===== CHART PAGES: One chart + table per page ===== */}
                {individualCharts.map(([cityName, chartData], index) => {
                    // Debug: Log each city's data
                    console.log(`📊 Processing ${cityName}:`, chartData)
                    
                    // Ensure chartData is a valid array
                    const validChartData = Array.isArray(chartData) && chartData.length > 0
                        ? chartData.map(item => ({
                            ts: item.ts,
                            yhat: Number(item.yhat ?? item.y ?? 0),
                            yhat_lower: Math.max(0, Number(item.yhat_lower ?? item.lower ?? item.yhat ?? 0)),
                            yhat_upper: Math.max(0, Number(item.yhat_upper ?? item.upper ?? item.yhat ?? 0))
                        }))
                        : []
                    
                    console.log(`📈 Valid chart data for ${cityName}:`, validChartData)
                    
                    const tableData = getForecastTableData(validChartData, cityName)
                    const cityStats = forecastData.summary[cityName]

                    return (
                        <div key={cityName} className="print:break-before-page print:min-h-screen print:flex print:flex-col print:justify-start print:py-4">
                            <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 print:shadow-none print:rounded-none print:p-6 print:mb-0 print:h-full print:flex print:flex-col">
                                <h3 className="text-3xl font-bold text-gray-800 mb-6 print:text-2xl print:text-center">
                                    AI Forecast Analysis: {cityName}
                                </h3>

                                {/* Chart Section - Reduced height */}
                                <div className="mb-6 print:mb-4 flex-shrink-0">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-2xl font-semibold text-gray-700 print:text-xl">
                                            PM2.5 Forecast Trend
                                        </h4>
                                        <div className={`px-4 py-2 rounded-full text-lg font-semibold print:text-base ${
                                            cityName === forecastData.best ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                                cityName === forecastData.worst ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                                    'bg-green-100 text-green-800 border border-green-300'
                                        }`}>
                                            {cityName === forecastData.best ? 'Best Forecast' :
                                                cityName === forecastData.worst ? 'Challenging Forecast' : 'Average Forecast'}
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 print:p-3">
                                        {validChartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height={300} className="print:h-64">
                                                <LineChart data={validChartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                                                <XAxis
                                                    dataKey="ts"
                                                    tick={{ fontSize: 14, fill: "#374151", fontWeight: 'bold' }}
                                                    axisLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                                                    height={40}
                                                />
                                                <YAxis
                                                    tick={{ fontSize: 14, fill: "#374151", fontWeight: 'bold' }}
                                                    axisLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                                                    tickFormatter={(v) => `${v} µg/m³`}
                                                    width={60}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: '#F9FAFB',
                                                        border: '1px solid #D1D5DB',
                                                        borderRadius: '8px',
                                                        color: '#374151',
                                                        fontSize: '16px',
                                                        fontWeight: 'bold'
                                                    }}
                                                    formatter={(value, name) => [`${value} µg/m³`, name]}
                                                />
                                                {showCI && (
                                                    <>
                                                        <Line
                                                            type="monotone"
                                                            dataKey="yhat_upper"
                                                            stroke={cityName === forecastData.best ? '#10B981' :
                                                                cityName === forecastData.worst ? '#F59E0B' : '#3B82F6'}
                                                            strokeDasharray="4 3"
                                                            opacity={0.7}
                                                            dot={false}
                                                        />
                                                        <Line
                                                            type="monotone"
                                                            dataKey="yhat_lower"
                                                            stroke={cityName === forecastData.best ? '#10B981' :
                                                                cityName === forecastData.worst ? '#F59E0B' : '#3B82F6'}
                                                            strokeDasharray="4 3"
                                                            opacity={0.4}
                                                            dot={false}
                                                        />
                                                    </>
                                                )}
                                                <Line
                                                    type="monotone"
                                                    dataKey="yhat"
                                                    stroke={cityName === forecastData.best ? '#10B981' :
                                                        cityName === forecastData.worst ? '#F59E0B' : '#3B82F6'}
                                                    strokeWidth={3}
                                                    dot={false}
                                                    activeDot={{ r: 4, strokeWidth: 1 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                        ) : (
                                            <div className="flex items-center justify-center h-64 text-gray-500">
                                                <div className="text-center">
                                                    <div className="text-lg font-medium mb-2">No Forecast Data Available</div>
                                                    <div className="text-sm">Unable to generate chart for {cityName}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Data Table Section - Compact design */}
                                <div className="flex-1 print:mt-2">
                                    <h4 className="text-2xl font-semibold text-gray-700 mb-4 print:text-xl">
                                        Detailed Forecast Data with Confidence Intervals
                                    </h4>
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 print:p-3">
                                        {tableData.length > 0 ? (
                                            <>
                                                <div className="mb-4 flex justify-between items-center print:mb-3">
                                                    <div className="text-lg font-semibold text-gray-700 print:text-base">
                                                        Average Forecast: <span className="text-green-600">{fmtPM(cityStats?.mean_yhat)}</span>
                                                    </div>
                                                    <div className="text-sm text-gray-600 print:text-xs">
                                                        * Confidence intervals show prediction uncertainty
                                                    </div>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-base print:text-sm">
                                                <thead>
                                                <tr className="bg-gray-200">
                                                    <th className="px-4 py-3 text-left font-bold text-gray-700 border-b border-gray-300 print:px-3 print:py-2">
                                                        Day
                                                    </th>
                                                    <th className="px-4 py-3 text-left font-bold text-gray-700 border-b border-gray-300 print:px-3 print:py-2">
                                                        Forecast (µg/m³)
                                                    </th>
                                                    <th className="px-4 py-3 text-left font-bold text-gray-700 border-b border-gray-300 print:px-3 print:py-2">
                                                        Confidence Interval
                                                    </th>
                                                    <th className="px-4 py-3 text-left font-bold text-gray-700 border-b border-gray-300 print:px-3 print:py-2">
                                                        Deviation from Average
                                                    </th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {tableData.map((row, rowIndex) => (
                                                    <tr
                                                        key={rowIndex}
                                                        className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-100'}
                                                    >
                                                        <td className="px-4 py-3 border-b border-gray-200 font-semibold text-gray-700 print:px-3 print:py-2">
                                                            {row.day}
                                                        </td>
                                                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 print:px-3 print:py-2">
                                                            {row.forecast.toFixed(2)} µg/m³
                                                        </td>
                                                        <td className="px-4 py-3 border-b border-gray-200 text-gray-700 print:px-3 print:py-2">
                                                            {row.lowerBound.toFixed(2)} - {row.upperBound.toFixed(2)} µg/m³
                                                        </td>
                                                        <td className={`px-4 py-3 border-b border-gray-200 font-semibold print:px-3 print:py-2 ${
                                                            row.deviation > 0 ? 'text-red-600' :
                                                                row.deviation < 0 ? 'text-green-600' : 'text-gray-600'
                                                        }`}>
                                                            {row.deviationFormatted}
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                            </>
                                        ) : (
                                            <div className="text-center py-8 text-gray-500">
                                                <div className="text-lg font-medium mb-2">No Forecast Data Available</div>
                                                <div className="text-sm">Unable to generate forecast table for {cityName}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}

                {/* ===== LLM REPORT PAGE: AI-Generated Forecast Analysis ===== */}
                {llmReport && (
                    <div className="print:break-before-page print:min-h-screen print:flex print:flex-col print:justify-start print:py-4">
                        <div className="bg-white rounded-2xl shadow-xl p-8 print:shadow-none print:rounded-none print:p-6 print:h-full print:flex print:flex-col">
                            <h3 className="text-3xl font-bold text-gray-800 mb-6 print:text-2xl print:text-center">
                                {llmReport.report?.title || "AI-Generated Forecast Analysis"}
                            </h3>

                            {/* Executive Overview */}
                            <div className="mb-8 print:mb-6">
                                <h4 className="text-2xl font-semibold text-gray-700 mb-4 print:text-xl">Forecast Overview</h4>
                                <div className="bg-gradient-to-r from-green-50 to-cyan-50 rounded-lg p-6 border border-green-200 print:p-4">
                                    <p className="text-gray-700 text-lg leading-relaxed print:text-base">
                                        {llmReport.report?.executiveOverview?.summary || "Analysis in progress..."}
                                    </p>
                                </div>
                            </div>

                            {/* Forecast Performance Analysis */}
                            <div className="mb-8 print:mb-6">
                                <h4 className="text-2xl font-semibold text-gray-700 mb-4 print:text-xl">Forecast Performance Analysis</h4>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:gap-4">
                                    {/* Best Forecast */}
                                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border border-emerald-200 print:p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <div className="text-emerald-600 text-lg font-semibold mb-2 print:text-base">
                                                    {llmReport.report?.forecastPerformance?.bestForecast?.icon} BEST FORECAST
                                                </div>
                                                <div className="text-2xl font-bold text-gray-800 print:text-xl">
                                                    {llmReport.report?.forecastPerformance?.bestForecast?.city}
                                                </div>
                                                <div className="text-emerald-600 text-lg font-semibold print:text-base">
                                                    {llmReport.report?.forecastPerformance?.bestForecast?.averageForecast}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-gray-700 text-sm print:text-xs">
                                            {llmReport.report?.forecastPerformance?.bestForecast?.forecastImplications}
                                        </p>
                                    </div>

                                    {/* Challenging Forecast */}
                                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200 print:p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <div className="text-amber-600 text-lg font-semibold mb-2 print:text-base">
                                                    {llmReport.report?.forecastPerformance?.challengingForecast?.icon} CHALLENGING FORECAST
                                                </div>
                                                <div className="text-2xl font-bold text-gray-800 print:text-xl">
                                                    {llmReport.report?.forecastPerformance?.challengingForecast?.city}
                                                </div>
                                                <div className="text-amber-600 text-lg font-semibold print:text-base">
                                                    {llmReport.report?.forecastPerformance?.challengingForecast?.averageForecast}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-gray-700 text-sm print:text-xs">
                                            {llmReport.report?.forecastPerformance?.challengingForecast?.forecastRisks}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Model Performance Insights */}
                            <div className="mb-8 print:mb-6">
                                <h4 className="text-2xl font-semibold text-gray-700 mb-4 print:text-xl">Model Performance Insights</h4>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:gap-4">
                                    {/* Model Accuracy */}
                                    <div className="bg-gray-50 rounded-lg p-6 print:p-4">
                                        <h5 className="text-lg font-semibold text-gray-700 mb-4 print:text-base">Model Accuracy Assessment</h5>
                                        <div className="space-y-3 print:space-y-2">
                                            <div>
                                                <div className="font-semibold text-gray-600 text-sm print:text-xs">Confidence Level:</div>
                                                <div className="text-gray-700 text-sm print:text-xs">
                                                    {llmReport.report?.modelPerformance?.confidenceLevel}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-600 text-sm print:text-xs">Prediction Reliability:</div>
                                                <div className="text-gray-700 text-sm print:text-xs">
                                                    {llmReport.report?.modelPerformance?.predictionReliability}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-600 text-sm print:text-xs">Model Type:</div>
                                                <div className="text-gray-700 text-sm print:text-xs">
                                                    {llmReport.report?.modelPerformance?.modelType}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Forecast Trends */}
                                    <div className="bg-gray-50 rounded-lg p-6 print:p-4">
                                        <h5 className="text-lg font-semibold text-gray-700 mb-4 print:text-base">Forecast Trends & Patterns</h5>
                                        <ul className="space-y-2 print:space-y-1">
                                            {llmReport.report?.forecastTrends?.patterns?.map((pattern, index) => (
                                                <li key={index} className="flex items-start text-sm print:text-xs">
                                                    <span className="text-blue-500 mr-2 print:mr-1">•</span>
                                                    <span className="text-gray-700">{pattern}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Health Impact Forecast */}
                            <div className="mb-8 print:mb-6">
                                <h4 className="text-2xl font-semibold text-gray-700 mb-4 print:text-xl">Health Impact Forecast</h4>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:gap-4">
                                    {/* Short-term Health Risks */}
                                    <div className="bg-red-50 rounded-lg p-6 border border-red-200 print:p-4">
                                        <h5 className="text-lg font-semibold text-red-700 mb-4 print:text-base">Short-term Health Risks</h5>
                                        <div className="space-y-3 print:space-y-2">
                                            <div>
                                                <div className="font-semibold text-red-600 text-sm print:text-xs">High Risk Areas:</div>
                                                <div className="text-gray-700 text-sm print:text-xs">
                                                    {llmReport.report?.healthImpact?.shortTermRisks?.highRiskAreas}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="font-semibold text-red-600 text-sm print:text-xs">Vulnerable Groups:</div>
                                                <div className="text-gray-700 text-sm print:text-xs">
                                                    {llmReport.report?.healthImpact?.shortTermRisks?.vulnerableGroups}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Long-term Health Implications */}
                                    <div className="bg-orange-50 rounded-lg p-6 border border-orange-200 print:p-4">
                                        <h5 className="text-lg font-semibold text-orange-700 mb-4 print:text-base">Long-term Health Implications</h5>
                                        <ul className="space-y-2 print:space-y-1">
                                            {llmReport.report?.healthImpact?.longTermImplications?.map((implication, index) => (
                                                <li key={index} className="flex items-start text-sm print:text-xs">
                                                    <span className="text-orange-500 mr-2 print:mr-1">•</span>
                                                    <span className="text-gray-700">{implication}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Forecast Recommendations */}
                            <div className="mb-8 print:mb-6">
                                <h4 className="text-2xl font-semibold text-gray-700 mb-4 print:text-xl">Forecast-Based Recommendations</h4>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:gap-4">
                                    {/* Immediate Actions */}
                                    <div className="bg-blue-50 rounded-lg p-6 border border-blue-200 print:p-4">
                                        <h5 className="text-lg font-semibold text-blue-700 mb-4 print:text-base">Immediate Actions</h5>
                                        <ul className="space-y-2 print:space-y-1">
                                            {llmReport.report?.recommendations?.immediateActions?.map((action, index) => (
                                                <li key={index} className="flex items-start text-sm print:text-xs">
                                                    <span className="text-blue-500 mr-2 print:mr-1">•</span>
                                                    <span className="text-gray-700">{action}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Long-term Planning */}
                                    <div className="bg-purple-50 rounded-lg p-6 border border-purple-200 print:p-4">
                                        <h5 className="text-lg font-semibold text-purple-700 mb-4 print:text-base">Long-term Planning</h5>
                                        <ul className="space-y-2 print:space-y-1">
                                            {llmReport.report?.recommendations?.longTermPlanning?.map((plan, index) => (
                                                <li key={index} className="flex items-start text-sm print:text-xs">
                                                    <span className="text-purple-500 mr-2 print:mr-1">•</span>
                                                    <span className="text-gray-700">{plan}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            {/* Forecast Uncertainty Assessment */}
                            <div className="mb-8 print:mb-6">
                                <h4 className="text-2xl font-semibold text-gray-700 mb-4 print:text-xl">Forecast Uncertainty Assessment</h4>
                                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200 print:p-4">
                                    <p className="text-gray-700 text-lg leading-relaxed print:text-base">
                                        {llmReport.report?.uncertaintyAssessment?.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading State for LLM Report */}
                {isGeneratingReport && (
                    <div className="print:break-before-page print:min-h-screen print:flex print:flex-col print:justify-center print:items-center">
                        <div className="bg-white rounded-2xl shadow-xl p-8 print:shadow-none print:rounded-none print:p-6 print:h-full print:flex print:flex-col print:justify-center print:items-center">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-6 print:w-12 print:h-12">
                                    <div className="w-full h-full border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 print:text-xl">Generating AI Forecast Analysis</h3>
                                <p className="text-gray-600 text-lg print:text-base">
                                    Our AI is analyzing the forecast data and generating comprehensive insights...
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error State for LLM Report */}
                {reportError && (
                    <div className="print:break-before-page print:min-h-screen print:flex print:flex-col print:justify-center print:items-center">
                        <div className="bg-white rounded-2xl shadow-xl p-8 print:shadow-none print:rounded-none print:p-6 print:h-full print:flex print:flex-col print:justify-center print:items-center">
                            <div className="text-center">
                                <div className="w-16 h-16 mx-auto mb-6 print:w-12 print:h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <span className="text-red-500 text-2xl print:text-xl">⚠️</span>
                                </div>
                                <h3 className="text-2xl font-bold text-gray-800 mb-4 print:text-xl">AI Analysis Unavailable</h3>
                                <p className="text-gray-600 text-lg print:text-base mb-4">
                                    {reportError}
                                </p>
                                <button
                                    onClick={generateLlmReport}
                                    className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors print:hidden"
                                >
                                    Retry AI Analysis
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ===== FINAL PAGE: Report Complete ===== */}
                <div className="print:break-before-page print:min-h-screen print:flex print:flex-col print:justify-center print:items-center">
                    <div className="bg-gradient-to-r from-green-600 to-cyan-600 rounded-2xl p-12 print:rounded-none print:p-8 print:w-full print:h-full print:flex print:flex-col print:justify-center">
                        <div className="text-center text-white">
                            <div className="flex items-center justify-center mb-8 print:mb-6">
                                <div className="w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center mr-4 print:w-16 print:h-16">
                                    <svg className="w-10 h-10 text-white print:w-8 print:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                </div>
                                <h3 className="text-4xl font-bold print:text-3xl">Forecast Report Complete</h3>
                            </div>
                            <p className="text-green-100 text-xl mb-6 print:text-lg">
                                This AI-powered forecast analysis was generated by AirSense Air Quality Intelligence Platform
                            </p>
                            <div className="text-green-200 text-base print:text-sm">
                                <p>For real-time monitoring and advanced analytics, visit the AirSense platform</p>
                                <p className="mt-3 print:mt-2">Report generated on {currentDate} | Forecast horizon: {horizonDays} days | Model: {getModelDisplayName(selectedModel)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Enhanced Print Styles */}
            <style jsx>{`
                @media print {
                    @page {
                        margin: 0.5cm;
                        size: A4;
                    }

                    body {
                        margin: 0;
                        padding: 0;
                        background: white !important;
                        font-family: 'Inter', 'Segoe UI', sans-serif;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .print\\:break-before-page {
                        page-break-before: always;
                        break-before: page;
                    }

                    .print\\:min-h-screen {
                        min-height: 100vh;
                    }

                    .print\\:hidden {
                        display: none !important;
                    }

                    .print\\:bg-white {
                        background: white !important;
                    }

                    /* Ensure colors print correctly */
                    .bg-gradient-to-r {
                        background-image: none !important;
                    }

                    .from-green-600 {
                        background-color: #059669 !important;
                    }

                    .to-cyan-600 {
                        background-color: #0891b2 !important;
                    }

                    .bg-gradient-to-br {
                        background-image: none !important;
                    }

                    .from-emerald-50 {
                        background-color: #ecfdf5 !important;
                    }

                    .to-green-50 {
                        background-color: #f0fdf4 !important;
                    }

                    .from-amber-50 {
                        background-color: #fffbeb !important;
                    }

                    .to-orange-50 {
                        background-color: #fff7ed !important;
                    }

                    /* Larger typography scaling for print */
                    .print\\:text-4xl {
                        font-size: 2rem !important;
                        line-height: 1.2 !important;
                    }

                    .print\\:text-3xl {
                        font-size: 1.75rem !important;
                        line-height: 1.3 !important;
                    }

                    .print\\:text-2xl {
                        font-size: 1.5rem !important;
                        line-height: 1.3 !important;
                    }

                    .print\\:text-xl {
                        font-size: 1.25rem !important;
                        line-height: 1.4 !important;
                    }

                    .print\\:text-lg {
                        font-size: 1.125rem !important;
                        line-height: 1.4 !important;
                    }

                    .print\\:text-base {
                        font-size: 1rem !important;
                        line-height: 1.5 !important;
                    }

                    .print\\:text-sm {
                        font-size: 0.875rem !important;
                        line-height: 1.5 !important;
                    }

                    .print\\:text-xs {
                        font-size: 0.75rem !important;
                        line-height: 1.5 !important;
                    }

                    /* Layout adjustments */
                    .print\\:p-3 {
                        padding: 0.75rem !important;
                    }

                    .print\\:p-4 {
                        padding: 1rem !important;
                    }

                    .print\\:p-6 {
                        padding: 1.5rem !important;
                    }

                    .print\\:p-8 {
                        padding: 2rem !important;
                    }

                    .print\\:mb-0 {
                        margin-bottom: 0 !important;
                    }

                    .print\\:mb-2 {
                        margin-bottom: 0.5rem !important;
                    }

                    .print\\:mb-3 {
                        margin-bottom: 0.75rem !important;
                    }

                    .print\\:mb-4 {
                        margin-bottom: 1rem !important;
                    }

                    .print\\:mt-2 {
                        margin-top: 0.5rem !important;
                    }

                    /* Chart sizing */
                    .print\\:h-64 {
                        height: 16rem !important;
                    }

                    /* Full width/height for final page */
                    .print\\:w-full {
                        width: 100% !important;
                    }

                    .print\\:h-full {
                        height: 100% !important;
                    }

                    /* Remove shadows for print */
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }

                    .print\\:rounded-none {
                        border-radius: 0 !important;
                    }

                    .print\\:text-center {
                        text-align: center !important;
                    }

                    /* Table cell padding */
                    .print\\:px-3 {
                        padding-left: 0.75rem !important;
                        padding-right: 0.75rem !important;
                    }

                    .print\\:py-2 {
                        padding-top: 0.5rem !important;
                        padding-bottom: 0.5rem !important;
                    }

                    /* Ensure proper spacing */
                    .print\\:py-4 {
                        padding-top: 1rem !important;
                        padding-bottom: 1rem !important;
                    }

                    /* Flex layout for chart pages */
                    .print\\:flex-col {
                        flex-direction: column !important;
                    }

                    .print\\:justify-start {
                        justify-content: flex-start !important;
                    }

                    .print\\:flex-shrink-0 {
                        flex-shrink: 0 !important;
                    }

                    .print\\:flex-1 {
                        flex: 1 1 0% !important;
                    }
                }

                /* Screen-only styles */
                @media screen {
                    .print\\:break-before-page {
                        page-break: auto;
                    }
                }
            `}</style>
        </div>
    )
}

