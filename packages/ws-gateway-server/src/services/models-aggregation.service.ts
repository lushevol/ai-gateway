import { Injectable } from '@nestjs/common';
import { ModelDescriptor, ModelsResponsePayload } from '../types/proxy-protocol';

interface PendingModelsRequest {
  expected: number;
  responses: ModelDescriptor[][];
  timer: NodeJS.Timeout;
  resolve: (models: ModelDescriptor[]) => void;
}

@Injectable()
export class ModelsAggregationService {
  private readonly pending = new Map<string, PendingModelsRequest>();

  waitForResponses(requestId: string, expected: number, timeoutMs: number): Promise<ModelDescriptor[]> {
    return new Promise<ModelDescriptor[]>((resolve) => {
      const timer = setTimeout(() => {
        const current = this.pending.get(requestId);
        if (!current) {
          return;
        }

        this.pending.delete(requestId);
        resolve(this.deduplicate(current.responses.flat()));
      }, timeoutMs);

      this.pending.set(requestId, {
        expected,
        responses: [],
        timer,
        resolve,
      });
    });
  }

  acceptResponse(payload: ModelsResponsePayload): void {
    const current = this.pending.get(payload.requestId);
    if (!current) {
      return;
    }

    current.responses.push(payload.models);
    if (current.responses.length >= current.expected) {
      clearTimeout(current.timer);
      this.pending.delete(payload.requestId);
      current.resolve(this.deduplicate(current.responses.flat()));
    }
  }

  deduplicate(models: ModelDescriptor[]): ModelDescriptor[] {
    const seen = new Set<string>();
    const result: ModelDescriptor[] = [];

    for (const model of models) {
      if (seen.has(model.id)) {
        continue;
      }

      seen.add(model.id);
      result.push(model);
    }

    return result;
  }
}
