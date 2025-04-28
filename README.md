# FlowTabs - Extension VS Code de gestion de fenêtres et d'onglets


FlowTabs est **un extension VS Code réalisé dans le cadre de mon mémoire à l'Université de Namur**. Cet extension VS Code permettant de synchroniser et gérer les onglets du navigateur ainsi que les fenêtres du bureau directement depuis l’éditeur de code. Cette solution est idéale pour les développeurs souhaitant naviguer rapidement entre leurs ressources et leur environnement de développement sans être submergé.

## 🚀 Backlog

[Lien vers le Trello](https://trello.com/invite/b/67dd8d8ebd700e3bacb774e8/ATTIcfc6b53b362bdf21068f833a0a2ea522FE7FE4F5/backlog)


## Pré-requis

- **VS Code**
- **Google Chrome**
- **Node.js**

## 🔨 Développement

### 🧱 Structure du projet
- 📁 `flowtabs/` – Code source de l’extension VS Code
- 📁 `extension-chrome/` – Code source de l’extension Chrome

### 💻 Extension VS Code

- **Installation des dépendances**

```bash
$ npm install
```

- **Lancement de l'extension en mode développement**

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

- **VS Code** : utilisez la console de débogage pour voir les logs
- **Chrome** : ouvrez `chrome://extensions/` > "Inspecter les vues" via le service worker pour voir les logs de l’extension


## 📦 Installation

Les instructions d’installation seront ajoutées ultérieurement pour une version stable.

## 👥 Contribuer

Les contributions sont les bienvenues ! Si vous souhaitez contribuer, veuillez suivre les étapes ci-dessous :

1. Créez une branche pour votre fonctionnalité ou votre correctif.

2. Faites vos modifications.

3. Soumettez une Pull Request une fois les modifications terminées. Fournissez une description claire.

4. Faites réviser votre code. Répondez aux retours et appliquez les modifications si nécessaire.

7. Une fois la PR approuvée, fusionnez la branche avec la branche principale. Supprimez ensuite la branche pour garder le dépôt propre.

## Licence

Ce projet est sous licence **MIT**