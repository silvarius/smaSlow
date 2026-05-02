// ============================================================
//  Gunbot Custom Strategy – Futures Properties & Methods Test
//  Version : 0-1-0  (alpha)
//  Objet   : Tester les propriétés Futures exposées par Gunbot
//            et les méthodes d'ordres market (buy / sell / close)
// ============================================================

const strategyVersion = "0-1-0";

// ──────────────────────────────────────────────────────────────
//  SECTION 1 – LOGGING DES PROPRIÉTÉS FUTURES
//  Toutes les propriétés répertoriées dans market-data qui ne
//  sont PAS marquées "Specific to spot trading".
// ──────────────────────────────────────────────────────────────

function logAllProperties() {
    console.log("==========================================================");
    console.log(`[${strategyVersion}] DUMP DES PROPRIÉTÉS – cycle ${Date.now()}`);
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
    console.log("[IND] slowSma                   :", gb.data.slowSma);
    console.log("[IND] atr                       :", gb.data.atr);

    // --- Données OHLCV (dernière bougie uniquement pour ne pas spammer) ---
    const lastIdx = gb.data.candlesClose.length - 1;
    console.log("[OHLCV] nb bougies dispo        :", gb.data.candlesClose.length);
    console.log("[OHLCV] last open               :", gb.data.candlesOpen[lastIdx]);
    console.log("[OHLCV] last high               :", gb.data.candlesHigh[lastIdx]);
    console.log("[OHLCV] last low                :", gb.data.candlesLow[lastIdx]);
    console.log("[OHLCV] last close              :", gb.data.candlesClose[lastIdx]);
    console.log("[OHLCV] last volume             :", gb.data.candlesVolume[lastIdx]);
    console.log("[OHLCV] last timestamp          :", gb.data.candlesTimestamp[lastIdx]);

    // --- Propriétés FUTURES ---
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

    console.log("==========================================================");
}

// ──────────────────────────────────────────────────────────────
//  SECTION 2 – LOGIQUE DE TRADING
//  entryPrice reconstruit à chaque cycle :
//  entryPrice = totalPositionInitialMargin * leverage / currentQty
// ──────────────────────────────────────────────────────────────

// Paramètres
const BASE_SIZE_USDT = 100;          // taille de position en base (USDT/USDC)
const ATR_MULTIPLIER_ENTRY = 2;      // multiplicateur ATR pour signal d'entrée
const ATR_MULTIPLIER_TP    = 2;      // multiplicateur ATR pour Take Profit
const ATR_MULTIPLIER_SL    = 1.5;    // multiplicateur ATR pour Stop Loss

// ── 1. Dump de toutes les propriétés à chaque cycle ──────
logAllProperties();

// ── 2. Lecture des données nécessaires à la logique ──────
const bid      = gb.data.bid;
const ask      = gb.data.ask;
const slowSma  = gb.data.slowSma;
const atr      = gb.data.atr;
const side     = gb.data.currentSide;   // "long" | "short" | "none"
const qty      = gb.data.currentQty;
const pair     = gb.data.pairName;
const margin   = gb.data.totalPositionInitialMargin;
const leverage = gb.data.leverage;

// Sécurité : attendre que les indicateurs soient disponibles
if (!slowSma || !atr || slowSma === 0 || atr === 0) {
    console.log("[WARN] slowSma ou ATR non disponible – cycle ignoré.");
    return;
}

// Taille de position en quote (ex: BTC) = 100 USDT / prix
const positionSizeQuote = BASE_SIZE_USDT / ask;

// Seuils d'entrée
const longEntryThreshold  = slowSma + atr * ATR_MULTIPLIER_ENTRY;
const shortEntryThreshold = slowSma - atr * ATR_MULTIPLIER_ENTRY;

console.log(`[LOGIC] bid=${bid} ask=${ask} slowSma=${slowSma} atr=${atr}`);
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
            const result = await gb.method.closeMarket(pair, qty);
            console.log("[TP LONG] closeMarket succès :", JSON.stringify(result));
        } catch (err) {
            console.log("[TP LONG] closeMarket ERREUR :", err.message || err);
        }
        return;
    }

    if (bid <= sl) {
        console.log(`[SL LONG] bid ${bid} <= SL ${sl.toFixed(8)} → closeMarket`);
        try {
            const result = await gb.method.closeMarket(pair, qty);
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
            const result = await gb.method.closeMarket(pair, qty);
            console.log("[TP SHORT] closeMarket succès :", JSON.stringify(result));
        } catch (err) {
            console.log("[TP SHORT] closeMarket ERREUR :", err.message || err);
        }
        return;
    }

    if (ask >= sl) {
        console.log(`[SL SHORT] ask ${ask} >= SL ${sl.toFixed(8)} → closeMarket`);
        try {
            const result = await gb.method.closeMarket(pair, qty);
            console.log("[SL SHORT] closeMarket succès :", JSON.stringify(result));
        } catch (err) {
            console.log("[SL SHORT] closeMarket ERREUR :", err.message || err);
        }
        return;
    }

    return;
}

// ── 4. Recherche d'un signal d'entrée (pas de position ouverte) ──

if (bid > longEntryThreshold) {

    console.log(`[SIGNAL LONG] bid ${bid} > seuil ${longEntryThreshold.toFixed(8)} → buyMarket`);
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
    try {
        const result = await gb.method.sellMarket(positionSizeQuote, pair);
        console.log("[ENTRY SHORT] sellMarket succès :", JSON.stringify(result));
    } catch (err) {
        console.log("[ENTRY SHORT] sellMarket ERREUR :", err.message || err);
    }
    return;
}

console.log("[IDLE] Aucun signal – pas d'ordre envoyé.");
