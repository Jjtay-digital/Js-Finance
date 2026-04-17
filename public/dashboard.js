
// ── INCOME SOURCES ────────────────────────────────────────────────────────────
function toggleIncomeFilter(){
  S.incomeUntaggedOnly=!S.incomeUntaggedOnly;saveS();
  const btn=getEl('income-untagged-toggle');
  if(btn)btn.classList.toggle('on',!!S.incomeUntaggedOnly);
  renderIncomeSources();
}

function renderIncomeSources(){
  const el=getEl('income-sources-body');if(!el)return;
  const untaggedOnly=!!S.incomeUntaggedOnly;
  const btn=getEl('income-untagged-toggle');
  if(btn)btn.classList.toggle('on',untaggedOnly);
  // Get income transactions, optionally filter to Unknown only
  let txs=TRANSACTIONS.filter(t=>t.type==='income');
  if(untaggedOnly)txs=txs.filter(t=>t.category==='Unknown');
  const subtitle=getEl('income-sources-subtitle');
  if(subtitle)subtitle.textContent=untaggedOnly?(isPageHidden('monthly')?'Showing untagged only (•••• transactions)':'Showing untagged only ('+txs.length+' transactions)'):(isPageHidden('monthly')?'All income (•••• transactions)':'All income ('+txs.length+' transactions)');
  if(!txs.length){
    el.innerHTML='<tr><td colspan="6"><div class="empty-state">'+(untaggedOnly?'All income transactions are tagged! Great job.':'No income transactions found.')+'</div></td></tr>';
    return;
  }
  el.innerHTML=txs.map(t=>{
    const isUnknown=t.category==='Unknown';
    const catBadge=catBadgeHTML(t.category);
    return '<tr>'+
      '<td class="mono text-muted" style="font-size:12px">'+t.date+'</td>'+
      '<td class="fw6">'+t.desc+'</td>'+
      '<td style="font-size:12px;color:var(--text3)">'+t.source+'</td>'+
      '<td class="mono text-green fw6">'+hideVal('monthly','+$'+fmt(t.amount))+'</td>'+
      '<td>'+catBadge+'</td>'+
      '<td>'+(isUnknown?'<button class="btn xs" style="border-color:var(--accent);color:var(--accent)" data-id="'+t.id+'" onclick="quickTagIncome(parseInt(this.dataset.id))">Tag</button>':'')+'</td>'+
    '</tr>';
  }).join('');
}

function quickTagIncome(id){
  // Jump to transactions tab and highlight this transaction
  const tab=document.querySelector('.nav-tab[data-page="transactions"]');
  if(tab){showPage('transactions',tab);}
  setTimeout(()=>{
    const searchEl=getEl('tx-search');
    if(searchEl){
      const tx=TRANSACTIONS.find(t=>t.id===id);
      if(tx){searchEl.value=tx.desc;filterTx();}
    }
  },100);
  showToast('Find and tag this transaction in the Transactions tab');
}


// ── P&L HISTORY ───────────────────────────────────────────────────────────────
function renderPnLHistory(){
  const el=getEl('pnl-history');if(!el)return;
  const endSel=getEl('pnl-end-month');
  const endVal=endSel?endSel.value:'3-2026';
  const [endM,endY]=endVal.split('-').map(Number);
  // Build 3 months ending at selection
  const months=[];
  for(let i=2;i>=0;i--){
    let m=endM-i,y=endY;
    if(m<=0){m+=12;y--;}
    const MNAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    months.push(MNAMES[m-1]+' '+y);
  }
  // Collect all unique months from transactions
  const allMonths=[...new Set(TRANSACTIONS.map(t=>t.month))].sort();
  let html='';let totalInc=0,totalExp=0;
  months.forEach(mon=>{
    const txs=TRANSACTIONS.filter(t=>t.month===mon);
    if(!txs.length&&!allMonths.includes(mon)){
      html+='<tr style="opacity:.4"><td class="text-muted fw6">'+mon+'</td><td colspan="5" class="text-muted">No statement uploaded</td></tr>';
      return;
    }
    const inc=txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const exp=txs.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const net=inc-exp;const rate=inc>0?(net/inc*100).toFixed(1):0;
    totalInc+=inc;totalExp+=exp;
    html+='<tr>'+
      '<td class="fw6">'+mon+'</td>'+
      '<td class="mono text-green">'+hideVal('monthly','+$'+fmt(inc))+'</td>'+
      '<td class="mono text-red">'+hideVal('monthly','-$'+fmt(exp))+'</td>'+
      '<td class="mono fw6 '+(net>=0?'text-green':'text-red')+'">'+hideVal('monthly',(net>=0?'+':'-')+'$'+fmt(Math.abs(net)))+'</td>'+
      '<td class="mono">'+hideVal('monthly',rate+'%')+'</td>'+
      '<td><span class="badge '+(net>=0?'badge-green':'badge-red')+'">'+(net>=0?'Surplus':'Deficit')+'</span></td>'+
    '</tr>';
  });
  // 3-month total row
  const totalNet=totalInc-totalExp;
  const avgRate=totalInc>0?(totalNet/totalInc*100).toFixed(1):0;
  html+='<tr style="background:var(--surface2);font-weight:700">'+
    '<td class="fw7">3-Month Total</td>'+
    '<td class="mono text-green fw7">'+hideVal('monthly','+$'+fmt(totalInc))+'</td>'+
    '<td class="mono text-red fw7">'+hideVal('monthly','-$'+fmt(totalExp))+'</td>'+
    '<td class="mono fw7 '+(totalNet>=0?'text-green':'text-red')+'">'+hideVal('monthly',(totalNet>=0?'+':'-')+'$'+fmt(Math.abs(totalNet)))+'</td>'+
    '<td class="mono fw7">'+hideVal('monthly',avgRate+'%')+'</td>'+
    '<td><span class="badge '+(totalNet>=0?'badge-green':'badge-red')+'">'+(totalNet>=0?'Surplus':'Deficit')+'</span></td>'+
  '</tr>';
  el.innerHTML=html;
  const noteEl=getEl('pnl-note');
  if(noteEl)noteEl.textContent='Upload more statements to populate past months. Change ending month above to view different periods.';
}


// ── CATEGORY SETTINGS ─────────────────────────────────────────────────────────
function renderCatSettings(){
  const el=getEl('cat-settings-list');if(!el)return;
  const PROTECTED=['Salary','Claims','Internal Transfer','Unknown'];
  const custom=S.categories.filter(c=>!PROTECTED.includes(c));
  const builtin=S.categories.filter(c=>PROTECTED.includes(c));

  let html='';

  // ── Custom categories (renameable + deletable) ──
  html+='<div style="margin-bottom:16px">';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:10px">Your Categories</div>';
  if(custom.length){
    html+='<div style="display:flex;flex-direction:column;gap:6px">';
    html+=custom.map(cat=>{
      const txCount=TRANSACTIONS.filter(t=>t.category===cat).length;
      return '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--rs);padding:10px 14px">'+
        '<div>'+
          '<span style="font-size:14px;font-weight:600">'+cat+'</span>'+
          '<span style="font-size:12px;color:var(--text3);margin-left:8px">'+txCount+' transaction'+(txCount!==1?'s':'')+'</span>'+
        '</div>'+
        '<div style="display:flex;gap:6px">'+
          '<button class="btn xs" data-cat="'+cat+'" onclick="openRenameCat(this.dataset.cat)">✎ Rename</button>'+
          '<button class="btn xs" data-cat="'+cat+'" onclick="confirmDeleteCat(this.dataset.cat)" style="border-color:var(--red);color:var(--red)">Delete</button>'+
        '</div>'+
      '</div>';
    }).join('');
    html+='</div>';
  } else {
    html+='<div style="padding:14px;background:var(--surface2);border-radius:var(--rs);font-size:13px;color:var(--text3);text-align:center">No custom categories yet. Add one below.</div>';
  }
  html+='</div>';

  // ── Built-in categories (renameable only) ──
  html+='<div>';
  html+='<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:10px">Built-in Categories <span style="font-weight:400;text-transform:none;letter-spacing:0">(rename only — cannot delete)</span></div>';
  html+='<div style="display:flex;flex-direction:column;gap:6px">';
  html+=builtin.map(cat=>{
    const txCount=TRANSACTIONS.filter(t=>t.category===cat).length;
    return '<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1.5px solid var(--border);border-radius:var(--rs);padding:10px 14px;opacity:.85">'+
      '<div>'+
        '<span style="font-size:14px;font-weight:600">'+cat+'</span>'+
        '<span style="font-size:12px;color:var(--text3);margin-left:8px">'+txCount+' transaction'+(txCount!==1?'s':'')+'</span>'+
        '<span class="badge badge-blue" style="margin-left:8px;font-size:10px">Built-in</span>'+
      '</div>'+
      '<button class="btn xs" data-cat="'+cat+'" onclick="openRenameCat(this.dataset.cat)">✎ Rename</button>'+
    '</div>';
  }).join('');
  html+='</div>';
  html+='</div>';

  el.innerHTML=html;
}

function openRenameCat(cat){
  getEl('rename-cat-old').value=cat;
  getEl('rename-cat-new').value=cat;
  getEl('rename-cat-desc').textContent='Renaming will update all transactions with this category.';
  const delBtn=getEl('rename-cat-del-btn');
  const protected_=['Salary','Claims','Internal Transfer','Unknown'];
  delBtn.style.display=protected_.includes(cat)?'none':'block';
  getEl('rename-cat-modal').classList.add('open');
}

function saveCategoryRename(){
  const oldName=getEl('rename-cat-old').value.trim();
  const newName=getEl('rename-cat-new').value.trim();
  if(!newName){showToast('Enter a new name');return;}
  if(newName===oldName){getEl('rename-cat-modal').classList.remove('open');return;}
  if(S.categories.includes(newName)){showToast('That name already exists');return;}
  // Rename in categories list
  const idx=S.categories.indexOf(oldName);
  if(idx>-1)S.categories[idx]=newName;
  // Update all transactions
  let txCount=0;
  TRANSACTIONS.forEach(t=>{
    if(t.category===oldName){t.category=newName;txCount++;}
    if(t.defaultCat===oldName)t.defaultCat=newName;
  });
  // Update catOverrides
  Object.keys(S.catOverrides).forEach(k=>{
    if(S.catOverrides[k]===oldName)S.catOverrides[k]=newName;
  });
  // Update budgets
  S.budgets.forEach(b=>{if(b.category===oldName)b.category=newName;});
  saveS();
  getEl('rename-cat-modal').classList.remove('open');
  renderCatSettings();
  calcSummary();filterTx();populateCatFilter();
  showToast('Renamed "'+oldName+'" to "'+newName+'" across '+txCount+' transactions');
}

function confirmDeleteCat(cat){
  getEl('rename-cat-old').value=cat;
  getEl('rename-cat-new').value=cat;
  getEl('rename-cat-desc').textContent='Delete this category? All transactions tagged with it will become "Unknown".';
  getEl('rename-cat-del-btn').style.display='block';
  getEl('rename-cat-modal').classList.add('open');
}

function deleteCategoryFromSettings(){
  const cat=getEl('rename-cat-old').value.trim();
  const protected_=['Salary','Claims','Internal Transfer','Unknown'];
  if(protected_.includes(cat)){showToast('Cannot delete built-in category');return;}
  S.categories=S.categories.filter(c=>c!==cat);
  TRANSACTIONS.forEach(t=>{if(t.category===cat)t.category='Unknown';});
  Object.keys(S.catOverrides).forEach(k=>{if(S.catOverrides[k]===cat)delete S.catOverrides[k];});
  S.budgets=S.budgets.filter(b=>b.category!==cat);
  saveS();
  getEl('rename-cat-modal').classList.remove('open');
  renderCatSettings();calcSummary();filterTx();populateCatFilter();
  showToast('"'+cat+'" deleted — transactions moved to Unknown');
}

function openAddCatFromSettings(){
  pendingCatTxId=null;
  getEl('cat-modal').classList.add('open');
}


// ── PDF STATEMENT UPLOAD & PARSE ─────────────────────────────────────────────
let uploadedFile = null;

function openUploadModal(){
  if(!S.apiKey||!S.apiKey.startsWith('sk-ant')){
    showToast('Add Anthropic API key in Settings first',4000);return;
  }
  uploadedFile=null;
  getEl('upload-file-name').textContent='Click to select or drag & drop PDF';
  getEl('upload-parse-btn').disabled=true;
  const status=getEl('upload-status');status.style.display='none';
  getEl('upload-modal').classList.add('open');
}
function closeUploadModal(){getEl('upload-modal').classList.remove('open');uploadedFile=null;}

function handleFileDrop(e){
  e.preventDefault();
  getEl('upload-drop-zone').style.borderColor='var(--border2)';
  const file=e.dataTransfer.files[0];
  if(file&&file.type==='application/pdf') setUploadFile(file);
  else showToast('Please drop a PDF file',3000);
}
function handleFileSelect(input){
  if(input.files[0]) setUploadFile(input.files[0]);
}
function setUploadFile(file){
  if(file.size>10*1024*1024){showToast('File too large (max 10MB)',3000);return;}
  uploadedFile=file;
  getEl('upload-file-name').textContent=file.name+' ('+Math.round(file.size/1024)+'KB)';
  getEl('upload-parse-btn').disabled=false;
  showUploadStatus('info','Ready to parse: '+file.name+'. Click "Parse with Claude" to begin.');
}
function showUploadStatus(type,msg){
  const el=getEl('upload-status');
  const colors={info:'var(--accent-light)',success:'var(--green-bg)',error:'var(--red-bg)',loading:'var(--amber-bg)'};
  const borders={info:'var(--accent)',success:'var(--green)',error:'var(--red)',loading:'var(--amber)'};
  el.style.display='block';el.style.background=colors[type]||colors.info;
  el.style.border='1.5px solid '+(borders[type]||borders.info);
  el.textContent=msg;
}

