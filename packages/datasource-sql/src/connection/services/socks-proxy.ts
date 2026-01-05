import type { ProxyOptions } from '../../types';
import type net from 'net';
import type { SocksClientEstablishedEvent } from 'socks/typings/common/constants';

import { SocksClient } from 'socks';

import Service from './service';
import { ProxyConnectError, ProxyForwardError } from '../errors';

export default class SocksProxy extends Service {
  private readonly options: ProxyOptions;

  constructor(proxyOptions: ProxyOptions, targetHost: string, targetPort: number) {
    super(proxyOptions.host, proxyOptions.port, targetHost, targetPort);
    this.options = proxyOptions;
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
      this.addConnectedClient(socks5Client.socket);
      socks5Client.socket.on('close', () =>
        this.destroySocketIfUnclosedAndSaveError(socks5Client.socket),
      );
      socks5Client.socket.on('error', error =>
        this.destroySocketIfUnclosedAndSaveError(
          socks5Client.socket,
          new ProxyConnectError(error.message, this.debugUri),
        ),
      );

      const tunnel = await super.connect(socks5Client.socket);

      if (tunnel) {
        // destroy the proxy socket when the tunnel is closed or an error occurs
        // this is very important to avoid unclose database connections
        tunnel.on('close', () => this.destroySocketIfUnclosedAndSaveError(socks5Client.socket));
        tunnel.on('error', error =>
          this.destroySocketIfUnclosedAndSaveError(
            socks5Client.socket,
            new ProxyConnectError(error.message, this.debugUri),
          ),
        );
      }

      return tunnel;
    } catch (error) {
      let serviceError = new ProxyConnectError(error.message, this.debugUri);

      if (
        error.message.includes('Socket closed') ||
        error.message.includes('Socks5 proxy rejected connection')
      ) {
        serviceError = new ProxyForwardError(error.message, this.debugForwardUri);
      }

      this.destroySocketIfUnclosedAndSaveError(socks5Client?.socket, serviceError);
      throw serviceError;
    }
  }
}
