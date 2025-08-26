import type { LLMRequest } from '@ai-gateway/types';
import { Body, Controller, Post } from '@nestjs/common';
import type { TaskQueueService } from '../services/task-queue.service';

interface OpenAIMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
}

@Controller('v1/chat')
export class OpenAIController {
  constructor(private taskQueue: TaskQueueService) {}

  @Post('completions')
  async createCompletion(@Body() body: OpenAIRequest) {
    const systemMessage = body.messages.find(m => m.role === 'system');
    const userMessages = body.messages.filter(m => m.role === 'user');

    const request: LLMRequest = {
      model: body.model,
      systemPrompt: systemMessage?.content,
      userPrompt: userMessages.map(m => m.content).join('\\n'),
      temperature: body.temperature,
      maxTokens: body.max_tokens,
      responseType: 'text',
    };

    const task = this.taskQueue.createTask(request);

    // Wait for task completion (in practice, you'd want to implement streaming)
    // This is a simplified implementation
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const currentTask = this.taskQueue.getTask(task.id);
        if (currentTask?.response) {
          clearInterval(checkInterval);
          resolve({
            id: task.id,
            choices: [{
              message: {
                role: 'assistant',
                content: currentTask.response.content,
              },
            }],
            usage: currentTask.response.usage,
          });
        }
      }, 100);
    });
  }
}