async function parseStatement(){
  if(!uploadedFile||!S.apiKey){return;}
  const btn=getEl('upload-parse-btn');
  btn.disabled=true;btn.textContent='Parsing...';
  const bankId=getEl('upload-bank-select').value;
  const monthNum=parseInt(getEl('upload-month-sel').value);
  const year=getEl('upload-year-sel').value;
  const MNAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthName=MNAMES[monthNum-1];
  showUploadStatus('loading','Reading PDF... this may take 20-30 seconds...');
  try{
    // Convert PDF to base64
    const base64=await new Promise((res,rej)=>{
      const reader=new FileReader();
      reader.onload=e=>res(e.target.result.split(',')[1]);
      reader.onerror=rej;
      reader.readAsDataURL(uploadedFile);
    });
    showUploadStatus('loading','Sending to Claude for analysis...');
    // Send to Claude API with PDF as document
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':S.apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:4000,
        messages:[{
          role:'user',
          content:[
            {
              type:'document',
              source:{type:'base64',media_type:'application/pdf',data:base64}
            },
            {
              type:'text',
              text:'This is a Singapore bank statement for '+monthName+' '+year+'. Please extract:\\n1. The CLOSING BALANCE (final account balance at end of statement)\\n2. ALL transactions listed\\n\\nReply in this exact JSON format only, no other text:\\n{\\n  "closingBalance": 1234.56,\\n  "currency": "SGD",\\n  "transactions": [\\n    {"date": "1 '+monthName+'", "month": "'+monthName+' '+year+'", "desc": "description here", "type": "income or expense or internal", "amount": 100.00, "source": "'+getEl('upload-bank-select').options[getEl('upload-bank-select').selectedIndex].text+'"},\\n    ...\\n  ]\\n}\\n\\nFor type: income=money coming in, expense=money going out, internal=transfers between own accounts.\\nFor amount: always positive number.\\nOnly include real transactions, skip opening balance lines.'
            }
          ]
        }]
      })
    });
    if(!resp.ok){
      const err=await resp.json().catch(()=>({}));
      throw new Error(err.error?.message||'API error '+resp.status);
    }
    const data=await resp.json();
    const textBlock=data.content?.filter(b=>b.type==='text').pop();
    if(!textBlock) throw new Error('No response from Claude');
    // Parse JSON from response
    const jsonMatch=textBlock.text.match(/\\{[\\s\\S]*\\}/);
    if(!jsonMatch) throw new Error('Could not parse Claude response');
    const parsed=JSON.parse(jsonMatch[0]);
    // Apply results
    applyParsedStatement(parsed,bankId,monthName,year);
  }catch(e){
    console.error('Parse error:',e);
    showUploadStatus('error','Error: '+e.message);
    showToast('Parse failed: '+e.message.slice(0,50),5000);
  }
  btn.disabled=false;btn.textContent='&#9889; Parse with Claude';
}

function applyParsedStatement(parsed,bankId,monthName,year){
  let added=0,updated=false;
  // Update account balance
  if(parsed.closingBalance>0){
    const asset=S.assets.find(a=>a.id===bankId);
    if(asset){asset.value=parsed.closingBalance;updated=true;}
    else{
      // Add new asset if not found
      const names={'dbs-sgd':'DBS Multiplier SGD','dbs-jpy':'DBS Multiplier JPY','posb-cc':'POSB Everyday CC','uob':'UOB Account','ocbc':'OCBC Joint','paylah':'PayLah','other':'Other Account'};
      S.assets.push({id:bankId,type:'bank',name:names[bankId]||'Bank Account',owner:'Jason',value:parsed.closingBalance});
      updated=true;
    }
  }
  // Add/update foreign-currency holdings cards only when statement is non-SGD.
  const currency=(parsed.currency||'SGD').toUpperCase();
  if(currency!=='SGD'&&parsed.closingBalance>0){
    const accountName=getEl('upload-bank-select').options[getEl('upload-bank-select').selectedIndex].text||bankId;
    const defaultRates={JPY:0.0079,USD:(parseFloat(S.usdSgd)||1.34)};
    const fx=parseFloat(parsed.fxRate)||defaultRates[currency]||1;
    const rec={
      accountId:bankId,
      accountName,
      currency,
      balance:parseFloat(parsed.closingBalance)||0,
      sgdEquivalent:(parseFloat(parsed.closingBalance)||0)*fx,
      rate:fx,
      asOf:monthName+' '+year,
    };
    const idx=S.forexHoldings.findIndex(h=>h.currency===currency&&h.accountId===bankId);
    if(idx>=0)S.forexHoldings[idx]=rec;else S.forexHoldings.push(rec);
  }
  // Add transactions (avoid duplicates)
  const existingDescs=new Set(TRANSACTIONS.map(t=>t.date+'|'+t.desc+'|'+t.amount));
  const newTxs=(parsed.transactions||[]).filter(t=>{
    const key=t.date+'|'+t.desc+'|'+t.amount;
    return !existingDescs.has(key);
  });
  // Assign IDs and apply category rules
  const nextId=Math.max(0,...TRANSACTIONS.map(t=>parseInt(t.id)||0))+1;
  newTxs.forEach((t,i)=>{
    const id=nextId+i;
    const cat=guessCat(t.desc,t.source,t.type);
    const tx={id,date:t.date||('1 '+monthName),month:monthName+' '+year,desc:t.desc,source:t.source||getEl('upload-bank-select').options[getEl('upload-bank-select').selectedIndex].text,type:t.type||'expense',amount:parseFloat(t.amount)||0,defaultCat:cat,category:S.catOverrides[id]||cat};
    TRANSACTIONS.push(tx);added++;
  });
  if(updated||added>0){
    saveS();renderNW();calcSummary();
    renderTxCurrencyCards();renderTxCurrencyTabs();
  }
  const msg='Done! Balance updated to $'+fmt(parsed.closingBalance||0)+'. '+added+' new transactions added.';
  showUploadStatus('success',msg);
  showToast(msg,5000);
  setTimeout(()=>closeUploadModal(),3000);
}

function guessCat(desc,source,type){
  if(type==='income') return 'Salary';
  const d=(desc||'').toLowerCase();
  if(d.includes('sha2')||d.includes('salary')||d.includes('payroll')) return 'Salary';
  if(d.includes('food')||d.includes('mcdonald')||d.includes('kopitiam')||d.includes('grab food')||d.includes('foodpanda')||d.includes('fomo pay')||d.includes('w90')||d.includes('sit@p')) return 'Food';
  if(d.includes('transport')||d.includes('mrt')||d.includes('bus')||d.includes('grab')&&!d.includes('food')||d.includes('gojek')) return 'Transport';
  if(d.includes('netflix')||d.includes('spotify')||d.includes('apple')||d.includes('subscription')) return 'Subscriptions';
  if(d.includes('insurance')||d.includes('aia')||d.includes('ntuc income')||d.includes('prudential')) return 'Insurance';
  if(d.includes('internet')||d.includes('singtel')||d.includes('starhub')||d.includes('m1')) return 'Internet';
  if(d.includes('handphone')||d.includes('mobile')) return 'Handphone';
  if(d.includes('electric')||d.includes('sp group')||d.includes('utilities')) return 'Utilities';
  if(d.includes('pokemon')||d.includes('rk')||d.includes('shafeeq')||d.includes('dex ')||d.includes('wayne')||d.includes('xuan')) return 'Hobbies - Pokemon';
  if(d.includes('paynow')||d.includes('fast transfer')||d.includes('internal')) return 'Internal Transfer';
  if(d.includes('sally')) return 'Gift Received';
  return 'Unknown';
}


const BASE_TX = [
  {id:0,date:'25 Mar',month:'Mar 2026',desc:'SHA2 Labs Pte Ltd',source:'DBS GIRO',type:'income',amount:3000.00,defaultCat:'Salary'},
  {id:1,date:'17 Mar',month:'Mar 2026',desc:'PayNow from Sally — Gift',source:'DBS Multiplier',type:'income',amount:400.00,defaultCat:'Gift Received'},
  {id:2,date:'23 Mar',month:'Mar 2026',desc:'PayNow from Sally — Travel reimb.',source:'DBS Multiplier',type:'income',amount:668.00,defaultCat:'Gift Received'},
  {id:3,date:'19 Mar',month:'Mar 2026',desc:'FAST Transfer inbound',source:'DBS Multiplier',type:'income',amount:1073.54,defaultCat:'Unknown'},
  {id:4,date:'28 Mar',month:'Mar 2026',desc:'FAST Transfer inbound',source:'DBS Multiplier',type:'income',amount:77.84,defaultCat:'Unknown'},
  {id:5,date:'19 Mar',month:'Mar 2026',desc:'PayNow from Lee Chee Wei',source:'DBS Multiplier',type:'income',amount:115.50,defaultCat:'Unknown'},
  {id:6,date:'31 Mar',month:'Mar 2026',desc:'Interest Earned',source:'DBS Multiplier',type:'income',amount:0.04,defaultCat:'Salary'},
  {id:7,date:'02 Mar',month:'Mar 2026',desc:'Manulife Insurance',source:'DBS GIRO',type:'expense',amount:8.24,defaultCat:'Insurance'},
  {id:8,date:'05 Mar',month:'Mar 2026',desc:'IRAS Property Tax',source:'DBS GIRO',type:'expense',amount:13.60,defaultCat:'Tax'},
  {id:9,date:'30 Mar',month:'Mar 2026',desc:'PayNow to RK',source:'DBS Multiplier',type:'expense',amount:260.00,defaultCat:'Hobbies — Pokémon'},
  {id:10,date:'30 Mar',month:'Mar 2026',desc:'PayNow to Shafeeq',source:'DBS Multiplier',type:'expense',amount:218.50,defaultCat:'Hobbies — Pokémon'},
  {id:11,date:'30 Mar',month:'Mar 2026',desc:'PayNow to Dex',source:'DBS Multiplier',type:'expense',amount:43.00,defaultCat:'Hobbies — Pokémon'},
  {id:12,date:'30 Mar',month:'Mar 2026',desc:'PayNow to Brendant',source:'DBS Multiplier',type:'expense',amount:27.00,defaultCat:'Hobbies — Pokémon'},
  {id:13,date:'31 Mar',month:'Mar 2026',desc:'PayNow to Wayne',source:'DBS Multiplier',type:'expense',amount:75.00,defaultCat:'Hobbies — Pokémon'},
  {id:14,date:'31 Mar',month:'Mar 2026',desc:'PayNow to XuanHao',source:'DBS Multiplier',type:'expense',amount:88.00,defaultCat:'Hobbies — Pokémon'},
  {id:15,date:'30 Mar',month:'Mar 2026',desc:'PayNow to NINE CAP',source:'DBS Multiplier',type:'expense',amount:95.00,defaultCat:'Unknown'},
  {id:16,date:'07 Mar',month:'Mar 2026',desc:'SEND MONEY TO TDSG',source:'PayLah',type:'expense',amount:25.00,defaultCat:'Food'},
  {id:17,date:'08 Mar',month:'Mar 2026',desc:'FOMO PAY',source:'PayLah',type:'expense',amount:6.00,defaultCat:'Food'},
  {id:18,date:'08 Mar',month:'Mar 2026',desc:'SIT@P S13A',source:'PayLah',type:'expense',amount:1.60,defaultCat:'Food'},
  {id:19,date:'09 Mar',month:'Mar 2026',desc:'QASHIER-GO',source:'PayLah',type:'expense',amount:8.00,defaultCat:'Food'},
  {id:20,date:'11 Mar',month:'Mar 2026',desc:'F M FOOD CO',source:'PayLah',type:'expense',amount:7.50,defaultCat:'Food'},
  {id:21,date:'13 Mar',month:'Mar 2026',desc:'Samantha (98391900) meal',source:'PayLah',type:'expense',amount:9.87,defaultCat:'Food'},
  {id:22,date:'23 Mar',month:'Mar 2026',desc:'PayLah top-up',source:'DBS Multiplier',type:'expense',amount:6.60,defaultCat:'Unknown'},
  {id:23,date:'24 Mar',month:'Mar 2026',desc:'PayLah top-up',source:'DBS Multiplier',type:'expense',amount:7.00,defaultCat:'Unknown'},
  {id:24,date:'24 Mar',month:'Mar 2026',desc:'PayLah top-up',source:'DBS Multiplier',type:'expense',amount:6.00,defaultCat:'Unknown'},
  {id:25,date:'25 Mar',month:'Mar 2026',desc:'PayLah top-up',source:'DBS Multiplier',type:'expense',amount:7.80,defaultCat:'Unknown'},
  {id:26,date:'29 Mar',month:'Mar 2026',desc:'PayLah top-up',source:'DBS Multiplier',type:'expense',amount:3.00,defaultCat:'Unknown'},
  {id:27,date:'05 Mar',month:'Mar 2026',desc:'Transfer to UOB',source:'DBS Multiplier',type:'internal',amount:200.00,defaultCat:'Internal Transfer'},
  {id:28,date:'18 Mar',month:'Mar 2026',desc:'Transfer to UOB',source:'DBS Multiplier',type:'internal',amount:350.00,defaultCat:'Internal Transfer'},
  {id:29,date:'26 Mar',month:'Mar 2026',desc:'Transfer to UOB',source:'DBS Multiplier',type:'internal',amount:53.79,defaultCat:'Internal Transfer'},
  {id:30,date:'29 Mar',month:'Mar 2026',desc:'Transfer to OCBC joint',source:'DBS Multiplier',type:'internal',amount:2800.00,defaultCat:'Internal Transfer'},
  {id:31,date:'29 Mar',month:'Mar 2026',desc:'Transfer from OCBC joint',source:'DBS Multiplier',type:'internal',amount:230.00,defaultCat:'Internal Transfer'},
  {id:32,date:'22 Feb',month:'Mar 2026',desc:'POSB Card — Bill Payment',source:'Credit Card',type:'internal',amount:254.66,defaultCat:'Internal Transfer'},
];

const DEFAULT_CATS=['Salary','Claims','Food','Insurance','Tax','Hobbies - Pokemon','Transport','Utilities','Internet','Handphone','Subscriptions','Gift Received','Internal Transfer','Unknown'];
const CAT_COLORS={'Salary':'#049a74','Claims':'#0096c7','Food':'#f9a825','Insurance':'#4361ee','Tax':'#7209b7','Hobbies - Pokemon':'#f3722c','Transport':'#06b6d4','Utilities':'#ec4899','Internet':'#0ea5e9','Handphone':'#84cc16','Subscriptions':'#ef233c','Gift Received':'#a855f7','Internal Transfer':'#94a3b8','Unknown':'#cbd5e1'};

