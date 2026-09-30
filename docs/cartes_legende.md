# cartes.csv — Légende

Fichier : séparateur `;`, encodage UTF-8 avec BOM (s'ouvre directement dans Excel / LibreOffice).
Une ligne = un **modèle** de carte (33 modèles → 87 cartes physiques).

## Colonnes

| Colonne | Contenu |
|---|---|
| `id` | Identifiant numérique du modèle (1–33) |
| `cle` | Identifiant technique (snake_case, sans accent) → à utiliser dans le code |
| `nom` | Nom imprimé |
| `rang` | `bronze` / `argent` / `or` |
| `famille` | `brutes` / `flambeurs` / `pirates` |
| `trait` | Ligne de traits imprimée (ex. `Brute - Impact`) : famille + trait |
| `force` | Force imprimée (haut gauche) |
| `force_automa` | Valeur violette (bas droite) — mode solo |
| `eclair` | `1` = icône éclair présente (effet activé pour l'Automa) |
| `exemplaires` | Bronze : 1 **par couleur** · Argent : 2 · Or : 3 |
| `total` | Nombre de cartes physiques du modèle (Bronze 4, Argent 2, Or 3) |
| `couleurs` | Bronze uniquement : `rouge,bleu,jaune,vert` |
| `effet` | Texte d'effet avec icônes codées (voir ci-dessous) |
| `jeton_rouge` / `jeton_vert` | Cartes à dé plaçant un jeton : valeur face rouge / face verte |
| `texte_italique` | Texte de rappel (Bronze) ou citation d'ambiance (Argent/Or) |
| `source` | Fichier PDF + page |

## Codes dans `effet`

| Code | Icône imprimée |
|---|---|
| `{Sur une frontière}` `{Dans tous les cas}` `{Enragé}` `{Calme}` | Mots-clés en cartouche coloré |
| `[puissance]` | Icône ✕ rouge (gain de puissance) |
| `[PV]` | Icône laurier verte (points de victoire) |
| `[dé]` | Icône dé rouge (lancer le d6) |
| `[jeton_rouge]` `[jeton_vert]` | Jeton Flambeurs, face rouge / verte |
| `[jeton_or]` | Jeton Or (Pirates) |
| `[Or]` `[Argent]` `[Bronze]` | Badge de rang |

## Symboles des couleurs Bronze

rouge = ♥ · bleu = ♠ · jaune = ♦ · vert = ♣

## Jetons Flambeurs (déduits des cartes)

| Face rouge | Face verte | Utilisé par |
|---|---|---|
| −1 | +1 | Parieur |
| −2 | +4 | Bookmaker |
| −3 | +3 | Croupier |
| −4 | +8 | Mad Dice |
