import { useCallback } from 'react';
import { useChartStore } from '@/store/useChartStore';
import type { ChartElement, ChartState } from '@/utils/Chart';

export const useChartTools = () => {
  const { chartLoaded, setIsChartReady } = useChartStore();

  const loadSavedTools = async (chart: any) => {
    return new Promise<void>((resolve) => {
      const savedState = localStorage.getItem('chartState');
      
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          
          // Set symbol if available
          if (typeof chart.setSymbol === 'function' && parsedState.symbol && parsedState.interval) {
            try {
              chart.setSymbol(parsedState.symbol, parsedState.interval);
            } catch (_error) {
              console.error('Error setting symbol:', _error);
            }
          }

          // Load studies
          const promises: Promise<void>[] = [];
          if (parsedState.studies && Array.isArray(parsedState.studies)) {
            parsedState.studies.forEach((study: any) => {
              if (study.name !== 'Volume') {
                try {
                  promises.push(
                    chart.createStudy(
                      study.name,
                      study.forceOverlay,
                      study.lock,
                      study.inputs,
                      study.overrides,
                      study.options,
                    ),
                  );
                } catch (_error) {
                  console.error('Error creating study:', _error);
                }
              }
            });
          }

          // Wait for all studies to load, then resolve ONCE
          Promise.all(promises)
            .then(() => {
              resolve();
            })
            .catch((error) => {
              console.error('Error loading studies:', error);
              resolve();
            });
        } catch (error) {
          console.error('Error parsing saved state:', error);
          resolve();
        }
      } else {
        resolve();
      }
    });
  };

  const saveChartTools = useCallback((chart: any) => {
    try {
      const currentState: ChartState = {
        studies: chart.getAllStudies(),
        interval: chart.resolution(),
      };

      const savedStateString = localStorage.getItem('chartState');
      const savedState: ChartState = savedStateString
        ? JSON.parse(savedStateString)
        : { drawings: [], studies: [], interval: '' };

      const updateElements = (currentElements: ChartElement[], savedElements: ChartElement[]) => {
        return currentElements.filter((curr) => {
          if (curr.name === 'Volume') return false;
          const existingElement = savedElements.find((saved) => saved.name === curr.name);
          return !existingElement;
        });
      };

      const updatedState: ChartState = {
        studies: updateElements(currentState.studies, savedState.studies),
        interval: currentState.interval,
      };

      updatedState.studies = [
        ...updatedState.studies,
        ...savedState.studies.filter((s) => currentState.studies.some((c) => c.name === s.name)),
      ];

      const hasChanges = JSON.stringify(updatedState) !== JSON.stringify(savedState);
      if (hasChanges) {
        localStorage.setItem('chartState', JSON.stringify(updatedState));
      }
    } catch (error) {
      console.error('Error saving chart tools:', error);
    }
  }, []);

  return { loadSavedTools, saveChartTools };
};