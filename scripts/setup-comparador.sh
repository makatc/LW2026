#!/bin/bash

# Setup script for LegalWatch Comparador
# This script helps setup the comparador app in Antigravity

set -e  # Exit on error

echo "🚀 LegalWatch Comparador - Setup Script"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must be run from the root of the LWBETA monorepo${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found monorepo root"

# Step 1: Check Docker services
echo ""
echo "Step 1: Checking Docker services..."
if ! docker compose ps | grep -q "postgres.*Up"; then
    echo -e "${YELLOW}⚠${NC} PostgreSQL is not running. Starting..."
    docker compose up -d postgres
    sleep 3
else
    echo -e "${GREEN}✓${NC} PostgreSQL is running"
fi

if ! docker compose ps | grep -q "redis.*Up"; then
    echo -e "${YELLOW}⚠${NC} Redis is not running. Starting..."
    docker compose up -d redis
    sleep 2
else
    echo -e "${GREEN}✓${NC} Redis is running"
fi

# Step 2: Create database
echo ""
echo "Step 2: Creating legitwatch_comparator database..."
DB_EXISTS=$(docker compose exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='legitwatch_comparator'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
    echo -e "${GREEN}✓${NC} Database 'legitwatch_comparator' already exists"
else
    echo "Creating database..."
    docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE legitwatch_comparator;" || {
        echo -e "${RED}✗${NC} Failed to create database"
        exit 1
    }
    echo -e "${GREEN}✓${NC} Database created"
fi

# Enable pgvector extension
echo "Enabling pgvector extension..."
docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
    echo -e "${YELLOW}⚠${NC} pgvector extension not available (will skip for now)"
}

# Step 3: Check .env file
echo ""
echo "Step 3: Checking environment configuration..."
if [ ! -f "apps/legitwatch-comparator/.env" ]; then
    echo -e "${YELLOW}⚠${NC} .env file not found. Creating from example..."
    if [ -f "apps/legitwatch-comparator/.env.example" ]; then
        cp apps/legitwatch-comparator/.env.example apps/legitwatch-comparator/.env
        echo -e "${GREEN}✓${NC} Created .env file"
        echo -e "${YELLOW}⚠${NC} Please edit apps/legitwatch-comparator/.env with your settings"
    else
        echo -e "${RED}✗${NC} .env.example not found"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} .env file exists"
fi

# Step 4: Install dependencies
echo ""
echo "Step 4: Installing dependencies..."
if [ ! -d "apps/legitwatch-comparator/node_modules" ]; then
    echo "Installing comparador dependencies..."
    cd apps/legitwatch-comparator
    npm install
    cd ../..
    echo -e "${GREEN}✓${NC} Dependencies installed"
else
    echo -e "${GREEN}✓${NC} Dependencies already installed"
fi

# Step 5: Run migrations
echo ""
echo "Step 5: Running database migrations..."
cd apps/legitwatch-comparator
if npm run migration:run 2>&1 | grep -q "Error"; then
    echo -e "${RED}✗${NC} Migrations failed"
    echo "This might be because PostgreSQL is not ready yet."
    echo "Try running: cd apps/legitwatch-comparator && npm run migration:run"
    cd ../..
else
    echo -e "${GREEN}✓${NC} Migrations completed"
    cd ../..
fi

# Step 6: Verify setup
echo ""
echo "Step 6: Verifying setup..."

# Check tables
TABLES=$(docker compose exec -T postgres psql -U postgres -d legitwatch_comparator -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" 2>/dev/null || echo "0")

if [ "$TABLES" -gt "0" ]; then
    echo -e "${GREEN}✓${NC} Database tables created ($TABLES tables)"
else
    echo -e "${YELLOW}⚠${NC} No tables found. Migrations may have failed."
fi

# Final summary
echo ""
echo "========================================"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Review and edit apps/legitwatch-comparator/.env if needed"
echo "2. Start the comparador:"
echo "   cd apps/legitwatch-comparator && npm run start:dev"
echo ""
echo "Or start all apps with Turborepo:"
echo "   npm run dev"
echo ""
echo "The comparador will be available at: http://localhost:3002"
echo ""
echo "For more details, see DEPLOYMENT.md"
echo ""
