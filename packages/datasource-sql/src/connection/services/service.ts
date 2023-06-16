import net from 'net';

export type ConnectionCallback = (socket: net.Socket) => Promise<net.Socket>;
export type CloseCallback = () => Promise<void>;

export default abstract class Service {
  private connectionCallback: ConnectionCallback;
  private closeCallback: CloseCallback;
  protected readonly errors: Error[] = [];

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
    await this.closeCallback?.();
  }

  destroySocketAndSaveError(socket?: net.Socket, error?: Error): void {
    if (socket && !socket.destroyed) socket.destroy();
    if (error) this.errors.push(error);
  }
}