// Category visual config: icon + bg + text (light) + text (dark)
const CAT_STYLE={
  'Salary':         {icon:'💼', bg:'#dcfce7', col:'#15803d', darkBg:'#052e16', darkCol:'#4ade80'},
  'Claims':         {icon:'📋', bg:'#dbeafe', col:'#1d4ed8', darkBg:'#0c1a3d', darkCol:'#60a5fa'},
  'Food':           {icon:'🍜', bg:'#fef9c3', col:'#a16207', darkBg:'#2d1f00', darkCol:'#fbbf24'},
  'Insurance':      {icon:'🛡️', bg:'#ede9fe', col:'#6d28d9', darkBg:'#1e0a3d', darkCol:'#a78bfa'},
  'Tax':            {icon:'🏛',  bg:'#f3e8ff', col:'#7e22ce', darkBg:'#1a0630', darkCol:'#c084fc'},
  'Hobbies - Pokemon':{icon:'🃏', bg:'#ffedd5', col:'#c2410c', darkBg:'#2d1000', darkCol:'#fb923c'},
  'Transport':      {icon:'🚌', bg:'#cffafe', col:'#0e7490', darkBg:'#001f26', darkCol:'#22d3ee'},
  'Utilities':      {icon:'💡', bg:'#fce7f3', col:'#be185d', darkBg:'#2d0020', darkCol:'#f472b6'},
  'Internet':       {icon:'📶', bg:'#e0f2fe', col:'#0369a1', darkBg:'#001a2e', darkCol:'#38bdf8'},
  'Handphone':      {icon:'📱', bg:'#ecfccb', col:'#3f6212', darkBg:'#0f1f00', darkCol:'#a3e635'},
  'Subscriptions':  {icon:'📺', bg:'#ffe4e6', col:'#be123c', darkBg:'#2d0010', darkCol:'#fb7185'},
  'Gift Received':  {icon:'🎁', bg:'#f5d0fe', col:'#86198f', darkBg:'#2a0030', darkCol:'#e879f9'},
  'Internal Transfer':{icon:'🔁', bg:'#f1f5f9', col:'#475569', darkBg:'#1e293b', darkCol:'#94a3b8'},
  'Unknown':        {icon:'❓', bg:'#fef3c7', col:'#92400e', darkBg:'#1c0f00', darkCol:'#fcd34d'},
};
function getCatStyle(cat){
  return CAT_STYLE[cat]||{icon:'📌', bg:'#f1f5f9', col:'#334155', darkBg:'#1e293b', darkCol:'#94a3b8'};
}
function catBadgeHTML(cat){
  const s=getCatStyle(cat);
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const bg=dark?s.darkBg:s.bg;
  const col=dark?s.darkCol:s.col;
  return '<span style="display:inline-flex;align-items:center;gap:4px;background:'+bg+';color:'+col+
    ';font-size:11px;font-weight:700;padding:3px 9px;border-radius:12px;white-space:nowrap">'+
    s.icon+' '+cat+'</span>';
}
const DEBIT_LABELS={'cpf-oa':'CPF OA','cpf-sa':'CPF SA','cpf-ma':'CPF MA','bank-dbs':'DBS','bank-uob':'UOB','bank-ocbc':'OCBC','':(a=>a||'—')};

// ── STORAGE ───────────────────────────────────────────────────────────────────
const SK='jff_v7';
function loadS(){
  // Privacy-first mode: do not read state from browser storage.
  // Source of truth is Supabase, loaded by app/dashboard/page.tsx.
  return {};
}
function saveS(){
  // Privacy-first mode: do not persist dashboard data in browser storage.
  // Keep current runtime state only; Supabase sync is handled by page.tsx patch.
  if(Array.isArray(window.TRANSACTIONS))S.transactions=window.TRANSACTIONS;
}

// ── STATE ─────────────────────────────────────────────────────────────────────
window.S=loadS();let S=window.S;
if(!S.categories)S.categories=[...DEFAULT_CATS];
if(!S.catOverrides)S.catOverrides={};
if(!S.budgets)S.budgets=[];
if(!S.theme)S.theme='light';
if(!S.activePage)S.activePage='monthly';
if(!S.apiKey)S.apiKey='';
if(!S.usdSgd)S.usdSgd=1.34;
if(!S.activeProfileId)S.activeProfileId='jason';
if(S.incomeUntaggedOnly===undefined)S.incomeUntaggedOnly=false;
if(S.includeCPFinNW===undefined)S.includeCPFinNW=true;
if(!S.pricesTs)S.pricesTs=null;
if(!S.cpfTransactions)S.cpfTransactions=[];
if(!S.forexHoldings)S.forexHoldings=[];
if(!S.sectionPrefs)S.sectionPrefs={};
['bank','invest','cpf','other','liab'].forEach(k=>{
  if(!S.sectionPrefs[k])S.sectionPrefs[k]={include:true,hide:false};
  if(S.sectionPrefs[k].include===undefined)S.sectionPrefs[k].include=true;
  if(S.sectionPrefs[k].hide===undefined)S.sectionPrefs[k].hide=false;
});
if(!S.hidePages)S.hidePages={monthly:false,transactions:false,networth:false};
if(S.hidePages.monthly===undefined)S.hidePages.monthly=false;
if(S.hidePages.transactions===undefined)S.hidePages.transactions=false;
if(S.hidePages.networth===undefined)S.hidePages.networth=false;
const selfName=(window._userName||window._userEmail||'You').toString();
const selfEmail=(window._userEmail||'').toString();
if(!S.profiles||!Array.isArray(S.profiles)||!S.profiles.length){
  S.profiles=[{id:'self',name:selfName,relation:'Self',dob:'',citizen:'sc',salary:'',employer:'',email:selfEmail}];
}else{
  // Keep identity aligned to currently signed-in user.
  S.profiles[0].id='self';
  S.profiles[0].relation='Self';
  S.profiles[0].name=selfName;
  S.profiles[0].email=selfEmail;
}
if(!S.assets)S.assets=[];
if(!S.liabilities)S.liabilities=[];

window.TRANSACTIONS=Array.isArray(S.transactions)?S.transactions:[];
let pieChart=null,nwChart=null,editAssetId=null,editLiabId=null,editBudgetIdx=null,pendingCatTxId=null,currentAssetType=null;

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt=(n,d=2)=>{const v=parseFloat(n)||0;return v.toLocaleString('en-SG',{minimumFractionDigits:d,maximumFractionDigits:d});};
const fmtN=n=>{const v=parseFloat(n)||0;return v.toLocaleString('en-SG',{maximumFractionDigits:0});};
const setEl=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
const getEl=id=>document.getElementById(id);
const sectionIncluded=key=>!!(S.sectionPrefs[key]&&S.sectionPrefs[key].include);
const sectionHidden=key=>!!(S.sectionPrefs[key]&&S.sectionPrefs[key].hide);
const showAmt=(key,val)=>sectionHidden(key)?'••••':val;
const isPageHidden=page=>!!(S.hidePages&&S.hidePages[page]);
const hideVal=(page,val)=>isPageHidden(page)?'••••':val;
const eyeIcon=hidden=>hidden?'👁̸':'👁';

function syncSectionControls(){
  ['bank','invest','cpf','other','liab'].forEach(k=>{
    const t=getEl(k+'-include-toggle'),l=getEl(k+'-include-label'),h=getEl(k+'-hide-btn');
    const on=sectionIncluded(k);
    if(t)t.classList.toggle('on',on);
    if(l)l.textContent=on?'Included':'Excluded';
    if(h){
      h.style.opacity='1';
      h.textContent=eyeIcon(sectionHidden(k));
    }
  });
}
function toggleSectionInclude(key){
  S.sectionPrefs[key].include=!S.sectionPrefs[key].include;
  if(key==='cpf')S.includeCPFinNW=S.sectionPrefs[key].include;
  saveS();
  renderNW();rebuildNWChart();
}
function toggleSectionHide(key){
  S.sectionPrefs[key].hide=!S.sectionPrefs[key].hide;
  saveS();
  renderNW();
}
function syncHideButtons(){
  const mb=getEl('monthly-hide-btn');
  if(mb)mb.textContent=isPageHidden('monthly')?'👁 Show All':'🙈 Hide All';
  const tb=getEl('tx-hide-btn');
  if(tb)tb.textContent=isPageHidden('transactions')?'👁 Show All':'🙈 Hide All';
  const nb=getEl('nw-hide-btn');
  if(nb)nb.textContent=eyeIcon(isPageHidden('networth'));
}
function toggleHidePage(page){
  S.hidePages[page]=!S.hidePages[page];
  saveS();
  syncHideButtons();
  if(page==='monthly')calcSummary();
  if(page==='transactions')filterTx();
  if(page==='networth')renderNW();
}

// ── ASSET VALUE ───────────────────────────────────────────────────────────────
function assetVal(a){
  if(a.type==='stock'||a.type==='etf'){
    const p=parseFloat(a.currentPrice)||0;
    const sh=parseFloat(a.shares)||0;
    const v=a.market==='US'?sh*p*(parseFloat(S.usdSgd)||1.34):sh*p;
    return isNaN(v)?0:v;
  }
  if(a.type==='cpf')return S.includeCPFinNW===false?0:(parseFloat(a.cpfOA)||0)+(parseFloat(a.cpfSA)||0)+(parseFloat(a.cpfMA)||0);
  // property/other: only include if includeInNW is true
  if(a.type==='property'||a.type==='other'){
    if(!a.includeInNW)return 0;
    const raw=parseFloat(a.value)||0;
    const share=a.myShare!=null?parseFloat(a.myShare):1;
    return isNaN(raw*share)?0:raw*share;
  }
  const raw=parseFloat(a.value)||0;
  const share=a.myShare!=null?parseFloat(a.myShare):null;
  const v=share!=null?raw*share:raw;
  return isNaN(v)?0:v;
}

// ── INLINE EDIT ───────────────────────────────────────────────────────────────
function inlineVal(section,id,field,value,display,cls){
  const safeV=String(parseFloat(value)!=null?parseFloat(value)||0:0);
  return '<span class="inline-val'+(cls?' '+cls:'')+'" data-s="'+section+'" data-i="'+id+'" data-f="'+field+'" data-v="'+safeV+'" onclick="startInlineEdit(this)">'+
    '<span class="val-display">'+display+'</span><span class="edit-hint">✎</span></span>';
}
function startInlineEdit(el){
  const section=el.dataset.s,id=el.dataset.i,field=el.dataset.f;
  const currentVal=parseFloat(el.dataset.v)||0;
  const input=document.createElement('input');
  input.className='inline-input';input.type='number';input.step='0.01';
  input.value=currentVal;input.style.width='130px';
  el.replaceWith(input);input.focus();input.select();
  let committed=false;
  function commit(){
    if(committed)return;committed=true;
    const raw=input.value.trim();
    // Allow clearing to 0
    const newVal=raw===''?0:parseFloat(raw);
    if(isNaN(newVal)){renderNW();return;}
    if(section==='bank'||section==='invest'){
      const a=S.assets.find(x=>x.id===id);if(a){a[field]=newVal;saveS();}
    }else if(section==='cpf'){
      const a=S.assets.find(x=>x.id===id);if(a){a[field]=newVal;saveS();}
    }else if(section==='liab'){
      const l=S.liabilities.find(x=>x.id===id);
      if(l){l[field]=newVal;if(l.myShare&&l.myShare<1)l.fullAmount=newVal/l.myShare;saveS();}
    }else if(section==='other'){
      const a=S.assets.find(x=>x.id===id);if(a){a[field]=newVal;saveS();}
    }
    showToast('Saved');renderNW();rebuildNWChart();
  }
  input.addEventListener('blur',commit);
  input.addEventListener('keydown',e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){committed=true;renderNW();}});
}

function eBtn(id){return '<button class="btn xs" data-id="'+id+'" onclick="openEditAsset(this.dataset.id)">Edit</button>';}
function lBtn(id){return '<button class="btn xs" data-id="'+id+'" onclick="openEditLiab(this.dataset.id)">Edit</button>';}
function dBtn(id){return '<button class="btn xs" data-id="'+id+'" onclick="deleteCPFTx(this.dataset.id)">Del</button>';}

function showToast(msg,dur=2500){const t=getEl('toast');t.textContent='✓ '+msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}

