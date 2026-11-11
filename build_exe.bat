@echo off
REM Builds dist\HoltropMennenSimulator.exe on a Windows PC.
REM Needs Python 3.10 or newer from python.org (tick "Add python.exe to PATH").
setlocal
cd /d "%~dp0"

py -3 -m venv .venv-build 2>nul || python -m venv .venv-build || goto :fail
call .venv-build\Scripts\activate.bat || goto :fail
python -m pip install --upgrade pip || goto :fail
python -m pip install -r requirements-desktop.txt || goto :fail

echo.
echo Checking the engine against the worked example...
python -m unittest test_holtrop || goto :fail

echo.
echo Building the .exe...
pyinstaller --noconfirm HoltropMennen.spec || goto :fail

echo.
echo Self-testing the .exe...
start "" /wait dist\HoltropMennenSimulator.exe --selftest
if errorlevel 1 goto :fail

echo.
echo Done: dist\HoltropMennenSimulator.exe
exit /b 0

:fail
echo.
echo Build failed.
exit /b 1
