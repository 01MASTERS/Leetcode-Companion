import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface TrackerState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;
  
  globalSearch: string;
  setGlobalSearch: (search: string) => void;
  
  dashboardSort: 'alphabetical' | 'most-complete' | 'least-complete' | 'most-remaining';
  setDashboardSort: (sort: 'alphabetical' | 'most-complete' | 'least-complete' | 'most-remaining') => void;
  
  dashboardFilter: 'all' | 'completed' | 'in-progress' | 'not-started';
  setDashboardFilter: (filter: 'all' | 'completed' | 'in-progress' | 'not-started') => void;
  
  selectedProblemId: number | null;
  setSelectedProblemId: (id: number | null) => void;
  
  // Custom Toast system
  toasts: Toast[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;

  // Guest Gate Modal
  guestGateOpen: boolean;
  guestGateReason: string;
  openGuestGate: (reason?: string) => void;
  closeGuestGate: () => void;

  // Catalog Sync History Audit Modal
  syncHistoryModalOpen: boolean;
  openSyncHistoryModal: () => void;
  closeSyncHistoryModal: () => void;

  // Onboarding Tour (Driver.js)
  tourRunning: boolean;
  startTour: () => void;
  stopTour: () => void;
}

export const useTrackerStore = create<TrackerState>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  
  globalSearch: '',
  setGlobalSearch: (search) => set({ globalSearch: search }),
  
  dashboardSort: 'most-complete',
  setDashboardSort: (sort) => set({ dashboardSort: sort }),
  
  dashboardFilter: 'all',
  setDashboardFilter: (filter) => set({ dashboardFilter: filter }),
  
  selectedProblemId: null,
  setSelectedProblemId: (id) => set({ selectedProblemId: id }),
  
  guestGateOpen: false,
  guestGateReason: 'Sign in with Google to sync your progress, save personal notes, and connect your LeetCode account across devices.',
  openGuestGate: (reason) =>
    set({
      guestGateOpen: true,
      guestGateReason:
        reason ||
        'Sign in with Google to sync your progress, save personal notes, and connect your LeetCode account across devices.',
    }),
  closeGuestGate: () => set({ guestGateOpen: false }),

  syncHistoryModalOpen: false,
  openSyncHistoryModal: () => set({ syncHistoryModalOpen: true }),
  closeSyncHistoryModal: () => set({ syncHistoryModalOpen: false }),

  tourRunning: false,
  startTour: () => set({ tourRunning: true }),
  stopTour: () => set({ tourRunning: false }),

  toasts: [],
  addToast: (message, type) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
