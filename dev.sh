#!/bin/bash
# Script para iniciar todos los servicios de LW2026 en desarrollo

ROOT=/home/maka/PROYECTOS/LW2026

echo "Limpiando procesos anteriores..."
killall node 2>/dev/null
sleep 1

echo "Iniciando Postgres y Redis via Docker..."
cd "$ROOT" && docker compose up postgres redis -d
echo "Esperando que Redis esté listo..."
until docker compose exec redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 1
done
echo "Redis listo en :6380"
echo "Esperando que Postgres esté listo..."
until docker compose exec postgres pg_isready -U postgres -d sutra_monitor 2>/dev/null | grep -q "accepting connections"; do
  sleep 1
done
echo "Postgres listo en :5433"

echo "Iniciando sutra-dashboard en :3000..."
cd "$ROOT/apps/sutra-dashboard" && pnpm dev &
DASHBOARD_PID=$!

echo "Iniciando sutra-monitor en :3001..."
cd "$ROOT/apps/sutra-monitor" && pnpm start:dev &
MONITOR_PID=$!

echo "Iniciando legitwatch-comparator en :3002..."
(
  while true; do
    cd "$ROOT/apps/legitwatch-comparator" && pnpm start:dev
    echo "Comparador se detuvo. Reiniciando en 3 segundos..."
    sleep 3
  done
) &
COMPARATOR_PID=$!

echo "Iniciando lw-dossier en :3003..."
cd "$ROOT/apps/lw-dossier" && pnpm dev &
DOSSIER_PID=$!

echo "Iniciando lw-rag-engine en :3004..."
cd "$ROOT/apps/lw-rag-engine" && pnpm start:dev &
RAG_PID=$!

echo ""
echo "Servicios iniciados:"
echo "   sutra-dashboard:       http://localhost:3000"
echo "   sutra-monitor:         http://localhost:3001"
echo "   legitwatch-comparator: http://localhost:3002"
echo "   lw-dossier:            http://localhost:3003"
echo "   lw-rag-engine:         http://localhost:3004"
echo ""
echo "Presiona Ctrl+C para detener todo"

trap "echo 'Deteniendo servicios...'; kill $DASHBOARD_PID $MONITOR_PID $COMPARATOR_PID $DOSSIER_PID $RAG_PID 2>/dev/null; killall node 2>/dev/null; exit" SIGINT SIGTERM

wait
