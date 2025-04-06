[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @"
  using System;
  using System.Collections.Generic;
  using System.Diagnostics;
  using System.Runtime.InteropServices;
  using System.Text;

  public class Window {
    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern IntPtr GetShellWindow();

    [DllImport("user32.dll")]
    static extern IntPtr GetAncestor(IntPtr hWnd, uint gaFlags);

    [DllImport("user32.dll", SetLastError = true)]
    static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    const uint GA_ROOTOWNER = 3;
    const int GWL_EXSTYLE = -20;
    const int WS_EX_TOOLWINDOW = 0x00000080;
    const int WS_EX_NOACTIVATE = 0x08000000;

    public static List<Dictionary<string, string>> GetOpenWindows() {
      var windows = new List<Dictionary<string, string>>();
      IntPtr shellWindow = GetShellWindow();
      string[] excludedProcesses = { "ApplicationFrameHost", "TextInputHost", "SystemSettings" };

      EnumWindows((hWnd, lParam) => {
        if (hWnd == shellWindow) return true; // Ignore la fenêtre du shell
        if (!IsWindowVisible(hWnd)) return true; // Ignore les fenêtres invisibles

        // Vérifie si la fenêtre est principale (pas un enfant)
        if (GetAncestor(hWnd, GA_ROOTOWNER) != hWnd) return true;

        // Vérifie si la fenêtre est une ToolWindow ou une fenêtre non activable
        int exStyle = GetWindowLong(hWnd, GWL_EXSTYLE);
        if ((exStyle & WS_EX_TOOLWINDOW) != 0 || (exStyle & WS_EX_NOACTIVATE) != 0) return true;

        // Vérifie le nom de la classe de la fenêtre pour exclure certains types connus
        var className = new StringBuilder(256);
        GetClassName(hWnd, className, 256);
        if (className.ToString() == "ApplicationFrameWindow") return true; // Exclut les fenêtres hébergées

        // Récupération du titre de la fenêtre
        var title = new StringBuilder(256);
        GetWindowText(hWnd, title, 256);
        if (title.Length == 0) return true; // Exclut les fenêtres sans titre

        // Récupération du processus
        uint processId;
        GetWindowThreadProcessId(hWnd, out processId);
        Process process;

        try
        {
          process = Process.GetProcessById((int)processId);
        }
        catch {
          return true; // Ignore les processus qui ne sont plus actifs
        }

        // Exclure les processus connus d'arrière-plan
        if (Array.Exists(excludedProcesses, element => element.Equals(process.ProcessName, StringComparison.OrdinalIgnoreCase)))
          return true;

        string exePath;
        try {
          exePath = process.MainModule.FileName;
        } catch {
          return true; // Si on ne peut pas accéder au chemin, on ignore cette fenêtre
        }


        // Ajoute uniquement les fenêtres qui passent les filtres
        var window = new Dictionary<string, string>
        {
          { "id", hWnd.ToString() },
          { "processName", process.ProcessName },
          { "title", title.ToString() },
          { "exePath", exePath }
        };

        windows.Add(window);
        return true;
      }, IntPtr.Zero);

      return windows;
    }
  }
"@

# Récupérer les fenêtres et les retourner sous forme JSON sans Newtonsoft
$windows = [Window]::GetOpenWindows()

# Convertir en JSON avec la méthode native de PowerShell
$windows | ConvertTo-Json -Depth 3
