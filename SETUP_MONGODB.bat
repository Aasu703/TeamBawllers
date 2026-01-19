@echo off
echo ==========================================
echo   MongoDB Local Setup for Team
echo ==========================================
echo.

echo Step 1: Download MongoDB Community Server
echo.
echo Go to: https://www.mongodb.com/try/download/community
echo - Select "Windows" 
echo - Download the MSI installer
echo - Run installer, click NEXT on everything
echo - IMPORTANT: Check "Install MongoDB as a Service"
echo.
pause

echo.
echo Step 2: Allow MongoDB through Firewall (for team access)
echo.
echo Running firewall command...
netsh advfirewall firewall add rule name="MongoDB" dir=in action=allow protocol=TCP localport=27017
echo [OK] Firewall rule added!
echo.

echo Step 3: Find your IP address for team
echo.
echo Your IP addresses:
ipconfig | findstr /i "IPv4"
echo.
echo Share the 192.168.x.x IP with your team!
echo.

echo ==========================================
echo   MongoDB is ready!
echo ==========================================
echo.
echo Your team members should use this in their .env:
echo DATABASE_URL="mongodb://YOUR_IP:27017/cyberguardian"
echo.
pause
