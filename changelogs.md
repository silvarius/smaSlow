# Changelogs – Projet smaSlow

## 0-6-1 – 2026-05-04

### Correctif : ajout du paramètre `exchange` sur `closeMarket`

- Le paramètre `exchange` est documenté comme optionnel dans la signature `closeMarket(pair, amount, exchange)`, mais s'avère apparemment requis en pratique sur Hyperliquid : sans lui, le signal TP/SL s'affiche bien en console mais l'ordre n'est pas traité par Gunbot.
- Les 4 appels `closeMarket` (TP long, SL long, TP short, SL short) sont mis à jour : `gb.method.closeMarket(pair, qty, exchange)`.

---

## 0-6-0 – 2026-05-04

### Remplacement de gb.data.leverage par la valeur de config

- **Source du levier modifiée** : `gb.data.leverage` s'est avéré non fiable en mode simulation. La valeur est désormais lue depuis `gb.data.pairLedger.whatstrat.LEVERAGE` (config locale de la paire).
  - Lecture en Section 2 : `const leverage = gb.data.pairLedger.whatstrat.LEVERAGE`
  - `gb.data.leverage` est conservé dans le dump Section 1 à titre d'observation comparative.
- **Nouveau log** : `[LOCALES] LEVERAGE` ajouté dans le dump Section 1 pour tracer la valeur lue depuis la config.

### Guard sur la valeur LEVERAGE

- **Nouveau guard en Section 4** : si `LEVERAGE` est nul ou non défini (valeur par défaut `0` dans config.js), toute entrée en position est bloquée et un avertissement est logué : `[WARN] LEVERAGE non défini ou nul dans la config – entrée en position bloquée.`
- Le guard n'affecte pas la gestion des positions ouvertes (TP/SL restent actifs), car la fermeture de position ne nécessite pas la valeur du levier.
- L'ancienne Section 4 (recherche de signal d'entrée) devient Section 5 en conséquence.

---

## 0-5-0 – 2026-05-02

### Intégration du module futureGbSimTools

- **Nouveau module chargé** : `futureGbSimTools_0-2-0`, chargé en Section 0 via `gb.method.require`.
  - En cas d'échec du chargement, la stratégie logue l'erreur et appelle `gb.method.finalize` avant de `return`.
- **Flag `SIMULATION`** : constante booléenne (`true` / `false`) contrôlant la source des propriétés Futures sensibles.
  - `true` → les propriétés sont lues depuis `simTools` (module futureGbSimTools).
  - `false` → les propriétés sont lues nativement depuis `gb.data`.
- **Propriétés reconstruites par futureGbSimTools en mode simulation** :
  - `currentSide` → `simTools.simCurrentSide`
  - `currentQty` → `simTools.simCurrentQty`
  - `totalPositionInitialMargin` → `simTools.simTotalPositionInitialMargin`
- Ces trois variables sont désormais déclarées avec `let` avant le bloc conditionnel, puis affectées selon le mode, afin d'être accessibles dans toute la suite du script.

### Correctifs appliqués sur la version soumise

- `const SIMULATION = TRUE` → `const SIMULATION = true` (`TRUE` provoquait une `ReferenceError`).
- `const side / qty / margin` déclarés à l'intérieur des blocs `if/else` → remplacés par `let` déclarés avant le bloc (portée corrigée).
- `simTotalPositionInitialMargin` → `simTools.simTotalPositionInitialMargin` (préfixe `simTools.` manquant).
- En-tête et `strategyVersion` mis à jour de `"0-3-0"` à `"0-5-0"`.

---

## 0-4-0 – 2026-04-30

- **Modification des valeurs des constantes ATR** pour l'entrée, le TP et le SL.

---

## 0-3-0 – 2026-04-29

### Modification du signal d'entrée

- **Indicateur de référence pour les entrées** : remplacement de `gb.data.ema3` par `gb.data.ema1` dans le calcul des seuils d'entrée long/short.
  - Signal long : `bid > ema1 + ATR × 2`
  - Signal short : `ask < ema1 − ATR × 2`
