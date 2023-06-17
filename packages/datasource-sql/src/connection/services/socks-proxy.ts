import net from 'net';
import { SocksClient } from 'socks';
import { SocksClientEstablishedEvent } from 'socks/typings/common/constants';

import Service from './service';
import { ProxyOptions } from '../../types';

export default class SocksProxy extends Service {
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
    try {
      await super.closeListener();
    } finally {
      this.connectedClients.forEach(client => client.destroy());
    }
  }

  override async connectListener(): Promise<net.Socket> {
    let socks5Proxy: SocksClientEstablishedEvent;

    try {
      socks5Proxy = await SocksClient.createConnection({
        proxy: { ...this.options, type: 5 },
        command: 'connect',
        destination: { host: this.targetHost, port: this.targetPort },
        timeout: 4000,
      });
      this.connectedClients.add(socks5Proxy.socket);

      socks5Proxy.socket.on('close', () => this.destroySocketIfUnclosed(socks5Proxy.socket));
      socks5Proxy.socket.on('error', error => this.onError(socks5Proxy, error));

      const tunnel = await super.connectListener(socks5Proxy.socket);
      // close the the proxy socket when the tunnel is closed or an error occurs
      tunnel.on('close', () => this.destroySocketIfUnclosed(socks5Proxy.socket));
      tunnel.on('error', error => this.onError(socks5Proxy, error));

      return tunnel;
    } catch (error) {
      this.errors.push(error);
      throw error;
    }
  }

  onError(socks5Proxy: SocksClientEstablishedEvent, error: Error): void {
    this.destroySocketIfUnclosed(socks5Proxy.socket, error);
    this.connectedClients.delete(socks5Proxy.socket);
  }
}
