import { useMobulaNetworkStore } from "@/store/useMobulaNetworkStore";
import { useMemo } from "react";

export function useNetworkStats() {
    const allRequests = useMobulaNetworkStore((state) => state.requests);
  
    return useMemo(() => {
      const requests = allRequests.filter((r) => r.type === 'REST');
  
      return {
        total: requests.length,
        averageTime:
          requests.length > 0
            ? requests.reduce((sum, r) => sum + (r.duration || 0), 0) /
            requests.length
            : 0,
        slowestRequest:
          requests.length > 0
            ? requests.reduce((max, r) =>
              (r.duration || 0) > (max.duration || 0) ? r : max
            )
            : null,
        errorCount: requests.filter((r) => r.error).length,
      };
    }, [allRequests]);
  }