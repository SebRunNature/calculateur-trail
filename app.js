// État applicatif centralisé (course, ravitos, préférences UI) — remplace les anciennes
// variables globales éparses (ravitoMode, currentWeather, selectedProducts, etc.) pour
// limiter les risques d'incohérence entre elles. Les noms de champs restent identiques
// à ceux utilisés dans collectFormData()/applyFormData() pour ne pas casser les
// sauvegardes locales et fichiers .json déjà exportés.
var state = {
  ravitoMode: 'custom',   // 'custom' | 'none'
  ravitoFreq: 2,          // conservé pour compat. anciens exports .json (mode "auto" retiré de l'UI)
  pdfFormat:  'portrait', // 'portrait' | 'landscape' | 'bracelet'
  weather:    'moderate', // 'cold' | 'moderate' | 'hot'
  terrain:    'easy',     // 'easy' | 'tech' | 'expert'
  fatigue:    0,          // 0-30, dérive de fatigue en %
  customRavitoKms:  [],   // km des ravitos officiels saisis
  drink:      'water',    // boisson dans les flasques : 'water' | 'custom'
  mode:       'simple',   // 'simple' | 'expert'
  simpleStep: 0           // 0=distance, 1=objectif, 2=résultat (parcours découverte, mode simple)
};

// Produit solide — plus de marques imposées : un seul produit, le tien.
function getCustomProduct(){
  var carbs=parseFloat((document.getElementById('productCarbs')||{}).value)||0;
  if(carbs<=0) return null;
  return {
    label:  (document.getElementById('productName')||{}).value || 'Mon produit',
    glucides: carbs,
    sodium: parseFloat((document.getElementById('productSodium')||{}).value)||0,
    icon: '⚙️'
  };
}

function fmtUnits(glucSection, product){
  if(!product||!product.glucides) return null;
  var n=Math.ceil(glucSection/product.glucides);
  var label=product.label||'unité';
  return n+'&nbsp;×&nbsp;'+product.icon+' '+label;
}

// state.drink : 'water' | 'custom' — plus de marques imposées (Maurten, Isostar…)
function setDrink(d){
  state.drink=d;
  document.querySelectorAll('#drinkPills .terrain-pill').forEach(function(b){b.classList.remove('on');});
  var el=document.getElementById('dp-'+d); if(el)el.classList.add('on');
  var wrap=document.getElementById('drinkCustomWrap');
  wrap.style.display=(d==='custom')?'block':'none';
  updateNutritionPreview();
}

function getDrinkConfig(){
  if(state.drink!=='custom') return null;
  var name=(document.getElementById('drinkName')||{}).value||'Boisson perso';
  var gluc=parseFloat((document.getElementById('drinkCarbs500')||{}).value)||0;
  if(gluc>0) return {label:name, glucPer500:gluc, icon:'🧪'};
  return null;
}

// ── SAUVEGARDE / EXPORT / IMPORT ─────────────────────────────────────────
var SAVE_KEY = 'seb_trail_calc_v1';

function collectFormData(){
  var data = {
    version: 1,
    savedAt: new Date().toISOString(),
    // Course
    raceName:    getVal('raceName'),
    dist:        getVal('dist','10'),
    customDist:  getVal('customDist'),
    targetTime:  getVal('targetTime'),
    startTime:   getVal('startTime'),
    freq:        getVal('freq','custom'),
    freqCustom:  getVal('freqCustom','1'),
    strategy:    getVal('strat','constant'),
    fatigue:     getVal('fatigueSlider','0'),
    dplus:       getVal('dplus'),
    terrain:     state.terrain,
    weather:     state.weather,
    // Ravito
    ravitoMode:  state.ravitoMode,
    ravitoFreq:  state.ravitoFreq,
    customRavitoKms: state.customRavitoKms.slice(),
    // Nutrition
    userWeight:  getVal('userWeight'),
    userCarbsH:  getVal('userCarbsH'),
    userWaterH:  getVal('userWaterH'),
    userSodiumH: getVal('userSodiumH'),
    userFlasque: getVal('userFlasque','1000'),
    // Boisson
    currentDrink: state.drink,
    drinkName:   getVal('drinkName'),
    drinkCarbs500:getVal('drinkCarbs500'),
    // Produit perso (plus de marques imposées)
    productName: getVal('productName'),
    productCarbs:getVal('productCarbs'),
    productSodium:getVal('productSodium'),
    // PDF
    pdfFormat:   state.pdfFormat,
    motivation:  getVal('mottoInput')
  };
  return data;
}

function applyFormData(data){
  if(!data) return;
  // Course
  if(data.raceName    !== undefined) setVal('raceName',    data.raceName);
  if(data.dist        !== undefined){ setVal('dist', data.dist); onDistChange(); }
  if(data.customDist  !== undefined) setVal('customDist',  data.customDist);
  if(data.targetTime  !== undefined) setVal('targetTime',  data.targetTime);
  if(data.startTime   !== undefined) setVal('startTime',   data.startTime);
  if(data.freq        !== undefined) setVal('freq',        data.freq);
  if(data.freqCustom  !== undefined) setVal('freqCustom',  data.freqCustom);
  onFreqChange();
  if(data.strategy    !== undefined) setVal('strat',    data.strategy);
  if(data.fatigue     !== undefined){
    setVal('fatigueSlider', data.fatigue);
    var lbl=document.getElementById('fatigueVal');
    if(lbl) lbl.textContent=data.fatigue+'%';
  }
  if(data.dplus       !== undefined){ setVal('dplus', data.dplus); onDplusChange&&onDplusChange(); }
  if(data.terrain     !== undefined){
    state.terrain=data.terrain;
    document.querySelectorAll('.terrain-pill').forEach(function(b){b.classList.remove('on');});
    var tb=document.getElementById('tp-'+data.terrain); if(tb)tb.classList.add('on');
  }
  if(data.weather     !== undefined){
    state.weather=data.weather;
    document.querySelectorAll('.weather-pill').forEach(function(b){b.classList.remove('on');b.setAttribute('aria-pressed','false');});
    var wb=document.querySelector('.weather-pill.'+data.weather); if(wb){wb.classList.add('on');wb.setAttribute('aria-pressed','true');}
  }
  // Ravito
  if(data.ravitoMode  !== undefined) setRavito(data.ravitoMode==='auto'?'custom':data.ravitoMode);
  if(data.ravitoFreq  !== undefined) setFreq(data.ravitoFreq);
  if(data.customRavitoKms !== undefined){
    state.customRavitoKms = data.customRavitoKms.slice();
    renderRavitoTags();
  }
  // Nutrition
  if(data.userWeight  !== undefined) setVal('userWeight',  data.userWeight);
  if(data.userCarbsH  !== undefined) setVal('userCarbsH',  data.userCarbsH);
  if(data.userWaterH  !== undefined) setVal('userWaterH',  data.userWaterH);
  if(data.userSodiumH !== undefined) setVal('userSodiumH', data.userSodiumH);
  if(data.userFlasque !== undefined) setVal('userFlasque', data.userFlasque);
  // Boisson
  if(data.currentDrink !== undefined) setDrink(data.currentDrink);
  if(data.drinkName   !== undefined) setVal('drinkName',   data.drinkName);
  if(data.drinkCarbs500 !== undefined) setVal('drinkCarbs500', data.drinkCarbs500);
  // Produit perso (data.selectedProducts d'anciens exports .json est ignoré : le
  // multi-sélecteur de marques a été retiré, il ne reste qu'un produit personnalisé)
  if(data.productName  !== undefined) setVal('productName',  data.productName);
  if(data.productCarbs !== undefined) setVal('productCarbs', data.productCarbs);
  if(data.productSodium!== undefined) setVal('productSodium',data.productSodium);
  // PDF
  if(data.pdfFormat !== undefined){
    state.pdfFormat = data.pdfFormat;
    document.querySelectorAll('.format-pill').forEach(function(b){b.classList.remove('on');});
    var fp = document.getElementById('pf'+data.pdfFormat.charAt(0).toUpperCase()+data.pdfFormat.slice(1));
    if(fp) fp.classList.add('on');
  }
  if(data.motivation !== undefined) setVal('mottoInput', data.motivation);
  updateNutritionPreview();
}

function setVal(id, val){
  var el = document.getElementById(id);
  if(el) el.value = val;
}

// Lecture compacte d'une valeur de champ (remplace les (getElementById(id)||{}).value)
function getVal(id, fallback){
  var el = document.getElementById(id);
  return (el && el.value != null && el.value !== '') ? el.value : (fallback != null ? fallback : '');
}

function setStatus(msg, isError){
  var el = document.getElementById('saveStatus');
  if(!el) return;
  el.textContent = msg;
  el.className = 'save-status' + (isError ? ' error' : '');
  setTimeout(function(){ el.textContent = ''; }, 3000);
}

// ── SAUVEGARDE LOCALE (localStorage) ──────────────────────────────────────
function saveToLocal(){
  try {
    var data = collectFormData();
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    setStatus('✓ Sauvegardé localement · ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
  } catch(e){
    setStatus('Erreur sauvegarde locale', true);
  }
}

function loadFromLocal(){
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    var data = JSON.parse(raw);
    applyFormData(data);
    var d = new Date(data.savedAt);
    var dateStr = d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})
      + ' ' + d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    setStatus('✓ Données restaurées · ' + dateStr);
    return true;
  } catch(e){
    return false;
  }
}

