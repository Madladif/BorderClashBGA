# Mise à jour de Border Clash BGA avec Claude Code

## 1. Préparer le dépôt

Arborescence à ajouter à ton projet BGA local (synchronisé avec le Studio) :

```
borderclash/
├── CLAUDE.md                 ← contexte permanent lu par Claude Code (bloc ci-dessous)
├── docs/
│   ├── REGLES_BGA.md         ← la spécification (fichier fourni)
│   ├── cartes.csv            ← les 87 cartes (à fournir, indispensable)
│   └── regles_livret.pdf     ← le livret, pour référence
└── modules/ …                ← code existant
```

**`docs/cartes.csv`** — colonnes minimales conseillées :
`id;nom;rang;famille;couleur;force;traits;texte_effet;force_automa;eclair;exemplaires`

Avant de commencer : `git commit` de l'état actuel (point de retour si besoin).

---

## 2. Contenu de `CLAUDE.md`

```markdown
# Border Clash — Crapules (BGA Studio)

## Sources de vérité (par priorité)
1. Texte des cartes : docs/cartes.csv
2. Règles : docs/REGLES_BGA.md (règles numérotées R-xx.y)
3. Le code existant est basé sur d'ANCIENNES règles : il n'a aucune autorité.

## Règles de travail
- Ne jamais inventer un effet de carte ni trancher un point marqué "⚠️ OUVERT" : le lister et me le demander.
- Citer l'identifiant R-xx.y dans les commentaires de code et les messages de commit.
- Toute logique de jeu côté serveur (PHP). Le client (JS) affiche et envoie des actions.
- Aléatoire uniquement via bga_rand() / Deck::shuffle, côté serveur.
- Ne jamais envoyer au client le type d'une carte cachée (main adverse, pioches, cartes améliorées).
- Code très commenté en français, fonctions courtes, noms explicites : je suis développeur débutant.
- Bibliothèques client : bga-animations 1.x puis bga-cards 1.x. Styles par classes CSS uniquement.
- Travailler par lots ; un commit par lot ; ne pas modifier hors du périmètre du lot.

## Glossaire code
power = puissance · strength = force · border = frontière · row/col = ligne/colonne
round = manche · turn = tour · rank = rang (bronze/silver/gold) · gem = gemme
```

---

## 3. Workflow en 5 étapes

| Étape | Mode Claude Code | Livrable |
|---|---|---|
| 1. Audit | Plan mode (`Shift+Tab`), aucune modification | `docs/AUDIT.md` |
| 2. Arbitrages | Tu réponds aux questions ouvertes | `docs/REGLES_BGA.md` mis à jour |
| 3. Implémentation | Un lot par session (`/clear` entre deux) | Code + commit par lot |
| 4. Tests | Playwright MCP sur le Studio | `docs/TESTS.md` |
| 5. Revue finale | Plan mode | Checklist de conformité |

---

### Étape 1 — Audit (aucune modification)

```
Lis CLAUDE.md, docs/REGLES_BGA.md et docs/cartes.csv, puis l'intégralité du code du projet (dbmodel.sql, material.inc.php, states.inc.php, modules/php, modules/js, .css, .tpl).

Produis docs/AUDIT.md, sans modifier aucun autre fichier, avec :
1. Cartographie du code actuel : états, tables SQL, actions joueur, notifications, données cartes.
2. Tableau de conformité : pour chaque règle R-xx.y → statut (conforme / partiel / absent / contraire), fichier et fonction concernés, écart constaté.
3. Liste des éléments du code à SUPPRIMER car issus des anciennes règles (voir §13 de REGLES_BGA.md).
4. Questions ouvertes : les points ⚠️ OUVERT + tout autre ambiguïté rencontrée. Ne tranche rien.
5. Plan de refonte découpé en lots indépendants et testables, ordonnés par dépendance, avec estimation de taille (S/M/L). Indique pour chaque lot s'il vaut mieux réécrire ou adapter l'existant.
```

🎯 **Target** : Claude Code, en plan mode, à la racine du dépôt
💡 **Note** : l'audit évite que Claude Code "rafistole" l'ancienne logique. Relis surtout la section 3 (suppressions) : c'est là que se cachent les restes des jauges individuelles et des jetons d'ordre.

---

### Étape 2 — Arbitrages

Tu réponds aux questions de `docs/AUDIT.md`, puis :

```
Voici mes réponses aux questions ouvertes de docs/AUDIT.md :
[colle tes réponses, numérotées comme dans l'audit]

Mets à jour docs/REGLES_BGA.md : remplace chaque "⚠️ OUVERT" concerné par la règle tranchée (garde le même identifiant R-xx.y, ajoute "(arbitrage)"). Mets à jour le plan de lots de docs/AUDIT.md si mes réponses le modifient. Ne touche pas au code.
```

🎯 **Target** : Claude Code, plan mode désactivé (édition de docs uniquement)
💡 **Note** : garder les arbitrages dans REGLES_BGA.md te sert aussi pour la prochaine version du livret papier.

