import net from 'net';

export type ConnectionCallback = (socket: net.Socket) => Promise<void>;
export type CloseCallback = () => Promise<void>;

/** This class is used to handle events. */
export default abstract class Events {
  private connectionCallback: ConnectionCallback;
  private closeCallback: CloseCallback;

  /** attach a callback when the 'connect' event is emit. */
  onConnect(callback: ConnectionCallback): void {
    this.connectionCallback = callback;
  }

  /** callback when the 'connect' event is emit. */
  async whenConnecting(socket: net.Socket): Promise<void> {
    await this.connectionCallback?.(socket);
  }

  /** attach a callback when the 'close' event is emit. */
  onClose(callback: CloseCallback): void {
    this.closeCallback = callback;
  }

  /** callback when the 'close' event is emit. */
  async whenClosing(): Promise<void> {
    await this.closeCallback?.();
  }
}
