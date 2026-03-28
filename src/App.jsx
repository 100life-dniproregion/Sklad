import React, { useState, useEffect, useMemo, useCallback, useRef, createContext, useContext } from "react";

// THEME & CONSTANTS
const C = {
  bg: "#07071a", bgCard: "#0f1029", bgHover: "#161840", bgModal: "#0d0e24",
  accent: "#2e75b6", accentLight: "#4a9fe5", accentDim: "#1a3d5c",
  text: "#e2e4f0", textDim: "#7b7f9e", textMuted: "#4a4e6a",
  border: "#1c1e3a", success: "#22c55e", warning: "#eab308",
  danger: "#ef4444", orange: "#f97316", grey: "#6b7280", purple: "#8b5cf6",
};

const CATEGORIES = ["NFI","Гігієна","Медичні","Продукти","Обладнання","Одяг","Безпека","ХАБ","ДЦ","Visibility","Логістика","Assistive Devices","Інше"];
const UNITS = ["шт","набір","упаковка","кг","л","м","пара","бутиль","коробка","палета"];
const SOURCES = ["Global Fund","UNICEF","USAID","UHF/OCHA","GFFO/Humedica","PACT","CDC","UNAIDS","007-GF-24","HL"];
const CONDITIONS = ["Новий","Б/У","Пошкоджений","Протермінований"];
const CURRENCIES = ["UAH","USD","EUR"];
const MT = {
  incoming:{label:"Прихід",icon:"↓",color:C.success},
  outgoing:{label:"Видача",icon:"↑",color:C.danger},
  transfer:{label:"Переміщення",icon:"⇄",color:C.accent},
  writeoff:{label:"Списання",icon:"✕",color:C.orange},
  adjustment:{label:"Коригування",icon:"±",color:C.purple},
};
const WO_REASONS = ["Прострочено","Пошкоджено","Втрачено","Вкрадено"];

