// ============================================================
//  Gunbot Custom Strategy – Futures Properties & Methods Test
//  Version : 0-7-0  (alpha)
//  Objet   : Tester les propriétés Futures exposées par Gunbot
//            et les méthodes d'ordres market (buy / sell / close)
//            + setTimeScaleMark sur signaux d'entrée
//  Modif   : Les paramètres de stratégie sont externalisés en
//            overrides Gunbot (config.js / GUI) et lus via
//            gb.data.pairLedger.whatstrat.
//            Les overrides manquants sont automatiquement écrits
//            dans config.js au premier cycle (initialisation).
//            Un fallback sur les valeurs par défaut est appliqué
//            si un paramètre est absent ou invalide.
// ============================================================

const strategyVersion = "0-7-0";

// ──────────────────────────────────────────────────────────────
//  SECTION 0 – CHARGEMENT DU MODULE futureGbSimTools
// ──────────────────────────────────────────────────────────────

const SIMULATION = true;   // passer à false en mode live

let simTools;

if (SIMULATION) {
    try {
        simTools = gb.method.require(gb.modulesPath + '/futureGbSimTools')(gb);
    } catch (e) {
        console.error('[TEST] Impossible de charger futureGbSimTools : ' + e.message);
        gb.method.finalize(gb.data.openOrders, gb.data.openOrders);
        return;
    }
}

// ──────────────────────────────────────────────────────────────
//  SECTION 1 – LOGGING DES PROPRIÉTÉS FUTURES
//  Toutes les propriétés répertoriées dans market-data qui ne
//  sont PAS marquées "Specific to spot trading".
// ──────────────────────────────────────────────────────────────

function logAllProperties() {
    console.log("==========================================================");
    console.log(`[${strategyVersion}] DUMP DES PROPRIÉTÉS PRIMAIRES – cycle ${Date.now()}`);
    console.log("==========================================================");

    // --- Propriétés générales (ni SPOT ni FUTURES) ---
    console.log("[GENERAL] pairName              :", gb.data.pairName);
    console.log("[GENERAL] exchangeName          :", gb.data.exchangeName);
    console.log("[GENERAL] baseBalance           :", gb.data.baseBalance);
    console.log("[GENERAL] onOrdersBalance       :", gb.data.onOrdersBalance);
    console.log("[GENERAL] openOrders            :", JSON.stringify(gb.data.openOrders));
    console.log("[GENERAL] orders (historique)   :", JSON.stringify(gb.data.orders));
    console.log("[GENERAL] orderbook             :", JSON.stringify(gb.data.orderbook));
    console.log("[GENERAL] period                :", gb.data.period);
    console.log("[GENERAL] bid                   :", gb.data.bid);
    console.log("[GENERAL] ask                   :", gb.data.ask);
    console.log("[GENERAL] BTCUSDprice           :", gb.data.BTCUSDprice);

    // --- Indicateurs pré-calculés (utiles à la stratégie) ---
    console.log("[IND] ema1                      :", gb.data.ema1);
    console.log("[IND] ema2                      :", gb.data.ema2);
    console.log("[IND] ema3                      :", gb.data.ema3);
    console.log("[IND] atr                       :", gb.data.atr);

    // --- Données OHLCV (avant-dernière bougie = dernière clôturée) ---
    const lastIdx  = gb.data.candlesClose.length - 1;
    const closeIdx = lastIdx - 1;   // index de la dernière bougie clôturée
    console.log("[OHLCV] nb bougies dispo        :", gb.data.candlesClose.length);
    console.log("[OHLCV] closed open             :", gb.data.candlesOpen[closeIdx]);
    console.log("[OHLCV] closed high             :", gb.data.candlesHigh[closeIdx]);
    console.log("[OHLCV] closed low              :", gb.data.candlesLow[closeIdx]);
    console.log("[OHLCV] closed close            :", gb.data.candlesClose[closeIdx]);
    console.log("[OHLCV] closed volume           :", gb.data.candlesVolume[closeIdx]);
    console.log("[OHLCV] closed timestamp        :", gb.data.candlesTimestamp[closeIdx]);

    // --- Propriétés FUTURES (valeurs natives Gunbot) ---
    console.log("[FUTURES] leverage              :", gb.data.leverage);
    console.log("[FUTURES] walletBalance         :", gb.data.walletBalance);
    console.log("[FUTURES] availableMargin       :", gb.data.availableMargin);
    console.log("[FUTURES] maintenanceMargin     :", gb.data.maintenanceMargin);
    console.log("[FUTURES] maxNotionalValue      :", gb.data.maxNotionalValue);
    console.log("[FUTURES] totalPosInitMargin    :", gb.data.totalPositionInitialMargin);
    console.log("[FUTURES] totalOrdInitMargin    :", gb.data.totalOpenOrderInitialMargin);
    console.log("[FUTURES] currentQty            :", gb.data.currentQty);
    console.log("[FUTURES] currentSide           :", gb.data.currentSide);
    console.log("[FUTURES] liquidationPrice      :", gb.data.liquidationPrice);

    // --- Propriétés locales (config.js) ---
    console.log("[LOCALES] LEVERAGE               :", gb.data.pairLedger.whatstrat.LEVERAGE);

    console.log("==========================================================");
}

