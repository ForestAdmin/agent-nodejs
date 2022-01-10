import { Factory } from 'fishery';
import ForestHttpApi from '../../src/services/forest-http-api';

export default Factory.define<ForestHttpApi>(() => new ForestHttpApi('url.com', 'secret'));
