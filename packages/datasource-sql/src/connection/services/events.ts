import net from 'net';

export type ConnectionCallback = (socket: net.Socket) => Promise<void>;

export default abstract class Events {
  private connectionCallback: ConnectionCallback;
  private closeCallback: () => Promise<void>;

  onConnect(callback: ConnectionCallback): void {
    this.connectionCallback = callback;
  }

  async whenConnecting(socket: net.Socket): Promise<void> {
    await this.connectionCallback?.(socket);
  }

  onClose(callback: () => Promise<void>): void {
    this.closeCallback = callback;
  }

  async whenClosing(): Promise<void> {
    await this.closeCallback?.();
  }
}
