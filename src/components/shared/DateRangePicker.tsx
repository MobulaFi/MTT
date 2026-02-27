"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

interface DateRangePickerProps {
    onRangeSelect: (from: Date, to: Date) => void;
    isCustomActive: boolean;
    customRange: { from: Date | null; to: Date | null } | null;
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

const isSameDay = (d1: Date, d2: Date) => 
    d1.getFullYear() === d2.getFullYear() && 
    d1.getMonth() === d2.getMonth() && 
    d1.getDate() === d2.getDate();

const isInRange = (date: Date, from: Date | null, to: Date | null) => {
    if (!from || !to) return false;
    return date >= from && date <= to;
};

const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function DateRangePicker({ onRangeSelect, isCustomActive, customRange }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectingFrom, setSelectingFrom] = useState(true);
    const [tempFrom, setTempFrom] = useState<Date | null>(null);
    const [tempTo, setTempTo] = useState<Date | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const days = getDaysInMonth(year, month);
    const today = new Date();
    
    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);
    
    const handleDayClick = useCallback((day: Date) => {
        if (day > today) return; // Can't select future dates
        
        if (selectingFrom) {
            setTempFrom(day);
            setTempTo(null);
            setSelectingFrom(false);
        } else {
            if (tempFrom && day < tempFrom) {
                // If selected date is before "from", swap
                setTempTo(tempFrom);
                setTempFrom(day);
            } else {
                setTempTo(day);
            }
            setSelectingFrom(true);
            
            // Auto-apply when both dates are selected
            const from = tempFrom && day < tempFrom ? day : tempFrom;
            const to = tempFrom && day < tempFrom ? tempFrom : day;
            if (from && to) {
                onRangeSelect(from, to);
                setIsOpen(false);
            }
        }
    }, [selectingFrom, tempFrom, onRangeSelect, today]);
    
    const goToPreviousMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };
    
    const goToNextMonth = () => {
        const next = new Date(year, month + 1, 1);
        if (next <= today) {
            setCurrentDate(next);
        }
    };
    
    const canGoNext = new Date(year, month + 1, 1) <= today;
    const monthName = currentDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    
    const displayLabel = isCustomActive && customRange?.from && customRange?.to
        ? `${formatDateShort(customRange.from)} - ${formatDateShort(customRange.to)}`
        : null;
    
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`h-7 px-2 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5
                    ${isCustomActive ? "text-success" : "hover:bg-success/50 text-textTertiary hover:text-white"}`}
            >
                <Calendar size={12} />
                {displayLabel || "Custom"}
            </button>
            
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-bgPrimary border border-borderDefault rounded-xl shadow-2xl p-3 w-[280px]">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={goToPreviousMonth} className="p-1.5 hover:bg-bgMuted rounded-lg transition-colors">
                            <ChevronLeft size={14} className="text-textTertiary" />
                        </button>
                        <span className="text-xs font-semibold text-textPrimary">{monthName}</span>
                        <button 
                            onClick={goToNextMonth} 
                            disabled={!canGoNext}
                            className={`p-1.5 rounded-lg transition-colors ${canGoNext ? 'hover:bg-bgMuted' : 'opacity-30 cursor-not-allowed'}`}
                        >
                            <ChevronRight size={14} className="text-textTertiary" />
                        </button>
                    </div>
                    
                    {/* Selection hint */}
                    <div className="text-[10px] text-textTertiary text-center mb-2">
                        {selectingFrom ? "Select start date" : "Select end date"}
                    </div>
                    
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                            <div key={i} className="text-center text-[10px] text-textTertiary font-medium py-1">
                                {d}
                            </div>
                        ))}
                    </div>
                    
                    {/* Days grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {days.map((day, i) => {
                            const isCurrentMonth = day.getMonth() === month;
                            const isSelected = (tempFrom && isSameDay(day, tempFrom)) || (tempTo && isSameDay(day, tempTo));
                            const inRange = isInRange(day, tempFrom, tempTo);
                            const isFuture = day > today;
                            const isToday = isSameDay(day, today);
                            
                            return (
                                <button
                                    key={i}
                                    onClick={() => handleDayClick(day)}
                                    disabled={isFuture || !isCurrentMonth}
                                    className={`
                                        h-8 text-[11px] rounded-lg transition-all
                                        ${!isCurrentMonth ? 'opacity-20 cursor-default' : ''}
                                        ${isFuture ? 'opacity-30 cursor-not-allowed' : 'hover:bg-bgMuted'}
                                        ${isSelected ? 'bg-success text-white font-semibold' : ''}
                                        ${inRange && !isSelected ? 'bg-success/20' : ''}
                                        ${isToday && !isSelected ? 'ring-1 ring-success/50' : ''}
                                        ${!isSelected && !inRange && isCurrentMonth ? 'text-textPrimary' : ''}
                                    `}
                                >
                                    {day.getDate()}
                                </button>
                            );
                        })}
                    </div>
                    
                    {/* Current selection */}
                    {(tempFrom || tempTo) && (
                        <div className="mt-3 pt-2 border-t border-borderDefault text-[10px] text-textTertiary flex justify-between">
                            <span>
                                {tempFrom ? formatDateShort(tempFrom) : '...'} 
                                {' → '} 
                                {tempTo ? formatDateShort(tempTo) : '...'}
                            </span>
                            <button 
                                onClick={() => { setTempFrom(null); setTempTo(null); setSelectingFrom(true); }}
                                className="text-errorBright hover:underline"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}



