import { ProxyTaskService } from '../services/proxy-task.service';

describe('ProxyTaskService', () => {
  test('resolveTask fulfills waiting promise', async () => {
    const svc = new ProxyTaskService();
    const pending = svc.createPendingTask('t1', 'sync', 1000);

    svc.resolveTask('t1', { taskId: 't1', result: { ok: true } });

    await expect(pending.waitForResult()).resolves.toEqual({ taskId: 't1', result: { ok: true } });
  });

  test('timeout rejects waiting promise with gateway timeout', async () => {
    const svc = new ProxyTaskService();
    const pending = svc.createPendingTask('t2', 'sync', 10);

    await expect(pending.waitForResult()).rejects.toMatchObject({
      code: 'gateway_timeout',
      taskId: 't2',
    });
  });
});
