@echo off
echo Setting up Node.js Card Detection Service...
echo.
echo This will install OpenCV for Node.js (may take 5-10 minutes)
echo.
pause

echo Installing dependencies...
npm install

echo.
echo Setup complete! Starting service...
npm start