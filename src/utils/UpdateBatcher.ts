
export class UpdateBatcher<T> {
  private queue: T[] = [];
  private rafId: number | null = null;
  private flushCallback: (updates: T[]) => void;
  private isFlushing = false;

  constructor(flushCallback: (updates: T[]) => void) {
    this.flushCallback = flushCallback;
  }

  add(update: T): void {
    this.queue.push(update);
    
    if (!this.rafId && !this.isFlushing) {
      this.rafId = requestAnimationFrame(() => {
        this.flush();
        this.rafId = null;
      });
    }
  }

  private flush(): void {
    if (this.queue.length === 0 || this.isFlushing) return;
    
    this.isFlushing = true;
    
    try {
      const updates = [...this.queue];
      this.queue = [];
      
      this.flushCallback(updates);
    } finally {
      this.isFlushing = false;
        if (this.queue.length > 0 && !this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.flush();
          this.rafId = null;
        });
      }
    }
  }

  clear(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.queue = [];
    this.isFlushing = false;
  }

  getQueueSize(): number {
    return this.queue.length;
  }
}

