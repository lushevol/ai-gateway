jest.mock('../index', () => ({
  startClient: jest.fn(),
}));

describe('CLI main entrypoint', () => {
  test('starts client when main module is loaded', async () => {
    await import('../main');
    const mod = await import('../index');
    expect(mod.startClient).toHaveBeenCalledTimes(1);
  });
});
