import path from 'path';
import { spawn } from 'child_process';

function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        NO_PROXY: '127.0.0.1,localhost',
        no_proxy: '127.0.0.1,localhost',
        HTTP_PROXY: '',
        HTTPS_PROXY: '',
        ALL_PROXY: '',
      },
      stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Script failed with code=${String(code)} signal=${String(signal)}`));
    });
    child.on('error', reject);
  });
}

describe('vercel ai sdk via gateway openai api', () => {
  test('non-stream, stream, and tool-call scenarios pass', async () => {
    const script = path.resolve(__dirname, '../scripts/vercel-ai-openai.mjs');
    await runScript(script);
  });
});
