import net from 'net';
import { SocksClient } from 'socks';

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
    try {
      const { socket } = await SocksClient.createConnection({
        proxy: { ...this.options, type: 5 },
        command: 'connect',
        destination: { host: this.targetHost, port: this.targetPort },
        timeout: 4000,
      });
      this.connectedClients.add(socket);
      this.onCloseEventDestroySocket(socket, socket);
      this.onErrorEventDestroySocket(socket, socket);

      const tunnel = await super.connectListener(socket);

      // destroy the proxy socket when the tunnel is closed or an error occurs
      // this is very important to avoid unclose database connections
      this.onCloseEventDestroySocket(tunnel, socket);
      this.onErrorEventDestroySocket(tunnel, socket);

      return tunnel;
    } catch (error) {
      this.errors.push(error);
      throw error;
    }
  }
}
