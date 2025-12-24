import type { MobulaClient } from '@mobula_labs/sdk';
import { MobulaRequestLog, useMobulaNetworkStore } from '@/store/useMobulaNetworkStore';
import { generateRequestId } from '@/utils/GenerateId';

type MobulaClientWithMeta = MobulaClient & {
  restUrl?: string;
};

export function createLoggingMobulaClient(client: MobulaClient): MobulaClient {
  const handler = new Proxy(client as MobulaClientWithMeta, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);

      if (
        typeof original === 'function' &&
        (typeof prop === 'string' &&
          (prop.startsWith('fetch') || prop.startsWith('subscribe')))
      ) {
        return async (...args: unknown[]) => {
          const requestId = generateRequestId();
          const isSubscription = typeof prop === 'string' && prop.startsWith('subscribe');
          const methodName = String(prop);

          const startTime = performance.now();
          const restUrl = target.restUrl ?? '';
          const url = `${restUrl}/${methodName}`;

          const request: MobulaRequestLog = {
            id: requestId,
            method: methodName,
            endpoint: methodName,
            url,
            startTime:startTime,
            type: isSubscription ? 'WebSocket' : 'REST',
            params: args[0] as Record<string, unknown>,
          };
         
          useMobulaNetworkStore.getState().addRequest(request);

          try {
            const result = await original.apply(target, args);
            const endTime = performance.now();
            const duration = endTime - startTime;

            Promise.resolve().then(() => {
              useMobulaNetworkStore.getState().updateRequest(requestId, {
                endTime,
                duration, 
                status: 200,
                responseSize: 0,
              });

              
              if (duration > 1000) {
                console.warn(`Slow ${methodName}: ${duration.toFixed(0)}ms`);
              }
            });

            return result;
          } catch (error) {
            const endTime = performance.now();
            const duration = endTime - startTime; 
            const errorMessage = error instanceof Error 
              ? error.message 
              : 'Unknown error';

            Promise.resolve().then(() => {
              useMobulaNetworkStore.getState().updateRequest(requestId, {
                endTime,
                duration,
                status: errorMessage.includes('timeout') ? 408 : 500,
                error: errorMessage,
              });

              console.error(`${methodName} failed: ${errorMessage}`);
            });
            throw error;
          }
        };
      }

      return original;
    },
  });

  return handler as MobulaClient;
}