// ── API KEY MANAGEMENT ───────────────────────────────────────────────────────
function loadApiKeyDisplay() {
  const el = getEl('api-key-input');
  if (el && S.apiKey) el.value = S.apiKey;
}
function saveApiKey() {
  const k = (getEl('api-key-input').value || '').trim();
  S.apiKey = k; saveS();
  showToast(k ? 'API key saved' : 'API key cleared');
}
async function testApiKey() {
  const k = (getEl('api-key-input').value || '').trim();
  if (!k || !k.startsWith('sk-ant')) { showToast('Enter a valid API key first'); return; }
  S.apiKey = k; saveS();
  showToast('Testing... (takes ~5 seconds)', 6000);
  const p = await fetchPriceViaAI('AVGO', 'US');
  showToast(p ? 'Works! AVGO = $' + p.toFixed(2) : 'Failed — check your key is valid', 5000);
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function init(){
  applyTheme();renderProfileTabs();renderProfileSwitcher();renderSettingsAccounts();renderCatSettings();calcSummary();renderBudgets();
  rebuildMonthlyChart();
  try{renderNW();}catch(e){console.warn('renderNW:',e);}
  renderTxCurrencyCards();renderTxCurrencyTabs();
  filterTx();populateCatFilter();
  setCurrency('SGD',document.querySelector('.currency-tab[data-currency="SGD"]'));
  const self=(S.profiles||[]).find(p=>p.relation==='Self');
  const cpfInput=getEl('cpf-salary');
  if(cpfInput&&self&&self.salary)cpfInput.value=self.salary;
  const statusSel=getEl('cpf-status');
  if(statusSel&&self&&self.citizen)statusSel.value=self.citizen;
  try{calcCPF();}catch(e){}
  loadCPFRates().then(()=>calcCPF());
  try{applyCPFAutoCredit();}catch(e){console.warn('CPF:',e);}
  loadApiKeyDisplay();
  syncHideButtons();
  const tab=document.querySelector('.nav-tab[data-page="'+S.activePage+'"]');
  if(tab)showPage(S.activePage,tab);
  // Scroll-to-top button
  window.addEventListener('scroll',()=>{
    const btn=document.getElementById('scroll-top-btn');
    if(btn) btn.classList.toggle('visible',window.scrollY>300);
  });
  const stale=!S.pricesTs||(Date.now()-S.pricesTs>15*60*1000);
  if(stale&&S.assets.some(a=>a.type==='stock'||a.type==='etf'))fetchAllPrices();
}

// ── THEME ─────────────────────────────────────────────────────────────────────
function applyTheme(){
  const d=S.theme==='dark';
  document.documentElement.setAttribute('data-theme',d?'dark':'light');
  setEl('theme-btn',d?'☀':'🌙');
  const btn=getEl('theme-toggle-btn'),lbl=getEl('theme-label');
  if(btn)btn.className='toggle'+(d?' on':'');if(lbl)lbl.textContent=d?'On':'Off';
}
function toggleTheme(){S.theme=S.theme==='dark'?'light':'dark';saveS();applyTheme();rebuildMonthlyChart();rebuildNWChart();}

// ── PAGES ─────────────────────────────────────────────────────────────────────
function showPage(name,tab){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  getEl('page-'+name).classList.add('active');tab.classList.add('active');
  S.activePage=name;saveS();
  if(name==='monthly'){calcSummary();rebuildMonthlyChart();}
  if(name==='networth'){renderNW();rebuildNWChart();calcCPF();}
  if(name==='transactions'){filterTx();populateCatFilter();}
  if(name==='settings'){renderCatSettings();}
}

// ── MONTHLY ───────────────────────────────────────────────────────────────────
function calcSummary(){
  const inc=TRANSACTIONS.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const exp=TRANSACTIONS.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const net=inc-exp;const rate=inc>0?(net/inc*100).toFixed(1):0;
  setEl('m-income',hideVal('monthly','+$'+fmt(inc)));setEl('m-expense',hideVal('monthly','-$'+fmt(exp)));
  const ne=getEl('m-net');
  if(ne){ne.textContent=hideVal('monthly',(net>=0?'+':'-')+'$'+fmt(Math.abs(net)));ne.className='stat-value '+(net>=0?'net-pos':'net-neg');}
  setEl('m-rate',hideVal('monthly',rate+'%'));
  getEl('pnl-history').innerHTML=
    '<tr><td class="fw6">March 2026</td><td class="mono text-green">+$'+fmt(inc)+'</td><td class="mono text-red">-$'+fmt(exp)+'</td>'+
    '<td class="mono fw6 '+(net>=0?'text-green':'text-red')+'">'+(net>=0?'+':'-')+'$'+fmt(Math.abs(net))+'</td>'+
    '<td class="mono">'+rate+'%</td><td><span class="badge '+(net>=0?'badge-green':'badge-red')+'">'+(net>=0?'Surplus':'Deficit')+'</span></td></tr>'+
    '<tr style="opacity:.4"><td class="text-muted">February 2026</td><td colspan="5" class="text-muted">Upload Feb statement</td></tr>';
  buildCatBreakdown(exp);renderBudgets();renderPnLHistory();renderIncomeSources();
}
function buildCatBreakdown(total){
  const map={};TRANSACTIONS.filter(t=>t.type==='expense').forEach(t=>{map[t.category]=(map[t.category]||0)+t.amount;});
  getEl('cat-breakdown').innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
    const pct=total>0?(amt/total*100).toFixed(0):0,col=CAT_COLORS[cat]||'#94a3b8';
    const icon=(CAT_STYLE[cat]||{}).icon||'';
    return '<div class="cat-row">'+
      '<div class="cat-dot" style="background:'+col+'"></div>'+
      '<div class="cat-name">'+icon+' '+cat+'</div>'+
      '<div class="cat-bar-wrap"><div class="cat-bar" style="width:'+pct+'%;background:'+col+'"></div></div>'+
      '<div class="cat-amount">'+hideVal('monthly','$'+fmt(amt))+'</div>'+
    '</div>';
  }).join('');
}

// ── BUDGETS ───────────────────────────────────────────────────────────────────
function renderBudgets(){
  const map={};TRANSACTIONS.filter(t=>t.type==='expense').forEach(t=>{map[t.category]=(map[t.category]||0)+t.amount;});
  getEl('budget-grid').innerHTML=S.budgets.map((b,i)=>{
    const spent=map[b.category]||0,pct=Math.min(spent/b.limit*100,100).toFixed(0);
    const over=spent>b.limit,warn=!over&&pct>=80,rem=b.limit-spent;
    return '<div class="budget-card"><div class="budget-card-hdr"><div class="budget-name">'+b.category+'</div><button class="budget-edit-btn" data-i="'+i+'" onclick="openEditBudget(parseInt(this.dataset.i))">✎</button></div>'+
      '<div class="budget-amounts"><span class="budget-spent '+(over?'text-red':'text-green')+'">'+hideVal('monthly','$'+fmt(spent))+'</span><span class="budget-limit">'+hideVal('monthly','of $'+fmt(b.limit))+'</span></div>'+
      '<div class="budget-progress"><div class="budget-bar '+(over?'over':warn?'warn':'ok')+'" style="width:'+pct+'%"></div></div>'+
      '<div class="budget-footer"><span style="color:var(--text3)">'+hideVal('monthly',pct+'% used')+'</span><span style="color:'+(over?'var(--red)':warn?'var(--amber)':'var(--green)')+'">'+hideVal('monthly',(over?'Over $'+fmt(Math.abs(rem)):'$'+fmt(rem)+' left'))+'</span></div></div>';
  }).join('')+'<button class="add-dashed" onclick="openBudgetModal()">+ Add Budget</button>';
}
function openBudgetModal(){editBudgetIdx=null;getEl('bm-title').textContent='Add Budget';getEl('bm-del').style.display='none';getEl('bm-amount').value='';populateBudgetCats();getEl('budget-modal').classList.add('open');}
function openEditBudget(i){editBudgetIdx=i;const b=S.budgets[i];getEl('bm-title').textContent='Edit Budget';getEl('bm-del').style.display='block';getEl('bm-amount').value=b.limit;populateBudgetCats(b.category);getEl('budget-modal').classList.add('open');}
function populateBudgetCats(sel){getEl('bm-cat').innerHTML=S.categories.filter(c=>!['Internal Transfer','Salary','Claims','Gift Received'].includes(c)).map(c=>'<option'+(c===sel?' selected':'')+'>'+c+'</option>').join('');}
function closeBudgetModal(){getEl('budget-modal').classList.remove('open');}
function saveBudget(){const cat=getEl('bm-cat').value,limit=parseFloat(getEl('bm-amount').value);if(!cat||isNaN(limit)||limit<=0){showToast('Enter a valid amount');return;}if(editBudgetIdx!==null){S.budgets[editBudgetIdx]={category:cat,limit};}else{if(S.budgets.find(b=>b.category===cat)){showToast('Budget already exists');return;}S.budgets.push({category:cat,limit});}saveS();renderBudgets();closeBudgetModal();showToast(editBudgetIdx!==null?'Budget updated':'Budget added');}
function deleteBudget(){if(editBudgetIdx===null)return;S.budgets.splice(editBudgetIdx,1);saveS();renderBudgets();closeBudgetModal();showToast('Removed');}

// ── NET WORTH RENDER ──────────────────────────────────────────────────────────
function renderNW(){
  // BANK
  const banks=S.assets.filter(a=>a.type==='bank');
  const bankTotal=banks.reduce((s,a)=>s+assetVal(a),0);
  setEl('bank-subtotal',showAmt('bank','$'+fmt(bankTotal)));
  getEl('bank-body').innerHTML=banks.length?banks.map(a=>
    '<tr><td class="fw6">'+a.name+'</td>'+
    '<td style="color:var(--text3);font-size:13px">'+a.owner+'</td>'+
    '<td style="text-align:right">'+(sectionHidden('bank')?showAmt('bank','$'+fmt(a.value)):inlineVal('bank',a.id,'value',a.value,'$'+fmt(a.value)))+'</td>'+
    '<td>'+(a.locked?'<span class="text-muted" style="font-size:11px">From stmt</span>':eBtn(a.id))+'</td></tr>'
  ).join(''):'<tr><td colspan="4"><div class="empty-state">No bank accounts added</div></td></tr>';

  // INVESTMENTS — VALUE CALCULATED FROM SHARES x PRICE
  const invests=S.assets.filter(a=>a.type==='stock'||a.type==='etf');
  const investTotal=invests.reduce((s,a)=>s+assetVal(a),0);
  setEl('invest-subtotal',showAmt('invest','$'+fmt(investTotal)));
  setEl('fx-rate',fmt(parseFloat(S.usdSgd)||1.34,4));
  getEl('invest-body').innerHTML=invests.length?invests.map(a=>{
    const shares=parseFloat(a.shares)||0;
    const price=parseFloat(a.currentPrice)||0;
    const cost=parseFloat(a.cost)||0;
    const fxRate=parseFloat(S.usdSgd)||1.34;
    const valUSD=shares*price;
    const valSGD=a.market==='US'?valUSD*fxRate:valUSD;
    const costSGD=a.market==='US'?shares*cost*fxRate:shares*cost;
    const gain=valSGD-costSGD;
    const pct=costSGD>0?(gain/costSGD*100).toFixed(1):0;
    const priceDisp=sectionHidden('invest')?showAmt('invest','$'+price.toFixed(2)):(price>0?'$'+price.toFixed(2):'<span class="price-pending">Fetch needed</span>');
    const valDisp=sectionHidden('invest')?showAmt('invest','$'+fmt(valSGD)):(valSGD>0?'$'+fmt(valSGD):'<span class="text-muted">—</span>');
    const plDisp=sectionHidden('invest')?showAmt('invest','$'+fmt(Math.abs(gain))):shares>0&&price>0&&cost>0?'<span class="mono fw6 '+(gain>=0?'text-green':'text-red')+'">'+(gain>=0?'+':'-')+'$'+fmt(Math.abs(gain))+' ('+(gain>=0?'+':'')+pct+'%)</span>':'<span class="text-muted">—</span>';
    return '<tr>'+
      '<td><div class="fw7">'+a.name+'</div><div style="font-size:12px;color:var(--text3)">'+a.ticker+'</div></td>'+
      '<td><span class="badge '+(a.type==='etf'?'badge-purple':'badge-green')+'">'+(a.type==='etf'?'ETF':'Stock')+'</span></td>'+
      '<td>'+(sectionHidden('invest')?showAmt('invest',shares||'0'):inlineVal('invest',a.id,'shares',shares,shares||'0'))+'</td>'+
      '<td>'+(sectionHidden('invest')?showAmt('invest',cost?'$'+cost.toFixed(2):'—'):inlineVal('invest',a.id,'cost',cost,cost?'$'+cost.toFixed(2):'—'))+'</td>'+
      '<td class="mono" style="font-size:13px">'+priceDisp+'<div class="price-tag">'+a.market+' · live</div></td>'+
      '<td class="mono fw6 text-green" style="text-align:right">'+valDisp+'</td>'+
      '<td>'+plDisp+'</td>'+
      '<td>'+eBtn(a.id)+'</td></tr>';
  }).join(''):'<tr><td colspan="8"><div class="empty-state">No investments added</div></td></tr>';

  // CPF
  const cpfs=S.assets.filter(a=>a.type==='cpf');
  const cpfTotal=cpfs.reduce((s,a)=>s+assetVal(a),0);
  setEl('cpf-subtotal',showAmt('cpf','$'+fmt(cpfTotal)));
  getEl('cpf-body').innerHTML=cpfs.length?cpfs.map(a=>{
    const total=(parseFloat(a.cpfOA)||0)+(parseFloat(a.cpfSA)||0)+(parseFloat(a.cpfMA)||0);
    return '<tr>'+
      '<td class="fw6">'+a.owner+'</td>'+
      '<td style="text-align:right">'+(sectionHidden('cpf')?showAmt('cpf','$'+fmt(a.cpfOA||0)):inlineVal('cpf',a.id,'cpfOA',a.cpfOA,'$'+fmt(a.cpfOA||0),'text-accent'))+'</td>'+
      '<td style="text-align:right">'+(sectionHidden('cpf')?showAmt('cpf','$'+fmt(a.cpfSA||0)):inlineVal('cpf',a.id,'cpfSA',a.cpfSA,'$'+fmt(a.cpfSA||0),''))+'</td>'+
      '<td style="text-align:right">'+(sectionHidden('cpf')?showAmt('cpf','$'+fmt(a.cpfMA||0)):inlineVal('cpf',a.id,'cpfMA',a.cpfMA,'$'+fmt(a.cpfMA||0),''))+'</td>'+
      '<td class="mono fw6 text-green" style="text-align:right">'+showAmt('cpf','$'+fmt(total))+'</td>'+
      '<td>'+eBtn(a.id)+'</td></tr>';
  }).join(''):'<tr><td colspan="6"><div class="empty-state">No CPF added</div></td></tr>';

  // PROPERTY & OTHER — with include/exclude toggle per row
  const others=S.assets.filter(a=>a.type==='property'||a.type==='other');
  const otherTotalForDisplay=others.reduce((s,a)=>{const raw=parseFloat(a.value)||0;const share=a.myShare!=null?parseFloat(a.myShare):1;return s+(isNaN(raw*share)?0:raw*share);},0);
  const otherTotalInNW=others.reduce((s,a)=>s+assetVal(a),0);
  setEl('other-subtotal',showAmt('other','$'+fmt(otherTotalForDisplay)));
  const typeLabels={property:'Property',srs:'SRS',gold:'Gold',insurance:'Insurance CV',other:'Other'};
  const typeCls={property:'badge-teal',srs:'badge-amber',gold:'badge-amber',insurance:'badge-blue',other:''};
  getEl('other-body').innerHTML=others.length?others.map(a=>{
    const sub=a.subtype||a.type;
    const raw=parseFloat(a.value)||0;const share=a.myShare!=null?parseFloat(a.myShare):1;const myVal=raw*share;
    const inc=!!a.includeInNW;
    const valDisp=raw>0?'$'+fmt(raw):'<span class="text-muted">Not set</span>';
    const shareDisp=raw>0?'$'+fmt(myVal)+(share<1?' ('+(share*100).toFixed(0)+'%)':''):'—';
    return '<tr>'+
      '<td><div class="fw7">'+a.name+'</div><div style="font-size:12px;color:var(--text3)">'+a.desc+'</div></td>'+
      '<td><span class="badge '+(typeCls[sub]||'')+'">'+typeLabels[sub]+'</span></td>'+
      '<td style="color:var(--text3);font-size:13px">'+a.owner+'</td>'+
      '<td style="font-size:12px;color:var(--text3)">'+a.notes+'</td>'+
      '<td style="text-align:right">'+(sectionHidden('other')?showAmt('other',valDisp):inlineVal('other',a.id,'value',raw,valDisp))+'</td>'+
      '<td class="mono fw6 '+(inc?'text-green':'text-muted')+'" style="text-align:right">'+showAmt('other',shareDisp)+'</td>'+
      '<td style="text-align:center"><button class="toggle-sm'+(inc?' on':'')+'" data-id="'+a.id+'" onclick="togglePropertyNW(this)" title="'+(inc?'Included in NW':'Excluded from NW')+'"></button><div style="font-size:10px;margin-top:4px;color:var(--text3)">'+(inc?'Included':'Excluded')+'</div></td>'+
      '<td>'+eBtn(a.id)+'</td></tr>';
  }).join(''):'<tr><td colspan="8"><div class="empty-state">No property or other assets</div></td></tr>';

  // LIABILITIES
  const debitDisp=v=>({'cpf-oa':'CPF OA','cpf-sa':'CPF SA','cpf-ma':'CPF MA','bank-dbs':'DBS','bank-uob':'UOB','bank-ocbc':'OCBC'}[v]||v||'—');
  const liabTotal=S.liabilities.reduce((s,l)=>s+(parseFloat(l.amount)||0),0);
  setEl('liab-total',showAmt('liab','$'+fmt(liabTotal)));
  getEl('liab-body').innerHTML=S.liabilities.length?S.liabilities.map(l=>{
    const hasShare=l.myShare!=null&&l.myShare<1;
    const amtDisp=hasShare&&l.fullAmount?
      '<div class="mono fw6 text-red">$'+fmt(l.amount)+'</div><div style="font-size:11px;color:var(--text3)">'+(l.myShare*100).toFixed(0)+'% of $'+fmt(l.fullAmount)+'</div>':
      inlineVal('liab',l.id,'amount',l.amount,'$'+fmt(l.amount),'text-red');
    const debitBadge=l.debit?'<span class="badge badge-blue" style="font-size:10px">'+debitDisp(l.debit)+'</span>':'';
    return '<tr>'+
      '<td><div class="fw6">'+l.name+'</div><div style="margin-top:3px">'+debitBadge+'</div></td>'+
      '<td><span class="badge badge-red">'+l.type+'</span></td>'+
      '<td style="font-size:13px;color:var(--text3)">'+l.owner+'</td>'+
      '<td style="font-size:12px;color:var(--text3)">'+debitDisp(l.debit)+'</td>'+
      '<td style="font-size:13px;color:var(--text3)">'+l.freq+'</td>'+
      '<td style="text-align:right">'+(sectionHidden('liab')?showAmt('liab','$'+fmt(l.amount)):amtDisp)+'</td>'+
      '<td style="font-size:12px;color:var(--text3)">'+l.notes+'</td>'+
      '<td>'+lBtn(l.id)+'</td></tr>';
  }).join(''):'<tr><td colspan="8"><div class="empty-state">No liabilities</div></td></tr>';

  updateNWTotals();
  renderCPFLog();
  syncCPFToggleUI();
  syncSectionControls();
  renderPeerComparison();
}

