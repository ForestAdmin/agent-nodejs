import type { ConnectionParams } from '../types';
import type { Connection } from 'mongoose';
import type { AddressInfo, Server } from 'net';
import type { Client } from 'ssh2';
import type { ForwardOptions, ServerOptions, SshOptions, TunnelOptions } from 'tunnel-ssh';

import mongoose from 'mongoose';
import { createTunnel } from 'tunnel-ssh';

import { ConnectionError, SshConnectError } from '../errors';

function closeTunnel(client: Client, server: Server) {
  client.destroy();

  server.close(() => {
    // ignore error
  });
}

async function createSSHTunnel(uri: string, sshConfig: SshOptions) {
  const url = new URL(uri);
  const { hostname, port } = url;

  const tunnelOptions: TunnelOptions = {
    autoClose: false,
    reconnectOnError: false,
  };
  const serverOptions: ServerOptions = {};
  const forwardOptions: ForwardOptions = {
    dstPort: Number(port),
    dstAddr: hostname,
  };

  try {
    return await createTunnel(tunnelOptions, serverOptions, sshConfig, forwardOptions);
  } catch (e) {
    throw new SshConnectError(
      e.message,
      `ssh://${encodeURIComponent(sshConfig.username)}@${sshConfig.host}:${sshConfig.port || 22}`,
    );
  }
}

async function createMongooseConnection(
  uri: string,
  options: ConnectionParams['connection'],
  originalUrl?: string,
) {
  try {
    return await mongoose.createConnection(uri, options).asPromise();
  } catch (e) {
    if (e instanceof mongoose.MongooseError || e instanceof mongoose.mongo.MongoError) {
      const parsedUri = new URL(originalUrl || uri);
      parsedUri.password = '***';
      throw new ConnectionError(parsedUri.toString(), e.message);
    }

    throw e;
  }
}

async function createMongooseConnectionTroughSSH(params: ConnectionParams): Promise<Connection> {
  const { uri, connection } = params;
  const { ssh, ...mongooseOptions } = connection ?? {};

  const [server, client] = await createSSHTunnel(uri, ssh);

  try {
    const serverAddress = server.address() as AddressInfo;

    const modifiedUrl = new URL(uri);
    modifiedUrl.host = 'localhost';
    modifiedUrl.port = `${serverAddress?.port}`;

    const mongooseConnection = await createMongooseConnection(
      modifiedUrl.toString(),
      {
        ...mongooseOptions,
        // Needed because we are changing the url to use localhost instead
        tlsAllowInvalidHostnames: true,
      },
      uri,
    );

    mongooseConnection.once('close', closeTunnel.bind(null, client, server));

    return mongooseConnection;
  } catch (e) {
    closeTunnel(client, server);
    throw e;
  }
}

export default async function createConnection(params: ConnectionParams): Promise<Connection> {
  const { uri, connection } = params;
  const { ssh, ...mongooseOptions } = connection ?? {};

  if (ssh) {
    return createMongooseConnectionTroughSSH(params);
  }

  return createMongooseConnection(uri, mongooseOptions);
}