// ──────────────────────────────────────────────────────────────
//  SECTION 2 – PARAMÈTRES DE STRATÉGIE (overrides Gunbot)
//
//  Ces paramètres sont définis dans config.js sous la clé
//  "override" de la paire, et modifiables directement depuis
//  le GUI Gunbot (section "Overrides" de la paire).
//
//  Si un paramètre est absent de config.js (typiquement au
//  premier lancement), il est automatiquement écrit avec sa
//  valeur par défaut. Gunbot recharge config.js à la volée :
//  le paramètre apparaît immédiatement dans le GUI.
//
//  Un paramètre déjà présent (même s'il vaut la valeur par
//  défaut) n'est jamais écrasé : les modifications faites via
//  le GUI sont toujours préservées.
//
//  Note : le GUI peut sauvegarder des nombres sous forme de
//  chaînes. parseFloat() est systématiquement appliqué pour
//  garantir le type numérique.
// ──────────────────────────────────────────────────────────────

const strat = gb.data.pairLedger.whatstrat;

// Valeurs par défaut (utilisées si le paramètre est absent ou invalide)
const DEFAULT_BASE_SIZE_USDT       = 100;
const DEFAULT_ATR_MULTIPLIER_ENTRY = 0.2;
const DEFAULT_ATR_MULTIPLIER_TP    = 1;
const DEFAULT_ATR_MULTIPLIER_SL    = 2;

// ── Initialisation automatique des overrides manquants dans config.js ──
// Seuls les paramètres absents (=== undefined) sont écrits.
// Les paramètres déjà présents (y compris modifiés via le GUI) sont intouchés.

const PARAMS_DEFAULTS = {
    BASE_SIZE_USDT       : DEFAULT_BASE_SIZE_USDT,
    ATR_MULTIPLIER_ENTRY : DEFAULT_ATR_MULTIPLIER_ENTRY,
    ATR_MULTIPLIER_TP    : DEFAULT_ATR_MULTIPLIER_TP,
    ATR_MULTIPLIER_SL    : DEFAULT_ATR_MULTIPLIER_SL,
};

const missingParams = Object.keys(PARAMS_DEFAULTS).filter(
    key => strat[key] === undefined
);

if (missingParams.length > 0) {
    try {
        const fs          = gb.method.require('fs');
        const configPath  = './config.js';
        const configClone = { ...gb.data.config };
        const exchange_   = gb.data.exchangeName;
        const pair_       = gb.data.pairName;

        // S'assurer que la structure override existe pour cette paire
        if (!configClone.pairs[exchange_][pair_].override) {
            configClone.pairs[exchange_][pair_].override = {};
        }

        missingParams.forEach(key => {
            configClone.pairs[exchange_][pair_].override[key] = PARAMS_DEFAULTS[key];
            console.log(`[CONFIG INIT] Paramètre absent écrit dans config.js : ${key} = ${PARAMS_DEFAULTS[key]}`);
        });

        fs.writeFileSync(configPath, JSON.stringify(configClone, null, 4), 'utf8');
        console.log(`[CONFIG INIT] config.js mis à jour (${missingParams.length} paramètre(s) initialisé(s)).`);
    } catch (e) {
        console.error('[CONFIG INIT] Erreur lors de l\'écriture dans config.js :', e.message || e);
    }
}

// Lecture des overrides avec fallback sur les valeurs par défaut
// (le fallback couvre le cycle courant si l'init vient d'avoir lieu)
const BASE_SIZE_USDT       = (parseFloat(strat.BASE_SIZE_USDT)       > 0)
    ? parseFloat(strat.BASE_SIZE_USDT)       : DEFAULT_BASE_SIZE_USDT;

