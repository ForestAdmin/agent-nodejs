import type net from 'net';

export type ConnectionCallback = (socket: net.Socket) => Promise<net.Socket>;
export type StopCallback = () => Promise<void>;

export default abstract class Service {
  private linkedService: Service;
  private readonly connectedClients: Set<net.Socket> = new Set();
  protected readonly errors: Error[] = [];
  protected readonly sourceHost: string;
  protected readonly sourcePort: number;
  protected readonly targetHost: string;
  protected readonly targetPort: number;

  get error(): Error | null {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  protected get debugUri(): string {
    return `${this.sourceHost}:${this.sourcePort}`;
  }

  protected get debugForwardUri(): string {
    return `${this.targetHost}:${this.targetPort}`;
  }

  constructor(sourceHost: string, sourcePort: number, targetHost: string, targetPort: number) {
    this.sourceHost = sourceHost;
    this.sourcePort = sourcePort;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
  }

  /** link a service */
  link(service: Service): void {
    this.linkedService = service;
  }

  /** stop the service by stopping the linked service and destroying all its clients. */
  async stop(): Promise<void> {
    try {
      await this.linkedService?.stop();
    } finally {
      this.connectedClients.forEach(client => client.destroy());
    }
  }

  /** call the linked service connection callback */
  protected async connect(socket?: net.Socket): Promise<net.Socket> {
    return (await this.linkedService?.connect(socket)) || socket;
  }

  /** destroy the given socket if it is not closed and save the error */
  protected destroySocketIfUnclosedAndSaveError(socket?: net.Socket, error?: Error): void {
    if (error) this.errors.push(error);

    if (socket) {
      if (!socket.closed) socket.destroy();
      this.connectedClients.delete(socket);
    }
  }

  /** register a socket as a client to be destroyed when the service is stopped */
  protected addConnectedClient(client: net.Socket): void {
    this.connectedClients.add(client);
  }
}
