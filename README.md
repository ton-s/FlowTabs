# FlowTabs - Outil de gestion de fenêtres et d'onglets

## 📌 Introduction

FlowTabs est **un outil réalisé dans le cadre d'un mémoire à l'Université de Namur**. Cet outil est une extension VS Code permettant de synchroniser et gérer les onglets/fenêtres du navigateur et du bureau directement depuis l’éditeur. Cette solution est idéale pour les développeurs souhaitant naviguer rapidement entre leurs ressources et leur environnement de travail.

## 🚀 Fonctionnalités

TODO


## Pré-requis

- VS Code
- Google Chrome
- Node.js

## 🔨 Développement

### 🧱 Structure du projet
- 📁 `flowtabs/` – Code source de l’extension VS Code
- 📁 `extension-chrome/` – Code source de l’extension Chrome

### 💻 Extension VS Code

#### Installation des dépendances

```bash
$ npm install
```

#### Lancement de l'extension en mode développement

1. Ouvrez le projet dans VS Code
2. Appuyez sur `F5` pour lancer une nouvelle fenêtre VS Code avec l’extension activée

### 🌍 Extension Chrome

1. Ouvrir Google Chrome et accéder à `chrome://extensions/`
2. Activer le mode développeur (en haut à droite)
3. Charger l'extension :
   - Cliquez sur **Charger un paquet**
   - Sélectionnez le dossier `chrome-extension` du projet
4. L'extension est maintenant prête à être utilisée

### 🔄 Synchronisation entre Navigateur et VS Code

1. Ouvrir le navigateur et naviguer sur des onglets
2. Dans VS Code, ouvrez la vue **FlowTabs** pour voir les onglets

### 🔍 Débogage

- **VS Code** : utilisez la console de débogage (`F5`) pour voir les logs
- **Chrome** : ouvrez `chrome://extensions/` > "Inspecter les vues" via le service worker pour voir les logs de l’extension


## 📦 Installation

Les instructions d’installation seront ajoutées ultérieurement pour une version stable.