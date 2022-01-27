import { Factory } from 'fishery';
import Serializer from '../../dist/services/serializer';

export default Factory.define<Serializer>(() => new Serializer('prefix'));
