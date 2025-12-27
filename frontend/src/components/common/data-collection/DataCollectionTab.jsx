import { useState } from 'react'
import GlassPanel from '../common/GlassPanel'
import DarkInputField from '../common/DarkInputField'
import AuroraButton from '../common/AuroraButton'
import DataChart from '../charts/DataChart'
import ValidationModal from '../common/ValidationModal'

export default function DataCollectionTab({ city, setCity, days, setDays, doScrape, scrapeLoading, scrapeRes, scrapeChartData, userPlan }) {
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
        fieldName: 'Days to Scrape'
      })
      setShowValidationModal(true)
      return
    }

    setDays(newValue)
  }
  return (
    <GlassPanel title="Data Collection" index={0}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <DarkInputField label="City Name" value={city} onChange={(e) => setCity(e.target.value)} className="flex-1 min-w-[200px]" placeholder="Enter city name" />
          <DarkInputField label="Days to Scrape" type="number" value={days} onChange={(e) => handleDaysChange(e.target.value)} className="w-32" />
          <AuroraButton onClick={doScrape} disabled={scrapeLoading} loading={scrapeLoading} variant="primary">
            Collect Data
          </AuroraButton>
        </div>

        {scrapeRes?.ok && (
          <>
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="text-sm text-emerald-400">
                ✅ Successfully collected data for <strong>{scrapeRes.city}</strong>
                {scrapeRes.lat && ` (📍 ${scrapeRes.lat.toFixed(3)}, ${scrapeRes.lon.toFixed(3)})`}
              </div>
            </div>
            <DataChart data={scrapeChartData} title={`PM2.5 Data for ${scrapeRes.city} (Past ${days} days)`} />
          </>
        )}
        {scrapeRes?.error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="text-sm text-red-400">{scrapeRes.error}</div>
          </div>
        )}
      </div>

      <ValidationModal
        isOpen={showValidationModal}
        onClose={() => setShowValidationModal(false)}
        title="Plan Limit Exceeded"
        message={`You've entered ${validationData.currentValue} days, but your ${validationData.plan?.toLowerCase() || 'free'} plan only allows up to ${validationData.maxValue} days for data scraping. Please reduce the number of days or upgrade your plan for higher limits.`}
        currentValue={validationData.currentValue}
        maxValue={validationData.maxValue}
        plan={validationData.plan}
        fieldName={validationData.fieldName}
      />
    </GlassPanel>
  )
}


