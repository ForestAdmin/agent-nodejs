import { Factory } from 'fishery';
import { IpRange } from '../../src/types';

export default Factory.define<IpRange>(() => ({
  ipMinimum: '10.1.1.2.3',
  ipMaximum: '10.1.1.2.10',
}));