function clearSave(){
  if(!confirm('Effacer la sauvegarde locale ?')) return;
  localStorage.removeItem(SAVE_KEY);
  setStatus('Sauvegarde effacée');
}

// ── EXPORT JSON ────────────────────────────────────────────────────────────
function exportJSON(){
  var data = collectFormData();
  var name = (data.raceName||'ma-course').toLowerCase()
    .replace(/[àáâã]/g,'a').replace(/[éèêë]/g,'e')
    .replace(/[îï]/g,'i').replace(/[ôõ]/g,'o').replace(/[ùûü]/g,'u')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
    || 'course';
  var year = new Date().getFullYear();
  var filename = name + '-' + year + '.json';
  var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setStatus('✓ Exporté : ' + filename);
}

// ── IMPORT JSON ────────────────────────────────────────────────────────────
function importJSON(event){
  var file = event.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try {
      var data = JSON.parse(e.target.result);
      if(!data.version) throw new Error('Format invalide');
      applyFormData(data);
      setStatus('✓ Importé : ' + (data.raceName||file.name));
    } catch(err){
      setStatus('Fichier invalide ou corrompu', true);
    }
    event.target.value = ''; // reset input
  };
  reader.readAsText(file);
}

// state.mode : 'simple' ou 'expert'

function setMode(mode){
  state.mode = mode;
  // Classes body
  document.body.classList.toggle('mode-simple', mode==='simple');
  document.body.classList.toggle('mode-expert', mode==='expert');
  // Boutons toggle
  document.getElementById('modeSimpleBtn').classList.toggle('active', mode==='simple');
  document.getElementById('modeExpertBtn').classList.toggle('active', mode==='expert');
  // Hero adaptatif
  document.getElementById('heroSimple').style.display = mode==='simple' ? '' : 'none';
  document.getElementById('heroExpert').style.display = mode==='expert' ? '' : 'none';
  // En mode simple : forcer ravitoMode = 'none' et stratégie = 'even'
  if(mode==='simple'){
    // Pas de ravito en mode simple
    state.ravitoMode='none';
    document.querySelectorAll('.radio-opt').forEach(function(el){el.classList.remove('selected');});
    var noneOpt=document.getElementById('opt-none');
    if(noneOpt)noneOpt.classList.add('selected');
    // Stratégie constante par défaut
    var stratEl=document.getElementById('strat');
    if(stratEl)stratEl.value='even';
  }
  // Mémoriser le choix
  try{ localStorage.setItem('seb_trail_mode', mode); }catch(e){}
  renderSimpleStep();
}

// ── PARCOURS DÉCOUVERTE (Mode Simple) — une question à la fois ─────────────
// state.simpleStep : 0 = distance, 1 = objectif (chrono+départ), 2 = résultat
function goSimpleStep(n){
  state.simpleStep = Math.max(0, Math.min(2, n));
  renderSimpleStep();
}

function simpleNext(){
  if(state.simpleStep===1){ calculate(); return; } // calculate() amène déjà à l'étape 3
  goSimpleStep(state.simpleStep+1);
}

function simplePrev(){ goSimpleStep(state.simpleStep-1); }

