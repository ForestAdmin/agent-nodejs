import net from 'net';
import { Client } from 'ssh2';

import Events from './events';
import { SshOptions } from '../../types';

export default class SshClient extends Events {
  private readonly client: Client;
  private readonly options: SshOptions;
  private readonly sourceHost: string;
  private readonly sourcePort: number;
  private readonly targetHost: string;
  private readonly targetPort: number;

  constructor(
    options: SshOptions,
    sourceHost: string,
    sourcePort: number,
    targetHost: string,
    targetPort: number,
  ) {
    super();
    this.options = options;
    this.sourceHost = sourceHost;
    this.sourcePort = sourcePort;
    this.targetHost = targetHost;
    this.targetPort = targetPort;
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
        this.onReady(socket);
        resolve();
      });
      this.client.connect(this.options);
    });
  }

  private onReady(socket: net.Socket): void {
    this.client.forwardOut(
      this.sourceHost,
      this.sourcePort,
      this.targetHost,
      this.targetPort,
      async (err, stream) => {
        if (err) {
          this.errors.push(err);
          throw err;
        }

        stream.on('close', () => this.client.end());
        stream.on('error', e => this.errors.push(e));
        stream.pipe(socket).pipe(stream);
        await super.whenConnecting(stream);
      },
    );
  }
}
