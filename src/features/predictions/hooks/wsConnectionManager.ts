'use client';

/**
 * Shared WebSocket Connection Manager
 * Prevents "Insufficient resources" errors by:
 * 1. Sharing a single WebSocket connection across all hooks
 * 2. Implementing connection throttling and exponential backoff
 * 3. Managing subscriptions centrally
 */

type MessageHandler = (message: unknown) => void;

interface Subscription {
  id: string;
  event: string;
  data: Record<string, unknown>;
  handler: MessageHandler;
}

class WSConnectionManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private connectionState: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private lastConnectAttempt = 0;
  private minConnectInterval = 2000; // Minimum 2 seconds between connection attempts
  private listeners: Set<(connected: boolean) => void> = new Set();

  getWsUrl(): string {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4058';
    return wsUrl.replace(/\/api\/2$/, '');
  }

  connect(): void {
    // Throttle connection attempts
    const now = Date.now();
    if (now - this.lastConnectAttempt < this.minConnectInterval) {
      console.log('[WSManager] Connection throttled, too soon since last attempt');
      return;
    }
    this.lastConnectAttempt = now;

    if (this.connectionState === 'connecting') {
      console.log('[WSManager] Already connecting...');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WSManager] Already connected');
      return;
    }

    // Clean up existing connection
    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect loop
      this.ws.close();
      this.ws = null;
    }

    this.connectionState = 'connecting';

    try {
      const wsUrl = this.getWsUrl();
      console.log('[WSManager] Connecting to', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WSManager] Connected');
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;
        this.notifyListeners(true);

        // Resubscribe all active subscriptions
        for (const sub of this.subscriptions.values()) {
          this.sendSubscription(sub);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          // Route message to appropriate handler
          for (const sub of this.subscriptions.values()) {
            sub.handler(message);
          }
        } catch (err) {
          console.error('[WSManager] Error parsing message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[WSManager] WebSocket error:', err);
      };

      this.ws.onclose = (event) => {
        console.log('[WSManager] Disconnected:', event.code, event.reason);
        this.connectionState = 'disconnected';
        this.ws = null;
        this.notifyListeners(false);

        // Only reconnect if we have active subscriptions
        if (this.subscriptions.size > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          this.reconnectAttempts++;
          console.log(`[WSManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          this.reconnectTimeout = setTimeout(() => this.connect(), delay);
        }
      };
    } catch (err) {
      console.error('[WSManager] Failed to create WebSocket:', err);
      this.connectionState = 'disconnected';
    }
  }

  private sendSubscription(sub: Subscription): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const msg = {
        event: sub.event,
        data: sub.data,
      };
      console.log('[WSManager] Sending subscription:', sub.event, sub.data);
      this.ws.send(JSON.stringify(msg));
    }
  }

  subscribe(id: string, event: string, data: Record<string, unknown>, handler: MessageHandler): void {
    const sub: Subscription = { id, event, data, handler };
    this.subscriptions.set(id, sub);

    // Connect if not already connected
    if (this.connectionState === 'disconnected') {
      this.connect();
    } else if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(sub);
    }
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);

    // Disconnect if no more subscriptions
    if (this.subscriptions.size === 0 && this.ws) {
      console.log('[WSManager] No more subscriptions, disconnecting');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this.ws.close();
      this.ws = null;
      this.connectionState = 'disconnected';
    }
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(connected: boolean): void {
    for (const listener of this.listeners) {
      listener(connected);
    }
  }
}

// Singleton instance
let manager: WSConnectionManager | null = null;

export function getWSManager(): WSConnectionManager {
  if (!manager) {
    manager = new WSConnectionManager();
  }
  return manager;
}
