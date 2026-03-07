import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import {
  Document,
  DocumentVersion,
  DocumentChunk,
  SourceSnapshot,
} from './entities';

config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'legitwatch_comparator',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [Document, DocumentVersion, DocumentChunk, SourceSnapshot],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: true,
});
