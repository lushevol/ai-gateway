import { ClientOptions } from './types';

export class LocalApiAdapter {
  constructor(private readonly options: ClientOptions) {}

  get baseUrl(): string {
    return this.options.localLlmBaseUrl;
  }
}
