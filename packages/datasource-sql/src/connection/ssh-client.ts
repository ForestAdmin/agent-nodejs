import net from 'net';
import { Client } from 'ssh2';

import ConnectionOptionsWrapper from '../connection-options-wrapper';
import { ConnectionOptionsObj, Ssh } from '../types';

export default class SshClient {
  private readonly connection: Client;
  private readonly destination: ConnectionOptionsObj;
  private readonly socket: net.Socket;

  constructor(socket: net.Socket, destination: ConnectionOptionsObj) {
    this.destination = destination;
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
      this.connection.connect(this.destination.ssh as Ssh);
    });
  }

  private onReady(clientSocket: net.Socket, sourceAddress: string, sourcePort: number): void {
    this.connection.forwardOut(
      sourceAddress,
      sourcePort,
      new ConnectionOptionsWrapper(this.destination).host,
      new ConnectionOptionsWrapper(this.destination).port,
      (err, stream) => {
        if (err) throw err;
        stream.on('close', () => this.connection.end());
        stream.pipe(clientSocket).pipe(stream);
      },
    );
  }
}
