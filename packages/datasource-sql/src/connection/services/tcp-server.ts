import net from 'net';

import Events from './events';

export default class TcpServer extends Events {
  private readonly server: net.Server;

  get host(): string {
    const { address } = this.server.address() as net.AddressInfo;

    return address;
  }

  get port(): number {
    const { port } = this.server.address() as net.AddressInfo;

    return port;
  }

  constructor() {
    super();
    this.server = net.createServer(this.whenConnecting.bind(this));
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
    });
  }

  override async whenClosing(): Promise<void> {
    await super.whenClosing();
    await this.stop();
  }
}
