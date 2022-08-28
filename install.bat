@echo off

if not exist "C:\Program Files\nodejs\node.exe" (
    echo "Installing Node.js"
    winget install OpenJS.NodeJS
) else (
    echo "Node.js is installed"
)

if not exist ".\node_modules\" (
    echo "Updating Node.js"
    "C:\Program Files\nodejs\npm.cmd" update    
)

"C:\Program Files\nodejs\node.exe" ".\ptil.js"