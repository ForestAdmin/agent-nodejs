import net from 'net';
import { SocksClient } from 'socks';

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
    if (!this.targetHost) throw new Error('Host is required');
    if (!this.targetPort) throw new Error('Port is required');
  }

  protected override async connect(): Promise<net.Socket> {
    try {
      const { socket } = await SocksClient.createConnection({
        proxy: { ...this.options, type: 5 },
        command: 'connect',
        destination: { host: this.targetHost, port: this.targetPort },
        timeout: 4000,
      });
      this.connectedClients.add(socket);
      socket.on('close', () => this.destroySocketIfUnclosed(socket));
      socket.on('error', error =>
        this.destroySocketIfUnclosed(socket, new SocksProxyServiceError(error as Error)),
      );

      const tunnel = await super.connect(socket);

      // destroy the proxy socket when the tunnel is closed or an error occurs
      // this is very important to avoid unclose database connections
      tunnel.on('close', () => this.destroySocketIfUnclosed(socket));
      tunnel.on('error', error =>
        this.destroySocketIfUnclosed(socket, new SocksProxyServiceError(error as Error)),
      );

      return tunnel;
    } catch (error) {
      const serviceError = new SocksProxyServiceError(error as Error);
      this.errors.push(serviceError);
      throw serviceError;
    }
  }
}
