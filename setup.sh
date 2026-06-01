#!/bin/bash
# =============================================================
#  OrinIDE — Full Termux Setup
#  Made by Nandan Das — MIT License 2026
#  Installs: git, make, cmake, clang, python, pip,
#            perl, ruby, lua, php, curl, wget, jq, zip
# =============================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TOTAL=7

step() { echo -e "\n${CYAN}${BOLD}[$1/$TOTAL]${NC} ${BOLD}$2${NC}"; }
ok()   { echo -e "  ${GREEN}✔${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }

echo -e "\n${BOLD}${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║      OrinIDE Full Setup — Nandan Das         ║${NC}"
echo -e "${BOLD}${BLUE}║      MIT License 2026                        ║${NC}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════╝${NC}\n"

# ── Guard: Termux only ────────────────────────────────────────
if [ -z "$PREFIX" ] || [[ "$PREFIX" != *"com.termux"* ]]; then
  echo -e "${YELLOW}Not Termux — skipping.${NC}"
  exit 0
fi

# ── Helper: install one package ───────────────────────────────
install_pkg() {
  local name="$1"
  echo -e "  ${CYAN}→${NC} $name"
  pkg install -y "$name" > /dev/null 2>&1 && ok "$name" || warn "$name (may already be installed)"
}

# ── 1. Update ─────────────────────────────────────────────────
step 1 "Updating Termux package lists..."
pkg update -y > /dev/null 2>&1
ok "Package lists updated"

# ── 2. Core build tools ───────────────────────────────────────
step 2 "Installing build tools (git, make, cmake, pkg-config, binutils)..."
install_pkg git
install_pkg make
install_pkg cmake
install_pkg pkg-config
install_pkg binutils

# ── 3. C / C++ ───────────────────────────────────────────────
step 3 "Installing C / C++ compiler (clang)..."
install_pkg clang

# ── 4. Python 3 ──────────────────────────────────────────────
step 4 "Installing Python 3 + pip..."
install_pkg python
install_pkg python-pip

# ── 5. Node.js check ──────────────────────────────────────────
step 5 "Checking Node.js..."
if command -v node > /dev/null 2>&1; then
  ok "Node.js $(node --version) already installed"
else
  install_pkg nodejs-lts
fi

# ── 6. Scripting languages ────────────────────────────────────
step 6 "Installing scripting languages (Perl, Ruby, Lua, PHP)..."
install_pkg perl
install_pkg ruby
install_pkg lua54
install_pkg php

# ── 7. CLI tools + projects folder ───────────────────────────
step 7 "Installing CLI tools and creating projects folder..."
install_pkg curl
install_pkg wget
install_pkg jq
install_pkg zip
install_pkg unzip
install_pkg tree
install_pkg htop
mkdir -p "$HOME/orin-ide-projects"
ok "~/orin-ide-projects created"

# ── Verification ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}  Installed tools:${NC}"
echo ""

check_cmd() {
  local name="$1" cmd="$2"
  if command -v "$cmd" > /dev/null 2>&1; then
    local ver; ver=$("$cmd" --version 2>/dev/null | head -1 | cut -c1-45 || echo "installed")
    printf "  ${GREEN}✔${NC}  %-16s %s\n" "$name" "$ver"
  else
    printf "  ${YELLOW}-${NC}  %-16s not found\n" "$name"
  fi
}

check_cmd "Node.js"       node
check_cmd "npm"           npm
check_cmd "Python 3"      python3
check_cmd "pip"           pip3
check_cmd "git"           git
check_cmd "clang (C)"     clang
check_cmd "clang++ (C++)" clang++
check_cmd "make"          make
check_cmd "cmake"         cmake
check_cmd "Perl"          perl
check_cmd "Ruby"          ruby
check_cmd "Lua"           lua5.4
check_cmd "PHP"           php
check_cmd "curl"          curl
check_cmd "wget"          wget
check_cmd "jq"            jq

echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         Setup Complete!                      ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
