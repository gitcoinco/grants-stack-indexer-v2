#!/bin/bash
# --- System Setup: Update packages and install Node.js tools ---
apt update
apt install -y nodejs npm

# Install "n", the Node.js version manager globally
npm install -g n

# Install Node.js version 20 using "n"
n i 20

# Install pnpm (version 10.0.0) via the installer script
wget -qO- https://get.pnpm.io/install.sh | env PNPM_VERSION=10.0.0 sh -

echo "Dependencies installed successfully."