@echo off

echo "Removing files"
rmdir /s /q ".\node_modules\"
del /s /q ".\package-lock.json"

echo "Unistalling Node"
winget uninstall OpenJS.NodeJS