function uid(){return crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).substr(2,12)}
function invNum(i){return `INV-2026-${String(i).padStart(4,"0")}`}
function fmtDate(d){if(!d)return"—";return new Date(d).toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric"})}
function fmtCur(v,c="UAH"){if(!v&&v!==0)return"—";return new Intl.NumberFormat("uk-UA",{style:"currency",currency:c,maximumFractionDigits:0}).format(v)}

// LABEL PRINTING — 80x50mm landscape
function printLabels(selectedItems,projects){
  const w=window.open("","_blank");if(!w)return;
  const itemsJson=JSON.stringify(selectedItems.map(item=>{
    const proj=projects?.find(p=>p.id===item.projectId);
    return{name:item.name,inv:item.inventoryNumber||"—",source:item.source||"—",
      expiry:item.expiryDate==="2099-12-31"?"Необмежений":(item.expiryDate||"—"),
      category:item.category,project:proj?.name||"",qr:item.qrCode||item.id};
  }));
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Етикетки</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
<style>
@page{size:80mm 50mm landscape;margin:2mm;}
*{margin:0;padding:0;box-sizing:border-box;font-family:'Source Sans 3',Arial,sans-serif;}
.label{width:76mm;height:46mm;border:0.5pt solid #ccc;padding:2mm;page-break-after:always;display:flex;gap:2mm;align-items:center;}
.label:last-child{page-break-after:auto;}
.qr{flex:0 0 26mm;height:26mm;}
.qr canvas,.qr img{width:26mm!important;height:26mm!important;}
.info{flex:1;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
.name{font-size:9pt;font-weight:800;line-height:1.2;margin-bottom:1mm;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
.row{font-size:7pt;color:#333;margin-bottom:0.5mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.inv{font-size:8pt;font-weight:700;font-family:monospace;margin-bottom:1mm;}
.project{font-size:7pt;font-weight:700;color:#2e75b6;margin-bottom:0.5mm;}
@media print{body{margin:0;}}
</style></head><body>
<script>
var items=${itemsJson};
items.forEach(function(item,i){
  var label=document.createElement('div');label.className='label';
  var qrDiv=document.createElement('div');qrDiv.className='qr';qrDiv.id='qr'+i;
  var info=document.createElement('div');info.className='info';
  info.innerHTML='<div class="name">'+item.name+'</div>'
    +'<div class="inv">'+item.inv+'</div>'
    +(item.project?'<div class="project">'+item.project+'</div>':'')
    +'<div class="row"><b>Донор:</b> '+item.source+'</div>'
    +'<div class="row"><b>Термін:</b> '+item.expiry+'</div>'
    +'<div class="row"><b>Категорія:</b> '+item.category+'</div>';
  label.appendChild(qrDiv);label.appendChild(info);
  document.body.appendChild(label);
  new QRCode(qrDiv,{text:item.qr,width:200,height:200,correctLevel:QRCode.CorrectLevel.H});
});
window.onload=function(){setTimeout(function(){window.print();},800);};
<\/script>
</body></html>`;
  w.document.write(html);w.document.close();
}

// EXCEL EXPORT via SheetJS (loaded from CDN in artifact)
async function exportXlsx(sheetData,fileName){
  // sheetData: [{name:"Sheet1",data:[[...],[...]]}]
  if(typeof XLSX==="undefined"){
    // Dynamic load SheetJS
    await new Promise((res,rej)=>{
      if(typeof XLSX!=="undefined")return res();
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload=res;s.onerror=rej;document.head.appendChild(s);
    });
  }
  const wb=XLSX.utils.book_new();
  sheetData.forEach(({name,data})=>{
    const ws=XLSX.utils.aoa_to_sheet(data);
    // Auto column widths
    const colW=data[0]?.map((_,ci)=>({wch:Math.max(...data.map(r=>(String(r[ci]||"")).length),10)}));
    if(colW)ws["!cols"]=colW;
    XLSX.utils.book_append_sheet(wb,ws,name.slice(0,31));
  });
  XLSX.writeFile(wb,fileName);
}

// Generate report data
function genStockReport(items,warehouses,settings){
  const org="БО «100% Життя» Дніпровський регіон";
  const date=fmtDate(new Date());
  const hdr=[[org],["Звіт: Залишки на складі"],[`Дата: ${date}`],["Підготував: ___________","","","","Затвердив: ___________"],[]];
  const cols=["№","Назва","Інв. №","Категорія","Одиниця","Кількість","Ціна","Вартість","Джерело","Склад","Термін","Стан"];
  const rows=items.filter(i=>!i.isDeleted).map((it,idx)=>[
    idx+1,it.name,it.inventoryNumber,it.category,it.unit,it.quantity,it.price||0,(it.price||0)*it.quantity,
    it.source,warehouses.find(w=>w.id===it.warehouseId)?.name||"",it.expiryDate==="2099-12-31"?"Необмеж.":fmtDate(it.expiryDate),it.condition
  ]);
  const total=rows.reduce((s,r)=>s+(r[7]||0),0);
  return{name:"Залишки",data:[...hdr,[cols],...rows.map(r=>[r]),["","","","","","","РАЗОМ:",total]]};
}

function genMovementsReport(movements,items,dateFrom,dateTo){
  const org="БО «100% Життя» Дніпровський регіон";
  const hdr=[[org],["Звіт: Журнал операцій"],[`Період: ${dateFrom||"—"} — ${dateTo||"—"}`],["Підготував: ___________","","","Затвердив: ___________"],[]];
  const cols=["№","Дата","Тип","Товар","Кількість","Деталі","Відповідальний"];
  let mv=[...movements].sort((a,b)=>a.date.localeCompare(b.date));
  if(dateFrom)mv=mv.filter(m=>m.date>=dateFrom);
  if(dateTo)mv=mv.filter(m=>m.date<=dateTo);
  const rows=mv.map((m,i)=>[i+1,fmtDate(m.date),MT[m.type]?.label||m.type,m.itemName,m.quantity,
    m.supplier||m.recipientName||m.reason||"",m.responsiblePerson||""]);
  return{name:"Операції",data:[...hdr,[cols],...rows.map(r=>[r])]};
}

function genExpiryReport(items,settings){
  const org="БО «100% Життя» Дніпровський регіон";
  const hdr=[[org],["Звіт: Терміни придатності"],[`Дата: ${fmtDate(new Date())}`],[]];
  const cols=["№","Назва","Інв.№","Термін","Днів залишилось","Статус","Кількість"];
  const today=new Date();today.setHours(0,0,0,0);
  const rows=items.filter(i=>!i.isDeleted&&i.expiryDate&&i.expiryDate!=="2099-12-31").sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate))
    .map((it,idx)=>{const dl=Math.ceil((new Date(it.expiryDate)-today)/864e5);
      const st=dl<0?"Протерміновано":dl<=(settings.criticalExpiryDays||30)?"Критично":dl<=(settings.warningExpiryDays||90)?"Попередження":"OK";
      return[idx+1,it.name,it.inventoryNumber,fmtDate(it.expiryDate),dl,st,it.quantity];});
  return{name:"Терміни",data:[...hdr,[cols],...rows.map(r=>[r])]};
}

function genDonorReport(items,movements){
  const org="БО «100% Життя» Дніпровський регіон";
  const hdr=[[org],["Донорський звіт"],[`Дата: ${fmtDate(new Date())}`],[]];
  const cols=["Джерело/Донор","Надійшло (шт)","Видано (шт)","Залишок (шт)","Вартість залишку"];
  const srcMap={};
  items.filter(i=>!i.isDeleted).forEach(i=>{if(!srcMap[i.source])srcMap[i.source]={stock:0,value:0};srcMap[i.source].stock+=i.quantity;srcMap[i.source].value+=(i.price||0)*i.quantity;});
  movements.forEach(m=>{const src=items.find(i=>i.id===m.itemId)?.source;if(!src)return;if(!srcMap[src])srcMap[src]={stock:0,value:0,inc:0,out:0};
    if(m.type==="incoming")srcMap[src].inc=(srcMap[src].inc||0)+m.quantity;
    if(m.type==="outgoing")srcMap[src].out=(srcMap[src].out||0)+m.quantity;});
  const rows=Object.entries(srcMap).map(([s,d])=>[s,d.inc||0,d.out||0,d.stock,d.value]);
  return{name:"Донори",data:[...hdr,[cols],...rows.map(r=>[r])]};
}

function genWriteoffReport(movements,items){
  const org="БО «100% Життя» Дніпровський регіон";
  const hdr=[[org],["Акт списання"],[`Дата: ${fmtDate(new Date())}`],["Підготував: ___________","","","Затвердив: ___________"],[]];
  const cols=["№","Дата","Товар","Кількість","Причина","Акт №","Затвердив"];
  const rows=movements.filter(m=>m.type==="writeoff").sort((a,b)=>b.date.localeCompare(a.date))
    .map((m,i)=>[i+1,fmtDate(m.date),m.itemName,m.quantity,m.reason||"",m.actNumber||"",m.approvedBy||""]);
  return{name:"Списання",data:[...hdr,[cols],...rows.map(r=>[r])]};
}

function genInventorySheet(items,warehouses){
  const org="БО «100% Життя» Дніпровський регіон";
  const hdr=[[org],["Аркуш інвентаризації"],[`Дата: ${fmtDate(new Date())}`],["Склад: ___________","","Відповідальний: ___________"],[]];
  const cols=["№","Назва","Інв.№","Одиниця","Облік","Факт","Різниця","Статус","Ціна","Сума нестачі"];
  const rows=items.filter(i=>!i.isDeleted).map((it,idx)=>[idx+1,it.name,it.inventoryNumber,it.unit,it.quantity,"","","",it.price||0,""]);
  return{name:"Інвентаризація",data:[...hdr,[cols],...rows.map(r=>[r])]};
}

// ═══════════════════════════════════════════════════════════════
// SYNC ENGINE — Offline-first with IndexedDB + Supabase
// ═══════════════════════════════════════════════════════════════
// Config: set these in .env for production
const SUPABASE_URL = "";  // Set in production: your Supabase project URL
const SUPABASE_KEY = "";  // Set in production: your Supabase anon key
const SYNC_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

// Lightweight IndexedDB wrapper — compatible API for offline storage
// In production project, replace with full IndexedDB library
class LocalDB {
  constructor(){
    this._stores={items:[],movements:[],warehouses:[],projects:[],settings:[],syncQueue:[]};
    this._listeners=new Map();
  }
  table(name){
    const self=this;
    return{
      toArray(){return Promise.resolve([...self._stores[name]||[]])},
      get(id){return Promise.resolve((self._stores[name]||[]).find(r=>r.id===id))},
      put(record){
        const arr=self._stores[name]||[];
        const idx=arr.findIndex(r=>r.id===record.id);
        if(idx>=0)arr[idx]={...arr[idx],...record,updated_at:new Date().toISOString()};
        else arr.push({...record,updated_at:new Date().toISOString()});
        self._stores[name]=arr;
        self._notify(name);
        return Promise.resolve(record.id);
      },
      bulkPut(records){records.forEach(r=>{const arr=self._stores[name]||[];const idx=arr.findIndex(x=>x.id===r.id);
        if(idx>=0)arr[idx]={...arr[idx],...r,updated_at:new Date().toISOString()};else arr.push({...r,updated_at:new Date().toISOString()});
        self._stores[name]=arr;});self._notify(name);return Promise.resolve();},
      delete(id){self._stores[name]=(self._stores[name]||[]).filter(r=>r.id!==id);self._notify(name);return Promise.resolve();},
      where(field){return{equals(val){return{toArray(){return Promise.resolve((self._stores[name]||[]).filter(r=>r[field]===val))}}},
        above(val){return{toArray(){return Promise.resolve((self._stores[name]||[]).filter(r=>r[field]>val))}}}}},
      count(){return Promise.resolve((self._stores[name]||[]).length)},
      clear(){self._stores[name]=[];self._notify(name);return Promise.resolve();}
    };
  }
  _notify(table){const cbs=this._listeners.get(table);if(cbs)cbs.forEach(cb=>cb());}
  onChange(table,cb){if(!this._listeners.has(table))this._listeners.set(table,new Set());this._listeners.get(table).add(cb);return()=>this._listeners.get(table)?.delete(cb);}
}

const db=new LocalDB();

// Sync Queue Manager
class SyncManager {
  constructor(localDb){
    this.db=localDb;
    this.pending=0;
    this.failed=0;
    this.lastSync=null;
    this.isOnline=typeof navigator!=="undefined"?navigator.onLine:true;
    this.listeners=new Set();
    this.realtimeChannel=null;
    this._setupOnlineListener();
  }

  _setupOnlineListener(){
    if(typeof window==="undefined")return;
    window.addEventListener("online",()=>{this.isOnline=true;this._notify();this.processQueue();});
    window.addEventListener("offline",()=>{this.isOnline=false;this._notify();});
  }

  subscribe(cb){this.listeners.add(cb);return()=>this.listeners.delete(cb);}
  _notify(){this.listeners.forEach(cb=>cb(this.getStatus()));}

  getStatus(){
    return{isOnline:this.isOnline,pending:this.pending,failed:this.failed,lastSync:this.lastSync,
      syncEnabled:SYNC_ENABLED,label:this._getLabel()};
  }

  _getLabel(){
    if(!SYNC_ENABLED)return"Локальний режим";
    if(!this.isOnline)return"Офлайн";
    if(this.pending>0)return`Синхронізація (${this.pending})...`;
    if(this.failed>0)return`${this.failed} помилок`;
    return"Синхронізовано";
  }

  // Queue a change for sync
  async queueChange(table,operation,data){
    const entry={id:uid(),table,operation,data,status:"pending",created_at:new Date().toISOString(),retries:0};
    await this.db.table("syncQueue").put(entry);
    this.pending++;
    this._notify();
    if(this.isOnline&&SYNC_ENABLED)this.processQueue();
  }

  // Process pending queue
  async processQueue(){
    if(!SYNC_ENABLED||!this.isOnline)return;
    const queue=await this.db.table("syncQueue").where("status").equals("pending").toArray();
    this.pending=queue.length;this._notify();

    // Sync order: warehouses → projects → settings → items → movements
    const order=["warehouses","projects","settings","items","movements"];
    const sorted=[...queue].sort((a,b)=>order.indexOf(a.table)-order.indexOf(b.table));

    for(const entry of sorted){
      try{
        await this._syncOne(entry);
        await this.db.table("syncQueue").put({...entry,status:"synced",synced_at:new Date().toISOString()});
        this.pending--;
      }catch(e){
        const retries=(entry.retries||0)+1;
        await this.db.table("syncQueue").put({...entry,status:retries>=3?"failed":"pending",retries,error:e.message});
        if(retries>=3){this.pending--;this.failed++;}
      }
      this._notify();
    }
    this.lastSync=new Date().toISOString();
    this._notify();
    // Clean synced entries older than 1 hour
    this._cleanSynced();
  }

  async _syncOne(entry){
    // In production: actual Supabase upsert/insert/delete
    // const { data, error } = await supabase.from(entry.table).upsert(entry.data);
    // if (error) throw error;
    // For demo: simulate network delay
    await new Promise(r=>setTimeout(r,50));
  }

  async _cleanSynced(){
    const synced=await this.db.table("syncQueue").where("status").equals("synced").toArray();
    const cutoff=Date.now()-3600000;
    for(const e of synced){if(new Date(e.synced_at).getTime()<cutoff)await this.db.table("syncQueue").delete(e.id);}
  }

  // Initial sync: download all from Supabase
  async initialSync(){
    if(!SYNC_ENABLED)return false;
    try{
      // In production:
      // const { data: items } = await supabase.from('items').select('*');
      // await db.table('items').bulkPut(items);
      // ... same for warehouses, projects, movements, settings
      this.lastSync=new Date().toISOString();
      this._notify();
      return true;
    }catch(e){return false;}
  }

  // Subscribe to Supabase Realtime
  setupRealtime(onItemChange,onMovementChange){
    if(!SYNC_ENABLED)return;
    // In production:
    // this.realtimeChannel = supabase.channel('db-changes')
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, payload => {
    //     db.table('items').put(payload.new);
    //     onItemChange(payload);
    //   })
    //   .on('postgres_changes', { event: '*', schema: 'public', table: 'movements' }, payload => {
    //     db.table('movements').put(payload.new);
    //     onMovementChange(payload);
    //   })
    //   .subscribe();
  }

  destroy(){
    // In production: supabase.removeChannel(this.realtimeChannel);
  }
}

const syncManager=new SyncManager(db);

// React hook for sync status
function useSyncStatus(){
  const [status,setStatus]=useState(syncManager.getStatus());
  useEffect(()=>{
    const unsub=syncManager.subscribe(setStatus);
    return unsub;
  },[]);
  return status;
}

// React hook for synced data — wraps state setter to also queue sync
function useSyncedState(table,initialData){
  const [data,setData]=useState(initialData);

  // Initialize local DB with demo data
  useEffect(()=>{
    db.table(table).bulkPut(initialData);
  },[]);

  // Wrap setter to queue sync
  const setSynced=useCallback((updater)=>{
    setData(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      // Find changes
      const prevIds=new Set(prev.map(r=>r.id));
      const nextIds=new Set(next.map(r=>r.id));
      // New or updated
      next.forEach(r=>{
        const old=prev.find(o=>o.id===r.id);
        if(!old||JSON.stringify(old)!==JSON.stringify(r)){
          db.table(table).put(r);
          syncManager.queueChange(table,"upsert",r);
        }
      });
      // Deleted
      prev.forEach(r=>{if(!nextIds.has(r.id)){
        db.table(table).put({...r,isDeleted:true});
        syncManager.queueChange(table,"soft_delete",{id:r.id,isDeleted:true});
      }});
      return next;
    });
  },[table]);

  return[data,setSynced];
}

// Sync Status Indicator Component
function SyncIndicator(){
  const status=useSyncStatus();
  const color=!status.isOnline?C.danger:status.pending>0?C.warning:status.failed>0?C.orange:C.success;
  const iconName=status.isOnline?"wifi":"wifiOff";

  return(
    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",fontSize:12,borderTop:`1px solid ${C.border}`}}>
      <div style={{position:"relative"}}>
        <I n={iconName} s={14} c={color}/>
        {status.pending>0&&<div style={{position:"absolute",top:-4,right:-6,width:8,height:8,borderRadius:4,background:C.warning,animation:"pulse 1.5s infinite"}}/>}
      </div>
      <div style={{flex:1}}>
        <div style={{color,fontWeight:600,fontSize:11}}>{status.label}</div>
        {status.lastSync&&<div style={{fontSize:10,color:C.textMuted}}>Остання: {fmtDate(status.lastSync)}</div>}
      </div>
      {!SYNC_ENABLED&&<div style={{fontSize:9,color:C.textMuted,textAlign:"right"}}>demo<br/>mode</div>}
      {status.failed>0&&<button onClick={()=>syncManager.processQueue()} style={{background:"none",border:`1px solid ${C.orange}44`,borderRadius:4,padding:"2px 6px",fontSize:10,color:C.orange,cursor:"pointer"}}>↻</button>}
    </div>
  );
}

// DEMO DATA
const DW=[
  {id:"wh1",name:"Офіс",address:"майдан Праці, 1",city:"Кривий Ріг",isActive:true},
  {id:"wh2",name:"Центральний склад",address:"вул. Вільної Іхерії, 4",city:"Кривий Ріг",isActive:true},
  {id:"wh3",name:"Мобільний пункт",address:"вул. Шевченка, 3",city:"Новомосковськ",isActive:true},
];
const DP=[
  {id:"p1",name:"Підтримка ВПО",donor:"UHF/OCHA",startDate:"2025-01-01",endDate:"2026-06-30",isActive:true},
  {id:"p2",name:"Доступні ліки",donor:"Global Fund",startDate:"2024-10-01",endDate:"2026-12-31",isActive:true},
  {id:"p3",name:"Реабілітація",donor:"GFFO/Humedica",startDate:"2025-06-01",endDate:"2026-12-31",isActive:true},
];
const DI=[
  {id:uid(),name:"Набір гігієнічний жіночий",category:"Гігієна",unit:"набір",quantity:150,minQuantity:20,source:"UNICEF",warehouseId:"wh2",projectId:"p1",inventoryNumber:invNum(1),expiryDate:"2027-03-15",price:320,currency:"UAH",manufacturer:"Гігієна-Сервіс",condition:"Новий",notes:"",qrCode:uid(),isDeleted:false,createdAt:"2026-01-15",lastMovementAt:"2026-03-20"},
  {id:uid(),name:"Ліжко функціональне 4-секційне",category:"Assistive Devices",unit:"шт",quantity:8,minQuantity:2,source:"GFFO/Humedica",warehouseId:"wh2",projectId:"p3",inventoryNumber:invNum(2),expiryDate:"2099-12-31",price:28500,currency:"UAH",manufacturer:"MedTech",condition:"Новий",notes:"Потребує збірки",qrCode:uid(),isDeleted:false,createdAt:"2025-12-01",lastMovementAt:"2026-03-15"},
  {id:uid(),name:"Тест швидкий HIV 1/2",category:"Медичні",unit:"шт",quantity:3200,minQuantity:500,source:"Global Fund",warehouseId:"wh1",projectId:"p2",inventoryNumber:invNum(3),expiryDate:"2026-06-30",price:85,currency:"UAH",manufacturer:"Alere",condition:"Новий",notes:"",qrCode:uid(),isDeleted:false,createdAt:"2025-08-10",lastMovementAt:"2026-03-25"},
  {id:uid(),name:"Генератор бензиновий 3кВт",category:"Обладнання",unit:"шт",quantity:3,minQuantity:1,source:"UHF/OCHA",warehouseId:"wh2",projectId:"p1",inventoryNumber:invNum(4),expiryDate:"2099-12-31",price:32000,currency:"UAH",manufacturer:"Honda",condition:"Б/У",notes:"Потребує ТО кожні 200 годин",qrCode:uid(),isDeleted:false,createdAt:"2025-06-20",lastMovementAt:"2026-02-10"},
  {id:uid(),name:"Мило туалетне 100г",category:"Гігієна",unit:"шт",quantity:5,minQuantity:100,source:"UNICEF",warehouseId:"wh3",projectId:"p1",inventoryNumber:invNum(5),expiryDate:"2026-04-10",price:18,currency:"UAH",manufacturer:"Дарія",condition:"Новий",notes:"",qrCode:uid(),isDeleted:false,createdAt:"2025-11-01",lastMovementAt:"2025-11-01"},
  {id:uid(),name:"Крісло колісне стандарт",category:"Assistive Devices",unit:"шт",quantity:12,minQuantity:3,source:"GFFO/Humedica",warehouseId:"wh2",projectId:"p3",inventoryNumber:invNum(6),expiryDate:"2099-12-31",price:15200,currency:"UAH",manufacturer:"Ottobock",condition:"Новий",notes:"",qrCode:uid(),isDeleted:false,createdAt:"2026-02-01",lastMovementAt:"2026-03-22"},
  {id:uid(),name:"Аптечка індивідуальна IFAK",category:"Медичні",unit:"набір",quantity:45,minQuantity:10,source:"USAID",warehouseId:"wh1",projectId:"p1",inventoryNumber:invNum(7),expiryDate:"2026-04-15",price:1800,currency:"UAH",manufacturer:"NAR",condition:"Новий",notes:"Тактична",qrCode:uid(),isDeleted:false,createdAt:"2025-09-15",lastMovementAt:"2026-03-18"},
  {id:uid(),name:"Ковдра термоізоляційна",category:"NFI",unit:"шт",quantity:200,minQuantity:30,source:"UHF/OCHA",warehouseId:"wh2",projectId:"p1",inventoryNumber:invNum(8),expiryDate:"2099-12-31",price:450,currency:"UAH",manufacturer:"Grabber",condition:"Новий",notes:"",qrCode:uid(),isDeleted:false,createdAt:"2025-10-01",lastMovementAt:"2026-01-05"},
  {id:uid(),name:"Підгузки дорослі L",category:"Гігієна",unit:"упаковка",quantity:0,minQuantity:20,source:"UNICEF",warehouseId:"wh2",projectId:"p1",inventoryNumber:invNum(9),expiryDate:"2026-02-28",price:280,currency:"UAH",manufacturer:"Tena",condition:"Протермінований",notes:"Потребують списання",qrCode:uid(),isDeleted:false,createdAt:"2025-07-01",lastMovementAt:"2025-12-20"},
  {id:uid(),name:"Powerbank 20000mAh",category:"Обладнання",unit:"шт",quantity:35,minQuantity:5,source:"CDC",warehouseId:"wh1",projectId:"p2",inventoryNumber:invNum(10),expiryDate:"2099-12-31",price:950,currency:"UAH",manufacturer:"Xiaomi",condition:"Новий",notes:"",qrCode:uid(),isDeleted:false,createdAt:"2026-01-20",lastMovementAt:"2026-03-10"},
  {id:uid(),name:"Рукавички нітрилові M",category:"Медичні",unit:"коробка",quantity:80,minQuantity:15,source:"Global Fund",warehouseId:"wh1",projectId:"p2",inventoryNumber:invNum(11),expiryDate:"2028-01-01",price:320,currency:"UAH",manufacturer:"Medicom",condition:"Новий",notes:"100 шт/коробка",qrCode:uid(),isDeleted:false,createdAt:"2026-02-15",lastMovementAt:"2026-03-24"},
  {id:uid(),name:"Жилет безпеки (PRESS)",category:"Безпека",unit:"шт",quantity:6,minQuantity:2,source:"PACT",warehouseId:"wh1",projectId:"p1",inventoryNumber:invNum(12),expiryDate:"2099-12-31",price:2200,currency:"UAH",manufacturer:"ProtectiMax",condition:"Б/У",notes:"Видаються під розпис",qrCode:uid(),isDeleted:false,createdAt:"2025-04-10",lastMovementAt:"2025-09-01"},
];
const DM=[
  {id:uid(),type:"incoming",itemId:DI[0].id,itemName:DI[0].name,quantity:200,toWarehouseId:"wh2",date:"2026-01-15",supplier:"UNICEF Warehouse Kyiv",responsiblePerson:"Іванченко О.",notes:"",createdAt:"2026-01-15"},
  {id:uid(),type:"outgoing",itemId:DI[0].id,itemName:DI[0].name,quantity:50,fromWarehouseId:"wh2",date:"2026-03-20",recipientName:"ЦД Кривий Ріг",responsiblePerson:"Петренко Н.",notes:"Роздача ВПО",createdAt:"2026-03-20"},
  {id:uid(),type:"incoming",itemId:DI[2].id,itemName:DI[2].name,quantity:5000,toWarehouseId:"wh1",date:"2025-08-10",supplier:"GF Sub-grant 007",responsiblePerson:"Рубан О.",notes:"",createdAt:"2025-08-10"},
  {id:uid(),type:"outgoing",itemId:DI[2].id,itemName:DI[2].name,quantity:1800,fromWarehouseId:"wh1",date:"2026-03-25",recipientName:"Мобільна клініка #3",responsiblePerson:"Козак Т.",notes:"",createdAt:"2026-03-25"},
  {id:uid(),type:"transfer",itemId:DI[7].id,itemName:DI[7].name,quantity:50,fromWarehouseId:"wh2",toWarehouseId:"wh3",date:"2026-01-05",responsiblePerson:"Петренко Н.",notes:"Для мобільного пункту",createdAt:"2026-01-05"},
  {id:uid(),type:"writeoff",itemId:DI[8].id,itemName:DI[8].name,quantity:15,fromWarehouseId:"wh2",date:"2025-12-20",responsiblePerson:"Рубан О.",notes:"Прострочено",actNumber:"АКТ-2025-042",approvedBy:"Кріпак О.О.",createdAt:"2025-12-20"},
];

function getAlerts(item,s){
  const a=[];if(item.isDeleted)return a;
  const today=new Date();today.setHours(0,0,0,0);
  if(item.expiryDate&&item.expiryDate!=="2099-12-31"){
    const exp=new Date(item.expiryDate),dl=Math.ceil((exp-today)/864e5);
    if(dl<0)a.push({type:"expired",color:C.danger,label:"Протерміновано",days:dl});
    else if(dl<=(s?.criticalExpiryDays||30))a.push({type:"critical",color:C.orange,label:`Критично: ${dl}д`,days:dl});
    else if(dl<=(s?.warningExpiryDays||90))a.push({type:"warning",color:C.warning,label:`Спливає: ${dl}д`,days:dl});
  }
  if(item.quantity<=item.minQuantity&&item.minQuantity>0)a.push({type:"lowStock",color:C.danger,label:"Низький запас"});
  if(item.lastMovementAt){const d=Math.ceil((today-new Date(item.lastMovementAt))/864e5);if(d>(s?.deadStockDays||180))a.push({type:"deadStock",color:C.grey,label:`Мертвий: ${d}д`});}
  return a;
}

// ICONS
const I=({n,s:sz=20,c:cl="currentColor"})=>{const p={
  warehouse:<><path d="M3 21V8l9-5 9 5v13" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 21V12h6v9" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  movements:<><path d="M7 16l-4-4 4-4M17 8l4 4-4 4" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 12h18" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round"/></>,
  analytics:<><rect x="3" y="12" width="4" height="9" rx="1" stroke={cl} fill="none" strokeWidth="1.5"/><rect x="10" y="7" width="4" height="14" rx="1" stroke={cl} fill="none" strokeWidth="1.5"/><rect x="17" y="3" width="4" height="18" rx="1" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  reports:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={cl} fill="none" strokeWidth="1.5"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round"/></>,
  settings:<><circle cx="12" cy="12" r="3" stroke={cl} fill="none" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  search:<><circle cx="11" cy="11" r="8" stroke={cl} fill="none" strokeWidth="1.5"/><path d="M21 21l-4.35-4.35" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round"/></>,
  plus:<><path d="M12 5v14M5 12h14" stroke={cl} fill="none" strokeWidth="2" strokeLinecap="round"/></>,
  close:<><path d="M18 6L6 18M6 6l12 12" stroke={cl} fill="none" strokeWidth="2" strokeLinecap="round"/></>,
  bell:<><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  filter:<><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  download:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  check:<><path d="M20 6L9 17l-5-5" stroke={cl} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
  edit:<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={cl} fill="none" strokeWidth="1.5"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  user:<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke={cl} fill="none" strokeWidth="1.5"/><circle cx="12" cy="7" r="4" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  logout:<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  box:<><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={cl} fill="none" strokeWidth="1.5"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  wifi:<><path d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round"/></>,
  qr:<><rect x="3" y="3" width="7" height="7" rx="1" stroke={cl} fill="none" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke={cl} fill="none" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke={cl} fill="none" strokeWidth="1.5"/><path d="M14 14h3v3h-3zM20 14v3h-3M20 20h-3v-3M17 20h3" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  camera:<><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={cl} fill="none" strokeWidth="1.5"/><circle cx="12" cy="13" r="4" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  print:<><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z" stroke={cl} fill="none" strokeWidth="1.5"/></>,
  upload:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
  clipboard:<><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke={cl} fill="none" strokeWidth="1.5"/><rect x="9" y="3" width="6" height="4" rx="1" stroke={cl} fill="none" strokeWidth="1.5"/><path d="M9 14l2 2 4-4" stroke={cl} fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
};return <svg width={sz} height={sz} viewBox="0 0 24 24" style={{flexShrink:0}}>{p[n]}</svg>};

// STYLES
const badge=(color)=>({padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700,background:`${color}22`,color,display:"inline-flex",alignItems:"center",gap:4});
const inp={width:"100%",padding:"10px 12px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:14,outline:"none",boxSizing:"border-box"};
const sel={...inp,appearance:"none"};
const lbl={fontSize:12,fontWeight:600,color:C.textDim,marginBottom:4,display:"block",textTransform:"uppercase",letterSpacing:"0.5px"};
const btn=(v="primary")=>({padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,display:"inline-flex",alignItems:"center",gap:6,transition:"all 0.15s",
  ...(v==="primary"?{background:C.accent,color:"#fff"}:v==="danger"?{background:"rgba(239,68,68,0.15)",color:C.danger,border:`1px solid ${C.danger}33`}:v==="ghost"?{background:"transparent",color:C.textDim,border:`1px solid ${C.border}`}:{background:"rgba(46,117,182,0.12)",color:C.accentLight,border:`1px solid ${C.accentDim}`})
});
const card={background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:16,cursor:"pointer",transition:"border-color 0.2s, transform 0.15s",position:"relative"};
const th={textAlign:"left",padding:"10px 12px",fontSize:12,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:"0.5px",borderBottom:`2px solid ${C.border}`};
const td={padding:"10px 12px",fontSize:14,borderBottom:`1px solid ${C.border}11`,verticalAlign:"middle"};
const kpi={background:`linear-gradient(135deg, ${C.bgCard}, ${C.bgHover})`,border:`1px solid ${C.border}`,borderRadius:12,padding:20,flex:1,minWidth:160};
const modal_bg={position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(4px)"};
const modal_c=(wide)=>({background:C.bgModal,border:`1px solid ${C.border}`,borderRadius:16,width:"100%",maxWidth:wide?720:560,maxHeight:"85vh",overflow:"auto",padding:24});

// Modal component
function Modal({open,onClose,title,children,wide}){
  if(!open)return null;
  return(<div style={modal_bg} onClick={onClose}><div style={modal_c(wide)} onClick={e=>e.stopPropagation()}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <h2 style={{fontSize:18,fontWeight:700,margin:0}}>{title}</h2>
      <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",padding:4}}><I n="close" c={C.textDim}/></button>
    </div>{children}
  </div></div>);
}

// QR Scanner Modal — video mode + photo fallback (iOS)
function QrScanner({open,onClose,onResult,items}){
  const videoRef=useRef(null);
  const streamRef=useRef(null);
  const canvasRef=useRef(null);
  const [mode,setMode]=useState("video"); // video | photo | manual
  const [manualCode,setManualCode]=useState("");
  const [error,setError]=useState("");
  const [scanning,setScanning]=useState(false);
  const [found,setFound]=useState(null);

  // Lookup logic: 1) by item.id 2) by qrCode 3) by externalBarcode 4) by inventoryNumber
  const findItem=(code)=>{
    const c=code.trim();
    return items.find(i=>!i.isDeleted&&(i.id===c||i.qrCode===c||i.externalBarcode===c||i.inventoryNumber===c));
  };

  // Start camera
  const startCamera=useCallback(async()=>{
    setError("");setScanning(true);setFound(null);
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}}});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();}
    }catch(e){
      setError("Камера недоступна. Спробуйте фоторежим або ручне введення.");
      setMode("manual");setScanning(false);
    }
  },[]);

  const stopCamera=useCallback(()=>{
    if(streamRef.current){streamRef.current.getTracks().forEach(t=>t.stop());streamRef.current=null;}
    setScanning(false);
  },[]);

  useEffect(()=>{
    if(open&&mode==="video")startCamera();
    return()=>stopCamera();
  },[open,mode]);

  // Simulated scan for demo (in prod: @zxing/library BrowserQRCodeReader)
  // In real app this would continuously decode from video frames
  const handleSimulatedScan=(code)=>{
    const item=findItem(code);
    if(item){setFound(item);stopCamera();}
    else setError(`Товар з кодом "${code}" не знайдено. Спробуйте інший код.`);
  };

  // Photo mode handler (iOS fallback)
  const handlePhoto=(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setError("");
    // In production: decode QR from image via canvas + @zxing
    // For demo: show message
    setError("Демо-режим: оберіть товар зі списку нижче або введіть код вручну.");
    setMode("manual");
  };

  // Manual code submit
  const handleManual=()=>{
    if(!manualCode.trim())return;
    handleSimulatedScan(manualCode.trim());
  };

  if(!open)return null;

  // If item found — show action card
  if(found){
    const wh=items.length>0?[]:null; // just for display
    return(<Modal open={true} onClose={()=>{setFound(null);onClose();}} title="Товар знайдено" wide>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{width:64,height:64,borderRadius:16,background:`${C.success}22`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:8}}>
          <I n="check" s={32} c={C.success}/>
        </div>
        <div style={{fontSize:13,color:C.textDim}}>QR-код розпізнано</div>
      </div>
      <div style={{padding:16,background:C.bg,borderRadius:12,marginBottom:20}}>
        <h3 style={{fontSize:18,fontWeight:800,margin:"0 0 8px"}}>{found.name}</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:13}}>
          <div><span style={{color:C.textDim}}>Інв. №:</span> {found.inventoryNumber}</div>
          <div><span style={{color:C.textDim}}>Категорія:</span> {found.category}</div>
          <div><span style={{color:C.textDim}}>Кількість:</span> <strong style={{fontSize:16}}>{found.quantity}</strong> {found.unit}</div>
          <div><span style={{color:C.textDim}}>Джерело:</span> {found.source}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
        <button style={{...btn("primary"),padding:"12px 24px",fontSize:15}} onClick={()=>{const item=found;setFound(null);onClose();onResult(item,"detail");}}><I n="box" s={16}/> Картка товару</button>
        <button style={{...btn("outline"),padding:"12px 20px"}} onClick={()=>{const item=found;setFound(null);onClose();onResult(item,"outgoing");}}><span style={{color:C.danger,fontSize:16}}>↑</span> Видача</button>
        <button style={{...btn("outline"),padding:"12px 20px"}} onClick={()=>{const item=found;setFound(null);onClose();onResult(item,"transfer");}}>⇄ Переміщення</button>
        <button style={{...btn("outline"),padding:"12px 20px"}} onClick={()=>{const item=found;setFound(null);onClose();onResult(item,"incoming");}}><span style={{color:C.success,fontSize:16}}>↓</span> Прихід</button>
      </div>
      <div style={{textAlign:"center",marginTop:12}}>
        <button style={{...btn("ghost"),fontSize:12}} onClick={()=>{setFound(null);setMode("manual");}}>Сканувати ще</button>
      </div>
    </Modal>);
  }

  return(<Modal open={true} onClose={()=>{stopCamera();onClose();}} title="Сканувати QR-код">
    {/* Mode tabs */}
    <div style={{display:"flex",gap:4,marginBottom:16}}>
      {[{id:"video",label:"Камера",icon:"camera"},{id:"photo",label:"Фото (iOS)",icon:"camera"},{id:"manual",label:"Код вручну",icon:"edit"}].map(m=>(
        <button key={m.id} onClick={()=>{if(m.id!=="video")stopCamera();setMode(m.id);setError("");}} style={{
          flex:1,padding:"8px 4px",borderRadius:8,border:`1px solid ${mode===m.id?C.accent:C.border}`,
          background:mode===m.id?`${C.accent}18`:"transparent",color:mode===m.id?C.accentLight:C.textDim,
          cursor:"pointer",fontSize:12,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:4
        }}><I n={m.icon} s={14} c={mode===m.id?C.accentLight:C.textDim}/>{m.label}</button>
      ))}
    </div>

    {/* Video mode */}
    {mode==="video"&&<div>
      <div style={{position:"relative",borderRadius:12,overflow:"hidden",background:"#000",marginBottom:12,aspectRatio:"4/3"}}>
        <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover"}} playsInline muted/>
        {/* Scan overlay */}
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{width:200,height:200,border:`3px solid ${C.accent}`,borderRadius:16,boxShadow:`0 0 0 9999px rgba(0,0,0,0.4)`,animation:"pulse 2s infinite"}}/>
        </div>
        {scanning&&<div style={{position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.7)",color:"#fff",padding:"4px 12px",borderRadius:20,fontSize:12}}>Наведіть камеру на QR-код...</div>}
      </div>
      <div style={{fontSize:12,color:C.textDim,textAlign:"center"}}>Демо: введіть код вручну для тестування</div>
    </div>}

    {/* Photo mode (iOS fallback) */}
    {mode==="photo"&&<div style={{textAlign:"center",padding:20}}>
      <div style={{width:80,height:80,borderRadius:20,background:`${C.accent}18`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12,cursor:"pointer"}} onClick={()=>document.getElementById("qr-photo-input")?.click()}>
        <I n="camera" s={36} c={C.accentLight}/>
      </div>
      <div style={{fontSize:14,marginBottom:8}}>Зробіть фото QR-коду</div>
      <div style={{fontSize:12,color:C.textDim,marginBottom:16}}>Для iOS Safari, де відеорежим нестабільний</div>
      <input id="qr-photo-input" type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handlePhoto}/>
      <button style={btn("outline")} onClick={()=>document.getElementById("qr-photo-input")?.click()}>Відкрити камеру</button>
    </div>}

    {/* Manual code entry */}
    {mode==="manual"&&<div>
      <div style={{fontSize:13,color:C.textDim,marginBottom:12}}>Введіть ID, інвентарний номер або штрихкод товару:</div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <input style={{...inp,flex:1}} placeholder="Напр.: INV-2026-0001" value={manualCode} onChange={e=>{setManualCode(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&handleManual()}/>
        <button style={btn("primary")} onClick={handleManual}><I n="search" s={16}/></button>
      </div>
      {/* Quick select from existing items */}
      <div style={{fontSize:12,fontWeight:600,color:C.textDim,marginBottom:8}}>Або оберіть товар:</div>
      <div style={{maxHeight:200,overflow:"auto",border:`1px solid ${C.border}`,borderRadius:8}}>
        {items.filter(i=>!i.isDeleted).map(item=>(
          <div key={item.id} onClick={()=>handleSimulatedScan(item.qrCode)} style={{
            padding:"8px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}22`,fontSize:13,
            display:"flex",justifyContent:"space-between",alignItems:"center"
          }}
          onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div><div style={{fontWeight:600}}>{item.name}</div><div style={{fontSize:11,color:C.textDim}}>{item.inventoryNumber}</div></div>
            <div style={{fontWeight:700,fontSize:15}}>{item.quantity} <span style={{fontSize:11,color:C.textDim}}>{item.unit}</span></div>
          </div>
        ))}
      </div>
    </div>}

    {error&&<div style={{marginTop:12,padding:10,background:`${C.danger}11`,borderRadius:8,fontSize:13,color:C.danger}}>{error}</div>}
  </Modal>);
}
function ItemCard({item,warehouses,alerts,onClick}){
  const wh=warehouses.find(w=>w.id===item.warehouseId);
  return(<div style={{...card,borderColor:alerts.length>0?`${alerts[0].color}44`:card.borderColor}} onClick={onClick}
    onMouseEnter={e=>{e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.transform="translateY(-2px)";}}
    onMouseLeave={e=>{e.currentTarget.style.borderColor=alerts.length>0?`${alerts[0].color}44`:C.border;e.currentTarget.style.transform="none";}}>
    {alerts.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{alerts.map((a,i)=><span key={i} style={badge(a.color)}>{a.label}</span>)}</div>}
    <h3 style={{fontSize:15,fontWeight:700,margin:"0 0 6px",lineHeight:1.3}}>{item.name}</h3>
    <div style={{fontSize:12,color:C.textDim,marginBottom:10}}>{item.inventoryNumber}</div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
      <div>
        <div style={{fontSize:24,fontWeight:800,color:item.quantity<=item.minQuantity&&item.minQuantity>0?C.danger:C.text}}>{item.quantity} <span style={{fontSize:13,fontWeight:400,color:C.textDim}}>{item.unit}</span></div>
        <div style={{fontSize:12,color:C.textDim,marginTop:2}}>{item.category} · {item.source}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:12,color:C.textDim}}>{wh?.name||"—"}</div>
        {item.price>0&&<div style={{fontSize:13,fontWeight:600,color:C.accentLight,marginTop:2}}>{fmtCur(item.price*item.quantity,item.currency)}</div>}
      </div>
    </div>
  </div>);
}

