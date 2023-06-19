import net from 'net';

export type ConnectionCallback = (socket: net.Socket) => Promise<net.Socket>;
export type CloseCallback = () => Promise<void>;

export default abstract class Service {
  private connectionCallback: ConnectionCallback;
  private closeCallback: CloseCallback;
  protected readonly errors: Error[] = [];
  protected readonly connectedClients: Set<net.Socket> = new Set();

  get error(): Error | null {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  /** attach a callback when there is a new connection on the service. */
  onConnect(callback: ConnectionCallback): void {
    this.connectionCallback = callback;
  }

  /** callback to execute when there is a new connection. */
  async connectListener(socket?: net.Socket): Promise<net.Socket> {
    return this.connectionCallback?.(socket) || socket;
  }

  /** attach a callback when a service is closing. */
  onClose(callback: CloseCallback): void {
    this.closeCallback = callback;
  }

  /** callback to execute when the service is closing. */
  async closeListener(): Promise<void> {
    try {
      await this.closeCallback?.();
    } finally {
      this.connectedClients.forEach(client => client.destroy());
    }
  }

  bindListeners(to: Service): void {
    this.onConnect(to.connectListener.bind(to));
    this.onClose(to.closeListener.bind(to));
  }

  destroySocketIfUnclosed(socket?: net.Socket, error?: Error): void {
    if (socket && !socket.closed) socket.destroy();
    if (error) this.errors.push(error);
  }

  onCloseEventDestroySocket(socketToListen: net.Socket, socketToDestroy: net.Socket): void {
    socketToListen.on('close', () => {
      this.destroySocketIfUnclosed(socketToDestroy);
      this.connectedClients.delete(socketToDestroy);
    });
  }

  onErrorEventDestroySocket(socketToListen: net.Socket, socketToDestroy: net.Socket): void {
    socketToListen.on('error', error => {
      this.destroySocketIfUnclosed(socketToDestroy, error);
      this.connectedClients.delete(socketToDestroy);
    });
  }
}