function togglePropertyNW(btn){
  const id=btn.dataset.id;
  const a=S.assets.find(x=>x.id===id);if(!a)return;
  a.includeInNW=!a.includeInNW;saveS();
  btn.classList.toggle('on',a.includeInNW);
  const label=btn.nextElementSibling;if(label)label.textContent=a.includeInNW?'Included':'Excluded';
  updateNWTotals();rebuildNWChart();showToast(a.includeInNW?'Added to net worth':'Removed from net worth');
}

// ── NW TOTALS ─────────────────────────────────────────────────────────────────
function updateNWTotals(){
  const bankAssets=sectionIncluded('bank')?S.assets.filter(a=>a.type==='bank').reduce((s,a)=>s+(parseFloat(a.value)||0),0):0;
  const investAssets=sectionIncluded('invest')?S.assets.filter(a=>a.type==='stock'||a.type==='etf').reduce((s,a)=>s+assetVal(a),0):0;
  const cpfAssets=sectionIncluded('cpf')&&S.includeCPFinNW?S.assets.filter(a=>a.type==='cpf').reduce((s,a)=>s+(parseFloat(a.cpfOA)||0)+(parseFloat(a.cpfSA)||0)+(parseFloat(a.cpfMA)||0),0):0;
  const otherAssets=sectionIncluded('other')?S.assets.filter(a=>a.type==='property'||a.type==='other').reduce((s,a)=>s+assetVal(a),0):0;
  const totalAssets=bankAssets+investAssets+cpfAssets+otherAssets;
  const totalLiab=sectionIncluded('liab')?S.liabilities.reduce((s,l)=>s+(parseFloat(l.amount)||0),0):0;
  const nw=totalAssets-totalLiab;
  setEl('assets-total'&&'nw-val',(a=>a)(''));
  setEl('nw-val',hideVal('networth',(nw>=0?'+':'-')+'$'+fmt(Math.abs(nw))));
  setEl('nw-sub',hideVal('networth','Assets: $'+fmtN(totalAssets)+' · Liabilities: $'+fmtN(totalLiab)+' · March 2026'));
  const liquid=S.assets.filter(a=>a.type==='bank').reduce((s,a)=>s+assetVal(a),0);
  setEl('compare-liquid','$'+fmtN(liquid));
  const barEl=getEl('compare-liquid-bar');if(barEl)barEl.style.width=Math.min(liquid/30000*100,100).toFixed(0)+'%';
  const hdbL=S.liabilities.find(l=>l.id==='hdb-loan');
  const noteEl=getEl('hdb-note');
  if(hdbL&&noteEl){
    const rem=parseFloat(hdbL.fullAmount)||342589.47;
    const mLeft=rem>0?Math.ceil(rem/820.15):0;
    const yrs=Math.floor(mLeft/12),mths=mLeft%12;
    noteEl.textContent='Estimated outstanding: $'+fmt(rem)+'. At $820.15/mth repayment, approx. '+(yrs>0?yrs+'y ':'')+mths+'m remaining.';
  }
}

// ── CPF AUTO-CREDIT ───────────────────────────────────────────────────────────
function applyCPFAutoCredit(){
  const now=new Date();const year=now.getFullYear(),month=now.getMonth();
  const key='cpf_'+year+'_'+month;if(S[key]||now.getDate()<10)return;
  const jason=S.profiles.find(p=>p.id==='jason'||p.relation==='Self');
  const gross=parseFloat(jason?.salary)||0;if(gross<=0)return;
  const capped=Math.min(gross,8000);
  const emp=Math.floor(capped*0.20),er=Math.floor(capped*0.17),total=emp+er;
  const oa=Math.floor(total*23/37),sa=Math.floor(total*6/37),ma=total-oa-sa;
  const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month];
  const dateStr='10 '+mn+' '+year;
  let cpfA=S.assets.find(a=>a.type==='cpf');
  if(!cpfA){cpfA={id:'cpf_jason',type:'cpf',name:'Jason CPF',owner:'Jason',cpfOA:0,cpfSA:0,cpfMA:0};S.assets.push(cpfA);}
  cpfA.cpfOA=(parseFloat(cpfA.cpfOA)||0)+oa;
  cpfA.cpfSA=(parseFloat(cpfA.cpfSA)||0)+sa;
  cpfA.cpfMA=(parseFloat(cpfA.cpfMA)||0)+ma;
  cpfA.cpfOA=Math.max(0,(parseFloat(cpfA.cpfOA)||0)-820.15);
  const hdbL=S.liabilities.find(l=>l.id==='hdb-loan');
  if(hdbL){const cf=parseFloat(hdbL.fullAmount)||342589.47;const nf=Math.max(0,cf-820.15);hdbL.fullAmount=parseFloat(nf.toFixed(2));hdbL.amount=parseFloat((nf*0.5).toFixed(2));hdbL.notes='Full $'+nf.toFixed(2)+' - Jason 50%: $'+hdbL.amount.toFixed(2);}
  S.cpfTransactions.push(
    {id:'emp_'+year+'_'+month,date:dateStr,desc:'CPF Employee Contribution ('+mn+' '+year+')',amount:emp,account:'CPF',type:'credit',detail:'OA +$'+oa+' SA +$'+sa+' MA +$'+ma,editable:true},
    {id:'er_'+year+'_'+month,date:dateStr,desc:'CPF Employer Contribution ('+mn+' '+year+')',amount:er,account:'CPF',type:'credit',detail:'Employer share',editable:true},
    {id:'hdb_'+year+'_'+month,date:dateStr,desc:'HDB Instalment ('+mn+' '+year+')',amount:820.15,account:'CPF OA',type:'debit',detail:'Deducted from CPF OA',editable:true},
    {id:'loan_'+year+'_'+month,date:dateStr,desc:'HDB Loan Reduced ('+mn+' '+year+')',amount:820.15,account:'HDB Loan',type:'debit',detail:'New outstanding: $'+(hdbL?hdbL.fullAmount.toFixed(2):'—'),editable:false}
  );
  S[key]=true;saveS();
}
function toggleCPFinNW(){
  S.includeCPFinNW=!S.includeCPFinNW;saveS();
  S.sectionPrefs.cpf.include=!!S.includeCPFinNW;
  const btn=getEl('cpf-nw-toggle'),lbl=getEl('cpf-nw-label');
  if(btn) btn.classList.toggle('on',S.includeCPFinNW);
  if(lbl) lbl.textContent=S.includeCPFinNW?'Included':'Excluded';
  updateNWTotals();rebuildNWChart();
  syncSectionControls();
  showToast('CPF '+(S.includeCPFinNW?'included in':'excluded from')+' net worth');
}
function syncCPFToggleUI(){
  const btn=getEl('cpf-nw-toggle'),lbl=getEl('cpf-nw-label');
  if(btn) btn.classList.toggle('on',!!S.includeCPFinNW);
  if(lbl) lbl.textContent=S.includeCPFinNW?'Included':'Excluded';
}
function renderCPFLog(){
  const el=getEl('cpf-tx-log');if(!el)return;
  const log=S.cpfTransactions||[];
  if(!log.length){el.innerHTML='<div class="empty-state">Auto-credited on 10th each month</div>';return;}
  el.innerHTML='<table class="tbl"><thead><tr><th>Date</th><th>Description</th><th>Details</th><th>Account</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody>'+
    [...log].reverse().map(t=>'<tr>'+
      '<td class="mono text-muted" style="font-size:12px">'+t.date+'</td>'+
      '<td class="fw6">'+t.desc+'</td>'+
      '<td style="font-size:12px;color:var(--text3)">'+t.detail+'</td>'+
      '<td><span class="badge badge-amber">'+t.account+'</span></td>'+
      '<td class="mono fw6 '+(t.type==='credit'?'text-green':'text-red')+'" style="text-align:right">'+(t.type==='credit'?'+':'-')+'$'+fmt(t.amount)+'</td>'+
      '<td>'+(t.editable?dBtn(t.id):'—')+'</td></tr>'
    ).join('')+'</tbody></table>';
}
function deleteCPFTx(id){if(!confirm('Delete this CPF transaction?'))return;S.cpfTransactions=S.cpfTransactions.filter(t=>t.id!==id);saveS();renderCPFLog();showToast('Deleted');}

// ── STOCK PRICES via Anthropic API ────────────────────────────────────────────
// Uses Claude with web_search to get current prices — bypasses CORS completely
async function fetchPriceViaAI(ticker,market){
  if(!S.apiKey||!S.apiKey.startsWith('sk-ant')){return null;}
  try{
    const sym=market==='SG'?ticker+'.SI':ticker;
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':S.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:256,
        tools:[{type:'web_search_20250305',name:'web_search'}],
        messages:[{role:'user',content:'What is the current stock price of '+sym+' right now? Reply with ONLY the number, no dollar sign, no text. Example: 185.42'}]
      })
    });
    if(!resp.ok){console.warn('API error:',resp.status);return null;}
    const data=await resp.json();
    // Extract price from response
    const textBlock=data.content?.find(b=>b.type==='text');
    if(textBlock){
      const match=textBlock.text.match(/[\\d,]+\\.?\\d*/);
      if(match){const p=parseFloat(match[0].replace(/,/g,''));if(p>0&&p<100000)return p;}
    }
    return null;
  }catch(e){console.warn('AI price fetch failed:',e.message);return null;}
}

// ── STOCK PRICE FETCHING ─────────────────────────────────────────────────────
// Primary: Anthropic API with web_search (requires API key in Settings)
// Fallback: Yahoo Finance via CORS proxy

async function fetchPriceViaAI(ticker, market) {
  if (!S.apiKey || !S.apiKey.startsWith('sk-ant')) return null;
  const sym = market === 'SG' ? ticker + '.SI' : ticker;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': S.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: 'What is the current stock price of ' + sym + '? Reply with ONLY the number. No dollar sign, no text, no explanation. Just digits and decimal point. Example: 185.42'
        }]
      })
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.warn('AI price API error', resp.status, err.slice(0, 200));
      return null;
    }
    const data = await resp.json();
    // Find the final text block (comes after web_search_tool_result blocks)
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    if (!textBlocks.length) return null;
    const lastText = textBlocks[textBlocks.length - 1].text;
    // Extract first clean number from response
    const match = lastText.match(/\\d[\\d,]*\\.?\\d*/);
    if (match) {
      const price = parseFloat(match[0].replace(/,/g, ''));
      if (price > 0 && price < 1000000) return price;
    }
    return null;
  } catch (e) {
    console.warn('AI fetch error:', e.message);
    return null;
  }
}

