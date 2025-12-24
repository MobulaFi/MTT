import { useState, useRef, useEffect, useCallback } from 'react';

interface DragState {
  isDragging: boolean;
  dragOffset: { x: number; y: number };
}

interface UseDragAndDropParams {
  position: { x: number; y: number };
  isFloating: boolean;
  onPositionChange: (position: { x: number; y: number }) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function useDragAndDrop({
  position,
  isFloating,
  onPositionChange,
  onDragStart,
  onDragEnd,
}: UseDragAndDropParams) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
  });

  const constrainPosition = useCallback((x: number, y: number) => {
    if (!windowRef.current) return { x, y };
    
    const windowWidth = windowRef.current.offsetWidth;
    const windowHeight = windowRef.current.offsetHeight;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    const minX = 0;
    const maxX = screenWidth - windowWidth;
    const minY = 0;
    const maxY = screenHeight - windowHeight;
    
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    };
  }, []);

  useEffect(() => {
    if (!isFloating || !windowRef.current) return;
    
    const constrained = constrainPosition(position.x, position.y);
    if (constrained.x !== position.x || constrained.y !== position.y) {
      onPositionChange(constrained);
    }
  }, [isFloating, position, onPositionChange, constrainPosition]);

  useEffect(() => {
    if (!isFloating) return;

    const handleResize = () => {
      if (!windowRef.current) return;
      const constrained = constrainPosition(position.x, position.y);
      onPositionChange(constrained);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFloating, position, onPositionChange, constrainPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFloating) return;
    
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select'))
    ) {
      return;
    }

    setDragState({
      isDragging: true,
      dragOffset: {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      },
    });
    
    if (onDragStart) {
      onDragStart();
    }
  }, [isFloating, position, onDragStart]);

  useEffect(() => {
    if (!dragState.isDragging || !isFloating) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragState.dragOffset.x;
      const newY = e.clientY - dragState.dragOffset.y;
      const constrained = constrainPosition(newX, newY);
      onPositionChange(constrained);
    };

    const handleMouseUp = () => {
      setDragState(prev => ({ ...prev, isDragging: false }));
      if (onDragEnd) {
        onDragEnd();
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, dragState.dragOffset, isFloating, onPositionChange, onDragEnd, constrainPosition]);

  return {
    windowRef,
    isDragging: dragState.isDragging,
    handleMouseDown,
  };
}

