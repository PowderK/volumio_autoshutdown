#!/bin/bash
echo "Installing Autoshutdown plugin dependencies..."

# OnOff SHIM Checks
echo "Checking dependencies for Pimoroni OnOff SHIM..."
cleanshutd_found=true
gpio_tool_found=true

# 1. Check if cleanshutd service exists
if systemctl list-unit-files | grep -q "cleanshutd.service"; then
    echo "[OK] cleanshutd service is registered."
    if systemctl is-active --quiet cleanshutd; then
        echo "[OK] cleanshutd service is active/running."
    else
        echo "[WARNING] cleanshutd service is installed but NOT running."
    fi
else
    echo "[WARNING] cleanshutd service (OnOff SHIM daemon) was not found."
    cleanshutd_found=false
fi

# 2. Check for GPIO utilities
if command -v raspi-gpio >/dev/null 2>&1; then
    echo "[OK] raspi-gpio utility is available."
elif command -v gpio >/dev/null 2>&1; then
    echo "[OK] gpio utility (wiringPi) is available."
elif command -v gpioset >/dev/null 2>&1; then
    echo "[OK] gpioset utility (gpiod) is available."
else
    echo "[WARNING] No GPIO utility found (raspi-gpio, gpio, or gpioset). The plugin won't be able to trigger the OnOff SHIM."
    gpio_tool_found=false
fi

if [ "$cleanshutd_found" = true ] && [ "$gpio_tool_found" = true ]; then
    echo "[SUCCESS] All dependencies for Pimoroni OnOff SHIM are present."
else
    echo "[INFO] If you plan to use the Pimoroni OnOff SHIM, make sure to install it by running:"
    echo "       curl https://get.pimoroni.com/onoffshim | bash"
    echo "       and ensure a GPIO utility is installed."
fi

echo "Plugin Autoshutdown installed successfully."
