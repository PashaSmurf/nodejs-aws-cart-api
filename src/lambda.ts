import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

let expressInstance: any;
let server: any;

async function bootstrapApp() {
  if (!expressInstance) {
    const expressApp = express();
    const adapter = new ExpressAdapter(expressApp);

    const nestFactory = await NestFactory.create(AppModule, adapter);
    nestFactory.enableCors({
      origin: (req: any, callback: any) => callback(null, true),
    });
    nestFactory.use(helmet());

    await nestFactory.init();
    expressInstance = expressApp;
  }
  return expressInstance;
}

export async function handler(event: any, context: any) {
  try {
    const app = await bootstrapApp();

    // Start server once
    if (!server) {
      await new Promise<void>((resolve) => {
        server = app.listen(3000, () => {
          resolve();
        });
      });
    }

    // Extract Lambda/API Gateway event
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
    const path = event.requestContext?.http?.path || event.path || '/';
    const rawQueryString = event.rawQueryString || '';
    const headers = event.headers || {};
    const body = event.body ? (typeof event.body === 'string' ? event.body : JSON.stringify(event.body)) : undefined;

    // Make internal request to the running server
    return new Promise((resolve) => {
      const http = require('http');

      const options = {
        hostname: 'localhost',
        port: 3000,
        path: path + (rawQueryString ? '?' + rawQueryString : ''),
        method: method,
        headers: {
          ...headers,
          'host': 'localhost'
        }
      };

      const timeoutId = setTimeout(() => {
        resolve({
          statusCode: 504,
          body: JSON.stringify({ message: 'Gateway timeout' })
        });
      }, 27000);

      const req = http.request(options, (res: any) => {
        let responseBody = '';
        res.on('data', (chunk: any) => {
          responseBody += chunk;
        });
        res.on('end', () => {
          clearTimeout(timeoutId);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseBody,
            isBase64Encoded: false
          });
        });
      });

      req.on('error', (err: any) => {
        clearTimeout(timeoutId);
        console.error('Request error:', err);
        resolve({
          statusCode: 500,
          body: JSON.stringify({ message: 'Internal server error', error: err.message })
        });
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  } catch (error: any) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
}
