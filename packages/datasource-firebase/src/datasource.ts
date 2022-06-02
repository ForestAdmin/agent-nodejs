import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import FirebaseCollection from './collection';

export default class FirebaseDatasource extends BaseDataSource<FirebaseCollection> {
  constructor(private readonly logger?: Logger) {
    super();
  }
}
