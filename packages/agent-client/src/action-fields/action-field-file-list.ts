import ActionFieldFile from './action-field-file';

export default class ActionFieldFileList extends ActionFieldFile {
  async addFile(file: { mimeType: string; buffer: Buffer; name: string; charset?: string }) {
    const values = (this.field?.getValue() as string[]) || [];
    await this.setValue([...values, ActionFieldFileList.makeDataUri(file)]);
  }

  async removeFile(fileName: string) {
    const values = (this.field?.getValue() as string[]) || [];
    const filtered = values.filter(uri => !uri.includes(`name=${encodeURIComponent(fileName)}`));

    if (filtered.length === values.length) {
      throw new Error(`File "${fileName}" is not in the list`);
    }

    await this.setValue(filtered);
  }
}