async function fetchPriceYahoo(sym) {
  const base = 'https://query1.finance.yahoo.com/v8/finance/chart/' + sym + '?interval=1d&range=1d';
  const urls = [
    'https://corsproxy.io/?url=' + encodeURIComponent(base),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(base),
    base
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      const p = d?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (p && p > 0) return parseFloat(p);
    } catch (e) { continue; }
  }
  return null;
}

async function fetchPrice(ticker, market) {
  const sym = market === 'SG' ? ticker + '.SI' : ticker;
  // 1. Try AI (most reliable - searches the web)
  const ai = await fetchPriceViaAI(ticker, market);
  if (ai) return ai;
  // 2. Fallback: Yahoo via proxy
  return await fetchPriceYahoo(sym);
}

async function fetchAllPrices() {
  const btn = getEl('refresh-btn');
  btn.disabled = true; btn.textContent = 'Fetching...';
  setEl('last-upd', 'Updating...');

  const stocks = S.assets.filter(a => a.type === 'stock' || a.type === 'etf');
  if (!stocks.length) {
    setEl('last-upd', 'No stocks added');
    btn.disabled = false; btn.textContent = '↻ Refresh Prices';
    return;
  }

  if (!S.apiKey || !S.apiKey.startsWith('sk-ant')) {
    setEl('last-upd', 'No API key — see Settings tab');
    showToast('Go to Settings → Stock Price API and paste your Anthropic key', 5000);
    btn.disabled = false; btn.textContent = '↻ Refresh Prices';
    return;
  }

  let ok = 0, fail = [];
  // Fetch FX rate first
  try {
    const fxResp = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':S.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:128,tools:[{type:'web_search_20250305',name:'web_search'}],messages:[{role:'user',content:'Current USD to SGD exchange rate today. Reply with ONLY the number like: 1.3456'}]})});
    const fxData = fxResp.ok ? await fxResp.json() : null;
    const fxTextBlock = fxData?.content?.filter(b=>b.type==='text').pop();
    const fxMatch = fxTextBlock?.text?.match(/1\\.\\d+/);
    const fx = fxMatch ? parseFloat(fxMatch[0]) : null;
    if (fx && fx > 1 && fx < 2) { S.usdSgd = fx; setEl('fx-rate', fx.toFixed(4)); }
  } catch (e) {}

  for (const a of stocks) {
    setEl('last-upd', 'Fetching ' + a.ticker + '...');
    const p = await fetchPrice(a.ticker, a.market);
    if (p) { a.currentPrice = p; ok++; }
    else fail.push(a.ticker);
  }

  S.pricesTs = Date.now(); saveS(); renderNW(); rebuildNWChart();
  setEl('last-upd', 'Updated ' + new Date().toLocaleTimeString('en-SG'));
  if (fail.length) showToast(ok + ' updated · Failed: ' + fail.join(', '), 4000);
  else showToast('All ' + ok + ' prices updated ✓');
  btn.disabled = false; btn.textContent = '↻ Refresh Prices';
}

// ── ASSET MODAL ───────────────────────────────────────────────────────────────
const ASSET_CFG={
  bank:{title:'Add Bank / Cash Account',desc:'Any bank account, savings, or cash.',fields:['f-bank'],hint:'e.g. UOB Stash Account'},
  invest:{title:'Add Investment',desc:'Stock or ETF. Prices via API in Settings.',fields:['f-stock'],hint:'e.g. Broadcom Inc'},
  cpf:{title:'Add CPF Account',desc:'Enter current CPF balances. Auto-updated on 10th.',fields:['f-cpf'],hint:'e.g. Jason CPF'},
  other:{title:'Add Property or Other',desc:'Property, SRS, gold, or anything else.',fields:['f-other'],hint:'e.g. 301D Punggol Place'},
};
function openAssetModal(section){
  editAssetId=null;currentAssetType=section==='invest'?'stock':section;
  const cfg=ASSET_CFG[section||'bank'];
  getEl('am-title').textContent=cfg.title;getEl('am-desc').textContent=cfg.desc;
  getEl('am-name').placeholder=cfg.hint;getEl('am-del').style.display='none';
  ['am-name','am-ticker','am-shares','am-cost','am-bank-bal','am-cpf-oa','am-cpf-sa','am-cpf-ma','am-other-val','am-other-desc','am-manual-price'].forEach(id=>{const e=getEl(id);if(e)e.value='';});
  getEl('am-other-share').value='100';
  const incTog=getEl('am-include-toggle');if(incTog)incTog.classList.add('on');
  ['f-bank','f-stock','f-cpf','f-other'].forEach(id=>{const e=getEl(id);if(e)e.style.display='none';});
  if(cfg.fields)cfg.fields.forEach(id=>{const e=getEl(id);if(e)e.style.display='block';});
  populateOwnerSelect('am-owner');
  getEl('asset-modal').classList.add('open');
}
function openEditAsset(id){
  const a=S.assets.find(x=>x.id===id);if(!a)return;
  editAssetId=id;currentAssetType=a.type;
  const secMap={bank:'bank',stock:'invest',etf:'invest',cpf:'cpf',property:'other',other:'other'};
  const section=secMap[a.type]||'bank';
  const cfg=ASSET_CFG[section];
  getEl('am-title').textContent='Edit '+(cfg?cfg.title.replace('Add ',''):'Asset');
  getEl('am-desc').textContent=cfg?cfg.desc:'';
  getEl('am-del').style.display='block';
  ['f-bank','f-stock','f-cpf','f-other'].forEach(id=>{const e=getEl(id);if(e)e.style.display='none';});
  if(cfg)cfg.fields.forEach(id=>{const e=getEl(id);if(e)e.style.display='block';});
  getEl('am-name').value=a.name||'';
  populateOwnerSelect('am-owner',a.owner);
  if(a.type==='bank'){getEl('am-bank-bal').value=a.value||'';}
  if(a.type==='stock'||a.type==='etf'){
    getEl('am-ticker').value=a.ticker||'';getEl('am-market').value=a.market||'US';
    getEl('am-shares').value=a.shares||'';getEl('am-cost').value=a.cost||'';
    // Show current price in manual override field
    const mp=getEl('am-manual-price');if(mp)mp.value=a.currentPrice!=null?a.currentPrice:'';
  }
  if(a.type==='cpf'){getEl('am-cpf-oa').value=a.cpfOA||'';getEl('am-cpf-sa').value=a.cpfSA||'';getEl('am-cpf-ma').value=a.cpfMA||'';}
  if(a.type==='property'||a.type==='other'){
    getEl('am-other-val').value=a.value||'';getEl('am-other-desc').value=a.desc||'';
    getEl('am-other-type').value=a.subtype||a.type;
    getEl('am-other-share').value=a.myShare?Math.round(a.myShare*100):100;
    const incTog=getEl('am-include-toggle');if(incTog)incTog.classList.toggle('on',!!a.includeInNW);
  }
  getEl('asset-modal').classList.add('open');
}
function closeAssetModal(){getEl('asset-modal').classList.remove('open');}
async function saveAsset(){
  if(!currentAssetType){showToast('Choose an asset type');return;}
  const name=getEl('am-name').value.trim();
  const owner=getEl('am-owner').value;
  if(!name){showToast('Enter a name');return;}
  const id=editAssetId||'asset_'+Date.now();
  let entry={id,type:currentAssetType,name,owner};
  if(currentAssetType==='bank'){
    entry.value=parseFloat(getEl('am-bank-bal').value)||0;
  }else if(currentAssetType==='stock'||currentAssetType==='etf'){
    const ticker=(getEl('am-ticker').value||'').toUpperCase().trim();
    if(!ticker){showToast('Enter a ticker symbol');return;}
    entry.ticker=ticker;entry.market=getEl('am-market').value;
    entry.shares=parseFloat(getEl('am-shares').value)||0;
    entry.cost=parseFloat(getEl('am-cost').value)||0;
    // Manual price: if field has a value use it, if blank clear the price (allow removing)
    const mpRaw=getEl('am-manual-price').value.trim();
    if(mpRaw!==''){
      const mp=parseFloat(mpRaw);
      entry.currentPrice=mp>0?mp:null;  // blank or 0 = clear price
    }else if(editAssetId){
      // Editing but left blank = keep existing price
      const old=S.assets.find(a=>a.id===editAssetId);
      entry.currentPrice=old?.currentPrice??null;
    }else{
      entry.currentPrice=null;// New asset, will fetch
    }
  }else if(currentAssetType==='cpf'){
    entry.cpfOA=parseFloat(getEl('am-cpf-oa').value)||0;
    entry.cpfSA=parseFloat(getEl('am-cpf-sa').value)||0;
    entry.cpfMA=parseFloat(getEl('am-cpf-ma').value)||0;
  }else{
    entry.value=parseFloat(getEl('am-other-val').value)||0;
    entry.desc=getEl('am-other-desc').value||'';
    const sub=getEl('am-other-type').value;
    entry.subtype=sub;entry.type=sub==='property'?'property':'other';
    const sh=parseFloat(getEl('am-other-share').value)||100;
    if(sh<100)entry.myShare=sh/100;
    entry.includeInNW=!!getEl('am-include-toggle').classList.contains('on');
    entry.notes=entry.desc;
  }
  if(editAssetId){const idx=S.assets.findIndex(a=>a.id===editAssetId);if(idx>-1)S.assets[idx]=entry;}
  else S.assets.push(entry);
  saveS();closeAssetModal();renderNW();rebuildNWChart();showToast('Saved');
  // Auto-fetch price for stocks/ETFs
  if((currentAssetType==='stock'||currentAssetType==='etf')&&entry.ticker){
    // Always fetch if: new stock, OR manual price was explicitly cleared
    const shouldFetch = entry.currentPrice==null;
    if(shouldFetch){
      if(!S.apiKey||!S.apiKey.startsWith('sk-ant')){
        setEl('last-upd','Add API key in Settings to fetch prices');
        showToast('Add Anthropic API key in Settings to get live prices',4000);
      } else {
        setEl('last-upd','Fetching '+entry.ticker+'...');
        const p=await fetchPrice(entry.ticker,entry.market);
        if(p){
          const idx=S.assets.findIndex(a=>a.id===id);
          if(idx>-1){
            S.assets[idx].currentPrice=p;
            S.pricesTs=Date.now();
            saveS();renderNW();rebuildNWChart();
            setEl('last-upd','Updated '+new Date().toLocaleTimeString('en-SG'));
            showToast(entry.ticker+' → $'+p.toFixed(2));
          }
        } else {
          setEl('last-upd','Price fetch failed for '+entry.ticker);
          showToast('Could not fetch '+entry.ticker+' price — try Refresh Prices button',4000);
        }
      }
    }
  }
}
function deleteAsset(){if(!editAssetId)return;S.assets=S.assets.filter(a=>a.id!==editAssetId);saveS();closeAssetModal();renderNW();rebuildNWChart();showToast('Removed');}

// ── LIABILITY MODAL ───────────────────────────────────────────────────────────
function openLiabModal(id){
  editLiabId=id;
  if(id){
    const l=S.liabilities.find(x=>x.id===id);if(!l)return;
    getEl('lm-title').textContent='Edit Liability';getEl('lm-del').style.display='block';
    getEl('lm-name').value=l.name;getEl('lm-amount').value=l.amount;
    getEl('lm-type').value=l.type;getEl('lm-freq').value=l.freq;
    getEl('lm-notes').value=l.notes||'';getEl('lm-debit').value=l.debit||'';
    getEl('lm-share').value=l.myShare?Math.round(l.myShare*100):100;
    getEl('lm-full').value=l.fullAmount||'';
    populateOwnerSelect('lm-owner',l.owner);
  }else{
    getEl('lm-title').textContent='Add Liability';getEl('lm-del').style.display='none';
    ['lm-name','lm-amount','lm-notes','lm-full'].forEach(id=>getEl(id).value='');
    getEl('lm-share').value='100';populateOwnerSelect('lm-owner');
  }
  getEl('liab-modal').classList.add('open');
}
function openEditLiab(id){openLiabModal(id);}
function closeLiabModal(){getEl('liab-modal').classList.remove('open');}
function saveLiab(){
  const name=getEl('lm-name').value.trim(),amount=parseFloat(getEl('lm-amount').value);
  if(!name||isNaN(amount)){showToast('Fill in name and amount');return;}
  const id=editLiabId||'liab_'+Date.now();
  const share=parseFloat(getEl('lm-share').value)||100;
  const fullAmt=parseFloat(getEl('lm-full').value)||null;
  const entry={id,name,amount,type:getEl('lm-type').value,freq:getEl('lm-freq').value,owner:getEl('lm-owner').value,notes:getEl('lm-notes').value.trim(),debit:getEl('lm-debit').value};
  if(share<100){entry.myShare=share/100;entry.fullAmount=fullAmt||amount/entry.myShare;}
  if(editLiabId){const idx=S.liabilities.findIndex(l=>l.id===editLiabId);if(idx>-1)S.liabilities[idx]=entry;}else S.liabilities.push(entry);
  saveS();closeLiabModal();renderNW();showToast('Saved');
}
function deleteLiab(){if(!editLiabId)return;S.liabilities=S.liabilities.filter(l=>l.id!==editLiabId);saveS();closeLiabModal();renderNW();showToast('Removed');}

