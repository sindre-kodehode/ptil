$CurrentRole=$( [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() )
$AdminRole=$( [Security.Principal.WindowsBuiltInRole]::Administrator )

# check if the current user is an administrator
if ( -Not ( $CurrentRole.IsInRole( $AdminRole ) ) ) {
  # rerun script as administrator
  Start-Process PowerShell -Verb RunAs -ArgumentList "cd $pwd; .\\uninstall.ps1"
}

else {
  # remove node modules folders and files
  if ( Test-Path -Path ".\node_modules" ) { Remove-Item ".\node_modules" -Recurse }
  if ( Test-Path -Path ".\package-lock.json" ) { Remove-Item ".\package-lock.json" }

  # uninstall node
  $( Get-WmiObject -Class Win32_Product | Where-Object -Property Name -eq "Node.js" ).uninstall()
}