const ATR_MULTIPLIER_ENTRY = (parseFloat(strat.ATR_MULTIPLIER_ENTRY) > 0)
    ? parseFloat(strat.ATR_MULTIPLIER_ENTRY) : DEFAULT_ATR_MULTIPLIER_ENTRY;

const ATR_MULTIPLIER_TP    = (parseFloat(strat.ATR_MULTIPLIER_TP)    > 0)
    ? parseFloat(strat.ATR_MULTIPLIER_TP)    : DEFAULT_ATR_MULTIPLIER_TP;

const ATR_MULTIPLIER_SL    = (parseFloat(strat.ATR_MULTIPLIER_SL)    > 0)
    ? parseFloat(strat.ATR_MULTIPLIER_SL)    : DEFAULT_ATR_MULTIPLIER_SL;

// LEVERAGE : déjà en usage depuis 0-6-0, on conserve le même pattern
const leverage = (parseFloat(strat.LEVERAGE) > 0)
    ? parseFloat(strat.LEVERAGE) : 0;

// ── 1. Dump de toutes les propriétés à chaque cycle ──────
logAllProperties();

// Log des paramètres actifs (overrides ou fallback)
console.log("==========================================================");
console.log(`[CONFIG] BASE_SIZE_USDT        : ${BASE_SIZE_USDT}  (raw: ${strat.BASE_SIZE_USDT})`);
console.log(`[CONFIG] ATR_MULTIPLIER_ENTRY  : ${ATR_MULTIPLIER_ENTRY}  (raw: ${strat.ATR_MULTIPLIER_ENTRY})`);
console.log(`[CONFIG] ATR_MULTIPLIER_TP     : ${ATR_MULTIPLIER_TP}  (raw: ${strat.ATR_MULTIPLIER_TP})`);
console.log(`[CONFIG] ATR_MULTIPLIER_SL     : ${ATR_MULTIPLIER_SL}  (raw: ${strat.ATR_MULTIPLIER_SL})`);
console.log(`[CONFIG] LEVERAGE              : ${leverage}  (raw: ${strat.LEVERAGE})`);
console.log("==========================================================");

// ── 2. Lecture des données nécessaires à la logique ──────
const bid      = gb.data.bid;
const ask      = gb.data.ask;
const ema1     = gb.data.ema1;
const atr      = gb.data.atr;
const pair     = gb.data.pairName;
const exchange = gb.data.exchangeName;

// Propriétés reconstruites par futureGbSimTools en simulation,
// ou lues nativement sur Gunbot en mode live
let side, qty, margin;

if (SIMULATION) {
    side   = simTools.simCurrentSide;
    qty    = simTools.simCurrentQty;
    margin = simTools.simTotalPositionInitialMargin;
} else {
    side   = gb.data.currentSide;                  // "long" | "short" | "none"
    qty    = gb.data.currentQty;
    margin = gb.data.totalPositionInitialMargin;
}

// Affichage console des valeurs retenues pour la logique
console.log("[VALEURS FUTURES RETRAITEES] currentSide                :", side);
console.log("[VALEURS FUTURES RETRAITEES] currentQty                 :", qty);
console.log("[VALEURS FUTURES RETRAITEES] totalPositionInitialMargin :", margin);
console.log("==========================================================");

// Sécurité : attendre que les indicateurs soient disponibles
if (!ema1 || !atr || ema1 === 0 || atr === 0) {
    console.log("[WARN] ema1 ou ATR non disponible – cycle ignoré.");
    return;
}

// Taille de position en quote (ex: ETH) = BASE_SIZE_USDT / prix
const positionSizeQuote = BASE_SIZE_USDT / ask;

// Seuils d'entrée
const longEntryThreshold  = ema1 + atr * ATR_MULTIPLIER_ENTRY;
const shortEntryThreshold = ema1 - atr * ATR_MULTIPLIER_ENTRY;

console.log(`[LOGIC] bid=${bid} ask=${ask} ema1=${ema1} atr=${atr}`);
console.log(`[LOGIC] longEntryThreshold=${longEntryThreshold.toFixed(8)}  shortEntryThreshold=${shortEntryThreshold.toFixed(8)}`);
console.log(`[LOGIC] currentSide=${side}  currentQty=${qty}  positionSizeQuote=${positionSizeQuote.toFixed(8)}`);

