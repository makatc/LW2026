import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { LegislatorsScraper } from './src/scrapers/legislators/legislators.scraper';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  console.log('App loaded, running scraper...');
  const scraper = app.get(LegislatorsScraper);
  await scraper.runPipeline();
  console.log('Done!');
  process.exit(0);
}
bootstrap();
