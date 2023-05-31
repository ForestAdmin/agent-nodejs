import net from 'net';
import { Client } from 'ssh2';

import { ConnectionOptionsObj } from '../types';

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
        this.onReady(this.socket, '10.0.0.1', 10);
        resolve();
      });
      this.connection.connect({
        ...this.destination.ssh,
        host: 'localhost',
      });
    });
  }

  private onReady(clientSocket: net.Socket, sourceAddress: string, sourcePort: number): void {
    this.connection.forwardOut(
      sourceAddress,
      sourcePort,
      this.destinationHost,
      this.destinationPort,
      (err, stream) => {
        if (err) throw err;
        stream.on('close', () => this.connection.end());
        stream.pipe(clientSocket).pipe(stream);
      },
    );
  }

  private get destinationHost(): string {
    return this.destination.uri ? new URL(this.destination.uri).hostname : this.destination.host;
  }

  private get destinationPort(): number {
    return Number(
      this.destination.uri ? new URL(this.destination.uri).port : this.destination.port,
    );
  }
}