// Item Detail Modal
function ItemDetail({item,onClose,warehouses,projects,movements,onEdit,onMovement,userRole}){
  if(!item)return null;
  const wh=warehouses.find(w=>w.id===item.warehouseId);
  const proj=projects.find(p=>p.id===item.projectId);
  const im=movements.filter(m=>m.itemId===item.id).sort((a,b)=>b.date.localeCompare(a.date));
  const canEdit=userRole==="admin"||(userRole==="logistics"&&im.length===0);
  const F=({l,v})=><div style={{marginBottom:12}}><div style={lbl}>{l}</div><div style={{fontSize:14}}>{v||"—"}</div></div>;
  return(<Modal open={true} onClose={onClose} title={item.name} wide>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 24px"}}>
      <F l="Категорія" v={item.category}/><F l="Одиниця" v={item.unit}/>
      <F l="Кількість" v={`${item.quantity} ${item.unit}`}/><F l="Мін. кількість" v={item.minQuantity}/>
      <F l="Джерело" v={item.source}/><F l="Склад" v={wh?.name}/>
      <F l="Проєкт" v={proj?.name}/><F l="Інв. №" v={item.inventoryNumber}/>
      <F l="Термін" v={item.expiryDate==="2099-12-31"?"Необмежений":fmtDate(item.expiryDate)}/>
      <F l="Ціна" v={item.price?fmtCur(item.price,item.currency):"—"}/>
      <F l="Виробник" v={item.manufacturer}/><F l="Стан" v={item.condition}/>
    </div>
    {item.notes&&<div style={{marginTop:4,padding:12,background:C.bg,borderRadius:8,fontSize:13,color:C.textDim}}>📝 {item.notes}</div>}
    <div style={{display:"flex",gap:8,marginTop:20,flexWrap:"wrap"}}>
      {canEdit&&<button style={btn("ghost")} onClick={()=>onEdit(item)}><I n="edit" s={14}/> Редагувати</button>}
      <button style={btn("ghost")} onClick={()=>printLabels([item],projects)}><I n="print" s={14}/> Етикетка</button>
      <button style={btn("outline")} onClick={()=>onMovement("incoming",item)}><span style={{color:C.success}}>↓</span> Прихід</button>
      <button style={btn("outline")} onClick={()=>onMovement("outgoing",item)}><span style={{color:C.danger}}>↑</span> Видача</button>
      <button style={btn("outline")} onClick={()=>onMovement("transfer",item)}>⇄ Переміщення</button>
    </div>
    {im.length>0&&<div style={{marginTop:20}}>
      <h3 style={{fontSize:14,fontWeight:700,marginBottom:8,color:C.textDim}}>Останні операції</h3>
      <div style={{maxHeight:200,overflow:"auto"}}>{im.slice(0,5).map(m=>(
        <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}22`,fontSize:13}}>
          <span style={{...badge(MT[m.type].color),minWidth:28,justifyContent:"center"}}>{MT[m.type].icon}</span>
          <span style={{flex:1}}>{MT[m.type].label}</span>
          <span style={{fontWeight:700}}>{m.type==="outgoing"||m.type==="writeoff"?"-":"+"}{m.quantity}</span>
          <span style={{color:C.textDim,fontSize:12}}>{fmtDate(m.date)}</span>
        </div>
      ))}</div>
    </div>}
  </Modal>);
}

// Movement Form
function MoveForm({type,item,onClose,onSave,warehouses,items}){
  const cfg=MT[type];
  const [f,sF]=useState({itemId:item?.id||"",quantity:"",supplier:"",recipientName:"",responsiblePerson:"",fromWarehouseId:item?.warehouseId||"",toWarehouseId:"",date:new Date().toISOString().split("T")[0],notes:"",reason:"",actNumber:"",approvedBy:"",qualityCheck:"accepted",factualQuantity:""});
  const [err,sErr]=useState("");
  const si=items.find(i=>i.id===f.itemId)||item;
  const save=()=>{
    sErr("");
    if(!f.itemId&&!item)return sErr("Оберіть товар");
    const q=type==="adjustment"?parseFloat(f.factualQuantity):parseFloat(f.quantity);
    if(isNaN(q)||q<0)return sErr("Вкажіть коректну кількість");
    if((type==="outgoing"||type==="transfer"||type==="writeoff")&&q>si.quantity)return sErr(`Недостатньо: на складі ${si.quantity} ${si.unit}`);
    if(type==="transfer"&&f.fromWarehouseId===f.toWarehouseId)return sErr("Склади повинні відрізнятися");
    onSave({id:uid(),type,itemId:si.id,itemName:si.name,quantity:type==="adjustment"?Math.abs(q-si.quantity):q,factualQuantity:type==="adjustment"?q:undefined,fromWarehouseId:f.fromWarehouseId||si?.warehouseId,toWarehouseId:f.toWarehouseId,date:f.date,supplier:f.supplier,recipientName:f.recipientName,responsiblePerson:f.responsiblePerson,notes:f.notes,reason:f.reason,actNumber:f.actNumber,approvedBy:f.approvedBy,qualityCheck:f.qualityCheck,createdAt:new Date().toISOString()});
  };
  const F=({l,ch})=><div style={{marginBottom:14}}><label style={lbl}>{l}</label>{ch}</div>;
  return(<Modal open={true} onClose={onClose} title={`${cfg.icon} ${cfg.label}`}>
    {si&&<div style={{padding:12,background:C.bg,borderRadius:8,marginBottom:16,display:"flex",justifyContent:"space-between"}}>
      <div><div style={{fontWeight:700,fontSize:14}}>{si.name}</div><div style={{fontSize:12,color:C.textDim}}>{si.inventoryNumber}</div></div>
      <div style={{textAlign:"right"}}><div style={{fontSize:18,fontWeight:800}}>{si.quantity}</div><div style={{fontSize:11,color:C.textDim}}>{si.unit} на складі</div></div>
    </div>}
    {!item&&<F l="Товар *" ch={<select style={sel} value={f.itemId} onChange={e=>sF(x=>({...x,itemId:e.target.value}))}><option value="">Оберіть товар...</option>{items.filter(i=>!i.isDeleted).map(i=><option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</option>)}</select>}/>}
    {type==="adjustment"?
      <F l="Фактична кількість *" ch={<><input style={inp} type="number" min="0" value={f.factualQuantity} onChange={e=>sF(x=>({...x,factualQuantity:e.target.value}))}/>{f.factualQuantity&&si&&<div style={{marginTop:6,fontSize:13,color:parseFloat(f.factualQuantity)-si.quantity>=0?C.success:C.danger}}>Різниця: {parseFloat(f.factualQuantity)-si.quantity>0?"+":""}{parseFloat(f.factualQuantity)-si.quantity} {si.unit}</div>}</>}/>
      :<F l="Кількість *" ch={<input style={inp} type="number" min="1" value={f.quantity} onChange={e=>sF(x=>({...x,quantity:e.target.value}))}/>}/>
    }
    <F l="Дата *" ch={<input style={inp} type="date" value={f.date} onChange={e=>sF(x=>({...x,date:e.target.value}))}/>}/>
    {type==="incoming"&&<><F l="Постачальник" ch={<input style={inp} value={f.supplier} onChange={e=>sF(x=>({...x,supplier:e.target.value}))}/>}/>
      <F l="Перевірка якості" ch={<div style={{display:"flex",gap:12}}>{["accepted","rejected"].map(v=><label key={v} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:14}}><input type="radio" name="qc" value={v} checked={f.qualityCheck===v} onChange={e=>sF(x=>({...x,qualityCheck:e.target.value}))}/>{v==="accepted"?"✓ Прийнято":"✕ Відхилено"}</label>)}</div>}/></>}
    {type==="outgoing"&&<F l="Отримувач *" ch={<input style={inp} value={f.recipientName} onChange={e=>sF(x=>({...x,recipientName:e.target.value}))}/>}/>}
    {type==="transfer"&&<F l="На склад *" ch={<select style={sel} value={f.toWarehouseId} onChange={e=>sF(x=>({...x,toWarehouseId:e.target.value}))}><option value="">Оберіть...</option>{warehouses.filter(w=>w.isActive&&w.id!==si?.warehouseId).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}/>}
    {type==="writeoff"&&<><F l="Причина *" ch={<select style={sel} value={f.reason} onChange={e=>sF(x=>({...x,reason:e.target.value}))}><option value="">Оберіть...</option>{WO_REASONS.map(r=><option key={r} value={r}>{r}</option>)}</select>}/>
      <F l="Акт №" ch={<input style={inp} value={f.actNumber} onChange={e=>sF(x=>({...x,actNumber:e.target.value}))}/>}/>
      <F l="Затвердив" ch={<input style={inp} value={f.approvedBy} onChange={e=>sF(x=>({...x,approvedBy:e.target.value}))}/>}/></>}
    <F l="Відповідальна особа" ch={<input style={inp} value={f.responsiblePerson} onChange={e=>sF(x=>({...x,responsiblePerson:e.target.value}))}/>}/>
    <F l="Примітки" ch={<input style={inp} value={f.notes} onChange={e=>sF(x=>({...x,notes:e.target.value}))}/>}/>
    {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12,padding:8,background:`${C.danger}11`,borderRadius:6}}>{err}</div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
      <button style={btn("ghost")} onClick={onClose}>Скасувати</button>
      <button style={btn("primary")} onClick={save}><I n="check" s={14}/> Зберегти</button>
    </div>
  </Modal>);
}

// Item Form (Add/Edit)
function ItemForm({item,onClose,onSave,warehouses,projects}){
  const isE=!!item;
  const [f,sF]=useState(item?{...item}:{name:"",category:"",unit:"шт",quantity:0,minQuantity:0,source:"",warehouseId:warehouses[0]?.id||"",projectId:"",expiryDate:"",price:0,currency:"UAH",manufacturer:"",condition:"Новий",notes:""});
  const [err,sErr]=useState("");
  const save=()=>{
    if(!f.name.trim())return sErr("Назва обов'язкова");
    if(!f.category)return sErr("Оберіть категорію");
    if(!f.source)return sErr("Вкажіть джерело");
    if(!f.warehouseId)return sErr("Оберіть склад");
    onSave({...f,id:f.id||uid(),qrCode:f.qrCode||uid(),inventoryNumber:f.inventoryNumber||invNum(Math.floor(Math.random()*9000)+1000),isDeleted:false,createdAt:f.createdAt||new Date().toISOString(),lastMovementAt:f.lastMovementAt||null,quantity:isE?f.quantity:0,price:parseFloat(f.price)||0,minQuantity:parseInt(f.minQuantity)||0});
  };
  const F=({l,ch,half})=><div style={{marginBottom:14,...(half?{flex:"1 1 45%"}:{})}}><label style={lbl}>{l}</label>{ch}</div>;
  return(<Modal open={true} onClose={onClose} title={isE?"Редагувати товар":"Новий товар"} wide>
    <div style={{display:"flex",flexWrap:"wrap",gap:"0 16px"}}>
      <F l="Назва *" half ch={<input style={inp} value={f.name} onChange={e=>sF(x=>({...x,name:e.target.value}))}/>}/>
      <F l="Категорія *" half ch={<select style={sel} value={f.category} onChange={e=>sF(x=>({...x,category:e.target.value}))}><option value="">Оберіть...</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>}/>
      <F l="Одиниця *" half ch={<select style={sel} value={f.unit} onChange={e=>sF(x=>({...x,unit:e.target.value}))}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select>}/>
      <F l="Джерело *" half ch={<select style={sel} value={f.source} onChange={e=>sF(x=>({...x,source:e.target.value}))}><option value="">Оберіть...</option>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select>}/>
      <F l="Склад *" half ch={<select style={sel} value={f.warehouseId} onChange={e=>sF(x=>({...x,warehouseId:e.target.value}))}>{warehouses.filter(w=>w.isActive).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>}/>
      <F l="Проєкт" half ch={<select style={sel} value={f.projectId} onChange={e=>sF(x=>({...x,projectId:e.target.value}))}><option value="">—</option>{projects.filter(p=>p.isActive).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}/>
      <F l="Мін. кількість" half ch={<input style={inp} type="number" value={f.minQuantity} onChange={e=>sF(x=>({...x,minQuantity:e.target.value}))}/>}/>
      <F l="Термін придатності" half ch={<><input style={inp} type="date" value={f.expiryDate} onChange={e=>sF(x=>({...x,expiryDate:e.target.value}))}/><div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Порожньо = необмежений</div></>}/>
      <F l="Ціна" half ch={<input style={inp} type="number" step="0.01" value={f.price} onChange={e=>sF(x=>({...x,price:e.target.value}))}/>}/>
      <F l="Валюта" half ch={<select style={sel} value={f.currency} onChange={e=>sF(x=>({...x,currency:e.target.value}))}>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select>}/>
      <F l="Виробник" half ch={<input style={inp} value={f.manufacturer} onChange={e=>sF(x=>({...x,manufacturer:e.target.value}))}/>}/>
      <F l="Стан" half ch={<select style={sel} value={f.condition} onChange={e=>sF(x=>({...x,condition:e.target.value}))}>{CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}</select>}/>
      <F l="Примітки" ch={<input style={inp} value={f.notes} onChange={e=>sF(x=>({...x,notes:e.target.value}))}/>}/>
    </div>
    {err&&<div style={{color:C.danger,fontSize:13,marginBottom:12,padding:8,background:`${C.danger}11`,borderRadius:6}}>{err}</div>}
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
      <button style={btn("ghost")} onClick={onClose}>Скасувати</button>
      <button style={btn("primary")} onClick={save}><I n="check" s={14}/> {isE?"Зберегти":"Додати"}</button>
    </div>
  </Modal>);
}

// PAGES
function WarehousePg({items,warehouses,projects,movements,settings,setItems,addMove,userRole}){
  const [search,setSearch]=useState("");
  const [fCat,sFCat]=useState("");
  const [fWh,sFWh]=useState("");
  const [fSrc,sFSrc]=useState("");
  const [selItem,setSelItem]=useState(null);
  const [editItem,setEditItem]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [moveM,setMoveM]=useState(null);
  const [showF,setShowF]=useState(false);
  const [checked,setChecked]=useState(new Set());
  const [showImport,setShowImport]=useState(false);

  const fi=useMemo(()=>items.filter(i=>{
    if(i.isDeleted)return false;
    if(search){const s=search.toLowerCase();if(!i.name.toLowerCase().includes(s)&&!i.inventoryNumber?.toLowerCase().includes(s)&&!i.manufacturer?.toLowerCase().includes(s))return false;}
    if(fCat&&i.category!==fCat)return false;if(fWh&&i.warehouseId!==fWh)return false;if(fSrc&&i.source!==fSrc)return false;return true;
  }),[items,search,fCat,fWh,fSrc]);

  const toggleCheck=(id)=>setChecked(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleAll=()=>setChecked(p=>p.size===fi.length?new Set():new Set(fi.map(i=>i.id)));

  const saveItem=(ni)=>{setItems(p=>{const idx=p.findIndex(i=>i.id===ni.id);if(idx>=0){const c=[...p];c[idx]=ni;return c;}return[...p,ni];});setShowAdd(false);setEditItem(null);setSelItem(null);};
  const saveMove=(m)=>{
    addMove(m);
    setItems(p=>p.map(i=>{if(i.id!==m.itemId)return i;let q=i.quantity;
      if(m.type==="incoming"&&m.qualityCheck!=="rejected")q+=m.quantity;
      else if(m.type==="outgoing"||m.type==="writeoff")q-=m.quantity;
      else if(m.type==="transfer")q-=m.quantity;
      else if(m.type==="adjustment")q=m.factualQuantity;
      return{...i,quantity:q,lastMovementAt:m.date};}));
    if(m.type==="transfer"){setItems(p=>{const src=p.find(i=>i.id===m.itemId);if(!src)return p;
      const dest=p.find(i=>i.name===src.name&&i.warehouseId===m.toWarehouseId&&!i.isDeleted);
      if(dest)return p.map(i=>i.id===dest.id?{...i,quantity:i.quantity+m.quantity,lastMovementAt:m.date}:i);
      return[...p,{...src,id:uid(),warehouseId:m.toWarehouseId,quantity:m.quantity,inventoryNumber:invNum(Math.floor(Math.random()*9000)+1000),qrCode:uid(),lastMovementAt:m.date}];});}
    setMoveM(null);setSelItem(null);
  };

  // Import handler
  const handleImport=(importedItems)=>{
    setItems(p=>[...p,...importedItems]);
    setShowImport(false);
  };

  return(<div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{flex:1,minWidth:200,position:"relative"}}>
        <input style={{...inp,paddingLeft:36}} placeholder="Пошук за назвою, інв. №, виробником..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><I n="search" s={16} c={C.textMuted}/></div>
      </div>
      <button style={btn("ghost")} onClick={()=>setShowF(!showF)}><I n="filter" s={14}/> Фільтри</button>
      {checked.size>0&&<button style={btn("outline")} onClick={()=>printLabels(items.filter(i=>checked.has(i.id)),projects)}><I n="print" s={14}/> Друк ({checked.size})</button>}
      {userRole!=="field"&&<>
        <button style={btn("ghost")} onClick={()=>setShowImport(true)}><I n="upload" s={14}/> Імпорт</button>
        <button style={btn("primary")} onClick={()=>setShowAdd(true)}><I n="plus" s={14}/> Додати</button>
      </>}
    </div>
    {showF&&<div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",padding:12,background:C.bgCard,borderRadius:10,border:`1px solid ${C.border}`}}>
      <select style={{...sel,width:"auto",minWidth:140}} value={fCat} onChange={e=>sFCat(e.target.value)}><option value="">Всі категорії</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <select style={{...sel,width:"auto",minWidth:140}} value={fWh} onChange={e=>sFWh(e.target.value)}><option value="">Всі склади</option>{warehouses.filter(w=>w.isActive).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <select style={{...sel,width:"auto",minWidth:140}} value={fSrc} onChange={e=>sFSrc(e.target.value)}><option value="">Всі джерела</option>{SOURCES.map(s=><option key={s} value={s}>{s}</option>)}</select>
      {(fCat||fWh||fSrc)&&<button style={{...btn("ghost"),fontSize:12}} onClick={()=>{sFCat("");sFWh("");sFSrc("");}}>Скинути</button>}
    </div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <span style={{fontSize:13,color:C.textDim}}>Показано: {fi.length} з {items.filter(i=>!i.isDeleted).length}</span>
      {fi.length>0&&<label style={{fontSize:12,color:C.textDim,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
        <input type="checkbox" checked={checked.size===fi.length&&fi.length>0} onChange={toggleAll}/> Обрати всі
      </label>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))",gap:12}}>
      {fi.map(item=>(
        <div key={item.id} style={{position:"relative"}}>
          <div style={{position:"absolute",top:8,left:8,zIndex:2}} onClick={e=>e.stopPropagation()}>
            <input type="checkbox" checked={checked.has(item.id)} onChange={()=>toggleCheck(item.id)} style={{width:16,height:16,cursor:"pointer",accentColor:C.accent}}/>
          </div>
          <ItemCard item={item} warehouses={warehouses} alerts={getAlerts(item,settings)} onClick={()=>setSelItem(item)}/>
        </div>
      ))}
    </div>
    {fi.length===0&&<div style={{textAlign:"center",padding:60,color:C.textMuted}}><I n="box" s={48} c={C.textMuted}/><div style={{marginTop:12,fontSize:16}}>Товарів не знайдено</div></div>}
    {selItem&&<ItemDetail item={selItem} onClose={()=>setSelItem(null)} warehouses={warehouses} projects={projects} movements={movements} userRole={userRole} onEdit={i=>{setSelItem(null);setEditItem(i);}} onMovement={(t,i)=>{setSelItem(null);setMoveM({type:t,item:i});}}/>}
    {(showAdd||editItem)&&<ItemForm item={editItem} onClose={()=>{setShowAdd(false);setEditItem(null);}} onSave={saveItem} warehouses={warehouses} projects={projects}/>}
    {moveM&&<MoveForm type={moveM.type} item={moveM.item} onClose={()=>setMoveM(null)} onSave={saveMove} warehouses={warehouses} items={items}/>}
    {showImport&&<ImportModal onClose={()=>setShowImport(false)} onImport={handleImport} warehouses={warehouses}/>}
  </div>);
}

function MovementsPg({items,movements,warehouses,addMove,setItems}){
  const [tf,sTf]=useState("");
  const [moveM,setMoveM]=useState(null);
  const fl=useMemo(()=>{let m=[...movements].sort((a,b)=>b.date.localeCompare(a.date));if(tf)m=m.filter(x=>x.type===tf);return m;},[movements,tf]);
  const saveM=(m)=>{addMove(m);setItems(p=>p.map(i=>{if(i.id!==m.itemId)return i;let q=i.quantity;
    if(m.type==="incoming"&&m.qualityCheck!=="rejected")q+=m.quantity;else if(m.type==="outgoing"||m.type==="writeoff")q-=m.quantity;else if(m.type==="transfer")q-=m.quantity;else if(m.type==="adjustment")q=m.factualQuantity;
    return{...i,quantity:q,lastMovementAt:m.date};}));setMoveM(null);};
  return(<div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <h2 style={{fontSize:20,fontWeight:700,margin:0,flex:1}}>Операції</h2>
      <select style={{...sel,width:"auto",minWidth:140}} value={tf} onChange={e=>sTf(e.target.value)}><option value="">Всі типи</option>{Object.entries(MT).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select>
      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.entries(MT).map(([k,v])=>(
        <button key={k} style={{...btn("ghost"),fontSize:12,padding:"6px 10px"}} onClick={()=>setMoveM({type:k})}><span style={{color:v.color}}>{v.icon}</span> {v.label}</button>
      ))}</div>
    </div>
    <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
      <th style={th}>Тип</th><th style={th}>Дата</th><th style={th}>Товар</th><th style={th}>К-ть</th><th style={th}>Деталі</th><th style={th}>Відповід.</th>
    </tr></thead><tbody>{fl.map(m=>{
      const wF=warehouses.find(w=>w.id===m.fromWarehouseId),wT=warehouses.find(w=>w.id===m.toWarehouseId);
      return(<tr key={m.id}><td style={td}><span style={badge(MT[m.type].color)}>{MT[m.type].icon} {MT[m.type].label}</span></td>
        <td style={td}>{fmtDate(m.date)}</td><td style={{...td,fontWeight:600}}>{m.itemName}</td>
        <td style={{...td,fontWeight:700,color:m.type==="incoming"?C.success:m.type==="outgoing"||m.type==="writeoff"?C.danger:C.text}}>{m.type==="incoming"?"+":m.type==="outgoing"||m.type==="writeoff"?"-":""}{m.quantity}</td>
        <td style={{...td,fontSize:12,color:C.textDim}}>{m.supplier&&`від: ${m.supplier}`}{m.recipientName&&`→ ${m.recipientName}`}{m.type==="transfer"&&`${wF?.name||"?"} → ${wT?.name||"?"}`}{m.reason&&`Причина: ${m.reason}`}</td>
        <td style={{...td,fontSize:13}}>{m.responsiblePerson||"—"}</td></tr>);
    })}</tbody></table></div>
    {fl.length===0&&<div style={{textAlign:"center",padding:40,color:C.textMuted}}>Операцій не знайдено</div>}
    {moveM&&<MoveForm type={moveM.type} item={null} onClose={()=>setMoveM(null)} onSave={saveM} warehouses={warehouses} items={items}/>}
  </div>);
}

function AnalyticsPg({items,movements,warehouses,settings}){
  const ai=items.filter(i=>!i.isDeleted);
  const tv=ai.reduce((s,i)=>s+(i.price||0)*i.quantity,0);
  const aa=ai.flatMap(i=>getAlerts(i,settings));
  const tm=new Date().toISOString().slice(0,7);
  const tmm=movements.filter(m=>m.date?.startsWith(tm));
  const cm={};ai.forEach(i=>{cm[i.category]=(cm[i.category]||0)+(i.price||0)*i.quantity;});
  const ce=Object.entries(cm).sort((a,b)=>b[1]-a[1]);const mcv=ce[0]?.[1]||1;
  const wm={};ai.forEach(i=>{if(!wm[i.warehouseId])wm[i.warehouseId]={count:0,value:0};wm[i.warehouseId].count++;wm[i.warehouseId].value+=(i.price||0)*i.quantity;});
  const sm={};ai.forEach(i=>{if(!sm[i.source])sm[i.source]={count:0,value:0};sm[i.source].count++;sm[i.source].value+=(i.price||0)*i.quantity;});
  const se=Object.entries(sm).sort((a,b)=>b[1].value-a[1].value);
  const cc=["#2e75b6","#8b5cf6","#22c55e","#eab308","#f97316","#ef4444","#06b6d4","#ec4899"];
  return(<div>
    <h2 style={{fontSize:20,fontWeight:700,margin:"0 0 16px"}}>Аналітика</h2>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:12,marginBottom:24}}>
      <div style={kpi}><div style={{fontSize:12,color:C.textDim,textTransform:"uppercase",letterSpacing:1}}>Позицій</div><div style={{fontSize:32,fontWeight:800,marginTop:4}}>{ai.length}</div></div>
      <div style={kpi}><div style={{fontSize:12,color:C.textDim,textTransform:"uppercase",letterSpacing:1}}>Загальна вартість</div><div style={{fontSize:28,fontWeight:800,marginTop:4,color:C.accentLight}}>{fmtCur(tv)}</div></div>
      <div style={kpi}><div style={{fontSize:12,color:C.textDim,textTransform:"uppercase",letterSpacing:1}}>Сповіщення</div><div style={{fontSize:32,fontWeight:800,marginTop:4,color:aa.length>0?C.warning:C.success}}>{aa.length}</div></div>
      <div style={kpi}><div style={{fontSize:12,color:C.textDim,textTransform:"uppercase",letterSpacing:1}}>Операцій (міс)</div><div style={{fontSize:32,fontWeight:800,marginTop:4}}>{tmm.length}</div></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
        <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.textDim}}>Вартість за категоріями</h3>
        {ce.map(([cat,val],i)=>(<div key={cat} style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span>{cat}</span><span style={{fontWeight:600}}>{fmtCur(val)}</span></div>
          <div style={{height:6,background:C.bg,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${(val/mcv)*100}%`,background:cc[i%cc.length],borderRadius:3,transition:"width 0.5s"}}/></div>
        </div>))}
      </div>
      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
        <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.textDim}}>Залишки по складах</h3>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={{...th,fontSize:11}}>Склад</th><th style={{...th,fontSize:11}}>Поз.</th><th style={{...th,fontSize:11}}>Вартість</th></tr></thead>
        <tbody>{warehouses.filter(w=>w.isActive).map(w=>{const d=wm[w.id]||{count:0,value:0};return(
          <tr key={w.id}><td style={{...td,fontWeight:600}}>{w.name}</td><td style={td}>{d.count}</td><td style={{...td,color:C.accentLight}}>{fmtCur(d.value)}</td></tr>
        );})}</tbody></table>
      </div>
      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:12,padding:20,gridColumn:"1 / -1"}}>
        <h3 style={{fontSize:14,fontWeight:700,margin:"0 0 16px",color:C.textDim}}>Залишки по донорах</h3>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={th}>Джерело</th><th style={th}>Поз.</th><th style={th}>Вартість</th><th style={th}>%</th></tr></thead>
        <tbody>{se.map(([src,d])=>(<tr key={src}><td style={{...td,fontWeight:600}}>{src}</td><td style={td}>{d.count}</td><td style={{...td,color:C.accentLight}}>{fmtCur(d.value)}</td><td style={td}>{tv>0?((d.value/tv)*100).toFixed(1):0}%</td></tr>))}</tbody></table>
      </div>
    </div>
  </div>);
}

