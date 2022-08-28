$NodePackageManager="C:\Program Files\nodejs\npm.cmd"
$NodeExecutable="C:\Program Files\nodejs\node.exe"

# check if node exists
if ( Test-Path -Path $NodeExecutable ) {
  # run node
  Start-Process $NodeExecutable -Wait -ArgumentList "ptil.js"
}

else {
  $CurrentRole=$( [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() )
  $AdminRole=$( [Security.Principal.WindowsBuiltInRole]::Administrator )

  # check if the user is an administrator
  if ( -Not ( $CurrentRole.IsInRole( $AdminRole ) ) ) {
    # rerun script as administrator
    Start-Process PowerShell -Verb RunAs -ArgumentList "cd $pwd; .\\install.ps1"
  }

  else {
    $NodeInstallerFile="node-v18.8.0-x64.msi"
    $NodeInstallerLink="https://nodejs.org/download/release/latest-v18.x/node-v18.8.0-x64.msi"
    $NodeInstallerArgs="/I $NodeInstallerFile /quiet"

    # download and install node quietly
    Invoke-WebRequest -Uri $NodeInstallerLink -OutFile $NodeInstallerFile
    Start-Process msiexec.exe -Wait -ArgumentList $NodeInstallerArgs
    Remove-Item $NodeInstallerFile

    # update node packages and run node
    Start-Process $NodePackageManager -Wait -ArgumentList "update"
    Start-Process $NodeExecutable -Wait -ArgumentList "ptil.js"
  }
}