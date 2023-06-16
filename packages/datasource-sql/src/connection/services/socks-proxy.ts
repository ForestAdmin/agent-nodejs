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

  override async connectListener(): Promise<net.Socket> {
    let socks5Proxy: SocksClientEstablishedEvent;

    try {
      socks5Proxy = await SocksClient.createConnection({
        proxy: { ...this.options, type: 5 },
        command: 'connect',
        destination: { host: this.targetHost, port: this.targetPort },
        timeout: 4000,
      });

      socks5Proxy.socket.on('close', () => this.destroySocketIfUnclosed(socks5Proxy.socket));
      socks5Proxy.socket.on('error', error =>
        this.destroySocketIfUnclosed(socks5Proxy.socket, error),
      );

      return await super.connectListener(socks5Proxy.socket);
    } catch (error) {
      this.errors.push(error);
    }
  }
}
