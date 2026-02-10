-- Create the comparator database
CREATE DATABASE legitwatch_comparator;

-- Connect to the comparator database and enable pgvector
\c legitwatch_comparator;
CREATE EXTENSION IF NOT EXISTS vector;

-- Also enable pgvector in the default sutra_monitor database
\c sutra_monitor;
CREATE EXTENSION IF NOT EXISTS vector;
