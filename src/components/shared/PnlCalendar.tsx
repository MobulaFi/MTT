"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { sdk } from "@/lib/sdkClient";
import type { WalletAnalysisResponse } from "@mobula_labs/types";

interface CalendarBreakdownEntry {
    date: string | Date;
    volumeBuy: number;
    volumeSell: number;
    totalVolume: number;
    buys: number;
    sells: number;
    realizedPnlUSD: number;
}

interface PnlCalendarProps {
    isOpen: boolean;
    onClose: () => void;
    walletAddress: string;
    blockchain: string;
    onDayClick?: (date: Date) => void;
}

const getDaysInMonth = (year: number, month: number): Date[] => {
    const days: Date[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    for (let i = mondayOffset - 1; i >= 0; i--) {
        const prevDay = new Date(year, month, -i);
        days.push(prevDay);
    }
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
        days.push(new Date(year, month, i));
    }
    
    const remainingDays = 7 - (days.length % 7);
    if (remainingDays < 7) {
        for (let i = 1; i <= remainingDays; i++) {
            days.push(new Date(year, month + 1, i));
        }
    }
    
    return days;
};

const formatDateKey = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatCompactNumber = (num: number): string => {
    const abs = Math.abs(num);
    if (abs >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${(num / 1000).toFixed(1)}K`;
    if (abs >= 100) return `${num.toFixed(0)}`;
    if (abs >= 1) return `${num.toFixed(2)}`;
    return `${num.toFixed(4)}`;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Global request ID to prevent race conditions
let calendarRequestId = 0;

export function PnlCalendar({ 
    isOpen, 
    onClose, 
    walletAddress,
    blockchain,
    onDayClick
}: PnlCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [hoveredDay, setHoveredDay] = useState<string | null>(null);
    const [calendarData, setCalendarData] = useState<CalendarBreakdownEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const lastFetchRef = useRef<string>("");
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Fetch data for the current month
    const fetchMonthData = useCallback(async (targetYear: number, targetMonth: number) => {
        if (!walletAddress || !blockchain) return;
        
        // Calculate from/to timestamps for the month
        const fromDate = new Date(targetYear, targetMonth, 1);
        const toDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
        
        const fetchKey = `${walletAddress}-${targetYear}-${targetMonth}`;
        
        // Skip if already fetched this exact month
        if (lastFetchRef.current === fetchKey) return;
        
        calendarRequestId++;
        const thisRequestId = calendarRequestId;
        
        setIsLoading(true);
        
        try {
            const res = await sdk.fetchWalletAnalysis({
                wallet: walletAddress,
                blockchain: blockchain,
                period: '90d',
                from: fromDate.getTime(),
                to: toDate.getTime(),
            }) as WalletAnalysisResponse;
            
            if (thisRequestId !== calendarRequestId) {
                return;
            }
            
            lastFetchRef.current = fetchKey;
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const periodTimeframes = (res?.data as any)?.periodTimeframes ?? [];
            
            // Map periodTimeframes to calendar format
            const breakdown: CalendarBreakdownEntry[] = periodTimeframes.map((entry: { date: string; realized: number }) => ({
                date: entry.date,
                volumeBuy: 0, // Not provided in periodTimeframes
                volumeSell: 0, // Not provided in periodTimeframes
                totalVolume: 0, // Not provided in periodTimeframes
                buys: 0, // Not provided in periodTimeframes
                sells: 0, // Not provided in periodTimeframes
                realizedPnlUSD: entry.realized,
            }));
            
            setCalendarData(breakdown);
        } catch (err) {
            if (thisRequestId === calendarRequestId) {
                console.error("Calendar data fetch failed:", err);
            }
        } finally {
            if (thisRequestId === calendarRequestId) {
                setIsLoading(false);
            }
        }
    }, [walletAddress, blockchain]);
    
    useEffect(() => {
        if (isOpen) {
            fetchMonthData(year, month);
        }
    }, [isOpen, year, month, fetchMonthData]);
    
    useEffect(() => {
        if (!isOpen) {
            lastFetchRef.current = "";
        }
    }, [isOpen]);
    
    const dataByDate = useMemo(() => {
        const map = new Map<string, CalendarBreakdownEntry>();
        calendarData.forEach(entry => {
            const date = typeof entry.date === 'string' ? new Date(entry.date) : entry.date;
            const key = formatDateKey(date);
            map.set(key, entry);
        });
        return map;
    }, [calendarData]);
    
    const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
    
    const monthlyStats = useMemo(() => {
        let totalPnl = 0;
        let wins = 0;
        let losses = 0;
        
        calendarData.forEach(entry => {
            const date = typeof entry.date === 'string' ? new Date(entry.date) : entry.date;
            if (date.getMonth() === month && date.getFullYear() === year) {
                totalPnl += entry.realizedPnlUSD;
                if (entry.realizedPnlUSD > 0) wins++;
                else if (entry.realizedPnlUSD < 0) losses++;
            }
        });
        
        return { totalPnl, wins, losses };
    }, [calendarData, month, year]);
    
    const bestStreak = useMemo(() => {
        let maxStreak = 0;
        let currentStreak = 0;
        
        const monthDays = days.filter(d => d.getMonth() === month);
        monthDays.forEach(day => {
            const key = formatDateKey(day);
            const data = dataByDate.get(key);
            if (data && data.realizedPnlUSD > 0) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });
        
        return maxStreak;
    }, [days, month, dataByDate]);
    
    const goToPreviousMonth = useCallback(() => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }, []);
    
    const goToNextMonth = useCallback(() => {
        setCurrentDate(prev => {
            const newDate = new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
            const today = new Date();
            if (newDate > today) return prev;
            return newDate;
        });
    }, []);
    
    const canGoNext = useMemo(() => {
        const nextMonth = new Date(year, month + 1, 1);
        const today = new Date();
        return nextMonth <= today;
    }, [year, month]);

    const handleDayClick = useCallback((day: Date) => {
        // Only allow clicking on days in the current month being viewed
        if (day.getMonth() !== month) return;
        onDayClick?.(day);
    }, [month, onDayClick]);
    
    const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent
                showCloseButton={false}
                className="bg-bgPrimary border border-borderDefault rounded-xl p-0 w-[520px] max-w-[95vw]"
            >
                <VisuallyHidden>
                    <DialogTitle>PNL Calendar</DialogTitle>
                </VisuallyHidden>
                
                <div className="p-5">
                    {/* Header with month navigation */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={goToPreviousMonth}
                                className="p-2 hover:bg-bgMuted rounded-lg transition-colors"
                            >
                                <ChevronLeft size={18} className="text-textTertiary" />
                            </button>
                            <h2 className="text-base font-semibold text-textPrimary min-w-[160px] text-center">
                                {monthName}
                            </h2>
                            <button
                                onClick={goToNextMonth}
                                disabled={!canGoNext}
                                className={`p-2 rounded-lg transition-colors ${canGoNext ? 'hover:bg-bgMuted' : 'opacity-30 cursor-not-allowed'}`}
                            >
                                <ChevronRight size={18} className="text-textTertiary" />
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* Stats inline */}
                            <div className="flex items-center gap-3 text-xs">
                                <span className={`font-semibold ${monthlyStats.totalPnl >= 0 ? 'text-success' : 'text-errorBright'}`}>
                                    {isLoading ? '...' : `${monthlyStats.totalPnl >= 0 ? '+' : ''}$${formatCompactNumber(monthlyStats.totalPnl)}`}
                                </span>
                                <span className="text-textTertiary">|</span>
                                <span className="text-success">{monthlyStats.wins}W</span>
                                <span className="text-errorBright">{monthlyStats.losses}L</span>
                            </div>
                            
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-bgMuted rounded-lg transition-colors"
                            >
                                <X size={16} className="text-textTertiary" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-2 mb-2">
                        {WEEKDAYS.map((day, i) => (
                            <div key={i} className="text-center text-xs text-textTertiary font-medium py-2">
                                {day}
                            </div>
                        ))}
                    </div>
                    
                    {/* Calendar Grid */}
                    <div className={`grid grid-cols-7 gap-2 ${isLoading ? 'opacity-50' : ''}`}>
                        {days.map((day, i) => {
                            const isCurrentMonth = day.getMonth() === month;
                            const dateKey = formatDateKey(day);
                            const dayData = dataByDate.get(dateKey);
                            const pnl = dayData?.realizedPnlUSD ?? 0;
                            const hasPnl = dayData && pnl !== 0;
                            const isHovered = hoveredDay === dateKey;
                            const isToday = formatDateKey(new Date()) === dateKey;
                            
                            return (
                                <div
                                    key={i}
                                    className={`
                                        relative h-14 flex flex-col items-center justify-center rounded-lg text-sm
                                        transition-all
                                        ${!isCurrentMonth ? 'opacity-20 cursor-default' : 'cursor-pointer'}
                                        ${hasPnl && pnl > 0 ? 'bg-success/10 hover:bg-success/30 active:bg-success/40' : ''}
                                        ${hasPnl && pnl < 0 ? 'bg-errorBright/10 hover:bg-errorBright/30 active:bg-errorBright/40' : ''}
                                        ${!hasPnl && isCurrentMonth ? 'hover:bg-bgMuted/50 active:bg-bgMuted/70' : ''}
                                        ${isToday ? 'ring-2 ring-success/50' : ''}
                                    `}
                                    onMouseEnter={() => setHoveredDay(dateKey)}
                                    onMouseLeave={() => setHoveredDay(null)}
                                    onClick={() => isCurrentMonth ? handleDayClick(day) : undefined}
                                >
                                    <span className={`text-xs font-medium ${!isCurrentMonth ? 'text-textTertiary' : isToday ? 'text-success font-bold' : 'text-textPrimary'}`}>
                                        {day.getDate()}
                                    </span>
                                    {hasPnl ? (
                                        <span className={`text-[10px] font-semibold mt-0.5 ${pnl > 0 ? 'text-success' : 'text-errorBright'}`}>
                                            {pnl > 0 ? '+' : ''}${formatCompactNumber(pnl)}
                                        </span>
                                    ) : isCurrentMonth ? (
                                        <span className="text-[10px] text-textTertiary/40 mt-0.5">-</span>
                                    ) : null}
                                    
                                    {/* Hover Tooltip */}
                                    {isHovered && dayData && isCurrentMonth && (
                                        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-bgContainer border border-borderDefault rounded-xl shadow-2xl min-w-[180px]">
                                            <div className="text-sm text-textPrimary font-semibold mb-3 pb-2 border-b border-borderDefault">
                                                {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="space-y-2 text-xs">
                                                {dayData.buys > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-textTertiary">Buys</span>
                                                        <span className="text-success font-semibold">{dayData.buys}</span>
                                                    </div>
                                                )}
                                                {dayData.sells > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-textTertiary">Sells</span>
                                                        <span className="text-errorBright font-semibold">{dayData.sells}</span>
                                                    </div>
                                                )}
                                                {dayData.volumeBuy > 0 && (
                                                    <div className="flex justify-between pt-2 border-t border-borderDefault">
                                                        <span className="text-textTertiary">Buy Vol</span>
                                                        <span className="text-success font-semibold">${formatCompactNumber(dayData.volumeBuy)}</span>
                                                    </div>
                                                )}
                                                {dayData.volumeSell > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-textTertiary">Sell Vol</span>
                                                        <span className="text-errorBright font-semibold">${formatCompactNumber(dayData.volumeSell)}</span>
                                                    </div>
                                                )}
                                                <div className={`flex justify-between ${dayData.volumeBuy > 0 || dayData.volumeSell > 0 ? 'pt-2 border-t border-borderDefault' : ''}`}>
                                                    <span className="text-textTertiary">Realized PNL</span>
                                                    <span className={`font-bold ${pnl >= 0 ? 'text-success' : 'text-errorBright'}`}>
                                                        {pnl >= 0 ? '+' : ''}${formatCompactNumber(pnl)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-bgContainer border-r border-b border-borderDefault rotate-45" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    
                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-borderDefault flex justify-between items-center text-xs">
                        <span className="text-textTertiary">
                            Best streak: <span className="text-success font-semibold">{bestStreak} days</span>
                        </span>
                        {isLoading && (
                            <span className="text-textTertiary animate-pulse">Loading...</span>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
