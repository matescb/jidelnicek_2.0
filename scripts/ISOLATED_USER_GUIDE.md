# Isolated Development User Guide

## Quick Setup

1. Run the setup script as root:
   ```bash
   sudo bash scripts/setup-isolated-user.sh
   ```

2. Log out and log back in (required for group changes)

3. Switch to the development user:
   ```bash
   dev-switch
   # or
   sudo -u jidelnicek-dev -i
   ```

## What the Isolated User Can Do

### ✅ Allowed Actions:
- Full read/write access to `/mnt/data/WORK/Jidelnicek_2.0`
- Install Python packages via pip and Poetry
- Create and use Python virtual environments
- Run Docker and docker-compose commands
- Install specific development packages (python3-dev, postgresql-client, redis-tools)
- Access the shared directory at `/home/jidelnicek-dev/shared`

### ❌ Restricted Actions:
- Cannot access your personal home directory
- Cannot install arbitrary system packages
- Cannot modify system configuration files
- Cannot access other users' files
- Cannot change system services

## Working with the Isolated User

### Switching Users
```bash
# From your normal user to dev user
dev-switch

# Run a single command as dev user
sudo -u jidelnicek-dev command_here

# Return to your normal user
exit
```

### File Permissions
All files in the project directory are owned by `jidelnicek-dev:jidelnicek-devs`. Your normal user is part of the `jidelnicek-devs` group, so you can still access files.

### Installing Dependencies

As the dev user:
```bash
# Python packages (in virtual environment)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Or with Poetry
poetry install

# System packages (limited set)
sudo apt-get install python3-dev postgresql-client
```

### Docker Usage

The dev user can run Docker commands:
```bash
docker-compose up -d
docker ps
docker logs container_name
```

## Security Features

1. **Limited sudo access**: Only specific commands are allowed
2. **Filesystem isolation**: Can't access other users' files
3. **No system modification**: Can't change critical system settings
4. **AppArmor profile** (optional): Additional sandboxing

## Troubleshooting

### Permission Denied
If you get permission errors:
```bash
# Check file ownership
ls -la /mnt/data/WORK/Jidelnicek_2.0

# Fix permissions if needed (as root)
sudo chown -R jidelnicek-dev:jidelnicek-devs /mnt/data/WORK/Jidelnicek_2.0
sudo chmod -R 775 /mnt/data/WORK/Jidelnicek_2.0
```

### Can't Install Package
The dev user can only install specific packages. For other packages, install them from your main user:
```bash
# From your normal user
sudo apt-get install package-name
```

### Group Not Updated
If you can't access files after setup:
```bash
# Log out completely and log back in
# Or refresh groups without logging out
newgrp jidelnicek-devs
```

## Optional: Enable AppArmor Profile

For extra security, enable the AppArmor profile:
```bash
sudo cp scripts/apparmor-profile-jidelnicek-dev /etc/apparmor.d/home.jidelnicek-dev
sudo apparmor_parser -r /etc/apparmor.d/home.jidelnicek-dev
sudo aa-enforce /etc/apparmor.d/home.jidelnicek-dev
```

## Removing the Isolated User

To completely remove the setup:
```bash
# Remove user and home directory
sudo userdel -r jidelnicek-dev

# Remove group
sudo groupdel jidelnicek-devs

# Remove sudo permissions
sudo rm /etc/sudoers.d/jidelnicek-dev

# Remove convenience script
sudo rm /usr/local/bin/dev-switch

# Remove AppArmor profile if enabled
sudo rm /etc/apparmor.d/home.jidelnicek-dev
```