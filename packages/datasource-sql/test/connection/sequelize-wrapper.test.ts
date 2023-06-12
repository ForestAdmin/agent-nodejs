import { Sequelize } from 'sequelize';

import SequelizeWrapper from '../../src/connection/sequelize-wrapper';

describe('SequelizeWrapper', () => {
  describe('when sequelize is closed', () => {
    it('should run all onClose callbacks', async () => {
      const wrapper = new SequelizeWrapper({ uri: 'postgres://' });
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      wrapper.onClose(callback1);
      wrapper.onClose(callback2);

      await wrapper.sequelize.close();
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    describe('when a callback fails', () => {
      it('should run all the callbacks and throw the errors', async () => {
        const wrapper = new SequelizeWrapper({ uri: 'postgres://' });
        wrapper.onClose(async () => {
          throw new Error('error 1');
        });
        wrapper.onClose(async () => {
          throw new Error('error 2');
        });
        const callback = jest.fn();
        wrapper.onClose(callback);

        await expect(() => wrapper.sequelize.close()).rejects.toThrow(
          'Error: error 1\nError: error 2',
        );
        expect(callback).toHaveBeenCalled();
      });
    });

    describe('when sequelize close fails', () => {
      it('should run all the callbacks and throw the sequelize errors', async () => {
        const wrapper = new SequelizeWrapper({ uri: 'postgres://' });

        Sequelize.prototype.close = () => {
          throw new Error('sequelize error');
        };

        const callback = jest.fn();
        wrapper.onClose(callback);

        await expect(() => wrapper.sequelize.close()).rejects.toThrow('sequelize error');
        expect(callback).toHaveBeenCalled();
      });
    });
  });
});
