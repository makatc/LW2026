import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // Enable CORS for frontend
    app.enableCors({
        origin: '*', // In production, restrict to dashboard domain
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    });

    const port = process.env.PORT || 3001;
    await app.listen(port);
    console.log(`🚀 Sutra Monitor running on port ${port}`);
    // Server ready
}
bootstrap();
