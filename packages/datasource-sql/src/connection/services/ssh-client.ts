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

  override async connectListener(socket?: net.Socket): Promise<net.Socket> {
    try {
      return await new Promise((resolve, reject) => {
        this.client.on('error', reject);
        this.client.on('ready', async () => {
          // when connection is ready
          resolve(await this.buildTunnel());
        });
        // connect to the SSH server
        this.client.connect({ ...this.options, sock: socket });
      });
    } catch (error) {
      this.errors.push(error);
      throw error;
    }
  }

  private async buildTunnel(): Promise<net.Socket> {
    // tell to the SSH server to forward all the traffic to the target host and port
    return new Promise<net.Socket>((resolve, reject) => {
      this.client.forwardOut(
        this.sourceHost,
        this.sourcePort,
        this.targetHost,
        this.targetPort,
        async (error, stream) => {
          if (error) {
            this.destroySocketIfUnclosed(stream, error);
            reject(error);
          }

          stream.on('error', e => this.destroySocketIfUnclosed(stream, e));
          stream.on('close', () => {
            this.destroySocketIfUnclosed(stream);
            this.client.end();
          });
          resolve(await super.connectListener(stream));
        },
      );
    });
  }
}
