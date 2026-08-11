import ActionField from './action-field';
import ActionFieldFile, { type FileInput } from './action-field-file';

export default class ActionFieldFileList extends ActionField {
  async add(file: FileInput) {
    const values = (this.field?.getValue() as string[]) || [];
    await this.setValue([...values, ActionFieldFile.makeDataUri(file)]);
  }

  async remove(fileName: string) {
    const values = (this.field?.getValue() as string[]) || [];
    const nameParam = `name=${encodeURIComponent(fileName)}`;
    const filtered = values.filter(uri => {
      const [metadata] = uri.split(';base64,');

      return !metadata.split(';').some(part => part === nameParam);
    });

    if (filtered.length === values.length) {
      throw new Error(`File "${fileName}" is not in the list`);
    }

    await this.setValue(filtered);
  }
}
