import { Factory } from 'fishery';
import Scope from '../../dist/services/scope';

export default Factory.define<Scope>(() => new Scope('https://url.com', 'secret', 3600));