// ── PEER COMPARISON ──────────────────────────────────────────────────────────
// Cached peer data in state - refreshed via AI web search when requested
const DEFAULT_CPF_RATE_BANDS=[
  {status:'sc',minAge:0,maxAge:35,employeeRate:0.20,employerRate:0.17,oaRate:0.23,saRate:0.06,maRate:0.08},
  {status:'sc',minAge:36,maxAge:45,employeeRate:0.20,employerRate:0.17,oaRate:0.21,saRate:0.07,maRate:0.09},
  {status:'sc',minAge:46,maxAge:50,employeeRate:0.20,employerRate:0.17,oaRate:0.19,saRate:0.08,maRate:0.10},
  {status:'sc',minAge:51,maxAge:55,employeeRate:0.20,employerRate:0.17,oaRate:0.15,saRate:0.115,maRate:0.105},
  {status:'sc',minAge:56,maxAge:60,employeeRate:0.17,employerRate:0.155,oaRate:0.12,saRate:0.095,maRate:0.11},
  {status:'sc',minAge:61,maxAge:65,employeeRate:0.13,employerRate:0.12,oaRate:0.035,saRate:0.075,maRate:0.14},
  {status:'sc',minAge:66,maxAge:70,employeeRate:0.075,employerRate:0.09,oaRate:0.01,saRate:0.025,maRate:0.13},
  {status:'sc',minAge:71,maxAge:200,employeeRate:0.05,employerRate:0.075,oaRate:0.01,saRate:0.01,maRate:0.105},
];
let CPF_RATE_BANDS=[...DEFAULT_CPF_RATE_BANDS];
const selfProfile=()=>S.profiles.find(p=>p.relation==='Self');
function calcAge(){
  const self=selfProfile();
  if(!self||!self.dob)return null;
  const dob=new Date(self.dob),now=new Date();
  if(Number.isNaN(dob.getTime()))return null;
  return now.getFullYear()-dob.getFullYear()-(now<new Date(now.getFullYear(),dob.getMonth(),dob.getDate())?1:0);
}
function setCPFSubtitle(age,status){
  const el=getEl('cpf-age-subtitle');if(!el)return;
  const self=selfProfile();
  if(!self||!self.dob||age===null){
    el.textContent='Add your date of birth in Settings → Family Profiles to personalize age-based CPF rates.';
    return;
  }
  const born=new Date(self.dob);
  const bornTxt=born.toLocaleDateString('en-SG',{month:'short',year:'numeric'});
  el.textContent='Born '+bornTxt+' · Age '+age+' · '+(status==='pr'?'PR':'Singapore Citizen')+' CPF rates';
}
function toPct(v){const n=parseFloat(v)||0;return n>1?n/100:n;}
function findCPFBand(age,status){
  const st=status==='pr'?'sc':status;
  return CPF_RATE_BANDS.find(r=>r.status===st&&age>=r.minAge&&age<=r.maxAge)||DEFAULT_CPF_RATE_BANDS[0];
}
async function loadCPFRates(){
  try{
    const res=await fetch('/api/cpf-rates');
    if(!res.ok)return;
    const d=await res.json();
    if(Array.isArray(d.rates)&&d.rates.length){
      CPF_RATE_BANDS=d.rates.map(r=>({
        status:r.status||'sc',
        minAge:parseInt(r.minAge??r.min_age??0),
        maxAge:parseInt(r.maxAge??r.max_age??200),
        employeeRate:toPct(r.employeeRate??r.employee_rate),
        employerRate:toPct(r.employerRate??r.employer_rate),
        oaRate:toPct(r.oaRate??r.oa_rate),
        saRate:toPct(r.saRate??r.sa_rate),
        maRate:toPct(r.maRate??r.ma_rate),
      }));
    }
  }catch(e){}
}

function renderPeerComparison(){
  const age=calcAge();
  const ageForBench=age===null?33:age;
  const salary=parseFloat((S.profiles.find(p=>p.relation==='Self')||{}).salary)||0;
  const housingLiab=S.liabilities.find(l=>(l.type||'').toLowerCase().includes('housing'));
  const hdbBalance=housingLiab?(parseFloat(housingLiab.fullAmount)||parseFloat(housingLiab.amount)||0):0;
  const liquid=S.assets.filter(a=>a.type==='bank').reduce((s,a)=>s+assetVal(a),0);

  // Use cached peer data or defaults
  const peer=S.peerData||{sgSalary:5500,sgSavings:30000,sgLoan:280000,updatedAt:null};

  // Update age displays
  document.querySelectorAll('.peer-age-ref').forEach(el=>el.textContent=ageForBench);
  const ageEl=getEl('peer-age');if(ageEl)ageEl.textContent=ageForBench;

  // Salary card
  setEl('peer-my-salary',salary>0?'~$'+fmtN(salary):'—');
  setEl('peer-sg-salary','~$'+fmtN(peer.sgSalary));
  const salaryPct=salary>0?Math.min(salary/peer.sgSalary*100,130).toFixed(0):0;
  const salaryBar=getEl('peer-salary-bar');
  if(salaryBar){salaryBar.style.width=Math.min(salaryPct,100)+'%';salaryBar.style.background=salary>=peer.sgSalary?'var(--green)':'var(--amber)';}
  const salaryNote=getEl('peer-salary-note');
  if(salaryNote){
    if(salary<=0){
      salaryNote.textContent='Enter gross monthly salary above or in Settings to compare with SG median.';
      salaryNote.style.color='var(--text3)';
    }else{
      const diff=salary-peer.sgSalary;
      salaryNote.textContent=diff>=0?'Above median by $'+fmtN(diff)+'/mth':'Below median by $'+fmtN(Math.abs(diff))+'/mth.';
      salaryNote.style.color=diff>=0?'var(--green)':'var(--amber)';
    }
  }

  // Savings card
  setEl('compare-liquid','$'+fmtN(liquid));
  const savPct=Math.min(liquid/peer.sgSavings*100,100).toFixed(0);
  const savBar=getEl('compare-liquid-bar');if(savBar){savBar.style.width=savPct+'%';}
  setEl('peer-sg-savings','~$'+fmtN(peer.sgSavings));

  // HDB card
  setEl('peer-my-loan',hdbBalance>0?'$'+fmtN(hdbBalance):'—');
  setEl('peer-sg-loan','~$'+fmtN(peer.sgLoan));
  const loanPct=hdbBalance>0?Math.min(hdbBalance/peer.sgLoan*100,130).toFixed(0):0;
  const loanBar=getEl('peer-loan-bar');
  if(loanBar){loanBar.style.width=Math.min(loanPct,100)+'%';loanBar.style.background=hdbBalance>0&&(hdbBalance<=peer.sgLoan)?'var(--green)':'var(--red)';}

  // Last updated
  const updEl=getEl('peer-last-upd');
  if(updEl&&peer.updatedAt){
    const d=new Date(peer.updatedAt);
    updEl.textContent='Stats from '+d.toLocaleDateString('en-SG',{month:'short',year:'numeric'});
  }
}

async function refreshPeerData(){
  if(!S.apiKey||!S.apiKey.startsWith('sk-ant')){
    showToast('Add Anthropic API key in Settings first',4000);return;
  }
  const btn=getEl('peer-refresh-btn');
  btn.disabled=true;btn.textContent='Searching...';
  setEl('peer-last-upd','Fetching latest stats...');
  const age=calcAge()??33;
  try{
    const resp=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':S.apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:1024,
        tools:[{type:'web_search_20250305',name:'web_search'}],
        messages:[{
          role:'user',
          content:'Search for Singapore median statistics for workers aged '+age+' in 2025 or 2026. I need three numbers: (1) median gross monthly salary SGD, (2) typical liquid savings/bank balance SGD, (3) median HDB outstanding loan balance SGD. After searching, reply with ONLY this exact format, nothing else:\\nSALARY:5500\\nSAVINGS:30000\\nLOAN:280000'
        }]
      })
    });
    if(!resp.ok){
      const err=await resp.json().catch(()=>({error:{message:'HTTP '+resp.status}}));
      throw new Error(err.error?.message||'HTTP '+resp.status);
    }
    const data=await resp.json();
    // Find the final text block (after tool use blocks)
    const allBlocks=data.content||[];
    const textBlocks=allBlocks.filter(b=>b.type==='text');
    if(!textBlocks.length) throw new Error('No text in response');
    const text=textBlocks[textBlocks.length-1].text;
    console.log('Peer data response:', text);
    // Parse KEY:VALUE format (much more reliable than JSON)
    const salaryMatch=text.match(/SALARY[:\\s]+([\\d,]+)/i);
    const savingsMatch=text.match(/SAVINGS[:\\s]+([\\d,]+)/i);
    const loanMatch=text.match(/LOAN[:\\s]+([\\d,]+)/i);
    if(salaryMatch&&savingsMatch&&loanMatch){
      const parsed={
        sgSalary:parseInt(salaryMatch[1].replace(/,/g,'')),
        sgSavings:parseInt(savingsMatch[1].replace(/,/g,'')),
        sgLoan:parseInt(loanMatch[1].replace(/,/g,'')),
        updatedAt:Date.now()
      };
      S.peerData=parsed;saveS();
      renderPeerComparison();
      showToast('Peer stats updated for age '+age+' ✓');
    } else {
      // Fallback: try to extract any numbers from the text
      console.warn('Could not parse structured response, raw text:', text);
      showToast('Got data but could not parse — check console (F12)',4000);
    }
  }catch(e){
    console.error('Peer refresh error:',e);
    setEl('peer-last-upd','Failed — try again');
    showToast('Error: '+e.message.slice(0,60),4000);
  }
  btn.disabled=false;btn.textContent='↻ Refresh Stats';
}

// ── CPF CALC ──// ── CPF CALC ──────────────────────────────────────────────────────────────────
function calcCPF(){
  const gross=parseFloat(getEl('cpf-salary').value)||0;
  const self=selfProfile();
  const status=((getEl('cpf-status')?.value)||(self?.citizen)||'sc').toLowerCase();
  const age=calcAge();
  setCPFSubtitle(age,status);
  if(self){
    self.salary=gross>0?String(gross):'';
    self.citizen=status;
    saveS();
    renderPeerComparison();
  }
  const capped=Math.min(gross,8000);
  const band=(age===null||status==='other')?{employeeRate:0,employerRate:0,oaRate:0,saRate:0,maRate:0}:findCPFBand(age,status);
  const emp=Math.floor(capped*(band.employeeRate||0));
  const er=Math.floor(capped*(band.employerRate||0));
  const oa=Math.floor(capped*(band.oaRate||0));
  const sa=Math.floor(capped*(band.saRate||0));
  const ma=Math.floor(capped*(band.maRate||0));
  const total=emp+er;
  getEl('cpf-results').innerHTML=
    '<div class="cpf-result-card"><div class="cpf-result-label">Take-home Cash</div><div class="cpf-result-value text-green">$'+(gross-emp).toFixed(0)+'</div></div>'+
    '<div class="cpf-result-card"><div class="cpf-result-label">OA (Housing)</div><div class="cpf-result-value text-accent">$'+oa+'</div></div>'+
    '<div class="cpf-result-card"><div class="cpf-result-label">SA (Retirement)</div><div class="cpf-result-value" style="color:var(--purple)">$'+sa+'</div></div>'+
    '<div class="cpf-result-card"><div class="cpf-result-label">MA (MediSave)</div><div class="cpf-result-value" style="color:var(--amber)">$'+ma+'</div></div>';
  const employeePct=((band.employeeRate||0)*100).toFixed(1).replace('.0','');
  const employerPct=((band.employerRate||0)*100).toFixed(1).replace('.0','');
  getEl('cpf-note').textContent=(age===null)
    ?'Enter date of birth in Settings and gross salary above to calculate age-based CPF contribution.'
    :'Gross $'+gross.toLocaleString()+' → Employee CPF $'+emp+' ('+employeePct+'%) + Employer CPF $'+er+' ('+employerPct+'%) = Total $'+total+'.';
}

