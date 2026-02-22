import { Module } from '@nestjs/common';
import { ClaudeController } from './controllers/claude.controller';
import { OpenAIController } from './controllers/openai.controller';
import { ProxyGateway } from './gateways/proxy.gateway';
import { ClientRegistryService } from './services/client-registry.service';
import { ModelsAggregationService } from './services/models-aggregation.service';
import { ProviderAdapterService } from './services/provider-adapter.service';
import { ProxyTaskService } from './services/proxy-task.service';

@Module({
  controllers: [OpenAIController, ClaudeController],
  providers: [
    ProxyGateway,
    ClientRegistryService,
    ProxyTaskService,
    ProviderAdapterService,
    ModelsAggregationService,
  ],
})
export class AppModule {}
