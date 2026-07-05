#!/usr/bin/env bash
cd "$(dirname "$0")/backend"
[ ! -d node_modules ] && npm install --silent
mkdir -p ~/orin-ide-projects
echo ""
echo "OrinIDE starting at http://127.0.0.1:3000"
echo "Press Ctrl+C to stop"
echo ""
node server.js
