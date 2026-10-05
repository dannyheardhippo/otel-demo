import { Module } from '@nestjs/common';
import { ChaosController } from './chaos.controller';

@Module({
  controllers: [ChaosController],
})
export class ChaosModule {}
