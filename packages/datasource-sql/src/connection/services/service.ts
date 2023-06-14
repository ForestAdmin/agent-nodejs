import net from 'net';

export type ConnectionCallback = (socket: net.Socket) => Promise<void>;
export type CloseCallback = () => Promise<void>;

export default abstract class Service {
  private connectionCallback: ConnectionCallback;
  private closeCallback: CloseCallback;

  /** attach a callback when there is a new connection on the service. */
  onConnect(callback: ConnectionCallback): void {
    this.connectionCallback = callback;
  }

  /** callback to execute when there is a new connection. */
  async connectListener(socket: net.Socket): Promise<void> {
    await this.connectionCallback?.(socket);
  }

  /** attach a callback when a service is closing. */
  onClose(callback: CloseCallback): void {
    this.closeCallback = callback;
  }

  /** callback to execute when the service is closing. */
  async closeListener(): Promise<void> {
    await this.closeCallback?.();
  }
}
