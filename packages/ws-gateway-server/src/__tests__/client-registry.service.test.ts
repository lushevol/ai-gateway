import { ClientRegistryService } from '../services/client-registry.service';

describe('ClientRegistryService', () => {
  test('selectNextClient returns clients in round-robin order', () => {
    const svc = new ClientRegistryService();
    svc.registerSocket('a', { clientName: 'A', version: '1.0.0', localBaseUrl: 'http://127.0.0.1:8000' });
    svc.registerSocket('b', { clientName: 'B', version: '1.0.0', localBaseUrl: 'http://127.0.0.1:8001' });

    expect(svc.selectNextClient()?.socketId).toBe('a');
    expect(svc.selectNextClient()?.socketId).toBe('b');
    expect(svc.selectNextClient()?.socketId).toBe('a');
  });

  test('heartbeat updates lastSeen', () => {
    const svc = new ClientRegistryService();
    svc.registerSocket('a', { clientName: 'A', version: '1.0.0', localBaseUrl: 'http://127.0.0.1:8000' });

    const before = svc.listOnlineClients()[0].lastSeenAt.getTime();
    svc.markHeartbeat('a');
    const after = svc.listOnlineClients()[0].lastSeenAt.getTime();

    expect(after).toBeGreaterThanOrEqual(before);
  });
});