// IMPORT MODAL
function ImportModal({onClose,onImport,warehouses}){
  const [step,setStep]=useState(1);
  const [whId,setWhId]=useState(warehouses[0]?.id||"");
  const [preview,setPreview]=useState([]);
  const [file,setFile]=useState(null);

  const handleFile=(e)=>{
    const f=e.target.files?.[0];if(!f)return;
    setFile(f);
    // Parse Excel — in production uses SheetJS, here simulate preview
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        // Try to parse with SheetJS if available
        if(typeof XLSX!=="undefined"){
          const wb=XLSX.read(ev.target.result,{type:"array"});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const data=XLSX.utils.sheet_to_json(ws);
          setPreview(data.slice(0,50).map(row=>({
            name:row["Назва"]||row["name"]||"",
            category:row["Категорія"]||row["category"]||"Інше",
            unit:row["Одиниця"]||row["unit"]||"шт",
            quantity:parseInt(row["Кількість"]||row["quantity"])||0,
            source:row["Джерело"]||row["source"]||"",
            price:parseFloat(row["Ціна"]||row["price"])||0,
            manufacturer:row["Виробник"]||row["manufacturer"]||"",
            expiryDate:row["Термін придатності"]||row["expiryDate"]||"2099-12-31",
            condition:row["Стан"]||"Новий",
            _action:"add",
          })));
        }else{
          // Fallback: show demo preview
          setPreview([{name:"(SheetJS не завантажено — демо-режим)",category:"Інше",unit:"шт",quantity:0,source:"",price:0,_action:"skip"}]);
        }
        setStep(3);
      }catch(err){setPreview([{name:"Помилка читання файлу",_action:"skip"}]);setStep(3);}
    };
    reader.readAsArrayBuffer(f);
  };

  const doImport=()=>{
    const toAdd=preview.filter(r=>r._action==="add"&&r.name);
    const newItems=toAdd.map(r=>({
      id:uid(),name:r.name,category:r.category||"Інше",unit:r.unit||"шт",quantity:r.quantity||0,minQuantity:0,
      source:r.source||"",warehouseId:whId,projectId:"",inventoryNumber:invNum(Math.floor(Math.random()*9000)+1000),
      expiryDate:r.expiryDate||"2099-12-31",price:r.price||0,currency:"UAH",manufacturer:r.manufacturer||"",
      condition:r.condition||"Новий",notes:"Імпорт Excel",qrCode:uid(),isDeleted:false,
      createdAt:new Date().toISOString(),lastMovementAt:null
    }));
    onImport(newItems);
  };

  const downloadTemplate=()=>{
    const tplData=[["Назва","Категорія","Одиниця","Кількість","Джерело","Ціна","Валюта","Виробник","Термін придатності","Стан","Примітки"],
      ["Приклад товару","Гігієна","шт","100","UNICEF","150","UAH","Виробник","2027-12-31","Новий",""]];
    exportXlsx([{name:"Шаблон",data:tplData}],"WMS_Import_Template.xlsx").catch(()=>alert("Не вдалося створити шаблон"));
  };

  return(<Modal open={true} onClose={onClose} title="Імпорт Excel" wide>
    {step===1&&<div>
      <div style={{marginBottom:16}}><label style={lbl}>Склад для імпортованих товарів</label>
        <select style={sel} value={whId} onChange={e=>setWhId(e.target.value)}>{warehouses.filter(w=>w.isActive).map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      </div>
      <button style={btn("primary")} onClick={()=>setStep(2)}>Далі →</button>
    </div>}
    {step===2&&<div>
      <div style={{textAlign:"center",padding:30,border:`2px dashed ${C.border}`,borderRadius:12,marginBottom:16,cursor:"pointer"}} onClick={()=>document.getElementById("import-file-input")?.click()}>
        <I n="upload" s={36} c={C.textDim}/>
        <div style={{marginTop:8,fontSize:14}}>Завантажте .xlsx файл</div>
        <div style={{fontSize:12,color:C.textDim,marginTop:4}}>Або перетягніть сюди</div>
        <input id="import-file-input" type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFile}/>
      </div>
      <button style={{...btn("ghost"),fontSize:12}} onClick={downloadTemplate}><I n="download" s={14}/> Завантажити шаблон</button>
    </div>}
    {step===3&&<div>
      <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>Попередній перегляд ({preview.filter(r=>r._action==="add").length} позицій)</div>
      <div style={{maxHeight:300,overflow:"auto",border:`1px solid ${C.border}`,borderRadius:8,marginBottom:16}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>
          <th style={{...th,fontSize:10}}>Дія</th><th style={{...th,fontSize:10}}>Назва</th><th style={{...th,fontSize:10}}>К-ть</th><th style={{...th,fontSize:10}}>Джерело</th>
        </tr></thead><tbody>
          {preview.map((r,i)=><tr key={i}><td style={td}>
            <select style={{...sel,width:80,fontSize:11,padding:4}} value={r._action} onChange={e=>{const n=[...preview];n[i]={...n[i],_action:e.target.value};setPreview(n);}}>
              <option value="add">Додати</option><option value="skip">Пропустити</option>
            </select>
          </td><td style={{...td,fontSize:12}}>{r.name}</td><td style={{...td,fontSize:12}}>{r.quantity}</td><td style={{...td,fontSize:12}}>{r.source}</td></tr>)}
        </tbody></table>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button style={btn("ghost")} onClick={onClose}>Скасувати</button>
        <button style={btn("primary")} onClick={doImport}><I n="check" s={14}/> Імпортувати {preview.filter(r=>r._action==="add").length} позицій</button>
      </div>
    </div>}
  </Modal>);
}

