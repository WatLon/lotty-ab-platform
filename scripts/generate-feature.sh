#!/bin/bash

set -euo pipefail

NAME=${1:-}
SERVICE=${2:-control-api}

if [ -z "$NAME" ]; then
  echo "Usage: ./generate-feature.sh FeatureName [service]"
  echo "Example: ./generate-feature.sh ChatGroup control-api"
  exit 1
fi

SERVICE_ROOT="src/apps/$SERVICE"
if [ ! -d "$SERVICE_ROOT" ]; then
  echo "Unknown service: $SERVICE"
  echo "Expected folder: $SERVICE_ROOT"
  exit 1
fi

KEBAB=$(echo "$NAME" | sed 's/\([a-z]\)\([A-Z]\)/\1-\2/g' | tr '[:upper:]' '[:lower:]')

mkdir -p "$SERVICE_ROOT/domain/$KEBAB/errors"
mkdir -p "$SERVICE_ROOT/domain/$KEBAB/value-objects"
mkdir -p "$SERVICE_ROOT/application/$KEBAB/commands"
mkdir -p "$SERVICE_ROOT/application/$KEBAB/queries"
mkdir -p "$SERVICE_ROOT/infrastructure/$KEBAB/persistence"
mkdir -p "$SERVICE_ROOT/presentation/$KEBAB/errors"
mkdir -p "$SERVICE_ROOT/presentation/$KEBAB/dto"

echo "Created feature structure: $NAME"
echo ""
echo "Service: $SERVICE"
echo "Directories:"
echo "  $SERVICE_ROOT/domain/$KEBAB/"
echo "  $SERVICE_ROOT/application/$KEBAB/"
echo "  $SERVICE_ROOT/infrastructure/$KEBAB/"
echo "  $SERVICE_ROOT/presentation/$KEBAB/"
