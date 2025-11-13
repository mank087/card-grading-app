@echo off
echo Starting Card Detection Service (PATH Fix)...
echo.

REM Try common Python installation paths
set PYTHON_PATH=""

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" (
    set PYTHON_PATH="C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe"
    set PIP_PATH="C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\Scripts\pip.exe"
)

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python313\python.exe" (
    set PYTHON_PATH="C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python313\python.exe"
    set PIP_PATH="C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python313\Scripts\pip.exe"
)

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe" (
    set PYTHON_PATH="C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe"
    set PIP_PATH="C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\Scripts\pip.exe"
)

if exist "C:\Python311\python.exe" (
    set PYTHON_PATH="C:\Python311\python.exe"
    set PIP_PATH="C:\Python311\Scripts\pip.exe"
)

if exist "C:\Python312\python.exe" (
    set PYTHON_PATH="C:\Python312\python.exe"
    set PIP_PATH="C:\Python312\Scripts\pip.exe"
)

REM Check Microsoft Store version
if exist "C:\Users\%USERNAME%\AppData\Local\Microsoft\WindowsApps\python.exe" (
    set PYTHON_PATH="C:\Users\%USERNAME%\AppData\Local\Microsoft\WindowsApps\python.exe"
    set PIP_PATH="C:\Users\%USERNAME%\AppData\Local\Microsoft\WindowsApps\pip.exe"
)

if %PYTHON_PATH%=="" (
    echo Python installation not found in common locations.
    echo Please check your Python installation.
    echo.
    echo Try running: python --version
    echo If that works, then use: python app.py
    pause
    exit /b 1
)

echo Found Python at: %PYTHON_PATH%
echo.

echo Installing dependencies...
%PIP_PATH% install -r requirements.txt

echo.
echo Starting Flask server on port 5001...
%PYTHON_PATH% app.py

pause