import type { LLMRequest, Task } from '@ai-gateway/types';
import { Body, Controller, Post } from '@nestjs/common';
import type { 
  ChatCompletion, 
  ChatCompletionCreateParams
} from 'openai/resources/chat';
import type { TaskQueueService } from '../services/task-queue.service';

@Controller('v1/chat')
export class OpenAIController {

  constructor(private taskQueue: TaskQueueService) {
  }

  @Post('completions')
  async createCompletion(@Body() body: ChatCompletionCreateParams): Promise<ChatCompletion> {
    const systemMessage = body.messages.find((m) => m.role === 'system');
    const userMessages = body.messages.filter((m) => m.role === 'user');

    const request: LLMRequest = {
      model: body.model,
      systemPrompt: systemMessage?.content as string,
      userPrompt: userMessages.map((m) => m.content).join('\n'),
      temperature: body.temperature!,
      responseType: 'text',
    };

    const task = this.taskQueue.createTask(request);

    return new Promise((resolve, reject) => {
      const handleTaskComplete = (completedTask: Task) => {
        if (completedTask.id === task.id) {
          this.taskQueue.removeListener('taskComplete', handleTaskComplete);
          resolve({
            id: task.id,
            object: 'chat.completion',
            created: Date.now(),
            model: body.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant',
                content: completedTask.response?.content ?? "",
                refusal: null
              },
              finish_reason: 'stop',
              logprobs: null
            }],
            usage: completedTask.response?.usage,
          });
        }
      };

      this.taskQueue.on('taskComplete', handleTaskComplete);
    });
  }
}