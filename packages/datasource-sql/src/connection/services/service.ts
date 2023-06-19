import net from 'net';

export type ConnectionCallback = (socket: net.Socket) => Promise<net.Socket>;
export type StopCallback = () => Promise<void>;

export default abstract class Service {
  private linkedService: Service;
  protected readonly errors: Error[] = [];
  protected readonly connectedClients: Set<net.Socket> = new Set();

  get error(): Error | null {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  /** link a service */
  link(service: Service): void {
    this.linkedService = service;
  }

  /** call the linked service connection callback */
  protected async connect(socket?: net.Socket): Promise<net.Socket> {
    return this.linkedService?.connect(socket) || socket;
  }

  /** stop the service by stopping the linked service and destroying all its clients. */
  async stop(): Promise<void> {
    try {
      await this.linkedService?.stop?.();
    } finally {
      this.connectedClients.forEach(client => client.destroy());
    }
  }

  /** destroy socket if it is not closed and add the error to the errors array */
  destroySocketIfUnclosed(socket?: net.Socket, error?: Error): void {
    if (socket && !socket.closed) socket.destroy();
    if (error) this.errors.push(error);
  }

  /** on the socket close event, destroy the socket if it is not closed and delete the client */
  onCloseEventDestroySocket(socketToListen: net.Socket, socketToDestroy: net.Socket): void {
    socketToListen.on('close', () => {
      this.destroySocketIfUnclosed(socketToDestroy);
      this.connectedClients.delete(socketToDestroy);
    });
  }

  /** on the socket error event, destroy the socket if it is not closed and delete the client */
  onErrorEventDestroySocket(socketToListen: net.Socket, socketToDestroy: net.Socket): void {
    socketToListen.on('error', error => {
      this.destroySocketIfUnclosed(socketToDestroy, error);
      this.connectedClients.delete(socketToDestroy);
    });
  }
}
