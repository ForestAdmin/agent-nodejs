import superagent from 'superagent';
import start from '../src/index';

jest.unmock('superagent');

describe('index', () => {
  test('should start a server on port 3000', async () => {
    const stop = await start();
    const response = await superagent.get('http://127.0.0.1:3000/forest/');
    stop();

    expect(response.status).toBe(200);
  });
});
