import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlassPanel from '../common/GlassPanel'
import DarkInputField from '../common/DarkInputField'
import AuroraButton from '../common/AuroraButton'
import GlowyKpi from '../common/GlowyKpi'
import { ComparisonIndividualCharts, ComparisonCombinedChart } from '../charts/ComparisonChart'
import { fmtPM } from '../../utils/formatters'
import ValidationModal from '../common/ValidationModal'

export default function ComparisonTab({ cmpInput, setCmpInput, cmpDays, setCmpDays, doCompare, cmpLoading, cmpRes, cmpChartData, cmpCombined, setCmpCombined, cmpCombinedData, cmpCities, agentOut, userPlan }) {
  const [showValidationModal, setShowValidationModal] = useState(false)
  const [validationData, setValidationData] = useState({})

  const getMaxDays = (plan) => {
    const limits = {
      free: 7,
      pro: 30,
      enterprise: 90
    }
    return limits[plan?.toLowerCase()] || limits.free
  }

  const handleDaysChange = (value) => {
    const maxAllowed = getMaxDays(userPlan)
    const newValue = +value

    if (newValue > maxAllowed) {
      setValidationData({
        currentValue: newValue,
        maxValue: maxAllowed,
        plan: userPlan,
        fieldName: 'Analysis Period (days)'
      })
      setShowValidationModal(true)
      return
    }

    setCmpDays(newValue)
  }
  const [reportLoading, setReportLoading] = useState(false)
  const navigate = useNavigate()
  return (
    <GlassPanel
      title="City Comparison Analysis"
      index={1}
      right={
        <label className="flex items-center gap-2 text-sm text-gray-400 bg-gray-800/50 px-3 py-2 rounded-lg">
          <input type="checkbox" checked={cmpCombined} onChange={(e) => setCmpCombined(e.target.checked)} className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500 bg-gray-700 border-gray-600" />
          Show Combined Chart
        </label>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <DarkInputField label="Cities (comma separated)" value={cmpInput} onChange={(e) => setCmpInput(e.target.value)} className="flex-1 min-w-[300px]" placeholder="Colombo,Kandy,Galle" />
          <DarkInputField label="Analysis Period (days)" type="number" value={cmpDays} onChange={(e) => handleDaysChange(e.target.value)} className="w-36" />
          <AuroraButton onClick={doCompare} disabled={cmpLoading} loading={cmpLoading} variant="secondary">
            Compare Cities
          </AuroraButton>
        </div>

        {cmpRes?.byCity && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              {Object.entries(cmpRes.byCity).map(([c, v]) => (
                <GlowyKpi key={c} label={c} value={v.mean_pm25 != null ? fmtPM(v.mean_pm25) : '-'} sub={`Samples: ${v.n_points} | Range: ${v.min_pm25 != null ? fmtPM(v.min_pm25) : '-'} - ${v.max_pm25 != null ? fmtPM(v.max_pm25) : '-'}`} />
              ))}
            </div>
            <div className="flex gap-6 text-sm font-medium mt-2">
              <span className="text-emerald-400">🏆 Best Air Quality: <strong>{cmpRes.best}</strong></span>
              <span className="text-amber-400">⚠️ Needs Improvement: <strong>{cmpRes.worst}</strong></span>
            </div>

            <div className="flex justify-end mt-4">
              <AuroraButton
                onClick={() => {
                  const cities = cmpInput.split(",").map(s => s.trim()).filter(Boolean);
                  if (!Array.isArray(cities) || cities.length === 0) {
                    alert("No cities to include in the report. Please run a comparison first.");
                    return;
                  }

                  // Prepare chart data for the report page
                  const chartData = {
                    individual: cmpChartData,
                    combined: cmpCombined && cmpCombinedData.length > 0 ? cmpCombinedData : null
                  };

                  // Navigate to the print report page with comparison data
                  navigate('/print-comparison-report', {
                    state: {
                      comparisonData: cmpRes,
                      chartData: chartData,
                      cities: cities,
                      periodDays: cmpDays,
                      showCombined: cmpCombined
                    }
                  });
                }}
                variant="secondary"
              >
                📄 Download PDF Report
              </AuroraButton>
            </div>

            {cmpCombined && (
              <div id="comparison-combined-chart">
                <ComparisonCombinedChart cmpCombinedData={cmpCombinedData} cmpCities={cmpCities} />
              </div>
            )}
            <div id="comparison-individual-charts">
            <ComparisonIndividualCharts cmpChartData={cmpChartData} />
            </div>
          </>
        )}
        {cmpRes?.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
            <div className="text-sm text-red-400">{cmpRes.error}</div>
          </div>
        )}
      </div>

      <ValidationModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="Plan Limit Exceeded"
        message={`You've entered ${validationData.currentValue} days, but your ${validationData.plan?.toLowerCase() || 'free'} plan only allows up to ${validationData.maxValue} days for analysis period. Please reduce the number of days or upgrade your plan for higher limits.`}
        currentValue={validationData.currentValue}
        maxValue={validationData.maxValue}
        plan={validationData.plan}
        fieldName={validationData.fieldName}
      />
    </GlassPanel>
  )
}


