import { NestFactory } from '@nestjs/core';

import helmet from 'helmet';

import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule);

    const configService = app.get(ConfigService);

    const port = configService.get('APP_PORT') || 3000;

    app.enableCors({
      origin: (req, callback) => callback(null, true),
    });
    app.use(helmet());

    await app.listen(port, '0.0.0.0', () => {
      console.log('App is running on %s port', port);
    });
  } catch (error) {
    console.error('Failed to bootstrap application:', error);
    process.exit(1);
  }
}
bootstrap();
