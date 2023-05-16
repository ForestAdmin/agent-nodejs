import net from 'net';
import { SocksClient } from 'socks';
import { SocksClientEstablishedEvent } from 'socks/typings/common/constants';

import { ConnectionOptionsObj } from '../types';

export default class ReverseProxy {
  private readonly errors: Error[] = [];
  private readonly server: net.Server;
  private readonly destination: ConnectionOptionsObj;
  private readonly connectedClients: Set<net.Socket> = new Set();

  constructor(destination: ConnectionOptionsObj) {
    this.destination = destination;
    this.server = net.createServer(this.onConnection.bind(this));

    if (!this.destinationPort) throw new Error('Port is required');
    if (!this.destinationHost) throw new Error('Host is required');
  }

  start(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.server.on('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close(e => {
        if (e) reject(e);
        else resolve();
      });

      this.connectedClients.forEach(client => client.destroy());
    });
  }

  get connectionOptions(): ConnectionOptionsObj {
    const { address, port } = this.server.address() as net.AddressInfo;
    const connection = { ...this.destination };

    if (this.destination.uri) {
      const uri = new URL(this.destination.uri);
      uri.host = address;
      uri.port = port.toString();
      connection.uri = uri.toString();
    }

    connection.host = address;
    connection.port = port;

    return connection;
  }

  get error(): Error | null {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  private get destinationHost(): string {
    return this.destination.uri ? new URL(this.destination.uri).hostname : this.destination.host;
  }

  private get destinationPort(): number {
    return Number(
      this.destination.uri ? new URL(this.destination.uri).port : this.destination.port,
    );
  }

  private async onConnection(socket: net.Socket): Promise<void> {
    let socks5Proxy: SocksClientEstablishedEvent;
    this.connectedClients.add(socket);

    socket.on('error', error => {
      this.errors.push(error);

      if (!socket.closed) {
        socket.destroy(error);
      }
    });
    socket.on('close', () => {
      this.connectedClients.delete(socket);

      if (!socks5Proxy?.socket.closed) {
        socks5Proxy?.socket.destroy();
      }
    });

    try {
      socks5Proxy = await SocksClient.createConnection({
        proxy: { ...this.destination.proxySocks, type: 5 },
        command: 'connect',
        destination: { host: this.destinationHost, port: this.destinationPort },
        timeout: 4000,
      });

      socks5Proxy.socket.on('close', () => {
        this.connectedClients.delete(socks5Proxy.socket);

        if (!socket.closed) {
          socket.destroy();
        }
      });

      socks5Proxy.socket.on('error', socket.destroy);
      socks5Proxy.socket.pipe(socket);
      socket.pipe(socks5Proxy.socket);
    } catch (err) {
      socket.destroy(err as Error);
    }
  }
}