// ── CHARTS ────────────────────────────────────────────────────────────────────
function isDark(){return S.theme==='dark';}
function gc(){return isDark()?'rgba(94,104,149,.25)':'rgba(200,210,240,.6)';}
function tc(){return isDark()?'#9ba3d4':'#7b82a8';}
function rebuildMonthlyChart(){
  const map={};TRANSACTIONS.filter(t=>t.type==='expense').forEach(t=>{map[t.category]=(map[t.category]||0)+t.amount;});
  const labels=Object.keys(map),data=Object.values(map),colors=labels.map(l=>CAT_COLORS[l]||'#94a3b8');
  if(pieChart)pieChart.destroy();
  pieChart=new Chart(getEl('pieChart'),{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderColor:isDark()?'#0f1120':'#fff',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:tc(),font:{family:'Outfit',size:11,weight:'600'},padding:12,boxWidth:10}},tooltip:{callbacks:{label:ctx=>' $'+fmt(ctx.parsed)+' ('+((ctx.parsed/ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(0)+'%)'}}},cutout:'64%'}});
}
function rebuildNWChart(){
  const ctx=getEl('nwBarChart');if(!ctx)return;
  const bankV=S.assets.filter(a=>a.type==='bank').reduce((s,a)=>s+assetVal(a),0);
  const invV=S.assets.filter(a=>a.type==='stock'||a.type==='etf').reduce((s,a)=>s+assetVal(a),0);
  const cpfV=S.assets.filter(a=>a.type==='cpf').reduce((s,a)=>s+assetVal(a),0);
  const othV=S.assets.filter(a=>a.type==='property'||a.type==='other').reduce((s,a)=>s+assetVal(a),0);
  const liabV=S.liabilities.reduce((s,l)=>s+(parseFloat(l.amount)||0),0);
  if(nwChart)nwChart.destroy();
  nwChart=new Chart(ctx,{type:'bar',data:{labels:['Bank & Cash','Investments','CPF','Property & Other','Liabilities'],datasets:[{data:[bankV,invV,cpfV,othV,-liabV],backgroundColor:['#06d6a0','#4361ee','#f9a825','#0096c7','#ef233c'],borderRadius:8,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{grid:{color:gc()},ticks:{color:tc(),font:{family:'JetBrains Mono',size:11},callback:v=>'$'+v.toLocaleString()}},x:{grid:{display:false},ticks:{color:tc(),font:{family:'Outfit',size:12,weight:'600'}}}}}});
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
function buildCatOpts(sel){return [...S.categories,'+ New Category'].map(c=>'<option'+(c===sel?' selected':'')+'>'+c+'</option>').join('');}
function populateCatFilter(){const s=getEl('tx-cat-filter'),prev=s.value;s.innerHTML='<option value="all">All Categories</option>'+S.categories.map(c=>'<option>'+c+'</option>').join('');s.value=prev||'all';}
function getTxEffectiveType(tx){
  // Keep table grouping consistent with category overrides.
  if(tx.category==='Internal Transfer') return 'internal';
  return tx.type;
}
function txToTimestamp(tx){
  const m = /^([A-Za-z]{3})\s+(\d{4})$/.exec(tx.month||'');
  const d = /^(\d{1,2})/.exec(tx.date||'');
  const MM={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  if(!m||!d||MM[m[1]]===undefined) return 0;
  return new Date(parseInt(m[2],10),MM[m[1]],parseInt(d[1],10)).getTime();
}
function filterTx(){
  const search=getEl('tx-search').value.toLowerCase().trim();
  const monthSel=getEl('tx-month-sel')?getEl('tx-month-sel').value:'all';
  const yearSel=getEl('tx-year-sel')?getEl('tx-year-sel').value:'all';
  const type=getEl('tx-type').value,cat=getEl('tx-cat-filter').value;
  const MN={1:'Jan',2:'Feb',3:'Mar',4:'Apr',5:'May',6:'Jun',7:'Jul',8:'Aug',9:'Sep',10:'Oct',11:'Nov',12:'Dec'};
  const filtered=TRANSACTIONS.filter(t=>{
    if(monthSel!=='all'){const mn=MN[parseInt(monthSel)];if(!t.month.startsWith(mn))return false;}
    if(yearSel!=='all'&&!t.month.endsWith(yearSel))return false;
    if(type!=='all'&&getTxEffectiveType(t)!==type)return false;
    if(cat!=='all'&&t.category!==cat)return false;
    if(search){
      const a=t.amount.toFixed(2);
      if(!t.desc.toLowerCase().includes(search)&&!t.source.toLowerCase().includes(search)&&!a.includes(search)&&!t.category.toLowerCase().includes(search))return false;
    }
    return true;
  });
  setEl('tx-count',isPageHidden('transactions')?'•••• transactions':filtered.length+' transactions');
  const body=getEl('tx-body');
  if(!filtered.length){body.innerHTML='<tr><td colspan="5"><div class="empty-state">No transactions match</div></td></tr>';return;}
  const sortedByType={income:[],expense:[],internal:[]};
  filtered.forEach(tx=>{
    const et=getTxEffectiveType(tx);
    if(!sortedByType[et]) sortedByType[et]=[];
    sortedByType[et].push(tx);
  });
  Object.keys(sortedByType).forEach(k=>sortedByType[k].sort((a,b)=>txToTimestamp(b)-txToTimestamp(a)));
  const ordered=[...sortedByType.income,...sortedByType.expense,...sortedByType.internal];

  let html='',lastType=null;
  const tl={income:'Income',expense:'Expenses',internal:'Internal Transfers'};
  ordered.forEach(tx=>{
    const t=getTxEffectiveType(tx);
    if(t!==lastType){html+='<tr class="section-group-header"><td colspan="5">'+tl[t]+'</td></tr>';lastType=t;}
    const sg=t==='income'?'+':t==='internal'?'':'-';
    const dc='dot-'+(t==='income'?'income':t==='internal'?'internal':'expense');
    const uf=tx.category==='Unknown'?'<span class="unknown-flag">⚠</span>':'';
    // Amount: bright green/red that works in both light and dark mode
    const isDark=document.documentElement.getAttribute('data-theme')==='dark';
    const amtColor=t==='income'
      ?(isDark?'#34d399':'#059669')
      :t==='internal'
        ?'var(--text3)'
        :(isDark?'#f87171':'#dc2626');
    // Category badge with icon and colour
    const badge=catBadgeHTML(tx.category);
    const catWrap='<div class="cat-badge-wrap"><span class="cat-badge-inner">'+badge+'</span>'+
      '<select data-id="'+tx.id+'" onchange="changeCat(this)">'+buildCatOpts(tx.category)+'</select></div>';
    html+='<tr>'+
      '<td class="mono text-muted" style="font-size:12px">'+tx.date+'</td>'+
      '<td><span class="type-dot '+dc+'"></span>'+uf+'<span style="font-weight:600">'+tx.desc+'</span></td>'+
      '<td class="text-muted" style="font-size:12px">'+tx.source+'</td>'+
      '<td class="mono" style="text-align:right;font-weight:700;color:'+amtColor+'">'+hideVal('transactions',sg+'$'+fmt(tx.amount))+'</td>'+
      '<td>'+catWrap+'</td>'+
    '</tr>';
  });
  body.innerHTML=html;
}
function changeCat(sel){
  if(sel.value==='+ New Category'){pendingCatTxId=parseInt(sel.dataset.id);getEl('cat-modal').classList.add('open');sel.value=TRANSACTIONS[parseInt(sel.dataset.id)].category;return;}
  const id=parseInt(sel.dataset.id);TRANSACTIONS[id].category=sel.value;S.catOverrides[id]=sel.value;saveS();calcSummary();filterTx();populateCatFilter();showToast('Category saved');
}
function renderTxCurrencyTabs(){
  const tabs=getEl('tx-currency-tabs');if(!tabs)return;
  const currencies=[...new Set(['SGD',...(S.forexHoldings||[]).map(h=>h.currency)])];
  tabs.innerHTML=currencies.map((c,i)=>
    '<button class="currency-tab'+(i===0?' active':'')+'" data-currency="'+c+'" onclick="setCurrency(\''+c+'\',this)">'+c+'</button>'
  ).join('');
}
function renderTxCurrencyCards(){
  const wrap=getEl('tx-foreign-cards');if(!wrap)return;
  const groups={};
  (S.forexHoldings||[]).forEach(h=>{
    if(!groups[h.currency])groups[h.currency]=[];
    groups[h.currency].push(h);
  });
  wrap.innerHTML=Object.keys(groups).map(cur=>{
    const rows=groups[cur].map(h=>'<tr>'+
      '<td class="fw6">'+h.accountName+'</td>'+
      '<td class="mono fw6">'+fmt(h.balance)+'</td>'+
      '<td class="mono text-green fw6">~$'+fmt(h.sgdEquivalent)+'</td>'+
      '<td class="mono text-muted">'+(h.rate||0).toFixed(4)+'</td>'+
      '<td class="text-muted">'+(h.asOf||'—')+'</td>'+
    '</tr>').join('');
    return '<div class="card tx-currency-card" data-currency="'+cur+'" style="display:none;margin-top:16px">'+
      '<div class="card-header"><div class="card-title">'+cur+' Holdings</div></div>'+
      '<div class="card-body"><table class="tbl"><thead><tr><th>Account</th><th>Balance ('+cur+')</th><th>SGD Equiv.</th><th>Rate</th><th>As Of</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
  }).join('');
}
function setCurrency(cur,btn){
  document.querySelectorAll('.currency-tab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('.tx-currency-card').forEach(card=>{
    card.style.display=(card.dataset.currency===cur)?'':'none';
  });
}
function closeCatModal(){getEl('cat-modal').classList.remove('open');getEl('new-cat-input').value='';pendingCatTxId=null;}
function addNewCategory(){const val=getEl('new-cat-input').value.trim();if(!val)return;if(!S.categories.includes(val))S.categories.push(val);if(pendingCatTxId!==null){TRANSACTIONS[pendingCatTxId].category=val;S.catOverrides[pendingCatTxId]=val;saveS();calcSummary();filterTx();populateCatFilter();showToast('Category added');}closeCatModal();}
getEl('new-cat-input').addEventListener('keydown',e=>{if(e.key==='Enter')addNewCategory();if(e.key==='Escape')closeCatModal();});

// ── PROFILES ──────────────────────────────────────────────────────────────────
function renderProfileSwitcher(){
  const sw=getEl('profile-switcher');if(!sw)return;
  sw.innerHTML=S.profiles.map(p=>
    '<button class="profile-switcher-btn'+(p.id===S.activeProfileId?' active':'')+
    '" data-pid="'+p.id+'" onclick="switchActiveProfile(this.dataset.pid)">'+
    p.name.split(' ')[0]+'</button>'
  ).join('');
}
function switchActiveProfile(pid){
  S.activeProfileId=pid;saveS();
  renderProfileSwitcher();renderSettingsAccounts();
  const notice=getEl('profile-notice'),p=S.profiles.find(x=>x.id===pid);
  if(p&&p.relation!=='Self'){
    notice.style.display='block';
    notice.textContent='Viewing '+p.name.split(' ')[0]+' profile. Their data appears once they upload statements in Phase 2.';
  } else { notice.style.display='none'; }
  calcSummary();renderBudgets();renderNW();
}
function renderSettingsAccounts(){
  const el=getEl('settings-accounts-panel');if(!el)return;
  const assets=(S.assets||[]);
  const liabs=(S.liabilities||[]);
  const rows=[];

  assets.forEach(a=>{
    const typeLabel=a.type==='stock'||a.type==='etf'?'Investment':a.type==='cpf'?'CPF':'Asset';
    rows.push({
      id:a.id,
      kind:'asset',
      name:a.name||'Unnamed Asset',
      desc:(a.owner?a.owner+' · ':'')+typeLabel,
      status:'Added'
    });
  });
  liabs.forEach(l=>{
    rows.push({
      id:l.id,
      kind:'liab',
      name:l.name||'Unnamed Liability',
      desc:(l.owner?l.owner+' · ':'')+(l.type||'Liability'),
      status:'Added'
    });
  });

  if(!rows.length){
    el.innerHTML='<div style="background:var(--surface2);border:1.5px dashed var(--border2);border-radius:10px;padding:22px;text-align:center">'
      +'<div style="font-size:15px;font-weight:700;margin-bottom:6px">No accounts yet</div>'
      +'<div style="font-size:13px;color:var(--text3)">Add assets or liabilities to start tracking your own account status.</div></div>';
    return;
  }

  el.innerHTML=rows.map(r=>
    '<div class="setting-row"><div><div class="setting-name">'+r.name+'</div><div class="setting-desc">'+r.desc+'</div></div>'+
    '<div style="display:flex;align-items:center;gap:8px">'+
    '<span class="badge badge-green">'+r.status+'</span>'+
    (r.kind==='asset'
      ?'<button class="btn xs" onclick="openEditAsset(\''+r.id+'\')">Edit</button><button class="btn xs danger" onclick="removeAssetFromSettings(\''+r.id+'\')">Delete</button>'
      :'<button class="btn xs" onclick="openEditLiab(\''+r.id+'\')">Edit</button><button class="btn xs danger" onclick="removeLiabFromSettings(\''+r.id+'\')">Delete</button>')+
    '</div></div>'
  ).join('');
}

function removeAssetFromSettings(id){
  if(!confirm('Delete this asset?'))return;
  S.assets=S.assets.filter(a=>a.id!==id);saveS();
  renderSettingsAccounts();renderNW();rebuildNWChart();showToast('Asset deleted');
}
function removeLiabFromSettings(id){
  if(!confirm('Delete this liability?'))return;
  S.liabilities=S.liabilities.filter(l=>l.id!==id);saveS();
  renderSettingsAccounts();renderNW();showToast('Liability deleted');
}
function renderProfileTabs(){
  getEl('profile-tabs').innerHTML=S.profiles.map((p,i)=>'<button class="profile-tab-btn'+(i===0?' active':'')+'" data-pi="'+i+'" onclick="switchPTab(parseInt(this.dataset.pi),this)">'+p.name.split(' ')[0]+' <span style="font-size:10px;opacity:.7">'+p.relation+'</span></button>').join('');
  getEl('profile-panels').innerHTML=S.profiles.map((p,i)=>{
    const fi=(key,label,val,type)=>'<div class="form-group"><label class="form-label">'+label+'</label><input class="form-input"'+(type?' type="'+type+'"':'')+' value="'+(val||'')+'" data-pi="'+i+'" data-pk="'+key+'" oninput="updP(this)"></div>';
    return '<div class="profile-panel'+(i===0?' active':'')+'" id="pp-'+i+'">'+
      '<div class="profile-grid">'+fi('name','Full Name',p.name,'')+fi('relation','Relation',p.relation,'')+fi('dob','Date of Birth',p.dob,'date')+
      '<div class="form-group"><label class="form-label">Nationality</label><select class="form-select" data-pi="'+i+'" data-pk="citizen" onchange="updP(this)"><option value="sc"'+(p.citizen==='sc'?' selected':'')+'>Singapore Citizen</option><option value="pr"'+(p.citizen==='pr'?' selected':'')+'>Singapore PR</option><option value="other"'+(p.citizen==='other'?' selected':'')+'>Other</option></select></div>'+
      fi('salary','Gross Monthly Salary',p.salary,'number')+fi('employer','Employer',p.employer,'')+'</div>'+
      (i>0?'<button class="btn danger" data-pi="'+i+'" onclick="removeProfile(parseInt(this.dataset.pi))">Remove '+p.name.split(' ')[0]+'</button>':'')+'</div>';
  }).join('');
}
function switchPTab(i,btn){document.querySelectorAll('.profile-tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.profile-panel').forEach(p=>p.classList.remove('active'));btn.classList.add('active');getEl('pp-'+i).classList.add('active');}
function updP(el){
  const i=parseInt(el.dataset.pi),k=el.dataset.pk,v=el.value;
  S.profiles[i][k]=v;saveS();
  if(S.profiles[i]&&S.profiles[i].relation==='Self'&&k==='salary'){
    const cpfInput=getEl('cpf-salary');
    if(cpfInput){
      cpfInput.value=v||'';
      calcCPF();
    }else{
      renderPeerComparison();
    }
  }
  if(S.profiles[i]&&S.profiles[i].relation==='Self'&&(k==='dob'||k==='citizen')){
    const statusSel=getEl('cpf-status');
    if(statusSel&&k==='citizen')statusSel.value=v||'sc';
    calcCPF();
  }
}
function openAddProfileModal(){getEl('pm-name').value='';getEl('pm-dob').value='';getEl('profile-modal').classList.add('open');}
function closeProfileModal(){getEl('profile-modal').classList.remove('open');}
function saveNewProfile(){const name=getEl('pm-name').value.trim();if(!name){showToast('Enter a name');return;}S.profiles.push({id:'m_'+Date.now(),name,relation:getEl('pm-relation').value,dob:getEl('pm-dob').value,citizen:getEl('pm-citizen').value,salary:'',employer:'',email:''});saveS();closeProfileModal();renderProfileTabs();showToast(name+' added');}
function removeProfile(i){S.profiles.splice(i,1);saveS();renderProfileTabs();}
function populateOwnerSelect(id,selected){getEl(id).innerHTML=S.profiles.map(p=>'<option'+(p.name===selected?' selected':'')+'>'+p.name+' ('+p.relation+')</option>').join('');}

init();
