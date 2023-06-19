import net from 'net';
import { SocksClient } from 'socks';
import { SocksClientEstablishedEvent } from 'socks/typings/common/constants';

import { SocksProxyServiceError } from './errors';
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
  }

  protected override async connect(): Promise<net.Socket> {
    let socks5Client: SocksClientEstablishedEvent;

    try {
      socks5Client = await SocksClient.createConnection({
        proxy: { ...this.options, type: 5 },
        command: 'connect',
        destination: { host: this.targetHost, port: this.targetPort },
        timeout: 4000,
      });
      this.connectedClients.add(socks5Client.socket);
      socks5Client.socket.on('close', () => this.destroySocketIfUnclosed(socks5Client.socket));
      socks5Client.socket.on('error', error =>
        this.destroySocketIfUnclosed(
          socks5Client.socket,
          new SocksProxyServiceError(error as Error),
        ),
      );

      const tunnel = await super.connect(socks5Client.socket);

      if (tunnel) {
        // destroy the proxy socket when the tunnel is closed or an error occurs
        // this is very important to avoid unclose database connections
        tunnel.on('close', () => this.destroySocketIfUnclosed(socks5Client.socket));
        tunnel.on('error', error =>
          this.destroySocketIfUnclosed(
            socks5Client.socket,
            new SocksProxyServiceError(error as Error),
          ),
        );
      }

      return tunnel;
    } catch (error) {
      if (socks5Client?.socket) this.destroySocketIfUnclosed(socks5Client.socket);
      const serviceError = new SocksProxyServiceError(error as Error);
      this.errors.push(serviceError);
      throw serviceError;
    }
  }
}
