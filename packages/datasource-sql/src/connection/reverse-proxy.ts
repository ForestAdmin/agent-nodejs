import net from 'net';
import { SocksClient } from 'socks';

import { ConnectionOptionsObj } from '../types';

export default class ReverseProxy {
  private readonly errors: Error[] = [];
  private readonly server: net.Server;
  private readonly proxyOptions: ConnectionOptionsObj['proxySocks'];
  private readonly destination: ConnectionOptionsObj;

  constructor(connectionOptionsObj: ConnectionOptionsObj) {
    this.destination = connectionOptionsObj;
    this.proxyOptions = connectionOptionsObj.proxySocks;
    this.server = net.createServer(this.onConnection.bind(this));
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.on('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
  }

  handleError() {
    if (this.errors.length > 0) {
      throw this.errors[0];
    }
  }

  stop(): Promise<void> {
    return new Promise(resolve => {
      this.server.close(() => resolve());
    });
  }

  public get connectionOptions(): ConnectionOptionsObj {
    const { address, port } = this.server.address() as net.AddressInfo;
    const copiedBaseUri = { ...this.destination };

    if (this.destination.uri) {
      const uri = new URL(this.destination.uri);
      uri.host = address;
      uri.port = port.toString();
      copiedBaseUri.uri = uri.toString();
    }

    copiedBaseUri.host = address;
    copiedBaseUri.port = port;

    return copiedBaseUri;
  }

  public getError(): Error | null {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  private get destinationHost(): string {
    const destination = this.destination
      ? new URL(this.destination.uri).hostname
      : this.destination.host;

    if (!destination) {
      throw new Error('Missing host');
    }

    return destination;
  }

  private get destinationPort(): number {
    const port = Number(
      this.destination.uri ? new URL(this.destination.uri).port : this.destination.port,
    );

    if (!port) {
      throw new Error('Missing port');
    }

    return port;
  }

  private async onConnection(socket: net.Socket): Promise<void> {
    socket.on('error', this.onError.bind(this));

    try {
      const socks5Proxy = await SocksClient.createConnection({
        proxy: { ...this.proxyOptions, type: 5 },
        command: 'connect',
        destination: { host: this.destinationHost, port: this.destinationPort },
      });

      socks5Proxy.socket.on('error', socket.destroy);
      socks5Proxy.socket.pipe(socket);
      socket.pipe(socks5Proxy.socket);
    } catch (err) {
      socket.destroy(err as Error);
    }
  }

  private onError(error: Error): void {
    this.errors.push(error);
  }
}
