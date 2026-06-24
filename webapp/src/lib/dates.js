export function getEaster(year) {
  const f = Math.floor;
  const G = year % 19;
  const C = f(year / 100);
  const H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30;
  const I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11));
  const J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7;
  const L = I - J;
  const month = 3 + f((L + 40) / 44);
  const day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
}

export function getJoursFeries(year) {
  const easter = getEaster(year);
  const easterTime = easter.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  
  const lundiDePaques = new Date(easterTime + dayMs);
  const ascension = new Date(easterTime + 39 * dayMs);
  const pentecote = new Date(easterTime + 50 * dayMs);

  return [
    new Date(year, 0, 1),    // 1er Janvier
    lundiDePaques,
    new Date(year, 4, 1),    // 1er Mai - Fête du travail
    new Date(year, 4, 8),    // 8 Mai - Victoire 1945
    ascension,               // Jeudi de l'Ascension
    pentecote,               // Lundi de Pentecôte
    new Date(year, 6, 14),   // 14 Juillet - Fête Nationale
    new Date(year, 7, 15),   // 15 Août - Assomption
    new Date(year, 10, 1),   // 1er Novembre - Toussaint
    new Date(year, 10, 11),  // 11 Novembre - Armistice
    new Date(year, 11, 25)   // 25 Décembre - Noël
  ];
}

export function isJourFerie(date) {
  const year = date.getFullYear();
  const feries = getJoursFeries(year);
  
  return feries.some(f => 
    f.getDate() === date.getDate() && 
    f.getMonth() === date.getMonth()
  );
}
