import axios from 'axios';

// Axios (HTTP requests) mock
jest.mock('axios');
const axiosMock = axios as jest.Mocked<typeof axios> & jest.Mock;

axiosMock.mockImplementation(({ url }) => {
  console.log(url, process.env.FOREST_SERVER_URL);
  if (url === `${process.env.FOREST_SERVER_URL}/api/full-hosted-agent/last-published-code-details`)
    return {
      status: 200,
      data: {
        relativeDate: 'a few seconds ago',
        user: { name: 'some developer', email: 'some.dev@forestadmin.com' },
      },
    };

  if (url === 'https://github.com/ForestAdmin/cloud-customizer/archive/main.zip') {
    return {
      status: 200,
      data: {
        pipe: () => {},
      },
    };
  }
});

export default axiosMock;