function simpleRestart(){
  var out=document.getElementById('output');
  if(out) out.style.display='none';
  goSimpleStep(0);
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderSimpleStep(){
  var isSimple = state.mode==='simple';
  var w0=document.getElementById('wizStep0'), w1=document.getElementById('wizStep1');
  var p0=document.getElementById('wizPanel0'), p1=document.getElementById('wizPanel1');
  var a0=document.getElementById('wizActions0'), a1=document.getElementById('wizActions1');
  var mc=document.getElementById('maCourseSection');
  if(!isSimple){
    // Mode Expert : tout est toujours visible, l'étape n'a aucun effet
    [w0,w1,p0,p1,a0,a1].forEach(function(el){ if(el) el.classList.remove('wiz-hidden'); });
    if(mc) mc.style.display='';
    return;
  }
  var s=state.simpleStep;
  if(w0) w0.classList.toggle('wiz-hidden', s!==0);
  if(p0) p0.classList.toggle('wiz-hidden', s!==0);
  if(a0) a0.classList.toggle('wiz-hidden', s!==0);
  if(w1) w1.classList.toggle('wiz-hidden', s!==1);
  if(p1) p1.classList.toggle('wiz-hidden', s!==1);
  if(a1) a1.classList.toggle('wiz-hidden', s!==1);
  if(mc) mc.style.display = s<2 ? '' : 'none';
  [0,1,2].forEach(function(i){
    var dot=document.getElementById('wizDot'+i);
    if(!dot) return;
    dot.classList.toggle('current', i===s);
    dot.classList.toggle('done', i<s);
  });
}

// Initialisation mode au démarrage
window.addEventListener('DOMContentLoaded', function(){
  var savedMode = 'simple';
  try{ savedMode = localStorage.getItem('seb_trail_mode') || 'simple'; }catch(e){}
  setMode(savedMode);
  // Charger sauvegarde après avoir défini le mode
  if(localStorage.getItem(SAVE_KEY)) loadFromLocal();
});
// Fenêtre caféine = 2ème nuit uniquement (pas la 1ère — adrénaline du départ)
// Départ + ~24h → on entre dans la 2ème nuit → caféine activée jusqu'au lever du soleil

function getCaffeineWindow(startTimeStr, totalSec){
  // Fenêtre caféine = 2ème nuit uniquement
  // Logique : trouver quand 22h00 arrive pour la 2ème fois depuis le départ
  if(!startTimeStr || startTimeStr==='--:--') return null;
  var parts = startTimeStr.split(':');
  var startH   = parseInt(parts[0])||0;
  var startMin = parseInt(parts[1])||0;
  var startMinOfDay = startH*60 + startMin; // minutes depuis minuit

  // Minutes restantes jusqu'à 22h00 ce même jour (première fois)
  var night22h = 22*60; // 1320 min
  var minToFirst22h = night22h - startMinOfDay;
  if(minToFirst22h < 0) minToFirst22h += 24*60; // déjà passé → demain
  if(minToFirst22h === 0) minToFirst22h = 24*60; // pile à 22h → compter la prochaine

  // 1ère fenêtre 22h = minToFirst22h minutes après le départ
  // 2ème fenêtre 22h = minToFirst22h + 24*60 minutes (la nuit suivante)
  var cafStartMin = minToFirst22h + 24*60;
  var cafStartSec = cafStartMin * 60;
  var cafEndSec   = cafStartSec + 8 * 3600; // 22h → 06h = 8h de fenêtre

  if(cafStartSec >= totalSec) return null; // course terminée avant la 2ème nuit

  return {
    startSec: cafStartSec,
    endSec:   Math.min(cafEndSec, totalSec)
  };
}

function getCafDose(weightKg){
  // 1-2 mg/kg/h, recommandation ISSN, max 100mg/h
  var w = parseFloat(weightKg)||70;
  var low  = Math.round(w * 1);
  var high = Math.round(Math.min(w * 2, 100));
  return {low:low, high:high};
}

function getCafSources(dose){
  // Exemples de sources pour atteindre la dose
  var lines = [];
  lines.push('<svg class="ic" aria-hidden="true"><use href="#i-coffee"/></svg> 1 café expresso (~60–80mg)');
  lines.push('<svg class="ic" aria-hidden="true"><use href="#i-pill"/></svg> 1 comprimé caféine 100mg (Nocca, Vivarin…)');
  lines.push('🟣 1 gel caféiné (SIS Caffeine 75mg, Maurten Caf 100mg…)');
  lines.push('<svg class="ic" aria-hidden="true"><use href="#i-cup"/></svg> Maurten 320 CAF 100 (100mg/500ml — glucides inclus)');
  return lines;
}

var NUTRITION_CONFIG = {
  // === EAU (ml/h) — ACSM 2007 / Sawka et al.
  // < 1h : pas besoin de ravitaillement structuré
  // 1h–2h : ~400–500 ml/h selon intensité
  // 2h–4h : ~500–700 ml/h (pertes sudation soutenues)
  // > 4h  : ~600–800 ml/h (ultras, terrain difficile)
  water: [
    {maxH:1.5, mlH:0},
    {maxH:2.5, mlH:450},
    {maxH:4,   mlH:600},
    {maxH:99,  mlH:700}
  ],
  // === GLUCIDES (g/h) — Jeukendrup 2014, Burke et al. 2011
  // < 1h30 : réserves glycogène suffisantes, pas besoin
  // 1h30–2h30 : 30–60 g/h (glucose seul, absorption maximale ~60g/h)
  // 2h30–5h : 60–90 g/h (glucose + fructose 2:1, double transporteur)
  // > 5h (ultra) : 60–80 g/h (réduction digestive liée à la fatigue intestinale)
  // NOTE : 80g/h est le seuil de saturation intestinale pour glucose seul
  carbs: [
    {maxH:1.5, gH:0},
    {maxH:2.5, gH:45},
    {maxH:5,   gH:75},
    {maxH:99,  gH:70}
  ],
  // === SODIUM (mg/h) — Casa et al. 2019, ACSM
  // Sudation normale : 500–1000 mg Na/L de sueur
  // Base : 400 mg/h (seuil minimum pour prévenir hyponatrémie)
  // Chaleur / durée longue : jusqu'à 1000–1200 mg/h
  sodium: {base:500},
  // === MODIFICATEURS MÉTÉO
  weather: {
    cold:     {water:0.75, sodium:0.7},   // Moins de sudation, Na modéré
    moderate: {water:1.0,  sodium:1.0},   // Référence
    hot:      {water:1.45, sodium:1.6}    // +45% eau, +60% Na (sudation intense)
  },
  // === SEUILS D'ALERTE
  alerts: {
    carbsMax:90,       // > 90g/h → saturation intestinale (double transporteur max)
    carbsHigh:80,      // > 80g/h → attention si pas d'entraînement intestinal
    waterMin:400,      // < 400ml/h → déshydratation significative probable
    waterMax:1000,     // > 1000ml/h → risque hyponatrémie par dilution
    hypo:{waterMin:700, sodiumMax:350}   // Boire bcp + peu de Na → hyponatrémie
  }
};

function setWeather(w, btn) {
  state.weather = w;
  document.querySelectorAll('.weather-pill').forEach(function(b){
    b.classList.remove('on');
    b.setAttribute('aria-pressed','false');
  });
  btn.classList.add('on');
  btn.setAttribute('aria-pressed','true');
}

function toggleDark(){
  document.body.classList.toggle('dark');
  var isDark=document.body.classList.contains('dark');
  var btn=document.getElementById('darkBtn');
  if(btn)btn.innerHTML=isDark?ic('sun')+' Mode clair':ic('moon')+' Mode sombre';
}

function toggleFullscreen(){
  var btn=document.getElementById('fsBtn');
  if(!document.fullscreenElement){
    document.documentElement.requestFullscreen().catch(function(){});
    if(btn)btn.innerHTML=ic('x')+' Quitter';
  } else {
    document.exitFullscreen();
    if(btn)btn.innerHTML=ic('expand')+' Fullscreen';
  }
}
// Listener unique — évite les fuites mémoire dues aux ajouts répétés
document.addEventListener('fullscreenchange',function(){
  var btn=document.getElementById('fsBtn');
  if(!document.fullscreenElement&&btn)btn.innerHTML=ic('expand')+' Fullscreen';
});

function setTerrain(t,btn){
  state.terrain=t;
  document.querySelectorAll('.terrain-pill').forEach(function(b){b.classList.remove('on');});
  btn.classList.add('on');
  onDplusChange();
}

function onFatigueChange(v){
  state.fatigue=parseInt(v);
  var labels=['0% — Allure constante','-5% sur les 30 derniers km','-10% sur les 30 derniers km','-15% sur les 30 derniers km','-20% sur les 30 derniers km','-25% sur les 30 derniers km','-30% sur les 30 derniers km'];
  document.getElementById('fatigueVal').textContent=labels[parseInt(v)/5]||v+'%';
}

function onDplusChange(){
  var dplus=parseInt(document.getElementById('dplus').value)||0;
  var distSel=document.getElementById('dist').value;
  var dist=distSel==='custom'?parseFloat(document.getElementById('customDist').value)||0:parseFloat(distSel)||0;
  var tf=document.getElementById('terrainField');
  if(dplus>0&&dist>0){
    tf.style.display='block';
    var coeff={'easy':1.0,'tech':1.2,'expert':1.5}[state.terrain]||1.0;
    var ke=Math.round((dist+(dplus/100)*coeff)*10)/10;
    var banner=document.getElementById('kmEffortBanner');
    banner.style.display='flex';
    document.getElementById('kmEffortVal').textContent=ke+' km-effort';
    document.getElementById('kmEffortDetail').textContent=
      dist+' km + '+(dplus/100*coeff).toFixed(1)+' km D+ (Naismith ×'+coeff+') = '+ke+' km-effort · utilisé pour calculer ton allure par section';
  } else {
    tf.style.display='none';
    document.getElementById('kmEffortBanner').style.display='none';
  }
}

function calcKmEffort(dist,dplus){
  if(!dplus||dplus<=0)return dist;
  var coeff={'easy':1.0,'tech':1.2,'expert':1.5}[state.terrain]||1.0;
  return Math.round((dist+(dplus/100)*coeff)*10)/10;
}

function addRavitoKm(){
  var v=parseFloat(document.getElementById('ravitoKmInput').value);
  if(!v||v<=0)return;
  if(state.customRavitoKms.indexOf(v)===-1){
    state.customRavitoKms.push(v);
    state.customRavitoKms.sort(function(a,b){return a-b;});
    renderRavitoTags();
  }
  document.getElementById('ravitoKmInput').value='';
}

function removeRavitoKm(km){
  state.customRavitoKms=state.customRavitoKms.filter(function(k){return k!==km;});
  renderRavitoTags();
}

function renderRavitoTags(){
  var c=document.getElementById('ravitoTags');c.innerHTML='';
  state.customRavitoKms.forEach(function(km){
    var t=document.createElement('span');t.className='ravito-tag';
    t.innerHTML='km '+km+' ✕';
    t.onclick=(function(k){return function(){removeRavitoKm(k);};})(km);
    c.appendChild(t);
  });
}

function getEffectivePace(avgPace,km,dist){
  var strat=document.getElementById('strat').value;
  var pace=avgPace;
  if(strat==='neg')pace=avgPace*(1+0.05*(1-2*km/dist));
  else if(strat==='pos')pace=avgPace*(1-0.05*(1-2*km/dist));
  if(state.fatigue>0&&dist>30&&km>dist-30){
    var fatigueRatio=1+(state.fatigue/100)*((km-(dist-30))/30);
    pace=pace*fatigueRatio;
  }
  return pace;
}

function getNutritionSection(elapsedSecStart, elapsedSecEnd, totalSec, totalKm){
  // Calcule les besoins PENDANT une section, basé sur la durée réelle de la section
  // elapsedSecStart = temps écoulé au début de la section (ravito précédent ou départ)
  // elapsedSecEnd   = temps écoulé à la fin de la section (ce ravito)
  var sectionDurSec = elapsedSecEnd - elapsedSecStart;
  var sectionH = sectionDurSec / 3600;
  if(sectionH <= 0) return null;

  var n = getNutritionPerRavito(totalSec, 1, totalKm);
  if(!n) return null;

  // Les besoins de la section = taux horaire × durée de la section
  var glucSection  = Math.round(n.carbsH  * sectionH);
  var eauSection   = Math.round(n.waterH  * sectionH);
  var sodSection   = Math.round(n.sodiumH * sectionH);

  return {
    gluc:     glucSection,
    glucL:    glucSection+'g',
    eau:      eauSection,
    eauL:     eauSection+'ml',
    sod:      sodSection,
    sectionH: sectionH,
    carbsH:   n.carbsH,
    waterH:   n.waterH,
    detail:   n.detail
  };
}

function getNutritionPerRavito(totalSec, ravitoFreqKm, distKm) {
  var h = totalSec / 3600;
  if (h < 1.5) return null;
  var mod = NUTRITION_CONFIG.weather[state.weather];
  var nbRavitos = Math.floor(distKm / ravitoFreqKm);
  if (nbRavitos < 1) nbRavitos = 1;

  // === Valeurs horaires : personnalisées si saisies, sinon recommandations auto ===
  var userCarbsH = parseFloat(document.getElementById('userCarbsH').value) || 0;
  var userWaterH = parseFloat(document.getElementById('userWaterH').value) || 0;
  var userSodiumH = parseFloat(document.getElementById('userSodiumH').value) || 0;
  var userWeight = parseFloat(document.getElementById('userWeight').value) || 0;

  // Calcul automatique basé sur durée réelle
  var waterBase = 0, carbsBase = 0;
  NUTRITION_CONFIG.water.forEach(function(r){if(h<=r.maxH&&!waterBase)waterBase=r.mlH;});
  NUTRITION_CONFIG.carbs.forEach(function(r){if(h<=r.maxH&&!carbsBase)carbsBase=r.gH;});
  if(!waterBase) waterBase = 700;
  if(!carbsBase) carbsBase = 70;

  // Si poids renseigné : ajustement eau (~7-12ml/kg/h selon météo)
  // Le facteur météo est déjà intégré ici via mlPerKg — on ne le réapplique pas plus bas
  // (sinon la météo est comptée deux fois : ex. chaud => ×12/9 puis ×1.45 => ~1.9x au lieu de 1.45x).
  var autoWaterBase;
  if(userWeight > 0) {
    var mlPerKg = state.weather==='cold' ? 7 : state.weather==='hot' ? 12 : 9;
    autoWaterBase = Math.round(userWeight * mlPerKg);
    // On plafonne entre 300ml et 1000ml/h pour sécurité
    autoWaterBase = Math.max(300, Math.min(1000, autoWaterBase));
  } else {
    // Pas de poids : base par durée, la météo s'applique ici (une seule fois)
    autoWaterBase = Math.round(waterBase * mod.water);
  }

  var carbsH  = userCarbsH  > 0 ? userCarbsH  : carbsBase;
  var waterH  = userWaterH  > 0 ? userWaterH  : autoWaterBase;
  var sodiumH = userSodiumH > 0 ? userSodiumH : Math.round(NUTRITION_CONFIG.sodium.base * mod.sodium);

  // Par ravito (basé sur durée réelle h = totalSec/3600)
  var waterPerRav  = Math.round(waterH  * h / nbRavitos);
  var carbsPerRav  = Math.round(carbsH  * h / nbRavitos);
  var sodiumPerRav = Math.round(sodiumH * h / nbRavitos);

  // Label type nutrition selon durée réelle
  var detail;
  if (h < 2) detail = 'Gorgées d\'eau';
  else if (h < 2.5) detail = 'Gel + eau';
  else if (h < 4) detail = 'Gel + eau + sel';
  else if (h < 6) detail = 'Gel/barre + eau + sel';
  else detail = 'Solide + eau + sel + protéines';

  return {
    gluc: carbsPerRav,
    glucL: '~'+carbsPerRav+'g',
    eau: waterPerRav,
    eauL: waterPerRav+'ml',
    sod: sodiumPerRav,
    detail: detail,
    // Totaux horaires pour alertes (basés sur durée réelle !)
    waterH: waterH,
    carbsH: carbsH,
    sodiumH: sodiumH,
    totalWater: Math.round(waterH  * h),
    totalCarbs: Math.round(carbsH  * h),
    totalSodium: Math.round(sodiumH * h),
    isCustomCarbs:  userCarbsH  > 0,
    isCustomWater:  userWaterH  > 0,
    isCustomSodium: userSodiumH > 0,
    isWeightBased:  userWeight  > 0 && userWaterH === 0
  };
}

function getAlerts(n) {
  if (!n) return [];
  var alerts = [];

  // Sodium total réel = sodium alimentation + sodium boisson
  var drink = typeof getDrinkConfig === 'function' ? getDrinkConfig() : null;
  var waterH = n.waterH || 0;
  var drinkSodH = drink && drink.sodPer500
    ? Math.round(drink.sodPer500 * (Math.min(waterH, 1000) / 500))
    : 0;
  var totalSodiumH = n.sodiumH + drinkSodH;

  // Saturation intestinale glucides
  if (n.carbsH > NUTRITION_CONFIG.alerts.carbsMax)
    alerts.push({type:'danger', msg:'Saturation gastrique probable — '+n.carbsH+'g/h de glucides dépasse 90g/h (limite absolue double transporteur glucose+fructose). Réduisez ou alternez gel et solide.'});
  else if (n.carbsH > NUTRITION_CONFIG.alerts.carbsHigh)
    alerts.push({type:'warn', msg:'Charge glucidique élevée — '+n.carbsH+'g/h approche le seuil de 80g/h. Assurez-vous d\'avoir entraîné votre intestin à cette quantité.'});
  // Hydratation insuffisante
  if (n.waterH < NUTRITION_CONFIG.alerts.waterMin)
    alerts.push({type:'warn', msg:'Hydratation insuffisante — '+n.waterH+'ml/h est en dessous du minimum recommandé de 400ml/h. Augmentez la fréquence des ravitos ou votre capacité de flasque.'});
  // Sur-hydratation
  if (n.waterH > NUTRITION_CONFIG.alerts.waterMax)
    alerts.push({type:'warn', msg:'Volume hydrique très élevé — '+n.waterH+'ml/h. Boire plus de 1L/h sans compensation sodée peut diluer le sodium sanguin. Vérifiez votre apport en sel.'});
  // Hyponatrémie — on utilise le sodium TOTAL (alimentation + boisson)
  if (n.waterH > NUTRITION_CONFIG.alerts.hypo.waterMin && totalSodiumH < NUTRITION_CONFIG.alerts.hypo.sodiumMax)
    alerts.push({type:'danger', msg:'Risque d\'hyponatrémie — vous buvez beaucoup ('+n.waterH+'ml/h) mais peu de sodium total ('+totalSodiumH+'mg/h). Ajoutez du sel, des capsules sodium ou des boissons isotoniques.'});
  return alerts;
}
var lastRows=[], lastMeta={};

// Uniquement les distances propos\u00E9es dans le <select id="dist"> ci-dessus
var DIST_INFO={
  '5':{label:'5 km',sub:'Courte distance \u00B7 moins de 30 min pour les rapides'},
  '10':{label:'10 km',sub:'Distance classique \u00B7 r\u00E9f\u00E9rence pour calibrer tes allures'},
  '21.1':{label:'Semi-marathon 21,1 km',sub:'21,097 km officiels \u00B7 distance de r\u00E9f\u00E9rence'},
  '42.195':{label:'Marathon 42,195 km',sub:'La reine des distances \u00B7 42,195 km officiels'}
};

function updateNutritionPreview(){
  var carbsH  = parseFloat(document.getElementById('userCarbsH').value)||0;
  var waterH  = parseFloat(document.getElementById('userWaterH').value)||0;
  var sodiumH = parseFloat(document.getElementById('userSodiumH').value)||0;
  var weight  = parseFloat(document.getElementById('userWeight').value)||0;
  var flasque = parseFloat(document.getElementById('userFlasque').value)||1000;
  var drink   = getDrinkConfig();
  var product = getCustomProduct();
  var el = document.getElementById('nutritionPreview');
  if(!el) return;
  var hasInput = carbsH||waterH||sodiumH||weight||drink||product;
  if(!hasInput){el.style.display='none';}
  else{
    var lines = [];
    if(carbsH) lines.push('<svg class="ic" aria-hidden="true"><use href="#i-pill"/></svg> Glucides : <strong>'+carbsH+'g/h</strong> (saisi)');
    else lines.push('<svg class="ic" aria-hidden="true"><use href="#i-pill"/></svg> Glucides : <strong>auto</strong> selon durée (45–75g/h)');
    if(waterH) lines.push('<svg class="ic" aria-hidden="true"><use href="#i-droplet"/></svg> Eau : <strong>'+waterH+'ml/h</strong> (saisi)');
    else if(weight) lines.push('<svg class="ic" aria-hidden="true"><use href="#i-droplet"/></svg> Eau : <strong>~'+Math.round(weight*9)+'ml/h</strong> (poids '+weight+'kg)');
    else lines.push('<svg class="ic" aria-hidden="true"><use href="#i-droplet"/></svg> Eau : <strong>auto</strong> selon météo (450–700ml/h)');
    if(drink) lines.push('<svg class="ic" aria-hidden="true"><use href="#i-cup"/></svg> Boisson : <strong>'+drink.icon+' '+drink.label+'</strong> · '+drink.glucPer500+'g glucides/500ml · '+drink.sodPer500+'mg Na/500ml');
    lines.push('<svg class="ic" aria-hidden="true"><use href="#i-droplet"/></svg> Capacité flasques : <strong>'+flasque+'ml</strong>');
    el.innerHTML = lines.join('<br>');
    el.style.display = 'block';
  }
  // Récap du produit perso
  var info = document.getElementById('productSelectionInfo');
  if(info){
    if(!product){ info.style.display='none'; return; }
    info.innerHTML = '<strong>✓ Ton produit :</strong> '+product.icon+' '+product.label+' · '+product.glucides+'g glucides/unité'+(product.sodium?' · '+product.sodium+'mg sodium/unité':'');
    info.style.display='block';
  }
}

function onFreqChange(){
  var sel=document.getElementById('freq');
  var cf=document.getElementById('freqCustomField');
  if(cf) cf.style.display = sel.value==='custom' ? 'block' : 'none';
  var echo=document.getElementById('freqCustomEcho');
  if(echo) echo.textContent=(document.getElementById('freqCustom')||{}).value||'1';
}

// Fréquence de splits effective :
//   > 0  → un point de passage tous les N km
//   0    → aucun point intermédiaire (départ + arrivée seulement)
function getSplitFreq(){
  var sel=document.getElementById('freq');
  if(!sel) return 1;
  if(sel.value==='custom'){
    var v=parseFloat((document.getElementById('freqCustom')||{}).value);
    return (v>0) ? v : 0;
  }
  return 0;
}

function onDistChange(){
  var sel=document.getElementById('dist').value;
  var cf=document.getElementById('customField');
  cf.style.display=sel==='custom'?'block':'none';
  var banner=document.getElementById('distBanner');
  if(sel!=='custom'&&DIST_INFO[sel]){
    document.getElementById('distBannerText').textContent=DIST_INFO[sel].label;
    document.getElementById('distBannerSub').textContent=DIST_INFO[sel].sub;
    banner.style.display='flex';
  } else if(sel==='custom'){
    var v=parseFloat(document.getElementById('customDist').value);
    if(v>0){
      document.getElementById('distBannerText').textContent=v+' km \u00B7 distance personnalis\u00E9e';
      document.getElementById('distBannerSub').textContent='Ton trail, tes r\u00E8gles.';
      banner.style.display='flex';
    } else banner.style.display='none';
  } else banner.style.display='none';
}

function setRavito(m){
  state.ravitoMode=m;
  ['custom','none'].forEach(function(x){
    var o=document.getElementById('opt-'+x);
    var d=document.getElementById('dot-'+x);
    if(o)o.classList.toggle('selected',x===m);
    if(d)d.classList.toggle('on',x===m);
  });
  var wrap=document.getElementById('ravitoCustomWrap');
  if(wrap)wrap.style.display=m==='custom'?'block':'none';
}

// Conservée pour compatibilité avec d'anciens fichiers .json exportés (mode ravito "auto" retiré de l'UI)
function setFreq(f){
  state.ravitoFreq=f;
}

function setFormat(f){
  state.pdfFormat=f;
  ['pfV','pfH','pfB'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('on');});
  var map={'portrait':'pfV','landscape':'pfH','bracelet':'pfB'};
  var el=document.getElementById(map[f]);if(el)el.classList.add('on');
}

