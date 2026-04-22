import createMerchantApplicationTool from '../../../../src/integrations/kolar/tools/create-merchant-application';

describe('createMerchantApplicationTool', () => {
  const headers = { Authorization: 'Basic abc', 'Content-Type': 'application/json' };
  const baseUrl = 'https://backend-partners.up.railway.app';

  beforeEach(() => jest.clearAllMocks());

  beforeAll(() => {
    global.fetch = jest.fn() as jest.Mock;
  });

  it('should throw on HTTP error during application creation', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: 'Validation failed' }),
    });

    const tool = createMerchantApplicationTool(headers, baseUrl);

    await expect(
      tool.invoke({
        companyName: 'LEETCHI',
        companySiren: '508289828',
        websiteUrl: 'https://leetchi.com',
        legalRepName: 'Céline Lazorthes',
      }),
    ).rejects.toThrow('Kolar create merchant application failed (400): Validation failed');
  });

  it('should throw on HTTP error during job creation', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Job creation failed' }),
      });

    const tool = createMerchantApplicationTool(headers, baseUrl);

    await expect(
      tool.invoke({
        companyName: 'LEETCHI',
        companySiren: '508289828',
        websiteUrl: 'https://leetchi.com',
        legalRepName: 'Céline Lazorthes',
      }),
    ).rejects.toThrow(
      'Kolar trigger merchant application analysis failed (500): Job creation failed',
    );
  });

  it('should create application and trigger analysis with required fields', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const tool = createMerchantApplicationTool(headers, baseUrl);
    const input = {
      companyName: 'LEETCHI',
      companySiren: '508289828',
      websiteUrl: 'https://leetchi.com',
      legalRepName: 'Céline Lazorthes',
    };

    const result = await tool.invoke(input);

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/merchant-application/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/merchant-application-job/create/42`, {
      method: 'POST',
      headers,
    });
    expect(result).toBe(JSON.stringify({ id: 42 }));
  });

  it('should create application with optional fields', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 99 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const tool = createMerchantApplicationTool(headers, baseUrl);

    await tool.invoke({
      companyName: 'LEETCHI',
      companySiren: '508289828',
      websiteUrl: 'https://leetchi.com',
      legalRepName: 'Céline Lazorthes',
      emailDomain: 'leetchi.com',
      phone: '+33184170000',
      businessDescription: 'Cagnotte en ligne',
    });

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/merchant-application/create`,
      expect.objectContaining({
        body: expect.stringContaining('"emailDomain":"leetchi.com"'),
      }),
    );
  });
});
