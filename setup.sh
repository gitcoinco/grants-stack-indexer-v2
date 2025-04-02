#!/bin/bash

set -e  # Exit on any error

echo "🧹 Cleaning up existing containers..."
if ! docker-compose down -v; then
    echo "Error stopping containers"
    exit 1
fi

sleep 10

echo "🏗️ Building and starting containers..."
if ! docker-compose up -d --build; then
    echo "Error starting containers"
    exit 1
fi

echo "⏳ Waiting for database to be ready..."
sleep 60

echo "🔄 Running cache migrations..."
if ! pnpm db:cache:migrate; then
    echo "Error running cache migrations"
    exit 1
fi

echo "📦 Bootstrapping metadata..."
if ! pnpm bootstrap:metadata; then
    echo "Error bootstrapping metadata"
    exit 1
fi

echo "💰 Bootstrapping pricing..."
if ! pnpm bootstrap:pricing; then
    echo "Error bootstrapping pricing"
    exit 1
fi

echo "🗃️ Running database migrations..."
if ! pnpm db:migrate; then
    echo "Error running migrations"
    exit 1
fi

echo "⚙️ Configuring API..."
if ! pnpm api:configure; then
    echo "Error configuring API"
    exit 1
fi

echo "✅ Setup completed!"