// INVENTORY WORKFLOW
function InventoryPg({items,warehouses,settings,setItems,addMove}){
  const [step,setStep]=useState(1);
  const [whId,setWhId]=useState("");
  const [responsible,setResponsible]=useState("");
  const [scanned,setScanned]=useState([]); // [{itemId,itemName,systemQty,factQty,unit,price}]
  const [manualId,setManualId]=useState("");
  const [factInput,setFactInput]=useState("");

  const whItems=useMemo(()=>items.filter(i=>!i.isDeleted&&i.warehouseId===whId),[items,whId]);
  const unscanned=whItems.filter(i=>!scanned.find(s=>s.itemId===i.id));
  const discrepancies=scanned.filter(s=>s.systemQty!==s.factQty);
  const totalShortage=discrepancies.reduce((s,d)=>{const diff=d.systemQty-d.factQty;return s+(diff>0?diff*(d.price||0):0);},0);

  const addScan=(itemId,factQty)=>{
    const item=items.find(i=>i.id===itemId);if(!item)return;
    setScanned(p=>{
      const ex=p.findIndex(s=>s.itemId===itemId);
      const entry={itemId,itemName:item.name,systemQty:item.quantity,factQty:parseInt(factQty)||0,unit:item.unit,price:item.price||0,inventoryNumber:item.inventoryNumber};
      if(ex>=0){const n=[...p];n[ex]=entry;return n;}
      return[...p,entry];
    });
    setManualId("");setFactInput("");
  };

  const applyAll=()=>{
    const today=new Date().toISOString().split("T")[0];
    discrepancies.forEach(d=>{
      const diff=d.factQty-d.systemQty;
      const movement={id:uid(),type:"adjustment",itemId:d.itemId,itemName:d.itemName,quantity:Math.abs(diff),factualQuantity:d.factQty,
        date:today,responsiblePerson:responsible,notes:`Інвентаризація: ${diff>0?"+":""}${diff}`,createdAt:new Date().toISOString()};
      addMove(movement);
    });
    setItems(p=>p.map(i=>{const s=discrepancies.find(d=>d.itemId===i.id);if(!s)return i;return{...i,quantity:s.factQty,lastMovementAt:new Date().toISOString().split("T")[0]};}));
    setStep(4);
  };

  const exportInventory=()=>{
    const wh=warehouses.find(w=>w.id===whId);
    const data=[["БО «100% Життя» Дніпровський регіон"],["ІНВЕНТАРИЗАЦІЙНИЙ АКТ"],[`Склад: ${wh?.name||""}`],[`Дата: ${fmtDate(new Date())}`],[`Відповідальний: ${responsible}`],["Затвердив: ___________"],[]];
    data.push([["№","Назва","Інв.№","Одиниця","Облік","Факт","Різниця","Статус","Ціна","Сума нестачі"]]);
    scanned.forEach((s,i)=>{const diff=s.factQty-s.systemQty;
      data.push([[i+1,s.itemName,s.inventoryNumber||"",s.unit,s.systemQty,s.factQty,diff,diff===0?"Збіг":diff>0?"Надлишок":"Нестача",s.price,diff<0?Math.abs(diff)*s.price:0]]);
    });
    data.push([["","","","","","","","","РАЗОМ нестача:",totalShortage]]);
    exportXlsx([{name:"Інвентаризація",data:data.map(r=>r[0]?r[0]:r)}],`Inventory_${fmtDate(new Date()).replace(/\./g,"-")}.xlsx`).catch(()=>alert("Помилка експорту"));
  };

  return(<div>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Інвентаризація</h2>
    {/* Progress */}
    <div style={{display:"flex",gap:4,marginBottom:20}}>
      {[{n:1,l:"Склад"},{n:2,l:"Сканування"},{n:3,l:"Підсумки"}].map(s=>(
        <div key={s.n} style={{flex:1,padding:"8px 12px",borderRadius:8,textAlign:"center",fontSize:12,fontWeight:600,
          background:step>=s.n?`${C.accent}22`:"transparent",color:step>=s.n?C.accentLight:C.textMuted,border:`1px solid ${step>=s.n?C.accent+"44":C.border}`}}>
          {s.n}. {s.l}
        </div>
      ))}
    </div>

    {step===1&&<div style={{maxWidth:400}}>
      <div style={{marginBottom:16}}><label style={lbl}>Склад</label>
        <select style={sel} value={whId} onChange={e=>setWhId(e.target.value)}><option value="">Оберіть склад...</option>
          {warehouses.filter(w=>w.isActive).map(w=><option key={w.id} value={w.id}>{w.name} ({items.filter(i=>!i.isDeleted&&i.warehouseId===w.id).length} поз.)</option>)}</select>
      </div>
      <div style={{marginBottom:16}}><label style={lbl}>Відповідальна особа</label><input style={inp} value={responsible} onChange={e=>setResponsible(e.target.value)} placeholder="Прізвище І.Б."/></div>
      <button style={btn("primary")} onClick={()=>{if(whId&&responsible)setStep(2);}} disabled={!whId||!responsible}>Почати інвентаризацію →</button>
    </div>}

    {step===2&&<div>
      <div style={{padding:12,background:C.bgCard,borderRadius:10,border:`1px solid ${C.border}`,marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div><span style={{fontWeight:700}}>Перевірено:</span> {scanned.length} / {whItems.length}</div>
        <div><span style={{fontWeight:700}}>Розбіжностей:</span> <span style={{color:discrepancies.length>0?C.danger:C.success}}>{discrepancies.length}</span></div>
      </div>
      {/* Quick add */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"flex-end"}}>
        <div style={{flex:1}}><label style={lbl}>Товар</label>
          <select style={sel} value={manualId} onChange={e=>setManualId(e.target.value)}>
            <option value="">Оберіть або скануйте QR...</option>
            {whItems.map(i=><option key={i.id} value={i.id}>{i.name} ({i.inventoryNumber})</option>)}
          </select>
        </div>
        <div style={{width:100}}><label style={lbl}>Факт</label><input style={inp} type="number" min="0" value={factInput} onChange={e=>setFactInput(e.target.value)} placeholder="0"/></div>
        <button style={{...btn("primary"),marginBottom:0}} onClick={()=>{if(manualId&&factInput!=="")addScan(manualId,factInput);}}>+</button>
      </div>
      {/* Scanned list */}
      <div style={{maxHeight:300,overflow:"auto"}}>
        {scanned.map(s=>{const diff=s.factQty-s.systemQty;return(
          <div key={s.itemId} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderBottom:`1px solid ${C.border}22`,fontSize:13}}>
            <div style={{width:8,height:8,borderRadius:4,background:diff===0?C.success:C.danger}}/>
            <div style={{flex:1}}><div style={{fontWeight:600}}>{s.itemName}</div><div style={{fontSize:11,color:C.textDim}}>{s.inventoryNumber}</div></div>
            <div style={{textAlign:"center",minWidth:50}}><div style={{fontSize:11,color:C.textDim}}>Облік</div><div style={{fontWeight:700}}>{s.systemQty}</div></div>
            <div style={{textAlign:"center",minWidth:50}}><div style={{fontSize:11,color:C.textDim}}>Факт</div><div style={{fontWeight:700}}>{s.factQty}</div></div>
            <div style={{textAlign:"center",minWidth:50,color:diff===0?C.success:C.danger,fontWeight:700}}>
              {diff===0?"✓":`${diff>0?"+":""}${diff}`}
            </div>
          </div>
        );})}
      </div>
      {unscanned.length>0&&<div style={{marginTop:12,fontSize:12,color:C.textDim}}>Залишилось: {unscanned.length} позицій ({unscanned.slice(0,3).map(i=>i.name).join(", ")}{unscanned.length>3?"...":""})</div>}
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <button style={btn("ghost")} onClick={()=>setStep(1)}>← Назад</button>
        <button style={btn("primary")} onClick={()=>setStep(3)} disabled={scanned.length===0}>Підсумки →</button>
      </div>
    </div>}

    {step===3&&<div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
        <div style={kpi}><div style={{fontSize:12,color:C.textDim}}>Перевірено</div><div style={{fontSize:28,fontWeight:800}}>{scanned.length}</div></div>
        <div style={kpi}><div style={{fontSize:12,color:C.textDim}}>Розбіжностей</div><div style={{fontSize:28,fontWeight:800,color:discrepancies.length>0?C.danger:C.success}}>{discrepancies.length}</div></div>
        <div style={kpi}><div style={{fontSize:12,color:C.textDim}}>Сума нестачі</div><div style={{fontSize:22,fontWeight:800,color:totalShortage>0?C.danger:C.success}}>{fmtCur(totalShortage)}</div></div>
      </div>
      {discrepancies.length>0&&<div style={{marginBottom:16}}>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:8,color:C.textDim}}>Розбіжності</h3>
        {discrepancies.map(d=>{const diff=d.factQty-d.systemQty;return(
          <div key={d.itemId} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}22`,fontSize:13}}>
            <span style={{flex:1,fontWeight:600}}>{d.itemName}</span>
            <span>Облік: {d.systemQty}</span><span>→ Факт: {d.factQty}</span>
            <span style={{fontWeight:700,color:diff>0?C.success:C.danger}}>{diff>0?"+":""}{diff}</span>
            {diff<0&&<span style={{color:C.danger,fontSize:12}}>{fmtCur(Math.abs(diff)*d.price)}</span>}
          </div>
        );})}
      </div>}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button style={btn("ghost")} onClick={()=>setStep(2)}>← Повернутися</button>
        <button style={btn("outline")} onClick={exportInventory}><I n="download" s={14}/> Роздрукувати звіт (Excel)</button>
        {discrepancies.length>0&&<button style={btn("primary")} onClick={applyAll}><I n="check" s={14}/> Застосувати всі коригування</button>}
      </div>
    </div>}

    {step===4&&<div style={{textAlign:"center",padding:40}}>
      <div style={{width:64,height:64,borderRadius:16,background:`${C.success}22`,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
        <I n="check" s={32} c={C.success}/>
      </div>
      <h3 style={{fontSize:18,fontWeight:700}}>Інвентаризацію завершено</h3>
      <p style={{color:C.textDim,fontSize:14}}>Застосовано {discrepancies.length} коригувань</p>
      <button style={{...btn("primary"),marginTop:12}} onClick={()=>{setStep(1);setScanned([]);setWhId("");setResponsible("");}}>Нова інвентаризація</button>
    </div>}
  </div>);
}

function ReportsPg({items,movements,warehouses,settings}){
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  const [preparedBy,setPreparedBy]=useState("");

  const doExport=async(id)=>{
    try{
      let sheet;
      switch(id){
        case 1: sheet=genStockReport(items,warehouses,settings);break;
        case 2: sheet=genMovementsReport(movements,items,dateFrom,dateTo);break;
        case 3: sheet=genExpiryReport(items,settings);break;
        case 4: sheet=genDonorReport(items,movements);break;
        case 5: sheet=genWriteoffReport(movements,items);break;
        case 6: sheet=genInventorySheet(items,warehouses);break;
        default:return;
      }
      await exportXlsx([sheet],`WMS_Report_${id}_${new Date().toISOString().slice(0,10)}.xlsx`);
    }catch(e){alert("Помилка генерації звіту. Перезавантажте сторінку і спробуйте ще раз.");}
  };

  const reps=[{id:1,name:"Залишки на складі",desc:"Всі позиції з кількістю, ціною, вартістю",icon:"📊"},
    {id:2,name:"Журнал операцій",desc:"Всі операції за обраний період",icon:"📋"},
    {id:3,name:"Звіт по термінах",desc:"Товари з терміном придатності та статусом",icon:"⏰"},
    {id:4,name:"Донорський звіт",desc:"Групування за джерелом: надійшло/видано/залишок",icon:"🤝"},
    {id:5,name:"Акт списання",desc:"Операції списання з актом і підписом",icon:"✕"},
    {id:6,name:"Аркуш інвентаризації",desc:"Товари з колонками Облік / Факт / Різниця",icon:"📝"}];
  return(<div>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Звіти</h2>
    {/* Filters for all reports */}
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",padding:12,background:C.bgCard,borderRadius:10,border:`1px solid ${C.border}`}}>
      <div><label style={{...lbl,marginBottom:2}}>Дата від</label><input style={{...inp,width:140}} type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></div>
      <div><label style={{...lbl,marginBottom:2}}>Дата до</label><input style={{...inp,width:140}} type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div>
      <div><label style={{...lbl,marginBottom:2}}>Підготував</label><input style={{...inp,width:180}} value={preparedBy} onChange={e=>setPreparedBy(e.target.value)} placeholder="Прізвище І.Б."/></div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:12}}>
      {reps.map(r=><div key={r.id} style={{...card,cursor:"pointer",display:"flex",gap:14,alignItems:"flex-start"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        <div style={{fontSize:28}}>{r.icon}</div>
        <div><h3 style={{fontSize:15,fontWeight:700,margin:"0 0 4px"}}>{r.name}</h3>
          <p style={{fontSize:13,color:C.textDim,margin:0}}>{r.desc}</p>
          <button style={{...btn("outline"),marginTop:10,fontSize:12,padding:"6px 12px"}} onClick={()=>doExport(r.id)}><I n="download" s={12}/> Сформувати .xlsx</button>
        </div>
      </div>)}
    </div>
  </div>);
}

function SettingsPg({warehouses,projects,settings,setSettings}){
  const [tab,sTab]=useState("warehouses");
  return(<div>
    <h2 style={{fontSize:20,fontWeight:700,marginBottom:16}}>Налаштування</h2>
    <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:`1px solid ${C.border}`,paddingBottom:4}}>
      {["warehouses","projects","general"].map(t=><button key={t} onClick={()=>sTab(t)} style={{padding:"8px 16px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontSize:14,fontWeight:600,
        background:tab===t?C.accent:"transparent",color:tab===t?"#fff":C.textDim}}>
        {t==="warehouses"?"Склади":t==="projects"?"Проєкти":"Загальні"}</button>)}
    </div>
    {tab==="warehouses"&&warehouses.map(w=><div key={w.id} style={{...card,marginBottom:8,cursor:"default",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div style={{fontWeight:700}}>{w.name}</div><div style={{fontSize:12,color:C.textDim}}>{w.address}, {w.city}</div></div>
      <span style={badge(w.isActive?C.success:C.grey)}>{w.isActive?"Активний":"Неактивний"}</span></div>)}
    {tab==="projects"&&projects.map(p=><div key={p.id} style={{...card,marginBottom:8,cursor:"default",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div><div style={{fontWeight:700}}>{p.name}</div><div style={{fontSize:12,color:C.textDim}}>{p.donor} · {fmtDate(p.startDate)} — {fmtDate(p.endDate)}</div></div>
      <span style={badge(p.isActive?C.success:C.grey)}>{p.isActive?"Активний":"Завершений"}</span></div>)}
    {tab==="general"&&<div style={{maxWidth:400}}>
      <div style={{marginBottom:16}}><label style={lbl}>Назва організації</label><input style={inp} value={settings.organizationName} readOnly/></div>
      <div style={{marginBottom:16}}><label style={lbl}>Критичний термін (днів)</label><input style={inp} type="number" value={settings.criticalExpiryDays} onChange={e=>setSettings(s=>({...s,criticalExpiryDays:parseInt(e.target.value)||30}))}/></div>
      <div style={{marginBottom:16}}><label style={lbl}>Попередження (днів)</label><input style={inp} type="number" value={settings.warningExpiryDays} onChange={e=>setSettings(s=>({...s,warningExpiryDays:parseInt(e.target.value)||90}))}/></div>
      <div style={{marginBottom:16}}><label style={lbl}>Мертвий запас (днів)</label><input style={inp} type="number" value={settings.deadStockDays} onChange={e=>setSettings(s=>({...s,deadStockDays:parseInt(e.target.value)||180}))}/></div>
    </div>}
  </div>);
}

// Alert Drawer
function AlertDr({open,onClose,items,settings,warehouses}){
  if(!open)return null;
  const ai=items.filter(i=>!i.isDeleted).map(i=>({item:i,alerts:getAlerts(i,settings)})).filter(x=>x.alerts.length>0);
  return(<div style={modal_bg} onClick={onClose}><div style={modal_c(false)} onClick={e=>e.stopPropagation()}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <h2 style={{fontSize:18,fontWeight:700,margin:0}}>Сповіщення ({ai.length})</h2>
      <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer"}}><I n="close" c={C.textDim}/></button>
    </div>
    <div style={{maxHeight:"60vh",overflow:"auto"}}>{ai.map(({item,alerts})=>(
      <div key={item.id} style={{padding:"12px 0",borderBottom:`1px solid ${C.border}22`}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{item.name}</div>
        <div style={{fontSize:12,color:C.textDim,marginBottom:6}}>{item.inventoryNumber} · {warehouses.find(w=>w.id===item.warehouseId)?.name}</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{alerts.map((a,i)=><span key={i} style={badge(a.color)}>{a.label}</span>)}</div>
      </div>
    ))}{ai.length===0&&<div style={{textAlign:"center",padding:30,color:C.textMuted}}>Немає сповіщень 🎉</div>}</div>
  </div></div>);
}

// Login
function LoginPg({onLogin}){
  const [role,sRole]=useState("admin");
  return(<div style={{fontFamily:"'Source Sans 3',system-ui,sans-serif",background:C.bg,color:C.text,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
    <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>
    <div style={{width:"100%",maxWidth:380,padding:32}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{fontSize:42,fontWeight:900,background:`linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:4}}>WMS</div>
        <div style={{fontSize:13,color:C.textDim,lineHeight:1.5}}>БО «100% Життя»<br/>Дніпровський регіон</div>
      </div>
      <div style={{background:C.bgCard,border:`1px solid ${C.border}`,borderRadius:16,padding:24}}>
        <div style={{marginBottom:16}}><label style={lbl}>Email</label><input style={inp} value="admin@100life-dniproregion.org.ua" readOnly/></div>
        <div style={{marginBottom:16}}><label style={lbl}>Пароль</label><input style={inp} type="password" value="demo" readOnly/></div>
        <div style={{marginBottom:20}}><label style={lbl}>Роль (demo)</label>
          <select style={sel} value={role} onChange={e=>sRole(e.target.value)}><option value="admin">Admin — повний доступ</option><option value="logistics">Logistics — розширений</option><option value="field">Field — базовий</option></select>
        </div>
        <button style={{...btn("primary"),width:"100%",justifyContent:"center",padding:12,fontSize:15}} onClick={()=>onLogin({email:"demo",role,name:role==="admin"?"Адміністратор":role==="logistics"?"Логіст":"Польовий працівник"})}>Увійти</button>
      </div>
      <div style={{textAlign:"center",marginTop:16,fontSize:12,color:C.textMuted}}>Демо · Дані в пам'яті</div>
    </div>
  </div>);
}

