#!/bin/bash
# Folio Docker Compose Deployment Script
# Builds and deploys the full stack: Folio + Kavita + ABS + Caddy
#
# Usage:
#   ./deploy.sh                    # Deploy with ../../docker-compose.yml
#   ./deploy.sh -f ../../docker-compose.yml   # Custom compose path
#   ./deploy.sh --pull             # Pull latest images first
#   ./deploy.sh --down             # Stop existing stack first

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE=""
PULL=false
DOWN=false

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        --pull)
            PULL=true
            shift
            ;;
        --down)
            DOWN=true
            shift
            ;;
        -h|--help)
            echo "Usage: ./deploy.sh [-f COMPOSE_FILE] [--pull] [--down]"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Default compose file relative to scripts/ directory
if [[ -z "$COMPOSE_FILE" ]]; then
    COMPOSE_FILE="$(cd "$SCRIPT_DIR/../.." && pwd)/docker-compose.yml"
fi

echo "========================================"
echo "Folio Docker Compose Deployment"
echo "========================================"
echo "Compose file: $COMPOSE_FILE"

# Verify compose file exists
if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "ERROR: Compose file not found: $COMPOSE_FILE"
    exit 1
fi

# Stop existing stack if requested
if $DOWN; then
    echo ""
    echo "[1/3] Stopping existing stack..."
    docker compose -f "$COMPOSE_FILE" down
fi

# Pull latest images if requested
if $PULL; then
    echo ""
    echo "[1/3] Pulling latest images..."
    docker compose -f "$COMPOSE_FILE" pull
fi

# Build and start
echo ""
echo "[1/3] Building and starting services..."
docker compose -f "$COMPOSE_FILE" up -d --build

# Health check
echo ""
echo "[2/3] Checking service status..."
sleep 3
docker compose -f "$COMPOSE_FILE" ps

# Test endpoints
echo ""
echo "[3/3] Testing endpoints..."

test_endpoint() {
    local name="$1"
    local url="$2"
    if curl -sf -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200\|301\|302"; then
        echo "  $name: OK"
    else
        echo "  $name: Not ready yet (expected during startup)"
    fi
}

test_endpoint "Folio" "http://localhost:3001"
test_endpoint "Kavita" "http://localhost:8050/api/health"
test_endpoint "ABS" "http://localhost:81"

echo ""
echo "========================================"
echo "Deployment complete!"
echo "========================================"
echo "Folio:     http://localhost:3001"
echo "Kavita:    http://localhost:8050"
echo "ABS:       http://localhost:81"
echo ""
echo "To view logs: docker compose -f $COMPOSE_FILE logs -f"
echo "To stop:     docker compose -f $COMPOSE_FILE down"
