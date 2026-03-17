'use client';

import MorningBriefing from '@/components/dashboard/MorningBriefing';
import FombRiskMeter from '@/components/dashboard/FombRiskMeter';
import FiscalIntelligenceFeed from '@/components/dashboard/FiscalIntelligenceFeed';

export default function InteligenciaFiscalPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2/3: Morning Briefing */}
        <div className="lg:col-span-2">
          <MorningBriefing />
        </div>

        {/* Right 1/3: FOMB Risk Meter */}
        <div className="lg:col-span-1">
          <FombRiskMeter />
        </div>

        {/* Full width: Feed */}
        <div className="lg:col-span-3">
          <FiscalIntelligenceFeed />
        </div>
      </div>
    </div>
  );
}
