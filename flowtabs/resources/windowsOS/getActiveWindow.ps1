[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WindowInfo {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
}
"@

# Récupérer le handle de la fenêtre active
$handle = [WindowInfo]::GetForegroundWindow()

# Afficher le handle de la fenêtre
$handle
