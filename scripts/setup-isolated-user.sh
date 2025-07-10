#!/bin/bash

# Setup script for creating an isolated development user
# This creates a limited user account for safe development work

set -e

# Configuration
DEV_USER="jidelnicek-dev"
PROJECT_DIR="/mnt/data/WORK/Jidelnicek_2.0"
DEV_GROUP="jidelnicek-devs"

echo "=== Setting up isolated development user ==="

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo "Please run this script with sudo: sudo bash $0"
    exit 1
fi

# Create development group
echo "Creating development group: $DEV_GROUP"
groupadd -f "$DEV_GROUP"

# Create the isolated user
echo "Creating user: $DEV_USER"
if id "$DEV_USER" &>/dev/null; then
    echo "User $DEV_USER already exists, skipping creation"
else
    useradd -m -s /bin/bash -G "$DEV_GROUP" "$DEV_USER"
    echo "User $DEV_USER created successfully"
fi

# Set up password for the user (optional)
echo "Setting password for $DEV_USER (you can change this later)"
passwd "$DEV_USER"

# Add current user to the development group
CURRENT_USER=$(logname)
echo "Adding $CURRENT_USER to $DEV_GROUP group"
usermod -a -G "$DEV_GROUP" "$CURRENT_USER"

# Set up project directory permissions
echo "Setting up project directory permissions..."
chown -R "$DEV_USER:$DEV_GROUP" "$PROJECT_DIR"
chmod -R 775 "$PROJECT_DIR"
# Set group sticky bit to maintain group ownership
find "$PROJECT_DIR" -type d -exec chmod g+s {} \;

# Create a shared directory for exchanging files
SHARED_DIR="/home/$DEV_USER/shared"
mkdir -p "$SHARED_DIR"
chown "$DEV_USER:$DEV_GROUP" "$SHARED_DIR"
chmod 775 "$SHARED_DIR"

# Set up limited sudo permissions for package management
echo "Setting up sudo permissions for package management..."
cat > "/etc/sudoers.d/$DEV_USER" <<EOF
# Allow $DEV_USER to install Python packages in virtual environments
$DEV_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get update
$DEV_USER ALL=(ALL) NOPASSWD: /usr/bin/apt-get install python3-venv python3-pip python3-dev postgresql-client libpq-dev redis-tools -y
$DEV_USER ALL=(ALL) NOPASSWD: /usr/bin/pip3 install *
$DEV_USER ALL=(ALL) NOPASSWD: /usr/bin/npm install *
$DEV_USER ALL=(ALL) NOPASSWD: /usr/bin/poetry install
$DEV_USER ALL=(ALL) NOPASSWD: /usr/bin/docker-compose *
$DEV_USER ALL=(ALL) NOPASSWD: /usr/bin/docker *
EOF

# Validate sudoers file
visudo -c -f "/etc/sudoers.d/$DEV_USER"

# Create environment setup for the dev user
echo "Creating environment setup..."
cat > "/home/$DEV_USER/.bashrc" <<'EOF'
# .bashrc for isolated development user

# Source global definitions
if [ -f /etc/bashrc ]; then
    . /etc/bashrc
fi

# User specific environment
export PATH=$PATH:$HOME/.local/bin
export PYTHONPATH=$HOME/.local/lib/python3.*/site-packages:$PYTHONPATH

# Project directory alias
alias cdproject='cd /mnt/data/WORK/Jidelnicek_2.0'

# Virtual environment helpers
alias mkvenv='python3 -m venv venv && source venv/bin/activate'
alias activate='source venv/bin/activate'

# Safety aliases
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# Poetry configuration
export POETRY_VIRTUALENVS_IN_PROJECT=true

# Welcome message
echo "=== Isolated Development Environment ==="
echo "User: $USER"
echo "Project: /mnt/data/WORK/Jidelnicek_2.0"
echo "Shared directory: ~/shared"
echo ""
echo "Commands:"
echo "  cdproject - Go to project directory"
echo "  mkvenv - Create virtual environment"
echo "  activate - Activate virtual environment"
echo ""

# Auto-cd to project directory
cd /mnt/data/WORK/Jidelnicek_2.0 2>/dev/null || true
EOF

chown "$DEV_USER:$DEV_USER" "/home/$DEV_USER/.bashrc"

# Create a convenience script for switching users
echo "Creating convenience script..."
cat > "/usr/local/bin/dev-switch" <<EOF
#!/bin/bash
# Switch to development user
echo "Switching to $DEV_USER..."
sudo -u "$DEV_USER" -i
EOF
chmod +x "/usr/local/bin/dev-switch"

# Create development tools installer
cat > "/home/$DEV_USER/install-dev-tools.sh" <<'EOF'
#!/bin/bash
# Install common development tools

echo "Installing development tools..."

# Install Poetry
curl -sSL https://install.python-poetry.org | python3 -

# Add Poetry to PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

echo "Development tools installed!"
echo "Please run: source ~/.bashrc"
EOF
chown "$DEV_USER:$DEV_USER" "/home/$DEV_USER/install-dev-tools.sh"
chmod +x "/home/$DEV_USER/install-dev-tools.sh"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Created user: $DEV_USER"
echo "Project directory: $PROJECT_DIR"
echo "Shared directory: /home/$DEV_USER/shared"
echo ""
echo "To switch to the development user, run:"
echo "  dev-switch"
echo "Or:"
echo "  sudo -u $DEV_USER -i"
echo ""
echo "IMPORTANT: Log out and back in for group changes to take effect!"
echo ""
echo "The dev user can:"
echo "  - Read/write to the project directory"
echo "  - Install Python packages with pip"
echo "  - Use Poetry for dependency management"
echo "  - Run Docker commands"
echo "  - Install specific apt packages (python, postgresql, redis tools)"
echo ""
echo "The dev user CANNOT:"
echo "  - Access your personal files"
echo "  - Install system-wide packages (except allowed ones)"
echo "  - Modify system configuration"
echo "  - Access other users' data"