- La guard clause de sécurité porte désormais sur `ema1` (au lieu de `ema3`).
- Le log `[LOGIC]` affiche `ema1=` en conséquence.
- Le dump Section 1 conserve les trois indicateurs (`ema1`, `ema2`, `ema3`) pour observation comparative.

---

## 0-2-0 – 2026-04-28

### Nouvelle méthode testée

- **`gb.method.setTimeScaleMark(pair, exchange, message)`** : ajout d'un mark sur l'axe temporel du graphique Gunbot à chaque signal d'entrée détecté.
  - Signal long : message `LONG @ {bid}`
  - Signal short : message `SHORT @ {ask}`
  - `pair` et `exchange` passés explicitement (paramètres non optionnels dans notre implémentation).

### Autres modifications

- Ajout de la variable `exchange` (= `gb.data.exchangeName`) en section 2 pour alimenter `setTimeScaleMark`.

---

## 0-1-1 – 2026-04-28

### Correctifs

- **Indicateur de référence** : remplacement de `gb.data.slowSma` par `gb.data.ema3` dans le calcul des seuils d'entrée long/short. `slowSma` produisait des valeurs incohérentes.
- **OHLCV** : les valeurs à `candlesXxxxx[lastIdx]` retournant `null`, l'index utilisé est désormais `lastIdx - 1` (dernière bougie clôturée). Les labels dans la console reflètent ce changement (`closed …` au lieu de `last …`).

### Dump des propriétés

- Supprimé : `gb.data.slowSma`
- Ajoutés : `gb.data.ema1`, `gb.data.ema2`, `gb.data.ema3`

---

## 0-1-0 – version initiale

### Périmètre

Première version alpha de la stratégie de test des propriétés et méthodes Futures exposées par Gunbot.

### Propriétés testées (dump à chaque cycle)

**Générales (ni SPOT ni FUTURES)**
- `gb.data.pairName`
- `gb.data.exchangeName`
- `gb.data.baseBalance`
- `gb.data.onOrdersBalance`
- `gb.data.openOrders`
- `gb.data.orders`
- `gb.data.orderbook`
- `gb.data.period`
- `gb.data.bid`
- `gb.data.ask`
- `gb.data.BTCUSDprice`

**Indicateurs**
- `gb.data.slowSma`
- `gb.data.atr`

**OHLCV** (dernière bougie via `candlesXxxxx[lastIdx]`)
- `gb.data.candlesOpen`
- `gb.data.candlesHigh`
- `gb.data.candlesLow`
- `gb.data.candlesClose`
- `gb.data.candlesVolume`
- `gb.data.candlesTimestamp`

**FUTURES**
- `gb.data.leverage`
- `gb.data.walletBalance`
- `gb.data.availableMargin`
- `gb.data.maintenanceMargin`
- `gb.data.maxNotionalValue`
- `gb.data.totalPositionInitialMargin`
- `gb.data.totalOpenOrderInitialMargin`
- `gb.data.currentQty`
- `gb.data.currentSide`
- `gb.data.liquidationPrice`

### Méthodes testées

- `gb.method.buyMarket(qty, pair)` – ouverture position longue
- `gb.method.sellMarket(qty, pair)` – ouverture position courte
- `gb.method.closeMarket(pair, qty)` – clôture position (TP et SL)

### Logique de la stratégie

- **Signal long** : `bid > slowSma + ATR(14) × 2`
- **Signal short** : `ask < slowSma − ATR(14) × 2`
- **TP long** : `entryPrice + ATR × 2`
- **TP short** : `entryPrice − ATR × 2`
- **SL long** : `entryPrice − ATR × 1.5`
- **SL short** : `entryPrice + ATR × 1.5`
- **Taille de position** : 100 USDT convertis en quote au prix `ask`
- **Prix d'entrée** reconstruit dynamiquement : `totalPositionInitialMargin × leverage / currentQty`
- Tous les ordres sont des ordres market.
