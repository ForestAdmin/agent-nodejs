import net from 'net';
import { Client } from 'ssh2';

import Events from './events';
import { SshOptions } from '../../types';

export default class SshClient extends Events {
  private readonly client: Client;
  private readonly options: SshOptions;
  private readonly sourceHost: string;
  private readonly sourcePort: number;

  constructor(options: SshOptions, sourceHost: string, sourcePort: number) {
    super();
    this.options = options;
    this.sourceHost = sourceHost;
    this.sourcePort = sourcePort;
    this.client = new Client();
  }

  override async whenClosing(): Promise<void> {
    try {
      await super.whenClosing();
    } finally {
      this.client.end();
    }
  }

  override async whenConnecting(socket: net.Socket): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.on('error', e => reject(e));
      this.client.on('ready', () => {
        this.onReady(socket, this.sourceHost, this.sourcePort);
        resolve();
      });
      this.client.connect(this.options);
    });
  }

  private onReady(clientSocket: net.Socket, sourceAddress: string, sourcePort: number): void {
    this.client.forwardOut(
      sourceAddress,
      sourcePort,
      this.options.dockerHost ?? this.options.host,
      this.options.port,
      async (err, stream) => {
        if (err) {
          this.errors.push(err);
          throw err;
        }

        stream.on('close', () => this.client.end());
        stream.on('error', e => this.errors.push(e));
        stream.pipe(clientSocket).pipe(stream);
        await this.whenConnecting(stream);
      },
    );
  }
}
