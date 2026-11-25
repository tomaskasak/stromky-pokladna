(function(){
  var SUPABASE_URL='https://ajbxynzxdyqbfjhpdyot.supabase.co';
  var SUPABASE_KEY='sb_publishable_1cEe3dARe90wosDXiZmbLw_l1j1OI8H';

  var TYPES=[{k:'smrk',n:'Smrk stříbrný'},{k:'jedle',n:'Jedle kavkazská'}];
  var SIZES=[{k:'s',n:'do 150 cm'},{k:'m',n:'150–200 cm'},{k:'l',n:'200–230 cm'},{k:'xl',n:'nad 230 cm'}];
  var sb=null, cfg=null, sales=[], lastAdded=null, toastTimer=null, pending=null, busy=false;
  var $=function(id){return document.getElementById(id)};
  function el(tag,attrs,kids){var e=document.createElement(tag);if(attrs)for(var a in attrs){if(a==='text')e.textContent=attrs[a];else if(a==='cls')e.className=attrs[a];else e.setAttribute(a,attrs[a]);}
    (kids||[]).forEach(function(k){if(k!=null)e.appendChild(typeof k==='string'?document.createTextNode(k):k)});return e;}
  function kc(n){return (Math.round(n)||0).toLocaleString('cs-CZ').replace(/ /g,' ')+' Kč'}
  function pad(n){return String(n).padStart(2,'0')}
  function dayKey(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
  function dayLabel(k){var p=k.split('-');var d=new Date(+p[0],+p[1]-1,+p[2]);return d.toLocaleDateString('cs-CZ',{weekday:'short',day:'numeric',month:'numeric'})}
  function tName(k){return (TYPES.find(function(t){return t.k===k})||{n:k}).n}
  function sName(k){return (SIZES.find(function(s){return s.k===k})||{n:k}).n}
  function seller(){try{return localStorage.getItem('seller')||''}catch(e){return ''}}
  function live(){return sales.filter(function(s){return !s.void})}
  function sum(list){var r={n:0,cash:0,card:0,total:0};list.forEach(function(s){r.n++;r.total+=s.price;if(s.pay==='card')r.card+=s.price;else r.cash+=s.price});return r}
  function price(t,s){return cfg&&cfg.prices&&cfg.prices[t]?cfg.prices[t][s]:null}
  function soldCount(t,s){return live().filter(function(x){return x.type===t&&x.size===s}).length}

  /* ---------- views ---------- */
  var VIEWS=['prodej','prehled','sklad','cenik'];
  function route(){var v=(location.hash||'').slice(1);if(VIEWS.indexOf(v)<0)v='prodej';
    VIEWS.forEach(function(n){$('v-'+n).hidden=n!==v});
    document.querySelectorAll('nav.tabs a').forEach(function(a){if(a.dataset.view===v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});}
  window.addEventListener('hashchange',route);

  /* ---------- render ---------- */
  function renderHeader(){var today=dayKey(new Date());$('today-label').textContent=new Date().toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'});
    var r=sum(live().filter(function(s){return s.day===today}));
    $('today-total').textContent=kc(r.total);$('today-split').textContent=r.n+' ks · hotově '+kc(r.cash)+' · kartou '+kc(r.card);}

  function renderTiles(){var box=$('sale-groups');box.textContent='';
    if(!cfg||!cfg.prices){box.appendChild(el('p',{cls:'empty',text:'Načítám ceník…'}));return}
    TYPES.forEach(function(t){var g=el('div',{cls:'group'},[el('h2',{text:t.n})]);var tiles=el('div',{cls:'tiles'});
      SIZES.forEach(function(s){var p=price(t.k,s.k);if(p==null)return;var bought=cfg.stock&&cfg.stock[t.k]?cfg.stock[t.k][s.k]:null;
        var info,low=false;if(bought>0){var left=bought-soldCount(t.k,s.k);info='zbývá '+left+' ks';low=left<=3}else info='prodáno '+soldCount(t.k,s.k)+' ks';
        var b=el('button',{type:'button',cls:'tile'+(s.k==='m'?' hot':'')},[el('span',{cls:'h',text:s.n}),el('span',{cls:'p',text:kc(p)}),el('span',{cls:'s'+(low?' low':''),text:info})]);
        b.addEventListener('click',function(){openSheet(t.k,s.k)});tiles.appendChild(b)});
      g.appendChild(tiles);box.appendChild(g)});}

  function saleRow(s){var d=new Date(s.at);var f=document.createDocumentFragment();
    f.appendChild(el('div',{cls:'row'+(s.void?' void':'')},[
      el('span',{cls:'t',text:pad(d.getHours())+':'+pad(d.getMinutes())}),
      el('span',{cls:'what'},[tName(s.type)+' · '+sName(s.size),s.by?el('small',{text:s.by}):null]),
      el('span',{cls:'chip '+(s.void?'void':s.pay),text:s.void?'storno':(s.pay==='card'?'karta':'hotově')}),
      el('span',{cls:'amt',text:kc(s.price)})]));
    var b=el('button',{type:'button',cls:'linkbtn'+(s.void?' ok':''),text:s.void?'Obnovit':'Stornovat'});
    b.addEventListener('click',function(){setVoid(s.id,!s.void)});
    f.appendChild(el('div',{cls:'row actions'},[el('span'),b]));return f}

  function renderRecent(){var box=$('recent');box.textContent='';var list=sales.slice(0,6);
    if(!list.length){box.appendChild(el('p',{cls:'empty',text:'Zatím žádný prodej. Ťukni na stromek nahoře a vyber platbu.'}));return}
    list.forEach(function(s){box.appendChild(saleRow(s))});}

  function renderPrehled(){var today=dayKey(new Date());var days={};days[today]=1;sales.forEach(function(s){days[s.day]=1});
    var keys=Object.keys(days).sort().reverse();var pick=$('day-pick');var cur=pick.value||today;pick.textContent='';
    keys.forEach(function(k){pick.appendChild(el('option',{value:k,text:dayLabel(k)+(k===today?' (dnes)':'')}))});
    pick.value=keys.indexOf(cur)>=0?cur:today;var day=pick.value;
    var ds=sales.filter(function(s){return s.day===day});var r=sum(ds.filter(function(s){return !s.void}));
    var st=$('day-stats');st.textContent='';
    [['Tržba',kc(r.total)],['Kusů',String(r.n)],['Hotově',kc(r.cash)],['Kartou / QR',kc(r.card)]].forEach(function(p){st.appendChild(el('div',{cls:'stat'},[el('span',{cls:'label',text:p[0]}),el('b',{text:p[1]})]))});
    var mix=$('day-mix');mix.textContent='';var hr=el('tr',null,[el('th',{text:'Výška'}),el('th',{text:'Smrk'}),el('th',{text:'Jedle'})]);
    mix.appendChild(el('thead',null,[hr]));var tb=el('tbody');
    SIZES.forEach(function(s){var tr=el('tr',null,[el('td',{text:s.n})]);TYPES.forEach(function(t){tr.appendChild(el('td',{text:ds.filter(function(x){return !x.void&&x.type===t.k&&x.size===s.k}).length+' ks'}))});tb.appendChild(tr)});
    mix.appendChild(tb);
    var dl=$('day-list');dl.textContent='';if(!ds.length)dl.appendChild(el('p',{cls:'empty',text:'V tento den žádné prodeje.'}));ds.forEach(function(s){dl.appendChild(saleRow(s))});
    var se=$('season');se.textContent='';se.appendChild(el('thead',null,[el('tr',null,['Den','Kusů','Hotově','Kartou','Celkem'].map(function(h){return el('th',{text:h})}))]));
    var body=el('tbody');var all=sum(live());
    keys.slice().sort().forEach(function(k){var x=sum(live().filter(function(s){return s.day===k}));if(!x.n)return;
      body.appendChild(el('tr',null,[dayLabel(k),String(x.n),kc(x.cash),kc(x.card),kc(x.total)].map(function(v){return el('td',{text:v})})))});
    if(!body.children.length)body.appendChild(el('tr',null,[el('td',{colspan:'5',text:'Zatím žádné prodeje.'})]));
    se.appendChild(body);se.appendChild(el('tfoot',null,[el('tr',null,['Celkem',String(all.n),kc(all.cash),kc(all.card),kc(all.total)].map(function(v){return el('td',{text:v})}))]));
    var note='';if(cfg&&cfg.buy){var cost=0;live().forEach(function(s){cost+=(Number(cfg.buy[s.type])||0)});note='Nákupní cena prodaných kusů '+kc(cost)+', hrubá marže '+kc(all.total-cost)+'. Stornované prodeje se nezapočítávají.'}
    $('season-note').textContent=note;}

  function renderSklad(){var t=$('stock');if(document.activeElement&&t.contains(document.activeElement))return;t.textContent='';
    t.appendChild(el('thead',null,[el('tr',null,['','Nakoupeno','Prodáno','Zbývá'].map(function(h){return el('th',{text:h})}))]));
    var b=el('tbody');
    TYPES.forEach(function(ty){b.appendChild(el('tr',null,[el('td',{colspan:'4',cls:'sub-head',text:ty.n})]));
      SIZES.forEach(function(s){var bought=cfg&&cfg.stock&&cfg.stock[ty.k]?(Number(cfg.stock[ty.k][s.k])||0):0;var sold=soldCount(ty.k,s.k);
        var inp=el('input',{type:'number',inputmode:'numeric',min:'0',id:'st-'+ty.k+'-'+s.k,cls:'num-in','aria-label':ty.n+' '+s.n+' nakoupeno'});inp.value=bought||'';
        var tdIn=el('td');tdIn.appendChild(inp);
        b.appendChild(el('tr',null,[el('td',{text:s.n}),tdIn,el('td',{text:String(sold)}),el('td',{text:bought?String(bought-sold):'–'})]))})});
    t.appendChild(b);}

  function renderCenik(){var f=$('price-form');if(document.activeElement&&f.contains(document.activeElement))return;f.textContent='';
    TYPES.forEach(function(t){var g=el('div',{cls:'grid2'});f.appendChild(el('div',{cls:'label',text:t.n}));
      SIZES.forEach(function(s){var id='pr-'+t.k+'-'+s.k;var inp=el('input',{type:'number',inputmode:'numeric',min:'0',id:id});var p=price(t.k,s.k);inp.value=p==null?'':p;
        g.appendChild(el('div',{cls:'field'},[el('label',{for:id,text:s.n}),inp]))});f.appendChild(g)});
    if(cfg&&cfg.buy){if(document.activeElement!==$('buy-smrk'))$('buy-smrk').value=cfg.buy.smrk||'';if(document.activeElement!==$('buy-jedle'))$('buy-jedle').value=cfg.buy.jedle||''}}

  function renderAll(){renderHeader();renderTiles();renderRecent();renderPrehled();renderSklad();renderCenik();}

  /* ---------- data ---------- */
  function mapSale(x){return {id:x.id,type:x.tree_type,size:x.size,price:Number(x.price)||0,pay:x.pay==='card'?'card':'cash',at:x.sold_at,day:String(x.sale_day||''),by:x.seller||'',void:!!x.is_void}}
  function setOffline(on){$('offline').hidden=!on}
  async function load(){if(!sb)return;
    var c=await sb.from('stromky_config').select('prices,buy,stock').eq('id','main').maybeSingle();
    var s=await sb.from('stromky_sales').select('*').order('sold_at',{ascending:false}).limit(5000);
    if(c.error||s.error){setOffline(true);return}
    setOffline(false);cfg=c.data;sales=(s.data||[]).map(mapSale);renderAll();}
  var reloadTimer=null;function scheduleLoad(){clearTimeout(reloadTimer);reloadTimer=setTimeout(load,250)}

  /* ---------- actions ---------- */
  function openSheet(t,s){pending={type:t,size:s};$('sheet-title').textContent=tName(t)+' · '+sName(s);$('sheet-price').value=price(t,s);
    $('sheet').hidden=false;$('sheet-back').hidden=false;$('pay-cash').focus();}
  function closeSheet(){pending=null;$('sheet').hidden=true;$('sheet-back').hidden=true;}
  async function sell(pay){if(!pending||!sb||busy)return;busy=true;var p=Math.max(0,parseInt($('sheet-price').value,10)||0);var now=new Date();
    var row={tree_type:pending.type,size:pending.size,price:p,pay:pay,sold_at:now.toISOString(),sale_day:dayKey(now),seller:seller().slice(0,40)};
    var label=tName(row.tree_type).split(' ')[0]+' '+sName(row.size)+' · '+kc(p)+(pay==='card'?' kartou':' hotově');closeSheet();
    var r=await sb.from('stromky_sales').insert(row).select('id').single();busy=false;
    if(r.error){toast('Prodej se neuložil. Zkontroluj internet a zkus to znovu.',true);return}
    lastAdded=r.data.id;toast(label);scheduleLoad();}
  function toast(text,noUndo){$('toast-text').textContent=text;$('toast-undo').hidden=!!noUndo;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').hidden=true;lastAdded=null},6000)}
  async function undo(){$('toast').hidden=true;if(!lastAdded)return;var id=lastAdded;lastAdded=null;await setVoid(id,true)}
  async function setVoid(id,v){if(!sb)return;var r=await sb.from('stromky_sales').update({is_void:v}).eq('id',id);if(r.error)toast('Změna se neuložila.',true);scheduleLoad()}
  async function saveStock(){if(!sb)return;var st={};TYPES.forEach(function(t){st[t.k]={};SIZES.forEach(function(s){st[t.k][s.k]=Math.max(0,parseInt($('st-'+t.k+'-'+s.k).value,10)||0)})});
    var r=await sb.from('stromky_config').update({stock:st,updated_at:new Date().toISOString()}).eq('id','main');
    if(document.activeElement)document.activeElement.blur();toast(r.error?'Sklad se neuložil.':'Sklad uložen',true);scheduleLoad()}
  async function savePrices(){if(!sb)return;var pr={};TYPES.forEach(function(t){pr[t.k]={};SIZES.forEach(function(s){var v=parseInt($('pr-'+t.k+'-'+s.k).value,10);if(!isNaN(v))pr[t.k][s.k]=v})});
    var buy={smrk:parseInt($('buy-smrk').value,10)||0,jedle:parseInt($('buy-jedle').value,10)||0};
    var r=await sb.from('stromky_config').update({prices:pr,buy:buy,updated_at:new Date().toISOString()}).eq('id','main');
    if(document.activeElement)document.activeElement.blur();toast(r.error?'Ceník se neuložil.':'Ceník uložen',true);scheduleLoad()}
  function exportCsv(){var rows=[['Datum','Čas','Druh','Výška','Cena Kč','Platba','Prodávající','Storno']];
    sales.slice().reverse().forEach(function(s){var d=new Date(s.at);rows.push([d.toLocaleDateString('cs-CZ'),pad(d.getHours())+':'+pad(d.getMinutes()),tName(s.type),sName(s.size),s.price,s.pay==='card'?'karta/QR':'hotově',s.by||'',s.void?'ano':''])});
    var csv='﻿'+rows.map(function(r){return r.map(function(v){v=String(v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(';')}).join('\r\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='evidence-prijmu-stromky.csv';
    document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);}

  $('pay-cash').addEventListener('click',function(){sell('cash')});
  $('pay-card').addEventListener('click',function(){sell('card')});
  $('sheet-cancel').addEventListener('click',closeSheet);$('sheet-back').addEventListener('click',closeSheet);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('sheet').hidden)closeSheet()});
  $('toast-undo').addEventListener('click',undo);
  $('day-pick').addEventListener('change',renderPrehled);
  $('save-stock').addEventListener('click',saveStock);$('save-prices').addEventListener('click',savePrices);
  $('export').addEventListener('click',exportCsv);
  $('seller').value=seller();$('seller').addEventListener('input',function(){try{localStorage.setItem('seller',$('seller').value.trim())}catch(e){}});

  route();renderAll();
  setInterval(renderHeader,60000);

  if(!window.supabase){setOffline(true);return}
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  load();
  sb.channel('stromky').on('postgres_changes',{event:'*',schema:'public',table:'stromky_sales'},scheduleLoad)
    .on('postgres_changes',{event:'*',schema:'public',table:'stromky_config'},scheduleLoad).subscribe();
  setInterval(load,30000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)load()});
  window.addEventListener('online',load);
})();
