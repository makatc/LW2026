'use client';
import { useDossier } from '@/context/DossierContext';
import ProjectSelector from '@/components/panels/ProjectSelector';
import LeftPanel from '@/components/panels/LeftPanel';
import CenterPanel from '@/components/panels/CenterPanel';
import RightPanel from '@/components/panels/RightPanel';

export default function DossierPage() {
  const { activeProject, rightPanelOpen } = useDossier();

  if (!activeProject) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center pt-10 pb-10 overflow-y-auto">
        <ProjectSelector />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-[#F5F6FA]">
      <LeftPanel />
      <CenterPanel />
      {rightPanelOpen && <RightPanel />}
    </div>
  );
}
