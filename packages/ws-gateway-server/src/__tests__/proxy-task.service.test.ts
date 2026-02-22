import { ProxyTaskService } from '../services/proxy-task.service';

describe('ProxyTaskService', () => {
  test('resolveTask fulfills waiting promise', async () => {
    const svc = new ProxyTaskService();
    const pending = svc.createPendingTask('t1', 'sync', 1000, 'socket-a');

    svc.resolveTask('t1', 'socket-a', { taskId: 't1', result: { ok: true } });

    await expect(pending.waitForResult()).resolves.toEqual({ taskId: 't1', result: { ok: true } });
  });

  test('ignores completion from unexpected socket', async () => {
    const svc = new ProxyTaskService();
    const pending = svc.createPendingTask('t3', 'sync', 10, 'socket-a');

    svc.resolveTask('t3', 'socket-b', { taskId: 't3', result: { ok: true } });

    await expect(pending.waitForResult()).rejects.toMatchObject({
      code: 'gateway_timeout',
      taskId: 't3',
    });
  });

  test('timeout rejects waiting promise with gateway timeout', async () => {
    const svc = new ProxyTaskService();
    const pending = svc.createPendingTask('t2', 'sync', 10, 'socket-a');

    await expect(pending.waitForResult()).rejects.toMatchObject({
      code: 'gateway_timeout',
      taskId: 't2',
    });
  });
});