---

### Étape 3 — Implémentation, lot par lot

Découpage type (à ajuster selon l'audit) :

| Lot | Contenu | Règles |
|---|---|---|
| A | Modèle de données : dbmodel.sql, material (cartes depuis cartes.csv), options de table (solo + difficulté) | §1, R-10.2 |
| B | Topologie et mise en place : voisins, frontières, gemmes, draft Argent | §2, §3 |
| C | Machine à états : manches, tours, déploiement multiactif, deuxième chance | §4, §5.1, §12 |
| D | Moteur de résolution générique : ordre gauche/centre/droite, puissance 0–20, jauges partagées, PV | §5.2–5.4, §8 |
| E | Effets de cartes, famille par famille (Brutes, puis Flambeurs, puis Pirates) | §9 + cartes.csv |
| F | Amélioration / production / fin de manche / fin de partie | §6, §7 |
| G | Mode solo Automa | §10 |
| H | Interface : grille 3×3, jauges, gemmes, Rage, journal de résolution lisible | §11 |

Prompt à réutiliser pour chaque lot (remplace la lettre) :

```
Implémente le lot [X] tel que défini dans docs/AUDIT.md, en respectant CLAUDE.md.

Avant d'écrire du code : liste les fichiers que tu vas modifier et les règles R-xx.y couvertes, puis attends ma validation.
Après validation :
- implémente uniquement ce lot ;
- commente chaque bloc en français avec la règle R-xx.y correspondante ;
- ajoute des notifications BGA claires pour chaque étape visible par les joueurs ;
- termine par : résumé des changements, points non couverts, et 3 à 5 scénarios de test manuels pour ce lot ;
- fais un commit "Lot [X] : <résumé> (R-xx.y, …)".
```

🎯 **Target** : Claude Code, une session neuve par lot (`/clear` avant)
💡 **Note** : pour le lot E, fais une famille par session et donne-lui les 3–4 cartes les plus retorses en premier (effets conditionnels, coûts en gemme, effets sur carte rivale) : si le moteur tient sur elles, le reste suit.

---

### Étape 4 — Tests sur le Studio

```
Avec le MCP Playwright, ouvre la table de test BGA Studio de Border Clash et vérifie les scénarios suivants. Pour chacun : captures d'écran, résultat attendu vs obtenu, et règle R-xx.y concernée. Consigne tout dans docs/TESTS.md. Ne corrige rien : liste les anomalies.

1. R-5.12 : Parieur (jet 1–2, jeton −1) contre Troll Enragé → 1 vs 4, le joueur du Troll marque 3 PV.
2. R-9.3 : Troll au centre → aucun gain de puissance, marqueur Rage retourné.
3. R-5.8 : puissance 14 → compteur face +10 sur la case 4 ; puissance 0 → aucun compteur ; puissance > 20 → 20.
4. R-5.11 : égalité à une frontière → 0 PV pour les deux.
5. R-5.2 : deuxième chance répétée jusqu'à ne plus avoir de gemme chargée.
6. R-6.2 / R-6.3 : après le tour 3, seules les 3 cartes centrales sont proposées en amélioration/production.
7. R-6.5 : amélioration impossible sans gemme chargée ; carte Or non améliorable.
8. R-6.8 : l'adversaire ne voit pas les cartes améliorées (vérifier aussi les données réseau / gamedatas).
9. R-7.4 : égalité de PV départagée aux gemmes chargées.
10. R-10.5 / R-10.6 : en solo, ordre de résolution correct ; carte Automa sans éclair = texte ignoré, force violette utilisée.
11. Rechargement F5 à chaque état : l'affichage reste identique.
```

🎯 **Target** : Claude Code avec le MCP Playwright configuré
💡 **Note** : le test 8 est le plus important pour BGA — une fuite d'information cachée via `getAllDatas()` est un motif de refus en revue.

---

### Étape 5 — Revue de conformité finale

```
Relis docs/REGLES_BGA.md règle par règle et le code final. Produis une checklist : chaque R-xx.y → implémentée / testée / fichier:fonction. Signale tout code mort hérité des anciennes règles, toute donnée cachée envoyée au client, et tout texte affiché non traduisible (absence de _() / clienttranslate()). Ne modifie rien.
```

🎯 **Target** : Claude Code, plan mode
💡 **Note** : à relancer après chaque nouvelle version du livret ; avec les identifiants R-xx.y, la mise à jour devient un simple diff de règles.

---

## 4. Conseils pratiques

- **Sessions courtes** : un lot = une session. Au-delà, Claude Code perd le fil des décisions.
- **Refuser les inventions** : si Claude Code propose un effet de carte non présent dans `cartes.csv`, stoppe et corrige le CSV, pas le code.
- **Extension Légendes** : demander dès le lot A que les familles soient des modules indépendants (mise en place + effets), puisque le livret prévoit le mélange de 3 familles parmi plusieurs boîtes (« Mélange de boîtes »).