function updateCount(){
  var r=120-document.getElementById('mottoInput').value.length;
  document.getElementById('mottoCount').textContent=r+' caract\u00E8re'+(r!==1?'s':'')+' restant'+(r!==1?'s':'');
}

function parseTime(s){
  if(typeof s!=='string')return NaN;
  var t=s.trim();
  if(!t)return NaN;
  // Formats acceptés : HH:MM:SS ou MM:SS (chiffres uniquement, bornes 0-59 sur min/sec)
  if(!/^\d+(:\d{1,2}){1,2}$/.test(t))return NaN;
  var p=t.split(':').map(Number);
  if(p.some(isNaN))return NaN;
  if(p.length===3){
    var h=p[0],m=p[1],sec=p[2];
    if(m>59||sec>59)return NaN;          // minutes/secondes < 60
    return h*3600+m*60+sec;
  }
  if(p.length===2){
    var mm=p[0],ss=p[1];
    if(ss>59)return NaN;                 // secondes < 60
    return mm*60+ss;
  }
  return NaN;
}

// Échappement HTML pour les saisies utilisateur injectées dans le PDF
function escHtml(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtTime(sec){
  sec=Math.round(sec);
  var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  if(h>0)return h+':'+pad(m)+':'+pad(s);
  return m+':'+pad(s);
}

function pad(n){return String(n).padStart(2,'0');}

function fmtPace(spm){
  var m=Math.floor(spm/60),s=Math.round(spm%60);
  return m+"'"+pad(s)+'"/km';
}

function addTime(hhmm,addSec){
  var p=hhmm.split(':').map(Number);
  var base=p[0]*3600+p[1]*60+Math.round(addSec);
  return pad(Math.floor(base/3600)%24)+':'+pad(Math.floor((base%3600)/60));
}

// getNutritionPerRavito définie plus haut avec NUTRITION_CONFIG

function calculate(){
  var distSel=document.getElementById('dist').value;
  var dist=distSel==='custom'?parseFloat(document.getElementById('customDist').value):parseFloat(distSel);
  var totalSec=parseTime(document.getElementById('targetTime').value);
  var startTime=document.getElementById('startTime').value;
  var splitFreq=getSplitFreq();
  var strat=document.getElementById('strat').value;
  var dplus=parseInt(document.getElementById('dplus').value)||0;
  // Temps cible invalide : message explicite plutôt qu'un calcul silencieusement faux
  var ttRaw=(document.getElementById('targetTime')||{}).value||'';
  if(ttRaw.trim() && isNaN(totalSec)){
    alert('Temps cible invalide : "'+ttRaw+'".\n\nUtilise le format HH:MM:SS (ex. 4:30:00) ou MM:SS (ex. 52:30). Les minutes et secondes doivent être inférieures à 60.');
    return;
  }
  if(!dist||isNaN(dist)||isNaN(totalSec)||totalSec<=0)return;

  // Garde-fou : éviter un tableau ingérable (seulement si une fréquence est définie)
  if(splitFreq>0){
    var estLines=Math.ceil(dist/splitFreq);
    if(estLines>120){
      alert('Cette combinaison distance / fréquence de splits générerait '+estLines+' lignes — c\'est trop pour rester lisible.\n\nAugmente la fréquence des temps de passage (ex. tous les 5 ou 10 km) ou réduis la distance.');
      return;
    }
  }

  // Affichage du nom de la course en haut des résultats (si renseigné)
  var raceNameEl=document.getElementById('raceNameDisplay');
  var raceNameVal=(document.getElementById('raceName')||{}).value||'';
  if(raceNameEl){
    if(raceNameVal){
      raceNameEl.innerHTML='<svg class="ic" aria-hidden="true"><use href="#i-trophy"/></svg> '+escHtml(raceNameVal);
      raceNameEl.style.display='block';
    } else {
      raceNameEl.style.display='none';
    }
  }

  var kmEffort=calcKmEffort(dist,dplus);
  // effortSec conservé pour compatibilité affichage banner uniquement
  // La NUTRITION utilise toujours totalSec (durée réelle) — cf. getNutritionPerRavito
  var avgPace=totalSec/dist;
  document.getElementById('rAllure').textContent=fmtPace(avgPace);
  document.getElementById('rVitesse').textContent=(3600/avgPace).toFixed(1)+' km/h';
  // heureArr/rFin sont calculés après la boucle des points, à partir du temps réellement
  // simulé (finalElapsed) — la dérive de fatigue peut allonger la course au-delà de totalSec,
  // et sans ça la carte "Heure d'arrivée" contredisait la dernière ligne du tableau.

  // ⚠️ CORRECTION BUG : la nutrition se base sur la durée RÉELLE (totalSec),
  // pas sur effortSec (durée fictive km-effort qui gonfle artificiellement les totaux).
  // Le D+ allonge le temps d'effort mais le sportif mange bien pendant sa durée réelle de course.
  var needs=state.ravitoMode!=='none'?getNutritionPerRavito(totalSec, state.ravitoFreq, dist):null;
  var showR=state.ravitoMode!=='none'&&needs;
  document.getElementById('thRavito').style.display=showR?'':'none';
  document.getElementById('thGluc').style.display=showR?'':'none';
  document.getElementById('thEau').style.display=showR?'':'none';
  document.getElementById('totalsRow').style.display=showR?'grid':'none';
  document.getElementById('disclaimerRavito').style.display=showR?'inline':'none';

  var points=[];
  if(state.ravitoMode==='custom'&&state.customRavitoKms.length>0){
    var allPts=[];
    if(splitFreq>0){
      var km0=splitFreq;
      while(km0<dist-0.01){allPts.push(Math.round(km0*10)/10);km0+=splitFreq;}
    }
    allPts.push(Math.round(dist*10)/10);
    state.customRavitoKms.forEach(function(k){if(allPts.indexOf(k)===-1&&k<dist)allPts.push(k);});
    allPts.sort(function(a,b){return a-b;});
    points=allPts;
  } else {
    if(splitFreq>0){
      var km=splitFreq;
      while(km<dist-0.01){points.push(Math.round(km*10)/10);km+=splitFreq;}
    }
    points.push(Math.round(dist*10)/10);
  }

  var cafWin = getCaffeineWindow(startTime, totalSec);
  var userW   = parseFloat((document.getElementById('userWeight')||{}).value)||70;
  var cafDose = getCafDose(userW);

  var halfTime=null, halfDist=dist/2;
  var finalElapsed=totalSec; // temps réel simulé au dernier point (peut différer de totalSec si dérive de fatigue)
  var totG=0,totE=0,totS=0,gCum=0,eCum=0;
  var tbody=document.getElementById('splitsBody');
  tbody.innerHTML='';
  lastRows=[];

  // Afficher la légende
  var leg=document.getElementById('tableLegend');
  if(leg)leg.style.display=showR?'block':'none';

  var product=null; // déterminé par ravito selon heure
  var flasqueCap=parseFloat((document.getElementById('userFlasque')||{}).value)||1000;

  var prevKm=0;
  var prevElapsed=0;

  points.forEach(function(pt,idx){
    var unitsStr; // partagée entre la collecte (isRav) et le rendu HTML — déclarée une seule fois
    var elapsed=0,segStart=0;
    for(var j=0;j<=idx;j++){
      var p=points[j],seg=p-segStart;
      elapsed+=seg*getEffectivePace(avgPace,p,dist); segStart=p;
    }
    if(!halfTime&&pt>=halfDist)halfTime=elapsed-(pt-halfDist)*avgPace;

    var isLast=idx===points.length-1;
    if(isLast) finalElapsed=elapsed;
    var isHalf=!isLast&&Math.abs(pt-halfDist)<splitFreq/2;
    var pace=getEffectivePace(avgPace,pt,dist);
    var diff=Math.round(elapsed-(pt/dist)*totalSec);
    var diffStr=diff===0?'±0s':(diff>0?'+':'')+fmtTime(Math.abs(diff));
    var isRavCustom=showR&&state.ravitoMode==='custom'&&state.customRavitoKms.indexOf(pt)!==-1;
    var isRav=isRavCustom;
    var sectionKm=pt-prevKm;

    var ravData=null;
    if(isRav&&needs){
      // Calcul nutrition basé sur la DURÉE de la section (temps réel)
      var ns=getNutritionSection(prevElapsed, elapsed, totalSec, dist);
      if(ns){
        gCum+=ns.gluc; eCum+=ns.eau; totG+=ns.gluc; totE+=ns.eau; totS+=ns.sod;

        // Produit perso, le même à chaque ravito (plus de rotation par marque/heure)
        product=getCustomProduct();

        // Nombre d'unités produit (sur la part solide si boisson présente)
        var boissonForCalc = getDrinkConfig();
        var glucBoissonCalc = boissonForCalc ? Math.round(boissonForCalc.glucPer500 * (Math.min(ns.eau,flasqueCap)/500)) : 0;
        var glucSolideCalc  = Math.max(0, ns.gluc - glucBoissonCalc);
        unitsStr = product ? fmtUnits(glucSolideCalc, product) : null;
        var prodVariant=''; // plus d'alternance manuelle — géré par rythme circadien

        // Alerte eau si section dépasse capacité flasques
        var eauAlert=ns.eau>flasqueCap;

        // Durée section formatée
        var sectionDurStr=fmtTime(elapsed-prevElapsed);

        // On track indicator
        var onTrackStr=ns.carbsH+'g/h ✓';

        ravData={
          detail:   ns.detail,
          sectionH: ns.sectionH,
          sectionDurStr: sectionDurStr,
          glucSection: ns.gluc,
          eauSection:  ns.eau,
          carbsH:   ns.carbsH,
          waterH:   ns.waterH,
          gCum:     gCum,
          eCum:     eCum,
          unitsStr: unitsStr,
          prodVariant: prodVariant,
          eauAlert: eauAlert,
          custom:   isRavCustom
        };
      }
    }

    var hp=startTime?addTime(startTime,elapsed):'--:--';
    lastRows.push({pt:pt,pace:pace,elapsed:elapsed,hp:hp,isRav:isRav,isRavCustom:isRavCustom,isLast:isLast,isHalf:isHalf,diff:diff,diffStr:diffStr,ravData:ravData});

    if(isRav){ prevKm=pt; prevElapsed=elapsed; }

    var isCaf = cafWin && elapsed>=cafWin.startSec && elapsed<=cafWin.endSec;

    var tr=document.createElement('tr');
    if(isRavCustom)tr.className='is-ravito-custom';
    else if(isRav)tr.className='is-ravito';
    else if(isHalf)tr.className='is-half';
    if(isCaf && isRav) tr.className+=' is-caf';

    var rCell='',gCell='',eCell='';
    if(showR){
      if(isLast){
        rCell='<td style="font-size:.72rem;color:#6b6b6b;"><svg class="ic" aria-hidden="true"><use href="#i-flag"/></svg> Arrivée</td>';
        gCell='<td style="font-size:.72rem;font-weight:800;color:#4a6e57;">'+totG+'g total</td>';
        eCell='<td style="font-size:.72rem;font-weight:800;color:#4a6478;">'+(Math.round(totE/100)/10)+'L total</td>';
      } else if(isRav&&ravData){
        // Colonne Section/Type
        var cafBadge = isCaf
          ? '<div class="caf-badge" style="margin-top:4px;"><svg class="ic" aria-hidden="true"><use href="#i-coffee"/></svg> Fenêtre caféine'
            +'<span class="caf-dose">'+cafDose.low+'–'+cafDose.high+'mg · café, gel, comprimé</span></div>'
          : '';
        rCell='<td>'
          +'<div style="font-size:.65rem;color:#6b6b6b;margin-bottom:2px;"><svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg> '+ravData.sectionDurStr+' · '+sectionKm.toFixed(1)+'km</div>'
          +'<span class="rav-badge'+(ravData.custom?' rav-badge-custom':'')+'">'+ravData.detail+(ravData.prodVariant?ravData.prodVariant:'')+'</span>'
          +cafBadge
          +'</td>';

        // Colonne Glucides — split boisson / solide
        var glucLines='';
        var boissonCfg = getDrinkConfig();
        var flasqueCapLocal = parseFloat((document.getElementById('userFlasque')||{}).value)||1000;
        // La boisson remplit les flasques (max = capacité) — pas plus d'eau que ce qu'on peut porter
        var eauBoisson = Math.min(ravData.eauSection, flasqueCapLocal);
        var glucBoisson = boissonCfg ? Math.round(boissonCfg.glucPer500 * (eauBoisson/500)) : 0;
        var glucSolide  = Math.max(0, ravData.glucSection - glucBoisson);
        unitsStr    = null;
        if(product && product.glucides && glucSolide > 0){
          var nSolide = Math.ceil(glucSolide/product.glucides);
          unitsStr = nSolide+'&nbsp;×&nbsp;'+product.icon+' '+(product.label||'unité');
        } else if(product && product.glucides && glucSolide === 0 && boissonCfg){
          unitsStr = '✓ Boisson seule suffit';
        }
        if(unitsStr) glucLines+='<div class="rav-units-badge">'+unitsStr+'</div>';
        if(boissonCfg && glucBoisson>0){
          glucLines+='<div style="font-size:.68rem;color:#4a6478;margin-bottom:1px;"><svg class="ic" aria-hidden="true"><use href="#i-cup"/></svg> '+glucBoisson+'g boisson'+(glucSolide>0?' + <svg class="ic" aria-hidden="true"><use href="#i-backpack"/></svg> '+glucSolide+'g solide':'')+'</div>';
          glucLines+='<div class="rav-gluc-section">= '+ravData.glucSection+'g total section</div>';
        } else {
          glucLines+='<div class="rav-gluc-section">'+ravData.glucSection+'g sur cette section</div>';
        }
        glucLines+='<span class="rav-cum">cum. '+ravData.gCum+'g · <span class="rav-ontrack">'+ravData.carbsH+'g/h ✓</span></span>';
        gCell='<td>'+glucLines+'</td>';

        // Colonne Eau
        var eauLines='<div class="eau-section-val">'+ravData.eauSection+'ml</div>';
        if(ravData.eauAlert){
          eauLines+='<div class="rav-alert-eau">'+ic('siren')+' Dépasse ta capacité ('+flasqueCap+'ml) !</div>';
        }
        eauLines+='<span class="rav-cum">cum. '+(Math.round(ravData.eCum/100)/10)+'L · '+ravData.waterH+'ml/h</span>';
        eCell='<td>'+eauLines+'</td>';

      } else {
        rCell='<td style="color:#9a9a9a;">—</td>';
        gCell='<td style="color:#9a9a9a;">—</td>';
        eCell='<td style="color:#9a9a9a;">—</td>';
      }
    }

    var dc=Math.abs(diff)<5?'#9a9a9a':diff>0?'#8a4a4a':'#4a6e57';
    var hb=isHalf?' <span style="font-size:.65rem;color:#4a6e57;">½ course</span>':'';
    tr.innerHTML='<td><strong>'+(isLast?'Arrivée '+pt+' km':'Km '+pt)+'</strong>'+hb+'</td>'
      +'<td>'+fmtPace(pace)+'</td><td>'+fmtTime(elapsed)+'</td>'
      +'<td style="font-weight:700;color:var(--c-accent);">'+hp+'</td>'
      +rCell+gCell+eCell
      +'<td class="hide-mobile" style="font-size:.78rem;color:'+dc+';">'+diffStr+'</td>';
    tbody.appendChild(tr);
  });

  // Heure d'arriv\u00E9e r\u00E9elle : bas\u00E9e sur finalElapsed (temps simul\u00E9 du dernier point), qui
  // int\u00E8gre la d\u00E9rive de fatigue \u2014 reste ainsi coh\u00E9rente avec la derni\u00E8re ligne du tableau.
  var heureArr=startTime?addTime(startTime,finalElapsed):null;
  document.getElementById('rFin').textContent=heureArr||fmtTime(finalElapsed);

  if(halfTime)document.getElementById('rDemi').textContent=startTime?addTime(startTime,halfTime):fmtTime(halfTime);
  if(showR&&totG>0){
    document.getElementById('totGluc').textContent=totG+'g';
    document.getElementById('totEau').textContent=Math.round(totE/100)/10+'L';
    document.getElementById('totSod').textContent=totS+'mg';
  }
  if(heureArr){
    var b=document.getElementById('arriveeBanner');
    b.innerHTML='D\u00E9part <strong>'+startTime+'</strong> &nbsp;\u00B7&nbsp; Arriv\u00E9e estim\u00E9e <strong>'+heureArr+'</strong> &nbsp;\u00B7&nbsp; Dur\u00E9e <strong>'+fmtTime(finalElapsed)+'</strong>';
    b.style.display='block';
  }
  lastMeta={dist:dist,totalSec:totalSec,finalElapsed:finalElapsed,avgPace:avgPace,startTime:startTime,heureArr:heureArr,showR:showR,totG:totG,totE:totE,totS:totS,dplus:dplus,kmEffort:kmEffort};
  document.getElementById('output').style.display='block';
  if(state.mode==='simple'){ state.simpleStep=2; renderSimpleStep(); }
  document.getElementById('output').scrollIntoView({behavior:'smooth',block:'start'});

  // Résumé nutrition + poids sac
  if (needs && showR) {
    document.getElementById('nutritionSummaryWrap').style.display = 'block';
    document.getElementById('nsEau').textContent = (needs.totalWater/1000).toFixed(1)+'L';
    document.getElementById('nsGluc').textContent = needs.totalCarbs+'g';
    document.getElementById('nsSod').textContent = needs.totalSodium+'mg';
    document.getElementById('nsEauH').textContent = needs.waterH+'ml';
    document.getElementById('nsGlucH').textContent = needs.carbsH+'g';
    var nsCal = document.getElementById('nsCal');
    if(nsCal) nsCal.textContent = Math.round(needs.totalCarbs*4)+' kcal';
    // Conseil contextuel dynamique selon durée + source des données
    // ── BLOC CAFÉINE ──────────────────────────────────────────────────────
  var cafBloc = document.getElementById('caffeineBloc');
  if(cafBloc){
    if(cafWin && startTime){
      var cafStartStr = addTime(startTime, cafWin.startSec);
      var cafEndStr   = addTime(startTime, cafWin.endSec);
      var sources     = getCafSources(cafDose);
      var html = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'
        +'<span style="display:flex;align-items:center;">'+ic('coffee','ic-lg')+'</span>'
        +'<strong style="font-size:.85rem;color:#e0e7ff;">Protocole caféine — 2ème nuit</strong>'
        +'</div>';
      html += '<div class="caf-row"><svg class="ic" aria-hidden="true"><use href="#i-clock"/></svg> <span><strong>Fenêtre recommandée :</strong> '
        +cafStartStr+' → '+cafEndStr
        +' <span style="opacity:.6;font-size:.68rem;">(2ème nuit · pas la 1ère — adrénaline du départ)</span></span></div>';
      html += '<div class="caf-row"><svg class="ic" aria-hidden="true"><use href="#i-pill"/></svg> <span><strong>Dose :</strong> '
        +cafDose.low+'–'+cafDose.high+'mg/h'
        +' <span style="opacity:.6;font-size:.68rem;">(1–2mg/kg · poids '+(parseFloat((document.getElementById('userWeight')||{}).value)||70)+'kg)</span></span></div>';
      html += '<div class="caf-row"><svg class="ic" aria-hidden="true"><use href="#i-pin"/></svg> <span><strong>Stratégie :</strong> '
        +'Garde la caféine pour cette fenêtre. Ne commence pas pendant la 1ère nuit — l\'adrénaline suffit et tu préserves l\'effet pour quand tu en auras vraiment besoin.</span></div>';
      html += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.18);font-size:.7rem;color:rgba(255,255,255,.7);">'
        +'<strong style="color:#fff;">Sources possibles :</strong><br>'
        + sources.join(' &nbsp;·&nbsp; ')+'</div>';
      html += '<div style="margin-top:8px;font-size:.65rem;color:rgba(255,255,255,.5);">'
        +ic('alert')+' Teste ton protocole caféine à l\'entraînement — sensibilité et tolérance digestive varient selon les individus. (ISSN 2019 · Tiller et al.)</div>';
      cafBloc.innerHTML = html;
      cafBloc.style.display = 'block';
    } else {
      cafBloc.style.display = 'none';
    }
  }
    var drinkForSummary = getDrinkConfig();
    var totalDrinkGluc = 0;
    if(drinkForSummary && needs){
      var flasqueCapSummary = parseFloat((document.getElementById('userFlasque')||{}).value)||1000;
      var nbRavTotal = state.customRavitoKms.length||1; // showR implique state.ravitoMode==='custom' ici
      // Par ravito : on remplit max flasqueCap ml de boisson
      totalDrinkGluc = Math.round(drinkForSummary.glucPer500 * (flasqueCapSummary/500)) * nbRavTotal;
      totalDrinkGluc = Math.min(totalDrinkGluc, needs.totalCarbs); // ne peut pas dépasser le besoin total
    }
    var nsConseil = document.getElementById('nsConseil');
    if(nsConseil){
      var hReal = totalSec/3600;
      var conseil = '';
      var sourceNote = '';
      if(needs.isCustomCarbs || needs.isCustomWater || needs.isCustomSodium)
        sourceNote = '<svg class="ic" aria-hidden="true"><use href="#i-settings"/></svg> Valeurs <strong>personnalisées</strong> — basées sur tes saisies.';
      else if(needs.isWeightBased)
        sourceNote = '<svg class="ic" aria-hidden="true"><use href="#i-scale"/></svg> Hydratation <strong>ajustée à ton poids</strong>. Glucides selon recommandations scientifiques.';
      else
        sourceNote = '<svg class="ic" aria-hidden="true"><use href="#i-books"/></svg> Valeurs <strong>automatiques</strong> (ACSM 2007 · Jeukendrup 2014). Personnalise dans la section ci-dessus.';

      if(drinkForSummary && totalDrinkGluc > 0){
        var solidGluc = Math.max(0, needs.totalCarbs - totalDrinkGluc);
        sourceNote += '<br><svg class="ic" aria-hidden="true"><use href="#i-cup"/></svg> <strong>'+drinkForSummary.label+'</strong> apporte ~'+totalDrinkGluc+'g de glucides sur la course → il te reste <strong>'+solidGluc+'g à prendre en solide</strong>.';
      }

      if(hReal >= 5) conseil = '<svg class="ic" aria-hidden="true"><use href="#i-bulb"/></svg> Ultra long : privilégiez gel + barre + solide salé (pommes de terre, riz). Ajoutez des protéines (~10g/h) après 4h pour limiter la dégradation musculaire. Testez votre plan alimentaire lors de vos sorties longues.';
      else if(hReal >= 2.5) conseil = '<svg class="ic" aria-hidden="true"><use href="#i-bulb"/></svg> Effort moyen-long : combinez glucose + fructose (ratio 2:1) pour 60–90g/h sans saturation digestive. Alternez gels et boissons sucrées. Vérifiez votre tolérance lors des entraînements.';
      else if(hReal >= 1.5) conseil = '<svg class="ic" aria-hidden="true"><use href="#i-bulb"/></svg> Effort court : les gels simples suffisent. Préférez une boisson légèrement sucrée et salée. L\'objectif principal est l\'hydratation, pas l\'apport calorique.';

      nsConseil.innerHTML = (sourceNote ? sourceNote + '<br>' : '') + conseil;
      nsConseil.style.display = 'block';
    }
    // Section ravito — ce qu'on porte entre 2 ravitos
    var sr = document.getElementById('sectionRavito');
    if(sr && needs){
      sr.style.display='block';
      // Distance et durée moyenne d'une section
      var nbRav = state.customRavitoKms.length||1; // showR implique state.ravitoMode==='custom' ici
      var distSection = Math.round((dist/nbRav)*10)/10;
      var dureeSecH = (totalSec/3600) / nbRav; // durée moyenne section en heures

      // Glucides et eau basés sur la DURÉE réelle de la section (pas sur needs.gluc qui est par ravito fixe)
      var glucSection = Math.round(needs.carbsH * dureeSecH);
      var eauSection  = Math.round(needs.waterH  * dureeSecH);

      // Décomposition boisson vs solide — cap à la capacité flasque
      var boissonConfig = getDrinkConfig();
      var eauBoissonSr = Math.min(eauSection, parseFloat((document.getElementById('userFlasque')||{}).value)||1000);
      var glucBoisson = boissonConfig ? Math.round(boissonConfig.glucPer500 * (eauBoissonSr/500)) : 0;
      var glucSolide  = Math.max(0, glucSection - glucBoisson);
      product = getCustomProduct();
      var unitsNeeded = (product && product.glucides && glucSolide > 0) ? Math.ceil(glucSolide/product.glucides) : null;

      // Poids à porter : eau (1kg/L) + solides (2.2g/g glucides) + boisson (poids liquide déjà dans eau)
      var poidsSection = (eauSection/1000) + (glucSolide * 0.0022);
      var eauAlert = eauSection > (parseFloat((document.getElementById('userFlasque')||{}).value)||1000);

      document.getElementById('srEau').textContent = eauSection+'ml';
      document.getElementById('srGluc').textContent = glucSection+'g';
      document.getElementById('srPoids').textContent = (poidsSection*1000).toFixed(0)+'g';
      document.getElementById('srDist').textContent = distSection+'km';

      // Note détaillée
      var noteLines = [];
      noteLines.push('Entre chaque ravito (~'+distSection+' km · ~'+fmtTime(dureeSecH*3600)+') tu as besoin de '+glucSection+'g de glucides et '+eauSection+'ml d\'eau.');
      if(boissonConfig && glucBoisson > 0)
        noteLines.push('<svg class="ic" aria-hidden="true"><use href="#i-cup"/></svg> Ta boisson ('+boissonConfig.label+') t\'apporte ~'+glucBoisson+'g de glucides → il te reste '+glucSolide+'g à prendre en solide.');
      if(unitsNeeded && product)
        noteLines.push('<svg class="ic" aria-hidden="true"><use href="#i-backpack"/></svg> Soit environ '+unitsNeeded+' × '+product.icon+' '+(product.label||'unité')+'(s) à emporter.');
      if(eauAlert)
        noteLines.push(ic('siren')+' '+eauSection+'ml dépasse ta capacité de flasques — prévois une source d\'eau intermédiaire ou augmente ta capacité.');
      document.getElementById('srNote').textContent = noteLines.join(' ');
    }
    // Alertes
    var alerts = getAlerts(needs);
    var ab = document.getElementById('alertBox');
    if (alerts.length > 0) {
      var hasDanger = alerts.some(function(a){return a.type==='danger';});
      ab.className = 'alert-box ' + (hasDanger ? 'alert-danger' : 'alert-warn');
      ab.innerHTML = alerts.map(function(a){return ic('alert')+' '+a.msg;}).join('<br>');
      ab.style.display = 'block';
    } else ab.style.display = 'none';
    lastMeta.dplus=dplus; lastMeta.kmEffort=kmEffort;
  } else {
    document.getElementById('nutritionSummaryWrap').style.display = 'none';
    var sr2=document.getElementById('sectionRavito'); if(sr2)sr2.style.display='none';
    document.getElementById('alertBox').style.display = 'none';
  }
}

