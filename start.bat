@echo off

:: check if winget is installed
where winget
if %errorlevel% neq 0 (
  echo "winget not installed"
  start "" "https://apps.microsoft.com/store/detail/9NBLGGH4NNS1"
  exit
)

:: install node with winget
if not exist "C:\Program Files\nodejs\node.exe" (
  echo "Installing Node.js"
  winget install OpenJS.NodeJS
) 

:: update node modules with npm
if not exist ".\node_modules\" (
  if exist "C:\Program Files\nodejs\npm.cmd" (
    echo "Updating Node.js"
    "C:\Program Files\nodejs\npm.cmd" update
  )
)

:: run program
if exist "C:\Program Files\nodejs\node.exe" (
  "C:\Program Files\nodejs\node.exe" ".\ptil.js"
)
