#!/usr/bin/env bash
# =============================================================
#  OrinIDE — Universal Setup (Termux / Linux / macOS)
#  Made by Nandan Das — MIT License 2026
#
#  Installs: git, make, cmake, clang/gcc, python3, pip,
#            perl, ruby, lua, php, curl, wget, jq, zip/unzip
#
#  Safe to re-run any time — every step is idempotent.
# =============================================================
set -u

PURPLE='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

TOTAL=8
SPIN='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'

banner() {
  echo -e "\n${BOLD}${PURPLE}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${PURPLE}║   ${CYAN}OrinIDE${PURPLE}  —  Universal Environment Setup    ║${NC}"
  echo -e "${BOLD}${PURPLE}║   ${DIM}by Nandan Das  ·  MIT License 2026${NC}${PURPLE}          ║${NC}"
  echo -e "${BOLD}${PURPLE}╚══════════════════════════════════════════════╝${NC}\n"
}

step()  { echo -e "\n${CYAN}${BOLD}[$1/$TOTAL]${NC} ${BOLD}$2${NC}"; }
ok()    { echo -e "  ${GREEN}✔${NC} $1"; }
warn()  { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail()  { echo -e "  ${RED}✘${NC} $1"; }
info()  { echo -e "  ${DIM}$1${NC}"; }

# Run a command with a small spinner instead of a wall of package-manager
# output, but keep it silent-not-swallowed: on failure we surface the tail
# of the log instead of just guessing.
spin_run() {
  local label="$1"; shift
  local logfile; logfile=$(mktemp)
  ("$@" > "$logfile" 2>&1) &
  local pid=$!
  local i=0
  if [ -t 1 ]; then
    while kill -0 "$pid" 2>/dev/null; do
      i=$(( (i + 1) % ${#SPIN} ))
      printf "\r  ${CYAN}%s${NC} %s" "${SPIN:$i:1}" "$label"
      sleep 0.08
    done
  fi
  wait "$pid"; local status=$?
  printf "\r\033[K"
  if [ $status -eq 0 ]; then
    ok "$label"
  else
    warn "$label ${DIM}(non-fatal — see below)${NC}"
    tail -n 4 "$logfile" | sed 's/^/      /'
  fi
  rm -f "$logfile"
  return 0
}

banner

# ── Platform detection ──────────────────────────────────────────
PLATFORM="unknown"

if [ -n "${PREFIX:-}" ] && [[ "$PREFIX" == *"com.termux"* ]]; then
  PLATFORM="termux"
elif [ "$(uname -s 2>/dev/null)" = "Darwin" ]; then
  PLATFORM="macos"
elif command -v apt-get >/dev/null 2>&1; then
  PLATFORM="debian"
elif command -v dnf >/dev/null 2>&1; then
  PLATFORM="fedora"
elif command -v pacman >/dev/null 2>&1; then
  PLATFORM="arch"
fi

info "Detected platform: ${BOLD}$PLATFORM${NC}"

case "$PLATFORM" in
  termux)  PKG_MGR="pkg";     PKG_UPDATE=(pkg update -y);;
  debian)  PKG_MGR="apt-get"; PKG_UPDATE=(sudo apt-get update -y);;
  fedora)  PKG_MGR="dnf";     PKG_UPDATE=(sudo dnf makecache -y);;
  arch)    PKG_MGR="pacman";  PKG_UPDATE=(sudo pacman -Sy --noconfirm);;
  macos)
    if ! command -v brew >/dev/null 2>&1; then
      warn "Homebrew not found."
      info "Install it from https://brew.sh, then re-run this script."
      exit 0
    fi
    PKG_MGR="brew"; PKG_UPDATE=(brew update);;
  *)
    warn "Unrecognized platform — skipping automatic package install."
    info "OrinIDE still runs fine here as long as Node.js 18+ is installed."
    info "Install manually if needed: git, python3, curl, wget, unzip."
    exit 0
    ;;
esac

# ── Helper: install one package, translating names per-platform ────
# Usage: install_pkg <termux> <debian> <fedora> <arch> <brew>
# Pass "-" for a platform where the package doesn't apply.
install_pkg() {
  local termux="$1" debian="$2" fedora="$3" arch="$4" brew="$5"
  local name
  case "$PLATFORM" in
    termux) name="$termux" ;;
    debian) name="$debian" ;;
    fedora) name="$fedora" ;;
    arch)   name="$arch"   ;;
    macos)  name="$brew"   ;;
  esac
  [ "$name" = "-" ] && return 0

  case "$PKG_MGR" in
    pkg)     spin_run "$name" pkg install -y "$name" ;;
    apt-get) spin_run "$name" sudo apt-get install -y "$name" ;;
    dnf)     spin_run "$name" sudo dnf install -y "$name" ;;
    pacman)  spin_run "$name" sudo pacman -S --noconfirm "$name" ;;
    brew)    spin_run "$name" brew install "$name" ;;
  esac
}

# ── 1. Update package index ─────────────────────────────────────
step 1 "Updating package index ($PKG_MGR)..."
spin_run "package index" "${PKG_UPDATE[@]}"

# ── 2. Core build tools ─────────────────────────────────────────
step 2 "Installing build tools (git, make, cmake, pkg-config)..."
install_pkg git git git git git
install_pkg make make make make make
install_pkg cmake cmake cmake cmake cmake
install_pkg pkg-config pkg-config pkgconf pkgconf pkg-config
[ "$PLATFORM" != "macos" ] && install_pkg binutils binutils binutils binutils -

# ── 3. C / C++ compiler ──────────────────────────────────────────
step 3 "Installing C / C++ compiler..."
if [ "$PLATFORM" = "macos" ]; then
  if xcode-select -p >/dev/null 2>&1; then
    ok "Xcode command-line tools already installed"
  else
    warn "Run 'xcode-select --install' to get clang, then re-run this script."
  fi
else
  install_pkg clang clang clang clang -
fi

# ── 4. Python 3 ───────────────────────────────────────────────────
step 4 "Installing Python 3 + pip..."
install_pkg python python3 python3 python python
install_pkg python-pip python3-pip python3-pip python-pip -

# ── 5. Node.js check ──────────────────────────────────────────────
step 5 "Checking Node.js..."
if command -v node > /dev/null 2>&1; then
  ok "Node.js $(node --version) already installed"
else
  install_pkg nodejs-lts nodejs nodejs nodejs node
fi

# ── 6. Scripting languages ────────────────────────────────────────
step 6 "Installing scripting languages (Perl, Ruby, Lua, PHP)..."
install_pkg perl perl perl perl perl
install_pkg ruby ruby ruby ruby ruby
install_pkg lua54 lua5.4 lua lua lua
install_pkg php php php php php

# ── 7. CLI tools + projects folder ────────────────────────────────
step 7 "Installing CLI tools and creating projects folder..."
install_pkg curl curl curl curl curl
install_pkg wget wget wget wget wget
install_pkg jq jq jq jq jq
install_pkg zip zip zip zip zip
install_pkg unzip unzip unzip unzip unzip
install_pkg tree tree tree tree tree
install_pkg htop htop htop htop htop
mkdir -p "$HOME/orin-ide-projects"
ok "~/orin-ide-projects created"

# ── 8. Verification ────────────────────────────────────────────────
step 8 "Verifying installation..."
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
echo -e "${BOLD}${GREEN}║              Setup Complete!                 ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo -e "\n  Start OrinIDE with: ${BOLD}${CYAN}orin-ide${NC}   (or ${BOLD}./start.sh${NC})\n"
