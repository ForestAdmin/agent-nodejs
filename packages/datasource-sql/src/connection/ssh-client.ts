import net from 'net';
import { Client } from 'ssh2';

import ConnectionOptionsWrapper from '../connection-options-wrapper';
import { ConnectionOptionsObj, Ssh } from '../types';

export default class SshClient {
  private readonly connection: Client;
  private readonly wrapper: ConnectionOptionsWrapper;
  private readonly socket: net.Socket;

  constructor(socket: net.Socket, options: ConnectionOptionsObj) {
    this.wrapper = new ConnectionOptionsWrapper(options);
    this.connection = new Client();
    this.socket = socket;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connection.on('error', e => {
        reject(e);
      });
      this.connection.on('ready', () => {
        // TO change?
        this.onReady(this.socket, '127.0.0.1', 10);
        resolve();
      });
      this.connection.connect(this.wrapper.options.ssh as Ssh);
    });
  }

  private onReady(clientSocket: net.Socket, sourceAddress: string, sourcePort: number): void {
    this.connection.forwardOut(
      sourceAddress,
      sourcePort,
      this.wrapper.hostFromUriOrOptions,
      this.wrapper.portFromUriOrOptions,
      (err, stream) => {
        if (err) throw err;
        stream.on('close', () => this.connection.end());
        stream.pipe(clientSocket).pipe(stream);
      },
    );
  }
}
