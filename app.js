(function(){
  var SUPABASE_URL='https://ajbxynzxdyqbfjhpdyot.supabase.co';
  var SUPABASE_KEY='sb_publishable_1cEe3dARe90wosDXiZmbLw_l1j1OI8H';

  var TYPES=[{k:'smrk',n:'Smrk stříbrný'},{k:'jedle',n:'Jedle kavkazská'}];
  var SIZES=[{k:'s',n:'do 150 cm'},{k:'m',n:'150–200 cm'},{k:'l',n:'200–230 cm'},{k:'xl',n:'nad 230 cm'}];
  var PAY={cash:'hotově',card:'karta',qr:'QR'};
  var sb=null, cfg=null, sales=[], odbery=[], days={}, lastAdded=null, toastTimer=null, pending=null, busy=false;
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
  function sum(list){var r={n:0,cash:0,card:0,qr:0,total:0};list.forEach(function(s){r.n++;r.total+=s.price;r[s.pay]+=s.price});return r}
  function price(t,s){return cfg&&cfg.prices&&cfg.prices[t]?cfg.prices[t][s]:null}
  function soldCount(t,s){return live().filter(function(x){return x.type===t&&x.size===s}).length}
  function typeSold(t){return live().filter(function(x){return x.type===t}).length}
  function stockOf(t){var v=cfg&&cfg.stock?cfg.stock[t]:0;if(v&&typeof v==='object'){var n=0;for(var k in v)n+=Number(v[k])||0;return n}return Number(v)||0}
  function num(id){var v=parseInt($(id).value,10);return isNaN(v)?0:Math.max(0,v)}
  function focusedIn(box){return document.activeElement&&box.contains(document.activeElement)}

  /* ---------- QR platba (formát SPD) ---------- */
  function toIban(input){var s=String(input||'').replace(/\s+/g,'').toUpperCase();if(!s)return null;
    if(/^CZ\d{22}$/.test(s))return ibanValid(s)?s:null;
    var m=s.match(/^(?:(\d{1,6})-)?(\d{2,10})\/(\d{4})$/);if(!m)return null;
    var bban=m[3]+(m[1]||'').padStart(6,'0')+m[2].padStart(10,'0');
    var check=98n-(BigInt(bban+'123500')%97n);return 'CZ'+String(check).padStart(2,'0')+bban;}
  function ibanValid(iban){var r=iban.slice(4)+iban.slice(0,4);var n=r.replace(/[A-Z]/g,function(c){return String(c.charCodeAt(0)-55)});return BigInt(n)%97n===1n}
  function spdText(t){return String(t).normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,'').replace(/\*/g,' ').slice(0,60)}
  function spd(iban,amount,msg){return 'SPD*1.0*ACC:'+iban+'*AM:'+amount.toFixed(2)+'*CC:CZK*MSG:'+spdText(msg)}

  /* ---------- views ---------- */
  var VIEWS=['prodej','prehled','sklad','cenik'];
  function route(){var v=(location.hash||'').slice(1);if(VIEWS.indexOf(v)<0)v='prodej';
    VIEWS.forEach(function(n){$('v-'+n).hidden=n!==v});
    document.querySelectorAll('nav.tabs a').forEach(function(a){if(a.dataset.view===v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});}
  window.addEventListener('hashchange',route);

  /* ---------- render ---------- */
  function renderHeader(){var today=dayKey(new Date());$('today-label').textContent=new Date().toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long'});
    var r=sum(live().filter(function(s){return s.day===today}));
    $('today-total').textContent=kc(r.total);$('today-split').textContent=r.n+' ks · hotově '+kc(r.cash)+' · kartou '+kc(r.card)+' · QR '+kc(r.qr);}

  function renderTiles(){var box=$('sale-groups');box.textContent='';
    if(!cfg||!cfg.prices){box.appendChild(el('p',{cls:'empty',text:'Načítám ceník…'}));return}
    TYPES.forEach(function(t){var bought=stockOf(t.k);var head=el('div',{cls:'type-head'},[el('h2',{text:t.n})]);
      if(bought>0){var left=bought-typeSold(t.k);head.appendChild(el('span',{cls:'left'+(left<=5?' low':''),text:'zbývá '+left+' ks'}))}
      var g=el('div',{cls:'group'},[head]);var tiles=el('div',{cls:'tiles'});
      SIZES.forEach(function(s){var p=price(t.k,s.k);if(p==null)return;
        var b=el('button',{type:'button',cls:'tile'+(s.k==='m'?' hot':'')},[el('span',{cls:'h',text:s.n}),el('span',{cls:'p',text:kc(p)}),el('span',{cls:'s',text:'prodáno '+soldCount(t.k,s.k)+' ks'})]);
        b.addEventListener('click',function(){openSheet(t.k,s.k)});tiles.appendChild(b)});
      g.appendChild(tiles);box.appendChild(g)});}

  function saleRow(s){var d=new Date(s.at);var f=document.createDocumentFragment();
    f.appendChild(el('div',{cls:'row'+(s.void?' void':'')},[
      el('span',{cls:'t',text:pad(d.getHours())+':'+pad(d.getMinutes())}),
      el('span',{cls:'what'},[tName(s.type)+' · '+sName(s.size),s.by?el('small',{text:s.by}):null]),
      el('span',{cls:'chip '+(s.void?'void':s.pay),text:s.void?'storno':PAY[s.pay]}),
      el('span',{cls:'amt',text:kc(s.price)})]));
    var b=el('button',{type:'button',cls:'linkbtn'+(s.void?' ok':''),text:s.void?'Obnovit':'Stornovat'});
    b.addEventListener('click',function(){setVoid('stromky_sales',s.id,!s.void)});
    f.appendChild(el('div',{cls:'row actions'},[el('span'),b]));return f}

  function renderRecent(){var box=$('recent');box.textContent='';var list=sales.slice(0,6);
    if(!list.length){box.appendChild(el('p',{cls:'empty',text:'Zatím žádný prodej. Ťukni na stromek nahoře a vyber platbu.'}));return}
    list.forEach(function(s){box.appendChild(saleRow(s))});}

  function renderPrehled(){var today=dayKey(new Date());var dk={};dk[today]=1;sales.forEach(function(s){dk[s.day]=1});
    var keys=Object.keys(dk).sort().reverse();var pick=$('day-pick');var cur=pick.value||today;pick.textContent='';
    keys.forEach(function(k){pick.appendChild(el('option',{value:k,text:dayLabel(k)+(k===today?' (dnes)':'')}))});
    pick.value=keys.indexOf(cur)>=0?cur:today;var day=pick.value;
    var ds=sales.filter(function(s){return s.day===day});var r=sum(ds.filter(function(s){return !s.void}));
    var st=$('day-stats');st.textContent='';
    [['Tržba',kc(r.total)],['Kusů',String(r.n)],['Průměr/ks',kc(r.n?r.total/r.n:0)],['Hotově',kc(r.cash)],['Kartou',kc(r.card)],['QR',kc(r.qr)]].forEach(function(p){st.appendChild(el('div',{cls:'stat'},[el('span',{cls:'label',text:p[0]}),el('b',{text:p[1]})]))});
    var mix=$('day-mix');mix.textContent='';
    mix.appendChild(el('thead',null,[el('tr',null,[el('th',{text:'Výška'}),el('th',{text:'Smrk'}),el('th',{text:'Jedle'})])]));var tb=el('tbody');
    SIZES.forEach(function(s){var tr=el('tr',null,[el('td',{text:s.n})]);TYPES.forEach(function(t){tr.appendChild(el('td',{text:ds.filter(function(x){return !x.void&&x.type===t.k&&x.size===s.k}).length+' ks'}))});tb.appendChild(tr)});
    mix.appendChild(tb);
    renderUzaverka(day,r);
    var dl=$('day-list');dl.textContent='';if(!ds.length)dl.appendChild(el('p',{cls:'empty',text:'V tento den žádné prodeje.'}));ds.forEach(function(s){dl.appendChild(saleRow(s))});
    var se=$('season');se.textContent='';se.appendChild(el('thead',null,[el('tr',null,['Den','Ks','Hotově','Kartou','QR','Celkem'].map(function(h){return el('th',{text:h})}))]));
    var body=el('tbody');var all=sum(live());
    keys.slice().sort().forEach(function(k){var x=sum(live().filter(function(s){return s.day===k}));if(!x.n)return;
      body.appendChild(el('tr',null,[dayLabel(k),String(x.n),kc(x.cash),kc(x.card),kc(x.qr),kc(x.total)].map(function(v){return el('td',{text:v})})))});
    if(!body.children.length)body.appendChild(el('tr',null,[el('td',{colspan:'6',text:'Zatím žádné prodeje.'})]));
    se.appendChild(body);se.appendChild(el('tfoot',null,[el('tr',null,['Celkem',String(all.n),kc(all.cash),kc(all.card),kc(all.qr),kc(all.total)].map(function(v){return el('td',{text:v})}))]));
    var note='';if(cfg&&cfg.buy){var cost=0;live().forEach(function(s){cost+=(Number(cfg.buy[s.type])||0)});note='Nákupní cena prodaných kusů '+kc(cost)+', hrubá marže '+kc(all.total-cost)+'. Stornované prodeje se nezapočítávají.'}
    $('season-note').textContent=note;}

  function renderUzaverka(day,r){var d=days[day]||{};
    if(document.activeElement!==$('start-cash'))$('start-cash').value=d.start_cash?d.start_cash:'';
    if(document.activeElement!==$('counted-cash'))$('counted-cash').value=d.counted_cash==null?'':d.counted_cash;
    var start=$('start-cash').value===''?0:num('start-cash');var expected=start+r.cash;$('expected-cash').textContent=kc(expected);
    var diff=$('cash-diff');
    if($('counted-cash').value===''){diff.className='note';diff.textContent='zadej napočítanou hotovost';return}
    var dv=num('counted-cash')-expected;diff.className=dv===0?'diff-ok':'diff-bad';
    diff.textContent=dv===0?'sedí na korunu':(dv>0?'+':'−')+kc(Math.abs(dv))+(dv>0?' navíc':' chybí');}

  function renderSklad(){var t=$('stock');if(!focusedIn(t)){t.textContent='';
    t.appendChild(el('thead',null,[el('tr',null,['','Nakoupeno','Prodáno','Zbývá'].map(function(h){return el('th',{text:h})}))]));
    var b=el('tbody');var tb=0,ts=0;
    TYPES.forEach(function(ty){var bought=stockOf(ty.k);var sold=typeSold(ty.k);tb+=bought;ts+=sold;
      var inp=el('input',{type:'number',inputmode:'numeric',min:'0',id:'st-'+ty.k,cls:'num-in','aria-label':ty.n+' nakoupeno kusů'});inp.value=bought||'';
      var tdIn=el('td');tdIn.appendChild(inp);
      b.appendChild(el('tr',null,[el('td',{text:ty.n}),tdIn,el('td',{text:String(sold)}),el('td',{text:bought?String(bought-sold):'–'})]))});
    t.appendChild(b);
    t.appendChild(el('tfoot',null,[el('tr',null,[el('td',{text:'Celkem'}),el('td',{text:String(tb)}),el('td',{text:String(ts)}),el('td',{text:tb?String(tb-ts):'–'})])]));}
    renderOdbery();}

  function renderOdbery(){var box=$('odbery');box.textContent='';var com=(cfg&&cfg.commission)||{smrk:0,jedle:0};
    if(!$('od-day').value)$('od-day').value=dayKey(new Date());
    var ts=0,tj=0;
    odbery.forEach(function(o){if(!o.void){ts+=o.smrk;tj+=o.jedle}
      var prov=o.smrk*(Number(com.smrk)||0)+o.jedle*(Number(com.jedle)||0);
      box.appendChild(el('div',{cls:'row'+(o.void?' void':'')},[el('span',{cls:'t',text:dayLabel(o.day)}),
        el('span',{cls:'what'},[o.smrk+' smrků · '+o.jedle+' jedlí',o.note?el('small',{text:o.note}):null]),
        el('span',{cls:'chip'+(o.void?' void':''),text:o.void?'storno':'odběr'}),el('span',{cls:'amt',text:kc(prov)})]));
      var b=el('button',{type:'button',cls:'linkbtn'+(o.void?' ok':''),text:o.void?'Obnovit':'Stornovat'});
      b.addEventListener('click',function(){setVoid('stromky_odbery',o.id,!o.void)});
      box.appendChild(el('div',{cls:'row actions'},[el('span'),b]))});
    if(!odbery.length)box.appendChild(el('p',{cls:'empty',text:'Zatím žádný odběr.'}));
    $('odbery-sum').textContent=ts+' smrků · '+tj+' jedlí';
    $('odbery-prov').textContent=kc(ts*(Number(com.smrk)||0)+tj*(Number(com.jedle)||0));}

  function renderCenik(){var f=$('price-form');if(!focusedIn(f)){f.textContent='';
    TYPES.forEach(function(t){var g=el('div',{cls:'grid2'});f.appendChild(el('div',{cls:'label',text:t.n}));
      SIZES.forEach(function(s){var id='pr-'+t.k+'-'+s.k;var inp=el('input',{type:'number',inputmode:'numeric',min:'0',id:id});var p=price(t.k,s.k);inp.value=p==null?'':p;
        g.appendChild(el('div',{cls:'field'},[el('label',{for:id,text:s.n}),inp]))});f.appendChild(g)});}
    if(!cfg)return;
    function setIf(id,v){if(document.activeElement!==$(id))$(id).value=v==null?'':v}
    setIf('buy-smrk',cfg.buy&&cfg.buy.smrk);setIf('buy-jedle',cfg.buy&&cfg.buy.jedle);
    setIf('com-smrk',cfg.commission&&cfg.commission.smrk);setIf('com-jedle',cfg.commission&&cfg.commission.jedle);
    setIf('account',cfg.account||'');accountNote();}
  function accountNote(){var v=$('account').value.trim();var n=$('account-note');
    if(!v){n.textContent='Zadej číslo účtu, jinak QR platba nepůjde.';n.className='note';return}
    var ib=toIban(v);n.textContent=ib?'QR platby půjdou na účet '+ib.replace(/(.{4})/g,'$1 ').trim()+'.':'Číslo účtu nevypadá správně. Zadej ho ve tvaru 123456789/0100.';n.className=ib?'note':'note diff-bad';}

  function renderAll(){renderHeader();renderTiles();renderRecent();renderPrehled();renderSklad();renderCenik();}

  /* ---------- data ---------- */
  function mapSale(x){return {id:x.id,type:x.tree_type,size:x.size,price:Number(x.price)||0,pay:PAY[x.pay]?x.pay:'cash',at:x.sold_at,day:String(x.sale_day||''),by:x.seller||'',void:!!x.is_void}}
  function setOffline(on){$('offline').hidden=!on}
  async function load(){if(!sb)return;
    var res=await Promise.all([
      sb.from('stromky_config').select('prices,buy,stock,account,commission').eq('id','main').maybeSingle(),
      sb.from('stromky_sales').select('*').order('sold_at',{ascending:false}).limit(5000),
      sb.from('stromky_odbery').select('*').order('odber_day',{ascending:false}).order('created_at',{ascending:false}).limit(500),
      sb.from('stromky_days').select('*').limit(200)]);
    if(res.some(function(r){return r.error})){setOffline(true);return}
    setOffline(false);cfg=res[0].data;sales=(res[1].data||[]).map(mapSale);
    odbery=(res[2].data||[]).map(function(o){return {id:o.id,day:String(o.odber_day),smrk:Number(o.smrk)||0,jedle:Number(o.jedle)||0,note:o.note||'',void:!!o.is_void}});
    days={};(res[3].data||[]).forEach(function(d){days[String(d.day)]=d});
    renderAll();}
  var reloadTimer=null;function scheduleLoad(){clearTimeout(reloadTimer);reloadTimer=setTimeout(load,250)}

  /* ---------- prodej ---------- */
  function openSheet(t,s){pending={type:t,size:s,full:price(t,s)};$('sheet-title').textContent=tName(t)+' · '+sName(s);$('sheet-price').value=pending.full;
    $('sheet-main').hidden=false;$('sheet-qr').hidden=true;$('sheet-cancel').hidden=false;
    $('sheet').hidden=false;$('sheet-back').hidden=false;$('pay-cash').focus();}
  function closeSheet(){pending=null;$('sheet').hidden=true;$('sheet-back').hidden=true;$('qr-img').textContent='';}
  function sheetPrice(){return Math.max(0,parseInt($('sheet-price').value,10)||0)}
  function showQr(){if(!pending)return;var iban=toIban(cfg&&cfg.account);var p=sheetPrice();
    $('sheet-main').hidden=true;$('sheet-qr').hidden=false;$('sheet-cancel').hidden=true;var box=$('qr-img');box.textContent='';
    if(!iban){box.parentNode.hidden=false;$('qr-amt').textContent=kc(p);$('qr-info').textContent='Chybí číslo účtu. Doplň ho v záložce Ceník.';$('qr-paid').disabled=true;box.hidden=true;return}
    box.hidden=false;$('qr-paid').disabled=false;
    var now=new Date();var msg='Stromek '+tName(pending.type).split(' ')[0]+' '+sName(pending.size)+' '+now.getDate()+'.'+(now.getMonth()+1)+'.';
    if(window.QRCode){new window.QRCode(box,{text:spd(iban,p,msg),width:480,height:480,correctLevel:window.QRCode.CorrectLevel.M})}
    else{box.appendChild(el('p',{cls:'note',text:'QR kód se nepodařilo načíst. Zkontroluj internet.'}))}
    $('qr-amt').textContent=kc(p);
    $('qr-info').textContent='Zákazník naskenuje kód v bankovní aplikaci. Až uvidíš potvrzení platby, ťukni na Zaplaceno.';}
  async function sell(pay){if(!pending||!sb||busy)return;busy=true;var p=sheetPrice();var now=new Date();
    var row={tree_type:pending.type,size:pending.size,price:p,pay:pay,sold_at:now.toISOString(),sale_day:dayKey(now),seller:seller().slice(0,40)};
    var label=tName(row.tree_type).split(' ')[0]+' '+sName(row.size)+' · '+kc(p)+' · '+PAY[pay];closeSheet();
    var r=await sb.from('stromky_sales').insert(row).select('id').single();busy=false;
    if(r.error){toast('Prodej se neuložil. Zkontroluj internet a zkus to znovu.',true);return}
    lastAdded=r.data.id;toast(label);scheduleLoad();}
  function toast(text,noUndo){$('toast-text').textContent=text;$('toast-undo').hidden=!!noUndo;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').hidden=true;lastAdded=null},6000)}
  async function undo(){$('toast').hidden=true;if(!lastAdded)return;var id=lastAdded;lastAdded=null;await setVoid('stromky_sales',id,true)}
  async function setVoid(table,id,v){if(!sb)return;var r=await sb.from(table).update({is_void:v}).eq('id',id);if(r.error)toast('Změna se neuložila.',true);scheduleLoad()}

  /* ---------- ukládání ---------- */
  function blur(){if(document.activeElement)document.activeElement.blur()}
  async function saveStock(){if(!sb)return;var st={};TYPES.forEach(function(t){st[t.k]=num('st-'+t.k)});
    var r=await sb.from('stromky_config').update({stock:st,updated_at:new Date().toISOString()}).eq('id','main');
    blur();toast(r.error?'Sklad se neuložil.':'Sklad uložen',true);scheduleLoad()}
  async function savePrices(){if(!sb)return;var pr={};TYPES.forEach(function(t){pr[t.k]={};SIZES.forEach(function(s){var v=parseInt($('pr-'+t.k+'-'+s.k).value,10);if(!isNaN(v))pr[t.k][s.k]=v})});
    var acc=$('account').value.trim();if(acc&&!toIban(acc)){toast('Číslo účtu nevypadá správně.',true);return}
    var r=await sb.from('stromky_config').update({prices:pr,buy:{smrk:num('buy-smrk'),jedle:num('buy-jedle')},commission:{smrk:num('com-smrk'),jedle:num('com-jedle')},account:acc,updated_at:new Date().toISOString()}).eq('id','main');
    blur();toast(r.error?'Ceník se neuložil.':'Ceník uložen',true);scheduleLoad()}
  async function saveDay(){if(!sb)return;var day=$('day-pick').value||dayKey(new Date());
    var row={day:day,start_cash:num('start-cash'),counted_cash:$('counted-cash').value===''?null:num('counted-cash'),updated_at:new Date().toISOString()};
    var r=await sb.from('stromky_days').upsert(row,{onConflict:'day'});blur();toast(r.error?'Uzávěrka se neuložila.':'Uzávěrka uložena',true);scheduleLoad()}
  async function saveOdber(){if(!sb)return;var s=num('od-smrk'),j=num('od-jedle');if(!s&&!j){toast('Zadej počet smrků nebo jedlí.',true);return}
    var r=await sb.from('stromky_odbery').insert({odber_day:$('od-day').value||dayKey(new Date()),smrk:s,jedle:j,note:$('od-note').value.trim().slice(0,200)});
    if(r.error){toast('Odběr se neuložil.',true);return}
    $('od-smrk').value='';$('od-jedle').value='';$('od-note').value='';blur();toast('Odběr zapsán',true);scheduleLoad()}

  /* ---------- export ---------- */
  function csvDownload(name,rows){var csv='﻿'+rows.map(function(r){return r.map(function(v){v=String(v);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(';')}).join('\r\n');
    var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download=name;
    document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1000);}
  function exportSales(){var rows=[['Datum','Čas','Druh','Výška','Cena Kč','Platba','Prodávající','Storno']];
    sales.slice().reverse().forEach(function(s){var d=new Date(s.at);rows.push([d.toLocaleDateString('cs-CZ'),pad(d.getHours())+':'+pad(d.getMinutes()),tName(s.type),sName(s.size),s.price,PAY[s.pay],s.by||'',s.void?'ano':''])});
    csvDownload('evidence-prijmu-stromky.csv',rows)}
  function exportOdbery(){var com=(cfg&&cfg.commission)||{};var rows=[['Datum','Smrků','Jedlí','Provize Kč','Poznámka','Storno']];
    odbery.slice().reverse().forEach(function(o){rows.push([o.day.split('-').reverse().join('.'),o.smrk,o.jedle,o.smrk*(Number(com.smrk)||0)+o.jedle*(Number(com.jedle)||0),o.note,o.void?'ano':''])});
    csvDownload('odbery-druhy-prodejce.csv',rows)}

  /* ---------- události ---------- */
  $('pay-cash').addEventListener('click',function(){sell('cash')});
  $('pay-card').addEventListener('click',function(){sell('card')});
  $('pay-qr').addEventListener('click',showQr);
  $('qr-paid').addEventListener('click',function(){sell('qr')});
  $('qr-back').addEventListener('click',function(){$('qr-img').textContent='';$('sheet-main').hidden=false;$('sheet-qr').hidden=true;$('sheet-cancel').hidden=false});
  document.querySelectorAll('[data-disc]').forEach(function(b){b.addEventListener('click',function(){if(!pending)return;var d=+b.dataset.disc;
    $('sheet-price').value=d?Math.max(0,sheetPrice()-d):pending.full})});
  $('sheet-cancel').addEventListener('click',closeSheet);$('sheet-back').addEventListener('click',closeSheet);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!$('sheet').hidden)closeSheet()});
  $('toast-undo').addEventListener('click',undo);
  $('day-pick').addEventListener('change',function(){$('start-cash').value='';$('counted-cash').value='';renderPrehled()});
  ['start-cash','counted-cash'].forEach(function(id){$(id).addEventListener('input',function(){var day=$('day-pick').value;renderUzaverka(day,sum(live().filter(function(s){return s.day===day})))})});
  $('account').addEventListener('input',accountNote);
  $('save-stock').addEventListener('click',saveStock);$('save-prices').addEventListener('click',savePrices);
  $('save-day').addEventListener('click',saveDay);$('save-odber').addEventListener('click',saveOdber);
  $('export').addEventListener('click',exportSales);$('export-odbery').addEventListener('click',exportOdbery);
  $('seller').value=seller();$('seller').addEventListener('input',function(){try{localStorage.setItem('seller',$('seller').value.trim())}catch(e){}});

  route();renderAll();
  setInterval(renderHeader,60000);

  if(!window.supabase){setOffline(true);return}
  sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  load();
  var ch=sb.channel('stromky');
  ['stromky_sales','stromky_config','stromky_odbery','stromky_days'].forEach(function(t){ch=ch.on('postgres_changes',{event:'*',schema:'public',table:t},scheduleLoad)});
  ch.subscribe();
  setInterval(load,30000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)load()});
  window.addEventListener('online',load);
})();
