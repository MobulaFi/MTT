
'use client';
import { useMobulaNetworkStore } from '@/store/useMobulaNetworkStore';
import { useNetworkStats } from '@/hooks/useNetworkStats';
import { MobulaRequestLog } from '@/store/useMobulaNetworkStore';
import { useCallback, useMemo, useState } from 'react';
import { FiX, FiTrash2, FiDownload, FiActivity, FiClock, FiAlertCircle, FiZap } from 'react-icons/fi';

interface NetworkDebuggerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NetworkDebuggerModal({ isOpen, onClose }: NetworkDebuggerModalProps) {
  const allRequests = useMobulaNetworkStore((state) => state.requests);
  const clearRequests = useMobulaNetworkStore((state) => state.clearRequests);
  const stats = useNetworkStats();
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'slow' | 'errors'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const requests = useMemo(
    () => allRequests.filter((r) => r.type === 'REST'),
    [allRequests]
  );

  const filteredRequests = useMemo(() => {
    let filtered = requests;

    if (filter === 'slow') {
      filtered = filtered.filter((r) => (r.duration || 0) > stats.averageTime * 1.5);
    } else if (filter === 'errors') {
      filtered = filtered.filter((r) => r.error);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.endpoint.toLowerCase().includes(query) ||
          r.method.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [requests, filter, searchQuery, stats.averageTime]);

  const handleExportCSV = useCallback(() => {
    const headers = ['Timestamp', 'Method', 'Endpoint', 'URL', 'Duration (ms)', 'Status', 'Error'];
    const rows = filteredRequests.map((req) => [
      new Date(req.startTime).toISOString(),
      req.method,
      req.endpoint,
      req.url || '',
      req.duration?.toFixed(2) || '',
      req.status || '',
      req.error || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `network-debug-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, [filteredRequests]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-bgPrimary border border-borderDefault rounded-xl shadow-2xl flex flex-col max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-bgOverlay to-bgPrimary border-b border-borderDefault">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-bgTableAlt rounded-lg flex-shrink-0">
              <FiActivity size={18} className="text-success sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-textPrimary truncate">Network Debugger</h2>
              <p className="text-[10px] sm:text-xs text-textSecondary mt-0.5 truncate">Real-time API monitoring</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-bgTableAlt rounded-lg transition-all duration-200 group"
            aria-label="Close modal"
          >
            <FiX size={20} className="text-textSecondary group-hover:text-textPrimary transition-colors" />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 bg-bgOverlay border-b border-borderDefault">
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault">
            <div className="p-1.5 sm:p-2 bg-bgTableAlt rounded-md flex-shrink-0">
              <FiActivity size={14} className="text-success sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-textSecondary truncate">Total</p>
              <p className="text-sm sm:text-lg font-semibold text-textPrimary font-mono">{requests.length}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault">
            <div className="p-1.5 sm:p-2 bg-bgTableAlt rounded-md flex-shrink-0">
              <FiClock size={14} className="text-blue-400 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-textSecondary truncate">Avg</p>
              <p className="text-sm sm:text-lg font-semibold text-textPrimary font-mono truncate">{formatDuration(stats.averageTime)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault">
            <div className="p-1.5 sm:p-2 bg-bgTableAlt rounded-md flex-shrink-0">
              <FiAlertCircle size={14} className={`${stats.errorCount > 0 ? 'text-error' : 'text-success'} sm:w-4 sm:h-4`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-textSecondary truncate">Errors</p>
              <p className={`text-sm sm:text-lg font-semibold font-mono ${stats.errorCount > 0 ? 'text-error' : 'text-success'}`}>
                {stats.errorCount}
              </p>
            </div>
          </div>
          
          {stats.slowestRequest && (
            <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault">
              <div className="p-1.5 sm:p-2 bg-bgTableAlt rounded-md flex-shrink-0">
                <FiZap size={14} className="text-warning sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-textSecondary truncate">Slowest</p>
                <p className="text-xs sm:text-sm font-semibold text-textPrimary font-mono truncate">
                  {formatDuration(stats.slowestRequest.duration)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-b border-borderDefault bg-bgOverlay">
          <div className="flex gap-2">
            {(['all', 'slow', 'errors'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
                  filter === f
                    ? 'bg-success text-bgPrimary shadow-lg shadow-success/20'
                    : 'bg-bgPrimary text-textSecondary hover:bg-bgTableAlt hover:text-textPrimary border border-borderDefault'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'errors' && stats.errorCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-error text-white text-[10px] rounded-full">
                    {stats.errorCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by endpoint or method..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bgPrimary border border-borderDefault text-textPrimary text-xs placeholder-textTertiary rounded-lg px-4 py-2 focus:outline-none focus:border-success focus:ring-2 focus:ring-success/20 transition-all"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-bgPrimary border border-borderDefault text-textSecondary text-xs font-medium rounded-lg hover:bg-bgTableAlt hover:text-textPrimary hover:border-success/50 transition-all duration-200"
              disabled={filteredRequests.length === 0}
            >
              <FiDownload size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              onClick={clearRequests}
              className="flex items-center gap-2 px-4 py-2 bg-error/10 border border-error/30 text-error text-xs font-medium rounded-lg hover:bg-error/20 hover:border-error/50 transition-all duration-200"
              disabled={requests.length === 0}
            >
              <FiTrash2 size={14} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="h-[400px] sm:h-[500px] overflow-y-auto custom-scrollbar">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 sm:p-16 text-center">
              <div className="p-4 bg-bgTableAlt rounded-full mb-4">
                <FiActivity size={32} className="text-textTertiary" />
              </div>
              <p className="text-textSecondary text-sm font-medium mb-1">
                {requests.length === 0 ? 'No requests captured yet' : 'No matching requests'}
              </p>
              <p className="text-textTertiary text-xs">
                {requests.length === 0 
                  ? 'Make an API call to see it appear here' 
                  : 'Try adjusting your filters or search query'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead className="sticky top-0 bg-bgOverlay border-b border-borderDefault z-10">
                  <tr>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-textSecondary uppercase tracking-wide text-[9px] sm:text-[10px]">Method</th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-textSecondary uppercase tracking-wide text-[9px] sm:text-[10px]">Endpoint</th>
                    <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-textSecondary uppercase tracking-wide text-[9px] sm:text-[10px] hidden md:table-cell">URL</th>
                    <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-textSecondary uppercase tracking-wide text-[9px] sm:text-[10px] w-16 sm:w-20">Status</th>
                    <th className="text-right px-2 sm:px-4 py-2 sm:py-3 font-semibold text-textSecondary uppercase tracking-wide text-[9px] sm:text-[10px] w-20 sm:w-24">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((req, index) => (
                    <tr
                      key={req.id}
                      onClick={() => setShowDetails(showDetails === req.id ? null : req.id)}
                      className={`
                        border-b border-borderDefault cursor-pointer transition-all duration-150
                        ${showDetails === req.id ? 'bg-bgTableHover' : 'hover:bg-bgTableAlt'}
                        ${index % 2 === 0 ? 'bg-bgPrimary' : 'bg-bgOverlay/30'}
                      `}
                    >
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <span className="font-mono text-success font-semibold text-[10px] sm:text-xs">
                          {req.method}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <span className="text-textPrimary font-medium truncate block max-w-[120px] sm:max-w-xs text-[10px] sm:text-xs">
                          {req.endpoint}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                        <a
                          href={req.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-textTertiary hover:text-success font-mono text-[9px] sm:text-[10px] truncate block max-w-md transition-colors"
                        >
                          {req.url}
                        </a>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                        <StatusBadge status={req.status} error={req.error} />
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                        <DurationBadge duration={req.duration} averageTime={stats.averageTime} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Details Panel */}
        {showDetails && (
          <RequestDetailsPanel
            request={filteredRequests.find((r) => r.id === showDetails)}
            onClose={() => setShowDetails(null)}
          />
        )}
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status?: number;
  error?: string;
}

function StatusBadge({ status, error }: StatusBadgeProps) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-error/10 border border-error/30 text-error rounded-md text-xs font-mono font-semibold">
        ✕ Error
      </span>
    );
  }

  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-warning/10 border border-warning/30 text-warning rounded-md text-xs font-mono">
        <FiClock size={10} />
        Pending
      </span>
    );
  }

  if (status < 300) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 bg-success/10 border border-success/30 text-success rounded-md text-xs font-mono font-semibold">
        {status}
      </span>
    );
  }

  if (status < 400) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 bg-warning/10 border border-warning/30 text-warning rounded-md text-xs font-mono font-semibold">
        {status}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-1 bg-error/10 border border-error/30 text-error rounded-md text-xs font-mono font-semibold">
      {status}
    </span>
  );
}

interface DurationBadgeProps {
  duration?: number;
  averageTime: number;
}

function DurationBadge({ duration, averageTime }: DurationBadgeProps) {
  if (!duration) {
    return <span className="text-textTertiary font-mono">—</span>;
  }

  const isSlow = duration > averageTime * 1.5;
  const isFast = duration < averageTime * 0.5;

  return (
    <span 
      className={`font-mono font-semibold ${
        isSlow 
          ? 'text-error' 
          : isFast 
            ? 'text-success' 
            : 'text-textPrimary'
      }`}
    >
      {formatDuration(duration)}
    </span>
  );
}

interface RequestDetailsPanelProps {
  request?: MobulaRequestLog;
  onClose: () => void;
}

function RequestDetailsPanel({ request, onClose }: RequestDetailsPanelProps) {
  if (!request) return null;

  const actualDuration = request.duration || (request.endTime && request.startTime 
    ? request.endTime - request.startTime 
    : undefined);

  return (
    <div className="border-t-2 border-borderDefault bg-gradient-to-b from-bgOverlay to-bgPrimary px-3 sm:px-6 py-4 sm:py-5 max-h-[60vh] sm:max-h-80 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h3 className="text-xs sm:text-sm font-semibold text-textPrimary">Request Details</h3>
        <button 
          onClick={onClose}
          className="text-xs text-textTertiary hover:text-textPrimary transition-colors flex items-center gap-1"
        >
          <FiX size={14} />
          <span className="hidden sm:inline">Close</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-5">
        <div className="p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault">
          <p className="text-[9px] sm:text-[10px] text-textTertiary uppercase tracking-wide mb-1 sm:mb-1.5 truncate">Method</p>
          <p className="text-xs sm:text-sm text-success font-mono font-semibold truncate">{request.method}</p>
        </div>
        <div className="p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault">
          <p className="text-[9px] sm:text-[10px] text-textTertiary uppercase tracking-wide mb-1 sm:mb-1.5 truncate">Status</p>
          <div className="flex items-center">
            <StatusBadge status={request.status} error={request.error} />
          </div>
        </div>
        <div className="p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault">
          <p className="text-[9px] sm:text-[10px] text-textTertiary uppercase tracking-wide mb-1 sm:mb-1.5 truncate">Duration</p>
          <p className="text-xs sm:text-sm text-textPrimary font-mono font-semibold truncate">{formatDuration(actualDuration)}</p>
        </div>
        <div className="p-2 sm:p-3 bg-bgPrimary rounded-lg border border-borderDefault col-span-2">
          <p className="text-[9px] sm:text-[10px] text-textTertiary uppercase tracking-wide mb-1 sm:mb-1.5 truncate">Timestamp</p>
          <p className="text-[10px] sm:text-xs text-textSecondary font-mono truncate">
            {new Date(request.startTime).toLocaleTimeString()}
          </p>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div>
          <p className="text-[10px] sm:text-xs text-textSecondary uppercase tracking-wide mb-1.5 sm:mb-2 font-semibold">Endpoint</p>
          <p className="text-xs sm:text-sm text-textPrimary font-mono bg-bgPrimary px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-borderDefault break-all">
            {request.endpoint}
          </p>
        </div>

        <div>
          <p className="text-[10px] sm:text-xs text-textSecondary uppercase tracking-wide mb-1.5 sm:mb-2 font-semibold">Full URL</p>
          <a
            href={request.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs sm:text-sm text-success font-mono hover:text-success/80 bg-bgPrimary px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-borderDefault hover:border-success/50 transition-all block break-all"
          >
            {request.url}
          </a>
        </div>

        {request.params && Object.keys(request.params).length > 0 && (
          <div>
            <p className="text-[10px] sm:text-xs text-textSecondary uppercase tracking-wide mb-1.5 sm:mb-2 font-semibold">Parameters</p>
            <pre className="bg-bgPrimary border border-borderDefault rounded-lg px-2 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs text-textSecondary overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(request.params, null, 2)}
            </pre>
          </div>
        )}

        {request.error && (
          <div className="p-2 sm:p-4 bg-error/5 border border-error/30 rounded-lg">
            <div className="flex items-start gap-2 sm:gap-3">
              <FiAlertCircle className="text-error mt-0.5 flex-shrink-0" size={14} />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-error font-semibold uppercase tracking-wide mb-1">Error Details</p>
                <p className="text-xs sm:text-sm text-error/90 font-mono break-all">{request.error}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms?: number) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatSize(bytes?: number) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}