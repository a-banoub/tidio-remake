type Handlers = {
  onOpen: () => void;
  onMessage: (msg: any) => void;
  onClose: () => void;
};

const BACKOFF = [1000, 2000, 4000, 8000, 15000];

export class ChatWS {
  private socket: WebSocket | null = null;
  private queue: string[] = [];
  private retries = 0;
  private closed = false;

  constructor(private url: string, private handlers: Handlers) { this.connect(); }

  private connect() {
    if (this.closed) return;
    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      this.retries = 0;
      for (const m of this.queue) this.socket!.send(m);
      this.queue = [];
      this.handlers.onOpen();
    };
    this.socket.onmessage = (e) => {
      try { this.handlers.onMessage(JSON.parse(e.data)); } catch {}
    };
    this.socket.onclose = () => {
      this.handlers.onClose();
      if (this.closed) return;
      const delay = BACKOFF[Math.min(this.retries, BACKOFF.length - 1)];
      this.retries++;
      setTimeout(() => this.connect(), delay);
    };
    this.socket.onerror = () => { try { this.socket?.close(); } catch {} };
  }

  send(msg: any) {
    const json = JSON.stringify(msg);
    if (this.socket?.readyState === 1) this.socket.send(json);
    else this.queue.push(json);
  }

  close() { this.closed = true; try { this.socket?.close(); } catch {} }
}
