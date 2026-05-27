type MockResponse = {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
};

const makeResponse = (response: MockResponse) => ({
  json: async () => (response.json ? response.json() : {}),
  text: async () => (response.text ? response.text() : ''),
  ...response,
});

function setupDriveTest() {
  jest.resetModules();
  const values = new Map<string, string>();
  const storage = {
    getString: jest.fn((key: string) => values.get(key)),
    set: jest.fn((key: string, value: string) => { values.set(key, value); }),
    remove: jest.fn((key: string) => { values.delete(key); }),
  };

  jest.doMock('../lib/storage', () => ({ storage }));
  return {
    storage,
    fetchMock: jest.fn(),
    load: () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;
      const drive = require('../lib/drive') as typeof import('../lib/drive');
      return { drive, fetchMock };
    },
  };
}

describe('drive high-level helpers', () => {
  afterEach(() => {
    jest.dontMock('../lib/storage');
  });

  it('writeFile updates a valid cached id', async () => {
    const { storage, load } = setupDriveTest();
    storage.set('driveId:vault.json', 'cached-id');
    const { drive, fetchMock } = load();
    fetchMock.mockResolvedValueOnce(makeResponse({ ok: true, status: 200 }));

    await drive.writeFile('token', 'vault.json', { ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/upload/drive/v3/files/cached-id');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });

  it('writeFile clears stale cached id and creates when file no longer exists', async () => {
    const { storage, load } = setupDriveTest();
    storage.set('driveId:vault.json', 'stale-id');
    const { drive, fetchMock } = load();
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ files: [] }),
      }))
      .mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ id: 'new-id' }),
      }));

    await drive.writeFile('token', 'vault.json', { ok: true });

    expect(storage.remove).toHaveBeenCalledWith('driveId:vault.json');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('/upload/drive/v3/files?uploadType=multipart');
    expect(storage.getString('driveId:vault.json')).toBe('new-id');
  });

  it('writeFile clears stale cached id, finds by name, and updates existing file', async () => {
    const { storage, load } = setupDriveTest();
    storage.set('driveId:vault.json', 'stale-id');
    const { drive, fetchMock } = load();
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 404 }))
      .mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        json: async () => ({ files: [{ id: 'fresh-id', name: 'vault.json', modifiedTime: '' }] }),
      }))
      .mockResolvedValueOnce(makeResponse({ ok: true, status: 200 }));

    await drive.writeFile('token', 'vault.json', { ok: true });

    expect(storage.remove).toHaveBeenCalledWith('driveId:vault.json');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('/upload/drive/v3/files/fresh-id');
    expect(fetchMock.mock.calls[2][1].method).toBe('PATCH');
    expect(storage.getString('driveId:vault.json')).toBe('fresh-id');
  });
});
