'use client';

import dynamic from 'next/dynamic';

// Code-split heavy modals and driver.js tour out of the critical initial bundle path.
// This trims ~35-45 KB from the initial page hydration.
const ProblemModal = dynamic(() => import('@/components/ProblemModal'), { ssr: false });
const GuestGateModal = dynamic(() => import('@/components/GuestGateModal'), { ssr: false });
const SyncHistoryModal = dynamic(() => import('@/components/SyncHistoryModal'), { ssr: false });
const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false });

export default function GlobalModals() {
  return (
    <>
      <ProblemModal />
      <GuestGateModal />
      <SyncHistoryModal />
      <OnboardingTour />
    </>
  );
}