// ── 3. Gestion TP / SL sur position ouverte ──────────────
// Prix d'entrée reconstruit dynamiquement à chaque cycle :
// entryPrice = totalPositionInitialMargin * leverage / currentQty

if (side === "long") {

    const entryPrice = (margin * leverage) / qty;
    const tp         = entryPrice + atr * ATR_MULTIPLIER_TP;
    const sl         = entryPrice - atr * ATR_MULTIPLIER_SL;

    console.log(`[HOLD LONG] entry=${entryPrice.toFixed(8)}  TP=${tp.toFixed(8)}  SL=${sl.toFixed(8)}`);

    if (bid >= tp) {
        console.log(`[TP LONG] bid ${bid} >= TP ${tp.toFixed(8)} → closeMarket`);
        try {
            const result = await gb.method.closeMarket(pair, qty, exchange);
            console.log("[TP LONG] closeMarket succès :", JSON.stringify(result));
        } catch (err) {
            console.log("[TP LONG] closeMarket ERREUR :", err.message || err);
        }
        return;
    }

    if (bid <= sl) {
        console.log(`[SL LONG] bid ${bid} <= SL ${sl.toFixed(8)} → closeMarket`);
        try {
            const result = await gb.method.closeMarket(pair, qty, exchange);
            console.log("[SL LONG] closeMarket succès :", JSON.stringify(result));
        } catch (err) {
            console.log("[SL LONG] closeMarket ERREUR :", err.message || err);
        }
        return;
    }

    return;
}

if (side === "short") {

    const entryPrice = (margin * leverage) / qty;
    const tp         = entryPrice - atr * ATR_MULTIPLIER_TP;
    const sl         = entryPrice + atr * ATR_MULTIPLIER_SL;

    console.log(`[HOLD SHORT] entry=${entryPrice.toFixed(8)}  TP=${tp.toFixed(8)}  SL=${sl.toFixed(8)}`);

    if (ask <= tp) {
        console.log(`[TP SHORT] ask ${ask} <= TP ${tp.toFixed(8)} → closeMarket`);
        try {
            const result = await gb.method.closeMarket(pair, qty, exchange);
            console.log("[TP SHORT] closeMarket succès :", JSON.stringify(result));
        } catch (err) {
            console.log("[TP SHORT] closeMarket ERREUR :", err.message || err);
        }
        return;
    }

    if (ask >= sl) {
        console.log(`[SL SHORT] ask ${ask} >= SL ${sl.toFixed(8)} → closeMarket`);
        try {
            const result = await gb.method.closeMarket(pair, qty, exchange);
            console.log("[SL SHORT] closeMarket succès :", JSON.stringify(result));
        } catch (err) {
            console.log("[SL SHORT] closeMarket ERREUR :", err.message || err);
        }
        return;
    }

    return;
}

// ── 4. Guard levier avant toute entrée en position ───────────
// LEVERAGE = 0 est la valeur par défaut dans config.js : bloquer les entrées
// si la valeur n'a pas été configurée pour cette paire.
if (!leverage || leverage === 0) {
    console.log("[WARN] LEVERAGE non défini ou nul dans la config – entrée en position bloquée.");
    return;
}

// ── 5. Recherche d'un signal d'entrée (pas de position ouverte) ──

if (bid > longEntryThreshold) {

    console.log(`[SIGNAL LONG] bid ${bid} > seuil ${longEntryThreshold.toFixed(8)} → buyMarket`);
    gb.method.setTimeScaleMark(pair, exchange, `LONG @ ${bid}`);
    try {
        const result = await gb.method.buyMarket(positionSizeQuote, pair);
        console.log("[ENTRY LONG] buyMarket succès :", JSON.stringify(result));
    } catch (err) {
        console.log("[ENTRY LONG] buyMarket ERREUR :", err.message || err);
    }
    return;
}

if (ask < shortEntryThreshold) {

    console.log(`[SIGNAL SHORT] ask ${ask} < seuil ${shortEntryThreshold.toFixed(8)} → sellMarket`);
    gb.method.setTimeScaleMark(pair, exchange, `SHORT @ ${ask}`);
    try {
        const result = await gb.method.sellMarket(positionSizeQuote, pair);
        console.log("[ENTRY SHORT] sellMarket succès :", JSON.stringify(result));
    } catch (err) {
        console.log("[ENTRY SHORT] sellMarket ERREUR :", err.message || err);
    }
    return;
}

console.log("[IDLE] Aucun signal – pas d'ordre envoyé.");