function exportPDF(){
  var motto=document.getElementById('mottoInput').value.trim();
  var m=lastMeta;
  if(!m.dist){alert('Lance d\'abord le calcul avant de g\u00E9n\u00E9rer le PDF.');return;}
  var thExtra=m.showR
    ?'<th style="background:#323232;color:#fff;padding:5px 7px;">Ravitaillement</th><th style="background:#525252;color:#fff;padding:5px 7px;">Glucides</th><th style="background:#6b6b6b;color:#fff;padding:5px 7px;">Eau</th>'
    :'';
  var rows='';
  lastRows.forEach(function(r){
    var cls=r.isRav?'background:#eef2ef;':r.isHalf?'background:#e6ebe8;font-weight:700;':'';
    var lborder=r.isRav?'border-left:3px solid #4a6e57;':'';
    var rc='',gc='',ec='';
    if(m.showR){
      if(r.isLast){rc='<td>Arriv\u00E9e</td>';gc='<td>'+m.totG+'g total</td>';ec='<td>'+Math.round(m.totE/100)/10+'L total</td>';}
      else if(r.ravData){
        var rd=r.ravData;
        var glucDisplay=rd.unitsStr ? rd.unitsStr.replace(/&nbsp;/g,' ') : (rd.glucSection+'g');
        rc='<td style="color:#323232;font-weight:700;">'+rd.detail+(rd.prodVariant||'')+'<br><small style="color:#6b6b6b;font-weight:400;">'+rd.sectionDurStr+'</small></td>';
        gc='<td><span style="background:#f3eee3;color:#8a6a3a;border:1px solid #e0d4b8;border-radius:6px;padding:1px 6px;font-size:9px;font-weight:700;white-space:nowrap;">'+glucDisplay+'</span><br><small style="color:#6b6b6b;">'+rd.glucSection+'g · cum. '+rd.gCum+'g</small></td>';
        ec='<td><span style="background:#eaeef2;color:#4a6478;border:1px solid #d4dde4;border-radius:6px;padding:1px 6px;font-size:9px;font-weight:700;white-space:nowrap;">'+rd.eauSection+'ml</span>'+(rd.eauAlert?'<br><small style="color:#8a4a4a;font-weight:700;">&gt; capacité flasques</small>':'')+'<br><small style="color:#9a9a9a;">cum. '+Math.round(rd.eCum/100)/10+'L</small></td>';
      } else {rc='<td>\u2014</td>';gc='<td>\u2014</td>';ec='<td>\u2014</td>';}
    }
    var dc=Math.abs(r.diff)<5?'#9a9a9a':r.diff>0?'#8a4a4a':'#4a6e57';
    var fw=r.isLast?'font-weight:800;':'';
    rows+='<tr style="'+cls+fw+'">'
      +'<td style="'+lborder+fw+'"><strong>'+(r.isLast?'Arriv\u00E9e '+r.pt+' km':'Km '+r.pt)+'</strong>'+(r.isHalf?' <em style=\'font-size:9px;color:#4a6e57;\'>\u00BD course</em>':'')+'</td>'
      +'<td>'+fmtPace(r.pace)+'</td><td>'+fmtTime(r.elapsed)+'</td>'
      +'<td style="color:#323232;font-weight:700;">'+r.hp+'</td>'
      +rc+gc+ec
      +'<td style="color:'+dc+';">'+r.diffStr+'</td></tr>';
  });
  var tots=m.showR&&m.totG>0
    ?'<div style="display:flex;gap:12px;margin:10px 0;flex-wrap:wrap;">'
      +'<div style="border:1px solid #cfcfcf;border-radius:6px;padding:6px 14px;text-align:center;"><div style="font-size:14px;font-weight:800;color:#323232;">'+m.totG+'g</div><div style="font-size:9px;color:#6b6b6b;">Glucides totaux</div></div>'
      +'<div style="border:1px solid #cfcfcf;border-radius:6px;padding:6px 14px;text-align:center;"><div style="font-size:14px;font-weight:800;color:#323232;">'+Math.round(m.totE/100)/10+'L</div><div style="font-size:9px;color:#6b6b6b;">Eau totale</div></div>'
      +'<div style="border:1px solid #cfcfcf;border-radius:6px;padding:6px 14px;text-align:center;"><div style="font-size:14px;font-weight:800;color:#323232;">'+m.totS+'mg</div><div style="font-size:9px;color:#6b6b6b;">Sodium total</div></div>'
      +'</div>'
    :'';
  var mottoH=motto?'<div style="margin-top:14px;padding:10px 14px;border:1px solid #cfcfcf;border-radius:8px;font-size:11px;font-style:italic;color:#525252;background:#fafafa;">"'+escHtml(motto)+'"</div>':'';
  var arrH=m.heureArr?'<div style="background:#323232;border-radius:6px;padding:6px 14px;font-size:11px;font-weight:800;color:#ffffff;display:inline-block;margin:8px 0;">'+'D\u00E9part '+m.startTime+' &nbsp;\u00B7&nbsp; Arriv\u00E9e estim\u00E9e '+m.heureArr+' &nbsp;\u00B7&nbsp; Dur\u00E9e '+fmtTime(m.finalElapsed||m.totalSec)+'</div><br>':'';
  var sel=document.getElementById('dist');
  var distLabel=sel.value==='custom'?m.dist+' km':sel.options[sel.selectedIndex].text;
  var dplusLabel=m.dplus>0?' · D+ '+m.dplus+'m ('+m.kmEffort+' km-effort)':'';
  var isBracelet=state.pdfFormat==='bracelet';
  var orientation=state.pdfFormat==='landscape'?'landscape':'portrait';
  var pageSize=isBracelet?'70mm 220mm':'A4 '+orientation;

  // Nom de la course (préfixe du titre PDF si renseigné)
  var raceName=(document.getElementById('raceName')||{}).value||'';
  var raceTitle=raceName?escHtml(raceName)+' · ':'';

  var html='<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
    +'<title>Temps de passage \u00B7 '+distLabel+'</title>'
    +'<style>'
    +'@page{size:'+pageSize+';margin:'+(isBracelet?'5mm':'1cm')+';}'
    +'*{box-sizing:border-box;margin:0;padding:0;}'
    +'body{font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#323232;padding:8px;}'
    +'.ph{text-align:center;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #323232;}'
    +'.ph h1{font-size:16px;font-weight:800;color:#323232;margin-bottom:2px;}'
    +'.ph p{font-size:9px;color:#6b6b6b;}'
    +'.pc{display:flex;gap:10px;justify-content:center;margin-bottom:12px;flex-wrap:wrap;}'
    +'.pc-item{border:1px solid #cfcfcf;border-radius:8px;padding:6px 14px;text-align:center;}'
    +'.pc-val{font-size:13px;font-weight:800;color:#323232;}'
    +'.pc-lbl{font-size:9px;color:#6b6b6b;text-transform:uppercase;}'
    +'table{width:100%;border-collapse:collapse;font-size:9px;}'
    +'th{background:#323232;color:#fafafa;padding:5px 6px;text-align:left;}'
    +'td{padding:4px 6px;border-bottom:1px solid #e5e5e5;vertical-align:middle;}'
    +'.pf{margin-top:12px;font-size:8px;color:#9a9a9a;text-align:center;padding-top:8px;border-top:1px solid #e5e5e5;}'
    +'</style></head><body>'
    +'<div class="ph"><h1>'+raceTitle+'Mes temps de passage · '+distLabel+dplusLabel+'</h1><p>Seb Run Nature · seb-run-nature.com</p></div>'
    +arrH
    +'<div class="pc">'
    +'<div class="pc-item"><div class="pc-val">'+fmtPace(m.avgPace)+'</div><div class="pc-lbl">Allure moyenne</div></div>'
    +'<div class="pc-item"><div class="pc-val">'+fmtTime(m.totalSec)+'</div><div class="pc-lbl">Chrono objectif</div></div>'
    +'<div class="pc-item"><div class="pc-val">'+((3600/m.avgPace).toFixed(1))+' km/h</div><div class="pc-lbl">Vitesse</div></div>'
    +'</div>'
    +'<table><thead><tr>'
    +'<th>Point de passage</th><th>Allure</th><th>Temps de course</th><th>Heure r\u00E9elle</th>'
    +thExtra+'<th>\u00C9cart objectif</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +tots+mottoH
    +'<div class="pf">Ces temps sont des estimations \u00B7 ta forme, la m\u00E9t\u00E9o et le terrain peuvent influencer ton allure r\u00E9elle. Bonne course ! \u00B7 Seb Run Nature \u00B7 seb-run-nature.com</div>'
    +'</body></html>';

  var w=window.open('','_blank','width=800,height=600');
  if(!w){alert('Le navigateur a bloqu\u00E9 la nouvelle fen\u00EAtre. Autorise les popups pour ce site puis r\u00E9essaie.');return;}
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(function(){w.print();},400);
}

onDistChange();
onFreqChange();
setRavito('custom');
