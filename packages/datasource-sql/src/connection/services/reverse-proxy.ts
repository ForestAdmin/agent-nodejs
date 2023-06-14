import net from 'net';
import { SocksClient } from 'socks';
import { SocksClientEstablishedEvent } from 'socks/typings/common/constants';

import Service from './service';
import { ProxyOptions } from '../../types';

export default class ReverseProxy extends Service {
  private readonly connectedClients: Set<net.Socket> = new Set();
  private readonly options: ProxyOptions;
  private readonly targetHost: string;
  private readonly targetPort: number;

  constructor(proxyOptions: ProxyOptions, targetHost: string, targetPort: number) {
    super();
    this.options = proxyOptions;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
    if (!this.targetHost) throw new Error('Host is required');
    if (!this.targetPort) throw new Error('Port is required');
  }

  override async closeListener(): Promise<void> {
    await super.closeListener();
    this.connectedClients.forEach(client => client.destroy());
  }

  override async connectListener(socket: net.Socket): Promise<void> {
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

      await super.connectListener(socks5Proxy.socket);
    } catch (err) {
      socket.destroy(err as Error);
    }
  }
}
