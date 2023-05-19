/* eslint-disable max-len */

import Client from './utils/google';

/**
 * Configuration for the GOOGLE docs addon of Forest Admin.
 *
 * TODO: specify required GOOGLE authorization scopes
 * ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.appdata', 'https://www.googleapis.com/auth/drive.appfolder', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.resource', 'https://www.googleapis.com/auth/drive.metadata']
 */
export type Options = {
  /** Name of the field that you want to use as a file-picker on the frontend */
  fieldname: string;

  /**
   */
  readMode?: 'title' | 'download' | 'webViewLink' | 'webContentLink' | 'raw';

  /** GOOGLE configuration */
  google?: {
    /** GOOGLE API keys, defaults to process.env.GOOGLE_API_KEY. */
    auth?: string;

    /** Alternatively, you can specify the path to the GOOGLE service account credential file via the keyFile */
    // keyFile?: string;
  };
};

export type Configuration = Required<
  Pick<Options, 'readMode'> & {
    client: Client;
    sourcename: string;
    filename: string;
  }
>;