// MAIN APP
export default function App(){
  const [user,setUser]=useState(null);
  const [page,setPage]=useState("warehouse");
  const [items,setItems]=useSyncedState("items",DI);
  const [movements,setMovements]=useSyncedState("movements",DM);
  const [warehouses]=useState(DW);
  const [projects]=useState(DP);
  const [settings,setSettings]=useState({organizationName:"БО «100% Життя» Дніпровський регіон",criticalExpiryDays:30,warningExpiryDays:90,deadStockDays:180});
  const [showAlerts,setShowAlerts]=useState(false);
  const [showQrScanner,setShowQrScanner]=useState(false);
  const [qrResultItem,setQrResultItem]=useState(null);
  const [isMobile,setIsMobile]=useState(typeof window!=="undefined"&&window.innerWidth<=768);

  useEffect(()=>{const h=()=>setIsMobile(window.innerWidth<=768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);

  // Setup Supabase Realtime subscriptions
  useEffect(()=>{
    syncManager.setupRealtime(
      (payload)=>{/* item changed on another device */
        if(payload?.new)setItems(p=>{const idx=p.findIndex(i=>i.id===payload.new.id);if(idx>=0){const c=[...p];c[idx]=payload.new;return c;}return[...p,payload.new];});},
      (payload)=>{/* movement added on another device */
        if(payload?.new)setMovements(p=>{if(p.find(m=>m.id===payload.new.id))return p;return[...p,payload.new];});}
    );
    // Initial sync attempt
    syncManager.initialSync();
    return()=>syncManager.destroy();
  },[]);
  const alertCount=useMemo(()=>items.filter(i=>!i.isDeleted).reduce((c,i)=>c+getAlerts(i,settings).length,0),[items,settings]);
  const addMove=(m)=>setMovements(p=>[...p,m]);

  // QR scan result handler
  const handleQrResult=(item,action)=>{
    setShowQrScanner(false);
    if(action==="detail"){
      setQrResultItem({item,action:"detail"});
    }else{
      setQrResultItem({item,action});
    }
  };

  // Handle movement save from QR flow
  const handleQrMoveSave=(movement)=>{
    addMove(movement);
    setItems(p=>p.map(i=>{if(i.id!==movement.itemId)return i;let q=i.quantity;
      if(movement.type==="incoming"&&movement.qualityCheck!=="rejected")q+=movement.quantity;
      else if(movement.type==="outgoing"||movement.type==="writeoff")q-=movement.quantity;
      else if(movement.type==="transfer")q-=movement.quantity;
      else if(movement.type==="adjustment")q=movement.factualQuantity;
      return{...i,quantity:q,lastMovementAt:movement.date};}));
    if(movement.type==="transfer"){setItems(p=>{const src=p.find(i=>i.id===movement.itemId);if(!src)return p;
      const dest=p.find(i=>i.name===src.name&&i.warehouseId===movement.toWarehouseId&&!i.isDeleted);
      if(dest)return p.map(i=>i.id===dest.id?{...i,quantity:i.quantity+movement.quantity,lastMovementAt:movement.date}:i);
      return[...p,{...src,id:uid(),warehouseId:movement.toWarehouseId,quantity:movement.quantity,inventoryNumber:invNum(Math.floor(Math.random()*9000)+1000),qrCode:uid(),lastMovementAt:movement.date}];});}
    setQrResultItem(null);
  };

  if(!user)return <LoginPg onLogin={setUser}/>;

  const canAccess=pg=>pg==="warehouse"||pg==="movements"||user.role==="admin"||user.role==="logistics";
  const navItems=[{id:"warehouse",label:"Склад",icon:"warehouse"},{id:"movements",label:"Операції",icon:"movements"},{id:"inventory",label:"Інвент.",icon:"clipboard"},{id:"analytics",label:"Аналітика",icon:"analytics"},{id:"reports",label:"Звіти",icon:"reports"},{id:"settings",label:"Налашт.",icon:"settings"}].filter(n=>canAccess(n.id));

  const NavBtn=({item,mob})=>(
    <button onClick={()=>setPage(item.id)} style={{display:"flex",flexDirection:mob?"column":"row",alignItems:"center",gap:mob?2:10,
      padding:mob?"8px 4px":"10px 16px",flex:mob?1:undefined,
      background:page===item.id?(mob?"transparent":`${C.accent}18`):"transparent",
      border:"none",cursor:"pointer",borderRadius:8,width:mob?undefined:"100%",
      color:page===item.id?C.accentLight:C.textDim,fontSize:mob?10:14,fontWeight:page===item.id?700:500,
      borderTop:mob&&page===item.id?`2px solid ${C.accent}`:mob?"2px solid transparent":"none",transition:"all 0.15s"}}>
      <I n={item.icon} s={mob?20:18} c={page===item.id?C.accentLight:C.textDim}/><span>{item.label}</span>
    </button>);

  const renderPg=()=>{switch(page){
    case"warehouse":return<WarehousePg items={items} warehouses={warehouses} projects={projects} movements={movements} settings={settings} setItems={setItems} addMove={addMove} userRole={user.role}/>;
    case"movements":return<MovementsPg items={items} movements={movements} warehouses={warehouses} addMove={addMove} setItems={setItems}/>;
    case"inventory":return<InventoryPg items={items} warehouses={warehouses} settings={settings} setItems={setItems} addMove={addMove}/>;
    case"analytics":return<AnalyticsPg items={items} movements={movements} warehouses={warehouses} settings={settings}/>;
    case"reports":return<ReportsPg items={items} movements={movements} warehouses={warehouses} settings={settings}/>;
    case"settings":return<SettingsPg warehouses={warehouses} projects={projects} settings={settings} setSettings={setSettings}/>;
    default:return null;}};

  const fontLink=<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700;800;900&display=swap" rel="stylesheet"/>;

  if(isMobile){return(
    <div style={{fontFamily:"'Source Sans 3',system-ui,sans-serif",background:C.bg,color:C.text,minHeight:"100vh",paddingBottom:72,display:"flex",flexDirection:"column"}}>
      {fontLink}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:C.bgCard,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18,fontWeight:900,color:C.accent}}>WMS</span><span style={{fontSize:12,color:C.textDim}}>100% Життя</span></div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>setShowQrScanner(true)} style={{background:C.accent,border:"none",cursor:"pointer",padding:6,borderRadius:8,display:"flex",alignItems:"center",gap:4}} title="Сканувати QR"><I n="qr" s={18} c="#fff"/></button>
          {alertCount>0&&<button onClick={()=>setShowAlerts(true)} style={{position:"relative",background:"none",border:"none",cursor:"pointer",padding:4}}><I n="bell" c={C.text}/>
            <span style={{position:"absolute",top:-2,right:-4,background:C.danger,color:"#fff",fontSize:10,fontWeight:800,borderRadius:10,padding:"1px 5px"}}>{alertCount}</span></button>}
          <span style={badge(user.role==="admin"?C.accent:user.role==="logistics"?C.purple:C.grey)}>{user.role}</span>
        </div>
      </div>
      <div style={{padding:12,flex:1}}>{renderPg()}</div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.bgCard,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100,padding:"4px 0 4px"}}>
        {navItems.map(n=><NavBtn key={n.id} item={n} mob/>)}
      </div>
      <AlertDr open={showAlerts} onClose={()=>setShowAlerts(false)} items={items} settings={settings} warehouses={warehouses}/>
      <QrScanner open={showQrScanner} onClose={()=>setShowQrScanner(false)} onResult={handleQrResult} items={items}/>
      {qrResultItem&&qrResultItem.action==="detail"&&<ItemDetail item={qrResultItem.item} onClose={()=>setQrResultItem(null)} warehouses={warehouses} projects={projects} movements={movements} userRole={user.role} onEdit={()=>{}} onMovement={(t,i)=>setQrResultItem({item:i,action:t})}/>}
      {qrResultItem&&qrResultItem.action!=="detail"&&<MoveForm type={qrResultItem.action} item={qrResultItem.item} onClose={()=>setQrResultItem(null)} onSave={handleQrMoveSave} warehouses={warehouses} items={items}/>}
    </div>);}

  return(
    <div style={{display:"flex",fontFamily:"'Source Sans 3',system-ui,sans-serif",background:C.bg,color:C.text,minHeight:"100vh"}}>
      {fontLink}
      <div style={{width:240,background:C.bgCard,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:100}}>
        <div style={{padding:"20px 16px 12px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{fontSize:24,fontWeight:900,background:`linear-gradient(135deg, ${C.accent}, ${C.accentLight})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>WMS</div>
          <div style={{fontSize:11,color:C.textDim,marginTop:2}}>100% Життя · Дніпро регіон</div>
        </div>
        <div style={{padding:"12px 8px",flex:1}}>
          <button onClick={()=>setShowQrScanner(true)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 16px",marginBottom:8,background:`${C.accent}18`,border:`1px solid ${C.accent}44`,borderRadius:8,cursor:"pointer",color:C.accentLight,fontSize:14,fontWeight:700,transition:"all 0.15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=`${C.accent}30`} onMouseLeave={e=>e.currentTarget.style.background=`${C.accent}18`}>
            <I n="qr" s={18} c={C.accentLight}/><span>Сканувати QR</span>
          </button>
          {navItems.map(n=><NavBtn key={n.id} item={n}/>)}
        </div>
        <div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`}}>
          <button onClick={()=>setShowAlerts(true)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 12px",background:alertCount>0?`${C.danger}11`:"transparent",border:`1px solid ${alertCount>0?C.danger+"33":C.border}`,borderRadius:8,cursor:"pointer",color:C.text,fontSize:13}}>
            <I n="bell" s={16} c={alertCount>0?C.danger:C.textDim}/><span>Сповіщення</span>
            {alertCount>0&&<span style={{marginLeft:"auto",background:C.danger,color:"#fff",fontSize:11,fontWeight:800,borderRadius:10,padding:"1px 7px"}}>{alertCount}</span>}
          </button>
        </div>
        <div style={{padding:"8px 12px",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:32,height:32,borderRadius:8,background:C.accentDim,display:"flex",alignItems:"center",justifyContent:"center"}}><I n="user" s={16} c={C.accentLight}/></div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div><div style={{fontSize:11,color:C.textDim}}>{user.role}</div></div>
          <button onClick={()=>setUser(null)} style={{background:"none",border:"none",cursor:"pointer",padding:4}} title="Вийти"><I n="logout" s={16} c={C.textDim}/></button>
        </div>
        <SyncIndicator/>
      </div>
      <div style={{flex:1,marginLeft:240,minHeight:"100vh"}}><div style={{padding:24,maxWidth:1400,width:"100%",margin:"0 auto"}}>{renderPg()}</div></div>
      <AlertDr open={showAlerts} onClose={()=>setShowAlerts(false)} items={items} settings={settings} warehouses={warehouses}/>
      <QrScanner open={showQrScanner} onClose={()=>setShowQrScanner(false)} onResult={handleQrResult} items={items}/>
      {qrResultItem&&qrResultItem.action==="detail"&&<ItemDetail item={qrResultItem.item} onClose={()=>setQrResultItem(null)} warehouses={warehouses} projects={projects} movements={movements} userRole={user.role} onEdit={()=>{}} onMovement={(t,i)=>setQrResultItem({item:i,action:t})}/>}
      {qrResultItem&&qrResultItem.action!=="detail"&&<MoveForm type={qrResultItem.action} item={qrResultItem.item} onClose={()=>setQrResultItem(null)} onSave={handleQrMoveSave} warehouses={warehouses} items={items}/>}
    </div>);
}
