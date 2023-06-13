import net from 'net';
import { SocksClient } from 'socks';
import { SocksClientEstablishedEvent } from 'socks/typings/common/constants';

import { ProxyOptions } from '../types';

export default class ReverseProxy {
  private readonly errors: Error[] = [];
  private readonly server: net.Server;
  private readonly connectedClients: Set<net.Socket> = new Set();
  private readonly options: ProxyOptions;
  private readonly targetHost: string;
  private readonly targetPort: number;

  get host(): string {
    const { address } = this.server.address() as net.AddressInfo;

    return address;
  }

  get port(): number {
    const { port } = this.server.address() as net.AddressInfo;

    return port;
  }

  constructor(proxyOptions: ProxyOptions, targetHost: string, targetPort: number) {
    this.options = proxyOptions;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
    if (!this.targetHost) throw new Error('Host is required');
    if (!this.targetPort) throw new Error('Port is required');

    this.server = net.createServer(this.onConnection.bind(this));
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

  get error(): Error | null {
    return this.errors.length > 0 ? this.errors[0] : null;
  }

  private async onConnection(socket: net.Socket): Promise<void> {
    let socks5Proxy: SocksClientEstablishedEvent;
    this.connectedClients.add(socket);

    socket.on('error', error => {
      this.errors.push(error);
      if (!socket.closed) socket.destroy(error);
    });
    socket.on('close', () => {
      this.connectedClients.delete(socket);
      if (!socks5Proxy?.socket.closed) socks5Proxy?.socket.destroy();
    });

    try {
      socks5Proxy = await SocksClient.createConnection({
        proxy: { ...this.options, type: 5 },
        command: 'connect',
        destination: { host: this.targetHost, port: this.targetPort },
        timeout: 4000,
      });

      socks5Proxy.socket.on('close', () => {
        this.connectedClients.delete(socks5Proxy.socket);
        if (!socket.closed) socket.destroy();
      });
      socks5Proxy.socket.on('error', socket.destroy);

      socks5Proxy.socket.pipe(socket).pipe(socks5Proxy.socket);
    } catch (err) {
      socket.destroy(err as Error);
    }
  }
}
