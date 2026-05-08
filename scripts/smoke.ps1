$ErrorActionPreference = "Stop"

function Test-Endpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$ExpectedStatus = 200
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 15 -UseBasicParsing
    if ($response.StatusCode -ne $ExpectedStatus) {
      throw "$Name returned status $($response.StatusCode), expected $ExpectedStatus"
    }
    Write-Host "[OK] $Name -> $Url ($($response.StatusCode))"
  }
  catch {
    Write-Error "[FAIL] $Name -> $Url :: $($_.Exception.Message)"
    exit 1
  }
}

Test-Endpoint -Name "Frontend" -Url "http://localhost:8080/"
Test-Endpoint -Name "Backend Health" -Url "http://localhost:3000/health"
Test-Endpoint -Name "Swagger" -Url "http://localhost:3000/api/docs"

Write-Host "Smoke checks passed."
