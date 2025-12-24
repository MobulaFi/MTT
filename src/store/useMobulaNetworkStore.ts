import { create } from "zustand";

export interface MobulaRequestLog {
    id: string;
    method: string;
    endpoint: string;
    url?: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status?: number;
    type: 'REST' | 'WebSocket';
    error?: string;
    requestSize?: number;
    responseSize?: number;
    params?: Record<string, any>;
}

interface MobulaNetworkStore {
    requests: MobulaRequestLog[];
    addRequest: (request: MobulaRequestLog) => void;
    updateRequest: (id: string, updates: Partial<MobulaRequestLog>) => void;
    clearRequests: () => void;
}

export const useMobulaNetworkStore = create<MobulaNetworkStore>((set) => ({
    requests: [],
    addRequest: (request) => {
        set((state) => ({
            requests: [request, ...state.requests].slice(0, 150),
        }));
    },
    updateRequest: (id, updates) => {
        set((state) => ({
            requests: state.requests.map((r) =>
                r.id === id ? { ...r, ...updates } : r
            ),
        }));
    },
    clearRequests: () => set({ requests: [] }),
}));