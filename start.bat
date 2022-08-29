@echo off

:: check if winget is installed
where winget
if %errorlevel% neq 0 (
  echo "winget not installed"
  start "" "https://apps.microsoft.com/store/detail/9NBLGGH4NNS1"
)

:: install node with winget
if not exist "C:\Program Files\nodejs\node.exe" (
  echo "Installing Node.js"
  winget install OpenJS.NodeJS
) 

:: update node modules with npm
if not exist ".\node_modules\" (
  echo "Updating Node.js"
  "C:\Program Files\nodejs\npm.cmd" update    
)

:: run program
"C:\Program Files\nodejs\node.exe" ".\ptil.js"
