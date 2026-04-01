import createScreenTransactionTool from '../../../../src/integrations/kolar/tools/screen-transaction';

describe('createScreenTransactionTool', () => {
  const headers = { Authorization: 'Basic abc', 'Content-Type': 'application/json' };
  const baseUrl = 'https://backend-partners.up.railway.app';

  beforeEach(() => jest.clearAllMocks());

  beforeAll(() => {
    global.fetch = jest.fn() as jest.Mock;
  });

  it('should throw on HTTP error during alert creation', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ error: 'Validation failed' }),
    });

    const tool = createScreenTransactionTool(headers, baseUrl);

    await expect(
      tool.invoke({
        clientFirstName: 'John',
        clientLastName: 'Doe',
        matchFirstNames: 'John',
        matchLastNames: 'Doe',
        matchType: 'PEP',
      }),
    ).rejects.toThrow('Kolar create alert failed (422): Validation failed');
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

    const tool = createScreenTransactionTool(headers, baseUrl);

    await expect(
      tool.invoke({
        clientFirstName: 'John',
        clientLastName: 'Doe',
        matchFirstNames: 'John',
        matchLastNames: 'Doe',
        matchType: 'PEP',
      }),
    ).rejects.toThrow('Kolar create alert job failed (500): Job creation failed');
  });

  it('should create alert and trigger job with required fields', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 42 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const tool = createScreenTransactionTool(headers, baseUrl);
    const input = {
      clientFirstName: 'John',
      clientLastName: 'Doe',
      matchFirstNames: 'John',
      matchLastNames: 'Doe',
      matchType: 'PEP' as const,
    };

    const result = await tool.invoke(input);

    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/alert/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, additionalData: {} }),
    });
    expect(fetch).toHaveBeenCalledWith(`${baseUrl}/alert-job/create/42`, {
      method: 'POST',
      headers,
    });
    expect(result).toBe(JSON.stringify({ id: 42 }));
  });

  it('should create alert with optional fields', async () => {
    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 99 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    const tool = createScreenTransactionTool(headers, baseUrl);

    await tool.invoke({
      clientFirstName: 'John',
      clientLastName: 'Doe',
      matchFirstNames: 'John',
      matchLastNames: 'Doe',
      matchType: 'SL',
      merchantBrand: 'Acme',
      paymentCountry: 'FR',
      additionalData: { ref: '12345' },
    });

    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/alert/create`,
      expect.objectContaining({
        body: expect.stringContaining('"merchantBrand":"Acme"'),
      }),
    );
  });
});
