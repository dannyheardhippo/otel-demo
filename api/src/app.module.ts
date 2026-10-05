import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { ChaosModule } from './chaos/chaos.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'debug',
        autoLogging: {
          ignore: (req) => req.url === '/api/health',
        },
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    DatabaseModule,
    ProductsModule,
    OrdersModule,
    ChaosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
