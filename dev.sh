#!/bin/bash
# Script para iniciar todos los servicios de LWBeta en desarrollo

echo "🔪 Limpiando procesos anteriores..."
killall node 2>/dev/null
sleep 1

echo "🚀 Iniciando sutra-dashboard en :3000..."
cd /home/maka/LWBETA/apps/sutra-dashboard
npm run dev &
DASHBOARD_PID=$!

echo "🚀 Iniciando sutra-monitor en :3001..."
cd /home/maka/LWBETA/apps/sutra-monitor
npm run start:dev &
MONITOR_PID=$!

echo "🚀 Iniciando legitwatch-comparator en :3002 (con auto-restart)..."
# Loop para reiniciar el comparador si muere
(
  while true; do
    cd /home/maka/LWBETA/apps/legitwatch-comparator
    npm run start:dev
    echo "⚠️  Comparador se detuvo. Reiniciando en 3 segundos..."
    sleep 3
  done
) &
COMPARATOR_PID=$!

echo ""
echo "✅ Servicios iniciados:"
echo "   Dashboard:  http://localhost:3000"
echo "   Monitor:    http://localhost:3001"
echo "   Comparador: http://localhost:3002"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"

trap "echo '🛑 Deteniendo servicios...'; kill $DASHBOARD_PID $MONITOR_PID $COMPARATOR_PID 2>/dev/null; killall node 2>/dev/null; exit" SIGINT SIGTERM

wait
