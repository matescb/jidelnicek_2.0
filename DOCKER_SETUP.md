# Docker Setup Instructions

## Starting Docker

Before you can use the Docker-based development environment, you need to start the Docker daemon.

### On Linux (systemd)

```bash
# Start Docker service
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Check Docker status
sudo systemctl status docker

# Add your user to docker group (to avoid using sudo)
sudo usermod -aG docker $USER
# Log out and back in for this to take effect
```

### On macOS

```bash
# If using Docker Desktop, start it from Applications
open -a Docker

# Or if using Docker via Homebrew
brew services start docker
```

### On Windows

1. Start Docker Desktop from the Start Menu
2. Wait for the Docker icon in the system tray to indicate Docker is running

## Verifying Docker Installation

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version

# Test Docker installation
docker run hello-world
```

## Using the Development Environment

Once Docker is running, you can use the provided scripts:

```bash
# Set up the development environment (first time only)
./scripts/dev-setup.sh

# Start the development environment
./scripts/dev-start.sh

# Start with additional tools (pgAdmin, Redis Commander)
./scripts/dev-start.sh --with-tools

# Stop the environment
./scripts/dev-stop.sh

# Reset everything (WARNING: deletes all data!)
./scripts/dev-reset.sh
```

## Docker Compose Commands

If you prefer to use Docker Compose directly:

```bash
# Start services (PostgreSQL, Redis, Mailhog)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d db redis mailhog

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Remove volumes (reset data)
docker-compose down -v
```

## Troubleshooting

### Permission Denied

If you get "permission denied" errors:

```bash
# Add yourself to docker group
sudo usermod -aG docker $USER

# Restart your session or run
newgrp docker
```

### Cannot Connect to Docker Daemon

If you see "Cannot connect to the Docker daemon":

1. Make sure Docker is installed: `which docker`
2. Check if the service is running: `sudo systemctl status docker`
3. Start the service: `sudo systemctl start docker`
4. If using Docker Desktop, make sure it's running

### Port Conflicts

If ports are already in use:

```bash
# Check what's using a port (e.g., 5432)
sudo lsof -i :5432

# Kill the process if needed
sudo kill -9 <PID>
```

## Alternative: Running Without Docker

If you can't use Docker, you can run the application locally:

```bash
# Install PostgreSQL and Redis locally
# Then use the local development script
./scripts/dev-local.sh --migrate
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for detailed instructions on running without Docker.