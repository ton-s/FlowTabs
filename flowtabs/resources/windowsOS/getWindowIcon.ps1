param(
    [string]$exePath,
    [string]$outputPath
)

if (-not $exePath) {
    Write-Output "The executable path is required."
    exit
}

if (-not $outputPath) {
    Write-Output "The output path for the icon is required."
    exit
}

Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)

if ($icon -ne $null) {
    $bitmap = $icon.ToBitmap()
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Icon extracted as PNG in $outputPath"
} else {
    Write-Output "Unable to extract icon."
}