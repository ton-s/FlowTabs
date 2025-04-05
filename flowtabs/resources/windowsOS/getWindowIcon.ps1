param(
    [string]$exePath,
    [string]$outputPath
)

if (-not $exePath) {
    Write-Output "Le chemin de l'exécutable est requis."
    exit
}

if (-not $outputPath) {
    Write-Output "Le chemin de sortie pour l'icône est requis."
    exit
}

Add-Type -AssemblyName System.Drawing

$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)

if ($icon -ne $null) {
    $bitmap = $icon.ToBitmap()
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output "Icône extraite en tant que PNG dans $outputPath"
} else {
    Write-Output "Impossible d'extraire l'icône."
}