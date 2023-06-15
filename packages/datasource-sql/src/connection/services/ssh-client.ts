import net from 'net';
import { Client } from 'ssh2';

import Service from './service';
import { SshOptions } from '../../types';

export default class SshClient extends Service {
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

  override async closeListener(): Promise<void> {
    try {
      await super.closeListener();
    } finally {
      this.client.end();
    }
  }

  override async connectListener(socket: net.Socket): Promise<void> {
    try {
      return await new Promise((resolve, reject) => {
        this.client.on('error', reject);
        this.client.on('ready', () => {
          // when connection is ready
          this.onReady(socket);
          resolve();
        });
        // connect to the SSH server
        this.client.connect(this.options);
      });
    } catch (e) {
      this.saveErrorAndDestroySocket(e, socket);
    }
  }

  private onReady(socket: net.Socket): void {
    // tell to the SSH server to forward all the traffic to the target host and port
    this.client.forwardOut(
      this.sourceHost,
      this.sourcePort,
      this.targetHost,
      this.targetPort,
      async (error, stream) => {
        if (error) this.saveErrorAndDestroySocket(error, socket);

        stream.on('error', e => this.saveErrorAndDestroySocket(e, socket));
        stream.on('close', () => this.client.end());
        socket.pipe(stream).pipe(socket);
        await super.connectListener(stream);
      },
    );
  }

  saveErrorAndDestroySocket(error: Error, socket: net.Socket): void {
    this.errors.push(error);
    if (!socket.destroyed) socket.destroy();
  }
}
