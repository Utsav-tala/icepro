import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from "firebase/auth";
import {
  collection, doc, setDoc, getDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy,
  serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { auth, db } from "./firebase";

const LOGO_URL = "/logo.png";

// ── ITEM CATALOG (from original Vrundavan bill) ───────────────────────────────
const ITEM_CATALOG = [
  { id:1,  name:"05.MINI CHOCOBAR [1*30]",                    rate:127 },
  { id:2,  name:"05.MINI CHOPATY [1*30]",                     rate:125 },
  { id:3,  name:"05.VANILLA CHOPATY [1*30]",                  rate:125 },
  { id:4,  name:"05.JALJEERA JYUSI [1*30] J",                 rate:125 },
  { id:5,  name:"10.CLASSIC CHOCOBAR [1*24]",                 rate:200 },
  { id:6,  name:"10.MAVA MALAI [1*24]",                       rate:200 },
  { id:7,  name:"10.MANGO DOLLY [1*24]",                      rate:190 },
  { id:8,  name:"10.GULKAND CANDY [1*24]",                    rate:180 },
  { id:9,  name:"10.CHIKU CANDY [1*24]",                      rate:180 },
  { id:10, name:"20.PISTA MALAI [1*15]",                      rate:245 },
  { id:11, name:"20.ROYAL MAVA MALAI [1*15]",                 rate:245 },
  { id:12, name:"10.MOTA VANILLA CUP [1*18]",                 rate:141 },
  { id:13, name:"10.BUTTER CUP [1*18]",                       rate:141 },
  { id:14, name:"10.RIPPLE FUNDAY [1*8]",                     rate:70  },
  { id:15, name:"10.BUTTER SCOTCH CONE [1*14] [100 ML]",      rate:120 },
  { id:16, name:"10.CHOCO VANILLA CONE [1*20] [80ML]",        rate:155 },
  { id:17, name:"10.JUNIOR BUTTER SCOTCH CONE [1*20] [80ML]", rate:155 },
  { id:18, name:"20.CHOCOLATE CONE [1*14] [100ML]",           rate:225 },
  { id:19, name:"20.DREAM MAGIC CONE [1*14] [100ML]",         rate:165 },
  { id:20, name:"20.MAVA BADAM CUP [1*15] [100ML]",           rate:245 },
  { id:21, name:"20.AMERICAN DRYFRUIT CUP [1*15] [100ML]",    rate:245 },
  { id:22, name:"20.SPECIAL THABADI [1*15] [100ML]",          rate:245 },
  { id:23, name:"20.PREMIUM VANILLA CUP [1*12] [120ML]",      rate:150 },
  { id:24, name:"30.KAJU GULKAND CUP [1*12] [120ML]",         rate:285 },
  { id:25, name:"30.KESAR PISTA CUP [1*12] [120ML]",          rate:285 },
  { id:26, name:"45.TRIPAL SUNDAY [1*4] [120ML]",             rate:152 },
  { id:27, name:"35.CP AMERICAN DRYFRUIT [250ML]",            rate:35  },
  { id:28, name:"40.KASATA [1*12] [100ML]",                   rate:360 },
];

const C = {
  red:"#c8181e", redDark:"#9e1015", redLight:"#f03035",
  yellow:"#f5c518", yellowDark:"#d4a012",
  sidebar:"#110606", text:"#1a0505", textMid:"#6b3333",
  textLight:"#a07070", border:"#f0dada", pageBg:"#fdf5f5",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Nunito',sans-serif;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:#f0dada;}
::-webkit-scrollbar-thumb{background:#c8181e;border-radius:4px;}

.sidebar{width:230px;background:${C.sidebar};display:flex;flex-direction:column;gap:4px;padding:20px 10px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;}
.brand-name{font-family:'Playfair Display',serif;font-size:15px;color:${C.yellow};line-height:1.2;}
.brand-sub{font-size:9px;color:#6b2a2a;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
.ni{cursor:pointer;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;transition:all 0.2s;color:#9a5555;}
.ni:hover{background:#2a0e0e;color:#f5c518;}
.na{background:linear-gradient(135deg,#7a0c10,#c8181e)!important;color:#fff!important;box-shadow:0 4px 12px rgba(200,24,30,0.4);}
.nav-badge{background:${C.yellow};color:${C.redDark};border-radius:20px;font-size:10px;font-weight:800;padding:1px 7px;margin-left:auto;}

.card{background:#fff;border:1px solid ${C.border};border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(200,24,30,0.06);}
.sc{background:#fff;border:1px solid ${C.border};border-radius:14px;padding:20px;transition:transform 0.2s,box-shadow 0.2s;}
.sc:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(200,24,30,0.12);}

.badge{padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.5px;display:inline-block;text-transform:uppercase;}
.ba{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;}
.bo{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
.bp{background:#fffbeb;color:#92400e;border:1px solid #fde68a;}

.btn{padding:9px 20px;border-radius:10px;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;transition:all 0.2s;}
.btn-red{background:linear-gradient(135deg,${C.red},${C.redDark});color:#fff;box-shadow:0 4px 12px rgba(200,24,30,0.3);}
.btn-red:hover{background:linear-gradient(135deg,${C.redLight},${C.red});transform:translateY(-1px);}
.btn-red:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
.btn-yellow{background:linear-gradient(135deg,${C.yellow},${C.yellowDark});color:${C.redDark};}
.btn-yellow:hover{transform:translateY(-1px);}
.btn-green{background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;}
.btn-green:hover{transform:translateY(-1px);}
.btn-ghost{background:#fff5f5;color:${C.textMid};border:1px solid ${C.border};}
.btn-ghost:hover{background:#fef2f2;color:${C.red};}
.btn-danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
.btn-danger:hover{background:#fee2e2;}

.inp{background:#fff;border:1.5px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-family:'Nunito',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s;width:100%;}
.inp:focus{border-color:${C.red};box-shadow:0 0 0 3px rgba(200,24,30,0.08);}
.sel{background:#fff;border:1.5px solid ${C.border};border-radius:10px;padding:10px 14px;color:${C.text};font-family:'Nunito',sans-serif;font-size:13px;outline:none;width:100%;cursor:pointer;}
.sel:focus{border-color:${C.red};}
.lbl{font-size:11px;color:${C.textMid};font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;display:block;}
.tr{padding:12px 16px;border-bottom:1px solid #fdf0f0;transition:background 0.15s;}
.tr:hover{background:#fff8f8;}
.tr:last-child{border-bottom:none;}

.mo{position:fixed;inset:0;background:rgba(26,5,5,0.75);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(6px);}
.mbox{background:#fff;border-radius:20px;padding:28px;width:700px;max-width:96vw;max-height:92vh;overflow-y:auto;box-shadow:0 24px 60px rgba(200,24,30,0.2);}

@keyframes fi{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.fi{animation:fi 0.3s ease;}
@keyframes su{from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);}}
.su{animation:su 0.35s cubic-bezier(.22,1,.36,1);}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.5;}}
.pulse{animation:pulse 2s infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.spin{animation:spin 0.7s linear infinite;display:inline-block;}

.auth-wrap{min-height:100vh;display:flex;background:${C.pageBg};}
.auth-left{width:420px;background:linear-gradient(160deg,${C.redDark} 0%,${C.red} 50%,#e03535 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;flex-shrink:0;}
.auth-right{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;}
.auth-card{background:#fff;border-radius:20px;padding:36px;width:100%;max-width:460px;box-shadow:0 8px 32px rgba(200,24,30,0.1);}
.toggle{position:relative;width:42px;height:24px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;}
.toggle-slider{position:absolute;inset:0;background:#e5e7eb;border-radius:24px;cursor:pointer;transition:0.3s;}
.toggle-slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2);}
.toggle input:checked+.toggle-slider{background:${C.red};}
.toggle input:checked+.toggle-slider:before{transform:translateX(18px);}
.otp-wrap{display:flex;gap:10px;justify-content:center;margin:16px 0;}
.otp-inp{width:48px;height:52px;text-align:center;font-size:20px;font-weight:800;border:2px solid ${C.border};border-radius:12px;outline:none;font-family:'Nunito',sans-serif;color:${C.redDark};}
.otp-inp:focus{border-color:${C.red};box-shadow:0 0 0 3px rgba(200,24,30,0.1);}
.err-box{font-size:12px;color:${C.red};margin-bottom:12px;background:#fef2f2;padding:10px 12px;border-radius:8px;border-left:3px solid ${C.red};}
.loading-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:${C.pageBg};}
.empty-state{text-align:center;padding:48px 20px;color:${C.textLight};}
.empty-state .icon{font-size:48px;margin-bottom:12px;}
.empty-state p{font-size:14px;margin-bottom:16px;}

/* Item dropdown */
.iswrap{position:relative;}
.idrop{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:2px solid ${C.red};border-radius:12px;z-index:999;max-height:240px;overflow-y:auto;box-shadow:0 12px 32px rgba(200,24,30,0.18);}
.iopt{padding:10px 14px;cursor:pointer;border-bottom:1px solid #fdf0f0;transition:background 0.12s;}
.iopt:hover{background:#fff0f0;}
.iopt:last-child{border-bottom:none;}
.iopt-name{font-size:12px;font-weight:700;color:${C.text};}
.iopt-rate{font-size:11px;color:${C.red};font-weight:700;margin-top:2px;}

@media(max-width:768px){
  .sidebar{width:100%;height:auto;flex-direction:row;padding:10px;overflow-x:auto;position:fixed;bottom:0;top:auto;z-index:100;border-top:2px solid #2a0e0e;}
  .ni{flex-direction:column;gap:3px;font-size:10px;padding:8px 12px;min-width:60px;text-align:center;}
  .brand-logo-wrap,.sidebar-footer{display:none;}
  .main-content{padding:16px 14px 80px!important;}
  .auth-left{display:none;}
  .stat-grid{grid-template-columns:1fr 1fr!important;}
  .hide-mobile{display:none!important;}
  .mbox{padding:20px;width:98vw;}
}
@media(max-width:480px){.stat-grid{grid-template-columns:1fr!important;}}
`;

// ── TINY HELPERS ──────────────────────────────────────────────────────────────
const Lbl = ({children}) => <label className="lbl">{children}</label>;
const Tag = ({children,cls}) => <span className={`badge ${cls}`}>{children}</span>;
const Spin = () => <span className="spin" style={{fontSize:16}}>⏳</span>;

function SC({label,value,sub,icon,color,accent}) {
  return (
    <div className="sc" style={{borderTop:`3px solid ${accent||C.red}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:11,color:C.textLight,marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.5px"}}>{label}</div>
          <div style={{fontSize:22,fontWeight:800,color:color||C.text}}>{value}</div>
          {sub&&<div style={{fontSize:11,color:C.textLight,marginTop:4}}>{sub}</div>}
        </div>
        <div style={{fontSize:28,opacity:0.85}}>{icon}</div>
      </div>
    </div>
  );
}

function Logo({size=48,showText=true}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <img src={LOGO_URL} alt="logo" style={{height:size,width:"auto",objectFit:"contain",filter:"drop-shadow(0 2px 6px rgba(200,24,30,0.3))"}} onError={e=>{e.target.style.display="none";}}/>
      {showText&&<div><div className="brand-name">Shree Vrundavan</div><div className="brand-sub">Ice Cream</div></div>}
    </div>
  );
}

function Modal({title,onClose,children,wide}) {
  return (
    <div className="mo" onClick={e=>e.target.className==="mo"&&onClose()}>
      <div className="mbox su" style={wide?{width:800}:{}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:C.redDark,fontWeight:800}}>{title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.textLight,lineHeight:1}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OtpInput({value,onChange}) {
  const digits=(value+"      ").slice(0,6).split("");
  function hk(i,e) {
    const d=e.target.value.replace(/\D/g,"").slice(-1);
    const arr=(value+"      ").slice(0,6).split("");
    arr[i]=d||" "; onChange(arr.join("").trimEnd());
    if(d&&i<5) document.getElementById(`otp-${i+1}`)?.focus();
    if(!d&&e.nativeEvent.inputType==="deleteContentBackward"&&i>0) document.getElementById(`otp-${i-1}`)?.focus();
  }
  return <div className="otp-wrap">{digits.map((d,i)=><input key={i} id={`otp-${i}`} className="otp-inp" maxLength={1} value={d.trim()} onChange={e=>hk(i,e)} inputMode="numeric"/>)}</div>;
}

function friendlyError(code) {
  return {"auth/email-already-in-use":"Email already registered.","auth/invalid-email":"Invalid email.","auth/weak-password":"Password needs 6+ chars.","auth/user-not-found":"No account found.","auth/wrong-password":"Incorrect password.","auth/invalid-credential":"Incorrect email or password.","auth/too-many-requests":"Too many attempts. Wait a bit.","auth/network-request-failed":"Network error."}[code]||"Something went wrong.";
}

function genInvNo() {
  return `GB/${Math.floor(Math.random()*9000)+1000}`;
}

// number to Indian words
function toWords(n) {
  const ones=["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens=["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  if(!n||n===0) return "Zero Only";
  function chunk(num) {
    if(num===0) return "";
    if(num<20) return ones[num]+" ";
    return tens[Math.floor(num/10)]+(num%10?" "+ones[num%10]+" ":" ");
  }
  const amt=Math.round(n*100)/100;
  const intPart=Math.floor(amt);
  const decPart=Math.round((amt-intPart)*100);
  let w="";
  if(intPart>=10000000) { w+=chunk(Math.floor(intPart/10000000))+"Crore "; }
  if(intPart>=100000)   { w+=chunk(Math.floor((intPart%10000000)/100000))+"Lakh "; }
  if(intPart>=1000)     { w+=chunk(Math.floor((intPart%100000)/1000))+"Thousand "; }
  if(intPart>=100)      { w+=chunk(Math.floor((intPart%1000)/100))+"Hundred "; }
  w+=chunk(intPart%100);
  if(decPart>0) w+=`And ${decPart}/100 Paise`;
  return w.trim()+" Only";
}

// ── PRINT INVOICE — exact Vrundavan format ────────────────────────────────────
function printInvoice(bill, agency) {
  const items   = bill.items||[];
  const subtotal= Number(bill.subtotal)||items.reduce((s,it)=>s+(it.amount||0),0);
  const discAmt = Number(bill.discountAmt)||0;
  const discPct = subtotal>0?((discAmt/subtotal)*100).toFixed(2):"0.00";
  const prevBal = Number(bill.prevBalance)||0;
  const grand   = subtotal-discAmt+prevBal;
  const totalQty= items.reduce((s,it)=>s+Number(it.qty||0),0);
  const dateStr = bill.createdAt?.toDate?.()?.toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"})||new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"});

  const itemRows = items.map((it,i)=>`
    <tr style="background:${i%2===0?"#ffffff":"#fffafa"}">
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;">${i+1}</td>
      <td style="text-align:left;border:1px solid #ddd;padding:6px 8px;font-weight:600;">${it.name}</td>
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;">${it.hsn||""}</td>
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;">${Number(it.qty||0).toFixed(3)}</td>
      <td style="text-align:right;border:1px solid #ddd;padding:6px 8px;">${Number(it.rate||0).toFixed(2)}</td>
      <td style="text-align:center;border:1px solid #ddd;padding:6px 8px;"></td>
      <td style="text-align:right;border:1px solid #ddd;padding:6px 8px;font-weight:700;">${Number(it.amount||0).toFixed(2)}</td>
    </tr>`).join("");

  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <title>Invoice ${bill.billNo}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Nunito',sans-serif;color:#111;background:#fff;font-size:13px;}
    .page{max-width:820px;margin:0 auto;padding:16px;border:2px solid #444;}
    .no-print{margin-bottom:14px;display:flex;gap:10px;}
    /* top header */
    .co-header{display:flex;align-items:center;justify-content:center;gap:16px;padding:10px 0 8px;border-bottom:3px double #333;}
    .co-name{font-family:'Playfair Display',serif;font-size:26px;font-weight:800;letter-spacing:0.5px;text-align:center;}
    .co-addr{font-size:12px;color:#444;text-align:center;margin-top:3px;}
    /* TAX INVOICE bar */
    .inv-bar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:#111;color:#fff;padding:5px 12px;margin:8px 0 0;}
    .inv-bar-left{font-size:12px;font-weight:700;}
    .inv-bar-mid{font-size:15px;font-weight:800;letter-spacing:4px;text-align:center;}
    .inv-bar-right{font-size:11px;font-weight:700;text-align:right;}
    .orig-badge{border:1px solid #fff;padding:2px 10px;display:inline-block;}
    /* bill-to + invoice info */
    .bill-grid{display:grid;grid-template-columns:1fr 220px;border:1px solid #ccc;border-top:none;}
    .bill-to{padding:10px 14px;border-right:1px solid #ccc;}
    .bill-inv{padding:10px 14px;}
    .fld{font-size:10px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:1px;}
    .fval{font-size:13px;font-weight:700;margin-bottom:6px;}
    .fval-sm{font-size:11px;color:#444;margin-top:1px;}
    /* table */
    table{width:100%;border-collapse:collapse;font-size:12px;}
    thead th{background:#222;color:#fff;padding:7px 8px;font-size:11px;font-weight:700;text-transform:uppercase;border:1px solid #444;}
    tfoot td{background:#f0f0f0;font-weight:700;border:1px solid #ccc;padding:7px 8px;}
    /* bottom section */
    .bottom-grid{display:grid;grid-template-columns:1fr 230px;border:1px solid #ccc;border-top:none;}
    .bank-sec{padding:10px 14px;border-right:1px solid #ccc;font-size:11px;}
    .bank-row{display:flex;gap:6px;margin-bottom:4px;}
    .bank-lbl{font-weight:700;min-width:90px;color:#555;}
    .totals-sec{padding:10px 14px;}
    .trow{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #e5e5e5;font-size:13px;}
    .trow:last-child{border-bottom:none;}
    .trow.grand{border-top:2px solid #111;border-bottom:none;margin-top:4px;padding-top:6px;}
    .trow.grand span:first-child{font-family:'Playfair Display',serif;font-weight:800;font-size:14px;}
    .trow.grand span:last-child{font-family:'Playfair Display',serif;font-weight:800;font-size:16px;}
    .closing-row{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ccc;border-top:none;padding:8px 14px;align-items:center;font-size:12px;}
    .closing-bal{font-size:19px;font-weight:800;color:#c8181e;text-align:right;}
    .words-row{border:1px solid #ccc;border-top:none;padding:8px 14px;font-size:12px;}
    .note-row{border:1px solid #ccc;border-top:none;padding:6px 14px;font-size:12px;}
    .footer-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #ccc;border-top:none;}
    .terms-sec{padding:10px 14px;border-right:1px solid #ccc;font-size:10px;color:#444;}
    .terms-sec ol{padding-left:14px;}
    .terms-sec li{margin-bottom:3px;}
    .sign-sec{padding:10px 14px;text-align:right;font-size:12px;}
    .sign-sec .for{font-size:11px;color:#555;margin-bottom:36px;}
    .gstin-note{font-size:10px;color:#555;}
    @media print{.no-print{display:none!important;}body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  </style></head><body>
  <div class="page">
    <div class="no-print">
      <button onclick="window.print()" style="background:#c8181e;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">🖨️ Print / Save as PDF</button>
      <button onclick="window.close()" style="background:#eee;color:#333;border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">✕ Close</button>
    </div>

    <!-- COMPANY HEADER -->
    <div class="co-header">
      <img src="${window.location.origin}/logo.png" style="height:68px;width:auto;" onerror="this.style.display='none'"/>
      <div>
        <div class="co-name">VRUNDAVAN MILK PRODUCTS</div>
        <div class="co-addr">DHORAJI ROAD , KALAVAD (SHITALA) &nbsp;|&nbsp; Mo: 95125 50255</div>
      </div>
    </div>

    <!-- TAX INVOICE BAR -->
    <div class="inv-bar">
      <span class="inv-bar-left">Debit Memo</span>
      <span class="inv-bar-mid">TAX INVOICE</span>
      <span class="inv-bar-right"><span class="orig-badge">Original</span></span>
    </div>

    <!-- BILL TO + INV INFO -->
    <div class="bill-grid">
      <div class="bill-to">
        <div class="fld">M/s.</div>
        <div class="fval" style="font-size:16px;">
          ${agency?.name||bill.agencyName||"—"}
        </div>
        <div class="fval-sm">${agency?.phone||""}</div>
        ${agency?.phone?`<div class="fval-sm">${agency.phone}</div>`:""}
        <div class="fval-sm" style="font-weight:700;">${agency?.city||""}</div>
        <div class="fval-sm">Place of Supply : 24-Gujarat</div>
        ${agency?.gst?`<div class="gstin-note" style="margin-top:4px;">GSTIN: ${agency.gst}</div>`:""}
      </div>
      <div class="bill-inv">
        <div style="margin-bottom:10px;">
          <div class="fld">Invoice No.</div>
          <div class="fval">: &nbsp;${bill.billNo}</div>
        </div>
        <div>
          <div class="fld">Date</div>
          <div class="fval">: &nbsp;${dateStr}</div>
        </div>
      </div>
    </div>

    <!-- ITEMS TABLE -->
    <table>
      <thead>
        <tr>
          <th style="width:38px;">SrNo</th>
          <th style="text-align:left;">Product Name</th>
          <th style="width:68px;">HSN/SAC</th>
          <th style="width:58px;">Qty</th>
          <th style="width:70px;">Rate</th>
          <th style="width:54px;">GST %</th>
          <th style="width:82px;">Amount</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="text-align:left;">
            <span class="gstin-note">GSTIN No.: 24AARFV6273D1ZV</span>
          </td>
          <td style="text-align:center;font-weight:800;">${totalQty.toFixed(3)}</td>
          <td colspan="2" style="text-align:right;font-weight:800;">Sub Total</td>
          <td style="text-align:right;font-weight:800;">${subtotal.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    <!-- BANK + TOTALS -->
    <div class="bottom-grid">
      <div class="bank-sec">
        <div class="bank-row"><span class="bank-lbl">Bank Name</span><span>: AXIS BANK LTD</span></div>
        <div class="bank-row"><span class="bank-lbl">Bank A/c. No.</span><span>: 919020042817580</span></div>
        <div class="bank-row"><span class="bank-lbl">RTGS/IFSC Code</span><span>: UTIB0001316</span></div>
      </div>
      <div class="totals-sec">
        <div class="trow"><span>Sub Total</span><span>${subtotal.toFixed(2)}</span></div>
        <div class="trow" style="color:#c8181e;"><span>Discount &nbsp;<b>${discPct}%</b></span><span>${discAmt.toFixed(2)}</span></div>
        ${prevBal>0?`<div class="trow" style="color:#d97706;"><span>Previous Balance</span><span>${prevBal.toFixed(2)}</span></div>`:""}
        <div class="trow grand"><span>Grand Total</span><span>${grand.toFixed(2)}</span></div>
      </div>
    </div>

    <!-- CLOSING BALANCE -->
    <div class="closing-row">
      <div>
        <b>Previous Balance :</b>&nbsp;&nbsp;
        <b style="font-size:14px;">${prevBal.toFixed(2)}</b>
        &nbsp;&nbsp;&nbsp;
        <b>Closing Balance :</b>
      </div>
      <div class="closing-bal">-${grand.toFixed(2)}</div>
    </div>

    <!-- AMOUNT IN WORDS -->
    <div class="words-row">
      <b>Bill Amount :</b>&nbsp;&nbsp;<i>${toWords(grand)}</i>
    </div>
    ${bill.notes?`<div class="note-row"><b>Note :</b>&nbsp;${bill.notes}</div>`:"<div class='note-row'><b>Note :</b>&nbsp;</div>"}

    <!-- FOOTER -->
    <div class="footer-grid">
      <div class="terms-sec">
        <b>Terms &amp; Condition :</b>
        <ol style="margin-top:5px;">
          <li>Goods once sold will not be taken back.</li>
          <li>Interest @18% p.a. will be charged if payment is not made within due date.</li>
          <li>Our risk and responsibility ceases as soon as the goods leave our premises.</li>
          <li>"Subject to 'Kalavad' Jurisdiction only. &nbsp;E.&amp;O.E"</li>
        </ol>
      </div>
      <div class="sign-sec">
        <div class="for">For, VRUNDAVAN MILK PRODUCTS</div>
        <div>(Authorised Signatory)</div>
      </div>
    </div>
  </div>
  </body></html>`;

  const w=window.open("","_blank","width=920,height=820,scrollbars=yes");
  if(w){w.document.write(html);w.document.close();}
  else alert("Allow pop-ups for this site to open invoices.");
}

// ── WHATSAPP SHARE ────────────────────────────────────────────────────────────
function shareWhatsApp(bill, agency) {
  const items  = bill.items||[];
  const sub    = Number(bill.subtotal)||items.reduce((s,it)=>s+(it.amount||0),0);
  const disc   = Number(bill.discountAmt)||0;
  const prev   = Number(bill.prevBalance)||0;
  const grand  = sub-disc+prev;
  const date   = bill.createdAt?.toDate?.()?.toLocaleDateString("en-IN")||new Date().toLocaleDateString("en-IN");
  const lines  = items.map((it,i)=>`  ${i+1}. ${it.name}\n     Qty: ${it.qty}  ×  Rs.${it.rate}  =  *Rs.${it.amount}*`).join("\n");

  const msg=`🍦 *VRUNDAVAN MILK PRODUCTS*
DHORAJI ROAD, KALAVAD (SHITALA)
Mo: 95125 50255
━━━━━━━━━━━━━━━━━━━━
📋 *TAX INVOICE / DEBIT MEMO*
━━━━━━━━━━━━━━━━━━━━
*Invoice No :* ${bill.billNo}
*Date       :* ${date}
*M/s        :* ${agency?.name||bill.agencyName}
*City       :* ${agency?.city||""}

*ITEMS:*
${lines}
━━━━━━━━━━━━━━━━━━━━
Sub Total         : Rs. ${sub.toFixed(2)}
Discount          : Rs. ${disc.toFixed(2)}${prev>0?`\nPrev. Balance     : Rs. ${prev.toFixed(2)}`:""}
━━━━━━━━━━━━━━━━━━━━
*💰 GRAND TOTAL   : Rs. ${grand.toFixed(2)}*
━━━━━━━━━━━━━━━━━━━━
_${toWords(grand)}_

🙏 Thank you for your business!
AXIS BANK | A/c: 919020042817580 | IFSC: UTIB0001316`;

  const phone=agency?.phone?.replace(/\D/g,"");
  const url=phone
    ?`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
    :`https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url,"_blank");
}

// ── SIGN UP ───────────────────────────────────────────────────────────────────
function SignupScreen({onDone}) {
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({firstName:"",lastName:"",username:"",mobile:"",email:"",secretCode:"",password:"",confirm:""});
  const [otp,setOtp]=useState(""); const [remember,setRemember]=useState(false);
  const [err,setErr]=useState(""); const [loading,setLoading]=useState(false);
  const upd=(f,v)=>{setForm(p=>({...p,[f]:v}));setErr("");};
  function s1(){
    if(!form.firstName.trim()) return setErr("Enter first name.");
    if(!form.username.trim())  return setErr("Enter username.");
    if(!/^\S+@\S+\.\S+/.test(form.email)) return setErr("Enter valid email.");
    if(form.mobile.length<10)  return setErr("Enter 10-digit mobile.");
    if(form.secretCode!=="VRUNDAVAN2024") return setErr("Invalid secret code.");
    setErr(""); setStep(2);
  }
  function s2(){
    if(otp.trim().length<6) return setErr("Enter 6 digits.");
    if(otp.trim()!=="123456") return setErr("Wrong OTP. Demo: 123456");
    setStep(3); setErr("");
  }
  async function s3(){
    if(form.password.length<6) return setErr("Password 6+ chars.");
    if(form.password!==form.confirm) return setErr("Passwords don't match.");
    setLoading(true); setErr("");
    try{
      const cred=await createUserWithEmailAndPassword(auth,form.email,form.password);
      await updateProfile(cred.user,{displayName:`${form.firstName} ${form.lastName}`.trim()});
      await setDoc(doc(db,"users",cred.user.uid),{uid:cred.user.uid,firstName:form.firstName,lastName:form.lastName,username:form.username.toLowerCase(),mobile:form.mobile,email:form.email.toLowerCase(),role:"staff",status:"active",createdAt:serverTimestamp(),remember});
      onDone({uid:cred.user.uid,name:`${form.firstName} ${form.lastName}`.trim(),email:form.email,role:"staff"});
    }catch(e){setErr(friendlyError(e.code));setLoading(false);}
  }
  const F=(label,field,type="text",ph="")=>(
    <div><Lbl>{label}</Lbl><input className="inp" type={type} placeholder={ph} value={form[field]} onChange={e=>upd(field,e.target.value)}/></div>
  );
  return(
    <div className="auth-wrap"><style>{CSS}</style>
      <div className="auth-left">
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:64,marginBottom:16}}>🍦</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#fff",fontWeight:800}}>Shree Vrundavan</div>
          <div style={{fontSize:16,color:C.yellow,fontWeight:700,marginTop:4}}>Ice Cream</div>
          <div style={{width:50,height:3,background:C.yellow,borderRadius:2,margin:"14px auto"}}/>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.8}}>Business Management Portal<br/>Saurashtra · Gujarat</div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-card su">
          <div style={{display:"flex",gap:6,marginBottom:24,alignItems:"center"}}>
            {["Details","Verify","Password"].map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,background:step>i+1?C.red:step===i+1?C.red:"#f0dada",color:step>=i+1?"#fff":C.textLight}}>{step>i+1?"✓":i+1}</div>
                <div style={{fontSize:11,fontWeight:600,color:step===i+1?C.red:C.textLight}}>{s}</div>
                {i<2&&<div style={{width:20,height:2,background:step>i+1?C.red:"#f0dada",borderRadius:1}}/>}
              </div>
            ))}
          </div>
          {step===1&&<div className="fi">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:C.redDark,marginBottom:18}}>Create Account</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>{F("First Name","firstName","text","Utsav")}{F("Last Name","lastName","text","Tala")}</div>
            <div style={{marginBottom:12}}>{F("Username","username","text","utsav_vrundavan")}</div>
            <div style={{marginBottom:12}}>{F("Email","email","email","utsav@gmail.com")}</div>
            <div style={{marginBottom:12}}><Lbl>Mobile</Lbl><div style={{display:"flex",gap:8}}><div style={{background:"#f9fafb",border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:C.textMid,fontWeight:700,flexShrink:0}}>+91</div><input className="inp" type="tel" maxLength={10} placeholder="9825011234" value={form.mobile} onChange={e=>upd("mobile",e.target.value.replace(/\D/g,""))}/></div></div>
            <div style={{marginBottom:18}}><Lbl>Secret Code</Lbl><input className="inp" type="password" placeholder="Owner-provided code" value={form.secretCode} onChange={e=>upd("secretCode",e.target.value)}/></div>
            {err&&<div className="err-box">⚠️ {err}</div>}
            <button className="btn btn-red" style={{width:"100%",padding:12}} onClick={s1}>Send OTP →</button>
            <div style={{textAlign:"center",marginTop:14,fontSize:13,color:C.textLight}}>Have account? <span style={{color:C.red,fontWeight:700,cursor:"pointer"}} onClick={()=>onDone(null)}>Sign In</span></div>
          </div>}
          {step===2&&<div className="fi">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:C.redDark,marginBottom:6}}>Verify Mobile</div>
            <div style={{fontSize:12,color:"#92400e",marginBottom:16,background:"#fffbeb",padding:"8px 12px",borderRadius:8,border:"1px solid #fde68a"}}>💡 Demo OTP: <b>123456</b></div>
            <OtpInput value={otp} onChange={setOtp}/>
            {err&&<div className="err-box">⚠️ {err}</div>}
            <button className="btn btn-red" style={{width:"100%",padding:12}} onClick={s2}>Verify →</button>
            <button className="btn btn-ghost" style={{width:"100%",marginTop:8,fontSize:12}} onClick={()=>setStep(1)}>← Back</button>
          </div>}
          {step===3&&<div className="fi">
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:21,color:C.redDark,marginBottom:18}}>Set Password</div>
            <div style={{marginBottom:12}}>{F("Password","password","password","Min 6 chars")}</div>
            <div style={{marginBottom:18}}>{F("Confirm","confirm","password","Re-enter")}</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18,padding:"12px 14px",background:"#fff8f8",borderRadius:10,border:`1px solid ${C.border}`}}>
              <label className="toggle"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span className="toggle-slider"/></label>
              <div style={{fontSize:13,fontWeight:700,color:C.text}}>Remember me for 1 month</div>
            </div>
            {err&&<div className="err-box">⚠️ {err}</div>}
            <button className="btn btn-red" style={{width:"100%",padding:12}} onClick={s3} disabled={loading}>{loading?<><Spin/> Creating...</>:"🎉 Create Account"}</button>
          </div>}
        </div>
      </div>
    </div>
  );
}

// ── SIGN IN ───────────────────────────────────────────────────────────────────
function SigninScreen({onLogin,onSignup}) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState("");
  const [remember,setRemember]=useState(false); const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false); const [showPass,setShowPass]=useState(false);
  async function doLogin(){
    if(!email.trim()) return setErr("Enter email.");
    if(!pass) return setErr("Enter password.");
    setLoading(true); setErr("");
    try{
      const cred=await signInWithEmailAndPassword(auth,email.trim(),pass);
      const snap=await getDoc(doc(db,"users",cred.user.uid));
      const p=snap.exists()?snap.data():{};
      onLogin({uid:cred.user.uid,name:p.firstName?`${p.firstName} ${p.lastName}`.trim():cred.user.email,email:cred.user.email,role:p.role||"staff"});
    }catch(e){setErr(friendlyError(e.code));setLoading(false);}
  }
  return(
    <div className="auth-wrap"><style>{CSS}</style>
      <div className="auth-left"><div style={{textAlign:"center"}}>
        <img src={LOGO_URL} alt="logo" style={{width:200,filter:"drop-shadow(0 4px 20px rgba(0,0,0,0.35))",marginBottom:20}}/>
        <div style={{width:50,height:3,background:C.yellow,borderRadius:2,margin:"0 auto 18px"}}/>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.6)",lineHeight:1.9}}>🏭 Manufacturing · Distribution<br/>📦 Inventory · Billing<br/>🚚 Delivery Management</div>
      </div></div>
      <div className="auth-right"><div className="auth-card su">
        <div style={{textAlign:"center",marginBottom:26}}>
          <Logo size={50} showText={false}/>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:23,color:C.redDark,marginTop:10}}>Welcome Back</div>
        </div>
        <div style={{marginBottom:14}}><Lbl>Email</Lbl><input className="inp" type="email" placeholder="your@email.com" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></div>
        <div style={{marginBottom:18}}><Lbl>Password</Lbl>
          <div style={{position:"relative"}}>
            <input className="inp" type={showPass?"text":"password"} placeholder="Your password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{paddingRight:44}}/>
            <button onClick={()=>setShowPass(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16,color:C.textLight}}>{showPass?"🙈":"👁️"}</button>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,padding:"12px 14px",background:"#fff8f8",borderRadius:10,border:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <label className="toggle"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/><span className="toggle-slider"/></label>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>Remember me</span>
          </div>
          <span style={{fontSize:12,color:C.red,cursor:"pointer",fontWeight:700}}>Forgot?</span>
        </div>
        {err&&<div className="err-box">⚠️ {err}</div>}
        <button className="btn btn-red" style={{width:"100%",padding:13,fontSize:15}} onClick={doLogin} disabled={loading}>{loading?<span className="pulse">Signing in...</span>:"Sign In →"}</button>
        <div style={{textAlign:"center",marginTop:14,fontSize:13,color:C.textLight}}>New staff? <span style={{color:C.red,fontWeight:700,cursor:"pointer"}} onClick={onSignup}>Create Account</span></div>
      </div></div>
    </div>
  );
}

// ── AGENCY MODAL (add/edit) ───────────────────────────────────────────────────
function AgencyModal({onClose,onSaved,existing}) {
  const isEdit=!!existing;
  const blank={name:"",owner:"",phone:"",city:"",email:"",creditLimit:"",address:"",gst:"",totalShops:""};
  const [form,setForm]=useState(isEdit?{name:existing.name||"",owner:existing.owner||"",phone:existing.phone||"",city:existing.city||"",email:existing.email||"",creditLimit:existing.creditLimit||"",address:existing.address||"",gst:existing.gst||"",totalShops:existing.totalShops||""}:blank);
  const [loading,setLoading]=useState(false); const [err,setErr]=useState("");
  const upd=(f,v)=>{setForm(p=>({...p,[f]:v}));setErr("");};
  async function save(){
    if(!form.name.trim()) return setErr("Agency name required.");
    if(!form.owner.trim()) return setErr("Owner name required.");
    if(!form.phone.trim()) return setErr("Phone required.");
    if(!form.city.trim()) return setErr("City required.");
    setLoading(true);
    const d={name:form.name.trim(),owner:form.owner.trim(),phone:form.phone.trim(),city:form.city.trim(),email:form.email.trim(),creditLimit:Number(form.creditLimit)||100000,address:form.address.trim(),gst:form.gst.trim(),totalShops:Number(form.totalShops)||0};
    try{
      if(isEdit){await updateDoc(doc(db,"agencies",existing.id),{...d,updatedAt:serverTimestamp()});onSaved({...existing,...d});}
      else{const ref=await addDoc(collection(db,"agencies"),{...d,outstanding:0,status:"active",createdAt:serverTimestamp()});onSaved({id:ref.id,...d,outstanding:0,status:"active"});}
      onClose();
    }catch(e){setErr("Save failed.");setLoading(false);}
  }
  const F=(label,field,type="text",ph="",half=false)=>(
    <div style={half?{}:{gridColumn:"1 / -1"}}><Lbl>{label}</Lbl><input className="inp" type={type} placeholder={ph} value={form[field]} onChange={e=>upd(field,e.target.value)}/></div>
  );
  return(
    <Modal title={isEdit?`✏️ Edit — ${existing.name}`:"➕ Add New Agency"} onClose={onClose}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <div style={{gridColumn:"1/-1"}}>{F("Agency / Shop Name *","name","text","Rajkot Central Agency")}</div>
        {F("Owner Name *","owner","text","Mahesh Patel",true)}{F("Phone *","phone","tel","9825011234",true)}
        {F("City *","city","text","Rajkot",true)}{F("Email","email","email","agency@email.com",true)}
        {F("Credit Limit (Rs.)","creditLimit","number","100000",true)}{F("Total Shops","totalShops","number","5",true)}
        {F("GST Number","gst","text","24XXXXX0000X1Z5",true)}
        <div style={{gridColumn:"1/-1"}}><Lbl>Full Address</Lbl><textarea className="inp" rows={2} placeholder="Shop/warehouse address..." value={form.address} onChange={e=>upd("address",e.target.value)} style={{resize:"vertical"}}/></div>
      </div>
      {err&&<div className="err-box" style={{marginTop:14}}>⚠️ {err}</div>}
      <div style={{display:"flex",gap:10,marginTop:20}}>
        <button className="btn btn-red" style={{flex:1}} onClick={save} disabled={loading}>{loading?<><Spin/> Saving...</>:isEdit?"💾 Save Changes":"💾 Add Agency"}</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── ITEM SEARCH ROW ───────────────────────────────────────────────────────────
function ItemRow({item,index,onUpdate,onRemove}) {
  const [q,setQ]=useState(item.name||"");
  const [open,setOpen]=useState(false);
  const filtered=q.length>0
    ?ITEM_CATALOG.filter(c=>c.name.toLowerCase().includes(q.toLowerCase())).slice(0,14)
    :ITEM_CATALOG.slice(0,14);

  function pick(cat){
    setQ(cat.name); setOpen(false);
    onUpdate(index,{...item,name:cat.name,rate:cat.rate,amount:Number(item.qty||0)*cat.rate});
  }
  function changeQty(v){
    const qty=Number(v)||0;
    onUpdate(index,{...item,qty:v,amount:qty*(Number(item.rate)||0)});
  }
  function changeRate(v){
    const r=Number(v)||0;
    onUpdate(index,{...item,rate:v,amount:(Number(item.qty)||0)*r});
  }

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 70px 90px 100px 28px",gap:8,padding:"8px 12px",borderBottom:`1px solid ${C.border}`,alignItems:"center",overflow:"visible"}}>
      {/* item search */}
      <div className="iswrap">
        <input className="inp" style={{padding:"7px 10px",fontSize:12}}
          placeholder="Type to search item..."
          value={q}
          onChange={e=>{setQ(e.target.value);setOpen(true);onUpdate(index,{...item,name:e.target.value});}}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),200)}
        />
        {open&&(
          <div className="idrop">
            {filtered.length===0
              ?<div className="iopt"><span style={{color:C.textLight,fontSize:12}}>No items found</span></div>
              :filtered.map(c=>(
                <div key={c.id} className="iopt" onMouseDown={()=>pick(c)}>
                  <div className="iopt-name">{c.name}</div>
                  <div className="iopt-rate">Rs. {c.rate} / box</div>
                </div>
              ))
            }
          </div>
        )}
      </div>
      {/* qty */}
      <input className="inp" style={{padding:"7px 8px",fontSize:12,textAlign:"center"}}
        type="number" min="1" placeholder="Qty" value={item.qty}
        onChange={e=>changeQty(e.target.value)}/>
      {/* rate (auto-filled, editable) */}
      <input className="inp" style={{padding:"7px 8px",fontSize:12,textAlign:"right"}}
        type="number" placeholder="Rate" value={item.rate}
        onChange={e=>changeRate(e.target.value)}/>
      {/* amount */}
      <div style={{fontWeight:800,fontSize:13,color:C.redDark,textAlign:"right",paddingRight:4}}>
        Rs.{(item.amount||0).toLocaleString()}
      </div>
      {/* remove */}
      <button onClick={()=>onRemove(index)}
        style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:C.textLight,lineHeight:1}}>✕</button>
    </div>
  );
}

// ── CREATE BILL MODAL ─────────────────────────────────────────────────────────
function CreateBillModal({agencies,onClose,preAgencyId}) {
  const [agencyId,setAgencyId]=useState(preAgencyId||"");
  const [notes,setNotes]=useState("");
  const [discountPct,setDiscountPct]=useState("");
  const [items,setItems]=useState([{name:"",qty:"",rate:"",amount:0}]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [saved,setSaved]=useState(null);

  const upItem=(i,v)=>setItems(p=>{const a=[...p];a[i]=v;return a;});
  const addRow=()=>setItems(p=>[...p,{name:"",qty:"",rate:"",amount:0}]);
  const delRow=i=>{ if(items.length>1) setItems(p=>p.filter((_,idx)=>idx!==i)); };

  const agency   = agencies.find(a=>a.id===agencyId);
  const prevBal  = Number(agency?.outstanding)||0;
  const subtotal = items.reduce((s,it)=>s+(it.amount||0),0);
  const discPct  = Number(discountPct)||0;
  const discAmt  = subtotal*discPct/100;
  const grand    = subtotal-discAmt+prevBal;

  async function handleSave(){
    if(!agencyId) return setErr("Select an agency.");
    const filled=items.filter(it=>it.name.trim());
    if(filled.length===0) return setErr("Add at least one item.");
    if(subtotal===0) return setErr("Total cannot be Rs. 0.");
    setLoading(true);
    try{
      const billNo=genInvNo();
      const ref=await addDoc(collection(db,"bills"),{
        billNo,agencyId,agencyName:agency?.name||"",
        items:filled,subtotal,
        discountPct:discPct,discountAmt:discAmt,
        prevBalance:prevBal,total:grand,
        status:"pending",notes,
        createdAt:serverTimestamp(),
        dueDate:new Date(Date.now()+15*24*60*60*1000),
      });
      // outstanding becomes new grand total
      await updateDoc(doc(db,"agencies",agencyId),{outstanding:grand});
      setSaved({bill:{id:ref.id,billNo,agencyId,agencyName:agency?.name,items:filled,subtotal,discountAmt:discAmt,prevBalance:prevBal,total:grand,status:"pending",notes},agency});
    }catch(e){setErr("Save failed. Try again.");setLoading(false);}
  }

  if(saved) return(
    <Modal title="✅ Bill Created!" onClose={onClose}>
      <div style={{textAlign:"center",padding:"10px 0 20px"}}>
        <div style={{fontSize:56,marginBottom:8}}>🧾</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:C.redDark,marginBottom:4}}>{saved.bill.billNo}</div>
        <div style={{fontSize:14,color:C.textLight,marginBottom:6}}>{saved.bill.agencyName}</div>
        <div style={{fontSize:26,fontWeight:800,color:C.red,marginBottom:18}}>Rs. {grand.toLocaleString()}</div>
        <div style={{background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:10,padding:"10px 16px",marginBottom:20,fontSize:13,color:"#065f46"}}>
          ✓ Saved to Firestore &nbsp;·&nbsp; Outstanding updated
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
          <button className="btn btn-red"   style={{fontSize:13,padding:"10px 20px"}} onClick={()=>printInvoice(saved.bill,saved.agency)}>🖨️ Print / PDF</button>
          <button className="btn btn-green" style={{fontSize:13,padding:"10px 20px"}} onClick={()=>shareWhatsApp(saved.bill,saved.agency)}>💬 Send on WhatsApp</button>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );

  return(
    <Modal title="🧾 Create New Bill" onClose={onClose} wide>
      {/* agency */}
      <div style={{marginBottom:14}}>
        <Lbl>Select Agency *</Lbl>
        <select className="sel" value={agencyId} onChange={e=>{setAgencyId(e.target.value);setErr("");}}>
          <option value="">-- Choose Agency --</option>
          {agencies.map(a=><option key={a.id} value={a.id}>{a.name} — {a.city}</option>)}
        </select>
      </div>

      {/* prev balance notice */}
      {agencyId&&prevBal>0&&(
        <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:13,color:"#856404"}}>
          ⚠️ <b>{agency?.name}</b> has a previous pending balance of <b>Rs. {prevBal.toLocaleString()}</b> — it will be added to this bill's grand total.
        </div>
      )}

      {/* items */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <Lbl>Items — Type to search &amp; select</Lbl>
          <button className="btn btn-ghost" style={{fontSize:11,padding:"4px 12px"}} onClick={addRow}>+ Add Row</button>
        </div>
        <div style={{background:"#fff8f8",borderRadius:12,border:`1px solid ${C.border}`,overflow:"visible"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 70px 90px 100px 28px",gap:8,padding:"8px 12px",background:"#fef0f0",borderBottom:`1px solid ${C.border}`,borderRadius:"12px 12px 0 0"}}>
            {["Product Name (Search)","Qty","Rate (Rs.)","Amount",""].map((h,i)=>(
              <div key={i} style={{fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase"}}>{h}</div>
            ))}
          </div>
          {items.map((it,i)=>(
            <ItemRow key={i} item={it} index={i} onUpdate={upItem} onRemove={delRow}/>
          ))}
        </div>
      </div>

      {/* discount + notes */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div>
          <Lbl>Discount % (enter for this bill)</Lbl>
          <input className="inp" type="number" min="0" max="100" step="0.01" placeholder="e.g. 14" value={discountPct} onChange={e=>setDiscountPct(e.target.value)}/>
        </div>
        <div>
          <Lbl>Notes (optional)</Lbl>
          <input className="inp" placeholder="Festival stock, special order..." value={notes} onChange={e=>setNotes(e.target.value)}/>
        </div>
      </div>

      {/* summary box */}
      <div style={{background:"#fff8f8",borderRadius:12,border:`1px solid ${C.border}`,padding:"14px 18px",marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:`1px dashed ${C.border}`}}>
          <span style={{color:C.textLight}}>Sub Total</span>
          <span style={{fontWeight:700}}>Rs. {subtotal.toLocaleString()}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:`1px dashed ${C.border}`,color:C.red}}>
          <span>Discount ({discPct}%)</span>
          <span style={{fontWeight:700}}>- Rs. {discAmt.toFixed(2)}</span>
        </div>
        {prevBal>0&&(
          <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13,borderBottom:`1px dashed ${C.border}`,color:"#d97706"}}>
            <span>Previous Pending Balance</span>
            <span style={{fontWeight:700}}>+ Rs. {prevBal.toLocaleString()}</span>
          </div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0 0",marginTop:4,borderTop:`2px solid ${C.border}`}}>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:800,color:C.text}}>Grand Total</span>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,color:C.red}}>Rs. {grand.toLocaleString()}</span>
        </div>
        <div style={{fontSize:11,color:C.textLight,marginTop:6,fontStyle:"italic"}}>{toWords(grand)}</div>
      </div>

      {err&&<div className="err-box">⚠️ {err}</div>}
      <div style={{display:"flex",gap:10}}>
        <button className="btn btn-red" style={{flex:1,padding:12}} onClick={handleSave} disabled={loading}>{loading?<><Spin/> Saving...</>:"💾 Create Bill"}</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── AGENCY HISTORY MODAL ──────────────────────────────────────────────────────
function AgencyHistoryModal({agency,bills,agencies,onClose}) {
  const ab   = bills.filter(b=>b.agencyId===agency.id);
  const now  = new Date();
  const thisM= ab.filter(b=>{const d=b.createdAt?.toDate?.();return d&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
  const mAmt = thisM.reduce((s,b)=>s+(b.total||0),0);
  const pAmt = ab.filter(b=>b.status!=="paid").reduce((s,b)=>s+(b.total||0),0);
  const cAmt = ab.filter(b=>b.status==="paid").reduce((s,b)=>s+(b.total||0),0);

  return(
    <Modal title={`📋 Invoice History — ${agency.name}`} onClose={onClose} wide>
      {/* summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
        {[
          {label:"This Month",value:`Rs.${mAmt.toLocaleString()}`,icon:"📅",col:C.redDark,bg:"#fff0f0"},
          {label:"Pending",   value:`Rs.${pAmt.toLocaleString()}`,icon:"⏳",col:"#d97706",bg:"#fffbeb"},
          {label:"Collected", value:`Rs.${cAmt.toLocaleString()}`,icon:"✅",col:"#065f46",bg:"#ecfdf5"},
        ].map(s=>(
          <div key={s.label} style={{background:s.bg,borderRadius:12,padding:"14px",textAlign:"center"}}>
            <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
            <div style={{fontSize:10,color:C.textLight,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:17,fontWeight:800,color:s.col}}>{s.value}</div>
          </div>
        ))}
      </div>
      {/* bills table */}
      {ab.length===0
        ?<div style={{textAlign:"center",padding:32,color:C.textLight}}>No invoices yet for this agency.</div>
        :<div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 80px 80px 70px 70px",gap:8,padding:"10px 14px",background:"#fff8f8",borderBottom:`1px solid ${C.border}`}}>
            {["Bill No","Date","Total","Status","","PDF","WA"].map((h,i)=><div key={i} style={{fontSize:10,color:C.textLight,fontWeight:700,textTransform:"uppercase"}}>{h}</div>)}
          </div>
          {ab.map(b=>(
            <div key={b.id} className="tr" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 80px 80px 70px 70px",gap:8,alignItems:"center"}}>
              <div style={{fontWeight:700,fontSize:12,color:C.red}}>{b.billNo}</div>
              <div style={{fontSize:11,color:C.textLight}}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")||"—"}</div>
              <div style={{fontWeight:800,color:C.redDark}}>Rs.{(b.total||0).toLocaleString()}</div>
              <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
              <div style={{fontSize:11,color:C.textLight}}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN",{month:"short",year:"2-digit"})||""}</div>
              <button className="btn btn-yellow" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>printInvoice(b,agency)}>🖨️</button>
              <button className="btn btn-green"  style={{fontSize:10,padding:"4px 8px"}} onClick={()=>shareWhatsApp(b,agency)}>💬</button>
            </div>
          ))}
        </div>
      }
    </Modal>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({user,onLogout}) {
  const [page,setPage]=useState("dashboard");
  const [selAgency,setSelAgency]=useState(null);
  const [agencies,setAgencies]=useState([]);
  const [bills,setBills]=useState([]);
  const [orders,setOrders]=useState([]);
  const [loadingData,setLoadingData]=useState(true);
  const [agMod,setAgMod]=useState({open:false,editing:null});
  const [billMod,setBillMod]=useState({open:false,preId:""});
  const [histMod,setHistMod]=useState(null);

  useEffect(()=>{
    const uA=onSnapshot(query(collection(db,"agencies"),orderBy("createdAt","desc")),s=>{setAgencies(s.docs.map(d=>({id:d.id,...d.data()})));setLoadingData(false);},e=>{console.error(e);setLoadingData(false);});
    const uB=onSnapshot(query(collection(db,"bills"),orderBy("createdAt","desc")),s=>setBills(s.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error(e));
    const uO=onSnapshot(query(collection(db,"orders"),orderBy("createdAt","desc")),s=>setOrders(s.docs.map(d=>({id:d.id,...d.data()}))),e=>console.error(e));
    return()=>{uA();uB();uO();};
  },[]);

  const totalOut=agencies.reduce((s,a)=>s+(a.outstanding||0),0);
  const pendingOrders=orders.filter(o=>o.status==="pending");

  async function approveOrder(o){
    await updateDoc(doc(db,"orders",o.id),{status:"approved"});
    const ag=agencies.find(a=>a.id===o.agencyId);
    await addDoc(collection(db,"bills"),{billNo:genInvNo(),agencyId:o.agencyId,agencyName:ag?.name||"",items:o.items||[],subtotal:o.total,discountAmt:0,prevBalance:0,total:o.total,status:"pending",notes:"Auto from order",createdAt:serverTimestamp(),dueDate:new Date(Date.now()+15*24*60*60*1000)});
    if(ag) await updateDoc(doc(db,"agencies",o.agencyId),{outstanding:(ag.outstanding||0)+o.total});
  }
  async function rejectOrder(o){await updateDoc(doc(db,"orders",o.id),{status:"rejected"});}
  async function markPaid(b){
    await updateDoc(doc(db,"bills",b.id),{status:"paid"});
    const ag=agencies.find(a=>a.id===b.agencyId);
    if(ag){const nOut=Math.max(0,(ag.outstanding||0)-b.total);await updateDoc(doc(db,"agencies",b.agencyId),{outstanding:nOut,status:nOut===0?"active":ag.status});}
  }
  async function delAgency(id){
    if(!window.confirm("Delete this agency? Cannot be undone.")) return;
    await deleteDoc(doc(db,"agencies",id));setSelAgency(null);
  }
  async function doLogout(){await signOut(auth);onLogout();}

  const nav=[
    {id:"dashboard",icon:"🏠",label:"Home"},
    {id:"orders",icon:"📦",label:"Orders",badge:pendingOrders.length},
    {id:"billing",icon:"🧾",label:"Billing"},
    {id:"agencies",icon:"🏢",label:"Agencies"},
    {id:"vehicles",icon:"🚚",label:"Vehicles"},
  ];

  function PH({title,sub,action}) {
    return(
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:C.redDark,fontFamily:"'Playfair Display',serif"}}>{title}</h1>
          {sub&&<p style={{color:C.textLight,fontSize:13,marginTop:3}}>{sub}</p>}
        </div>
        {action}
      </div>
    );
  }

  return(
    <div style={{display:"flex",minHeight:"100vh",background:C.pageBg}}>
      <style>{CSS}</style>

      {agMod.open&&<AgencyModal existing={agMod.editing} onClose={()=>setAgMod({open:false,editing:null})} onSaved={s=>{if(agMod.editing&&selAgency?.id===agMod.editing.id)setSelAgency(s);}}/>}
      {billMod.open&&<CreateBillModal agencies={agencies} preAgencyId={billMod.preId} onClose={()=>setBillMod({open:false,preId:""})}/>}
      {histMod&&<AgencyHistoryModal agency={histMod} bills={bills} agencies={agencies} onClose={()=>setHistMod(null)}/>}

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="brand-logo-wrap" style={{padding:"4px 8px 18px",borderBottom:"1px solid #2a0e0e",marginBottom:8}}>
          <Logo size={34}/>
        </div>
        {nav.map(n=>(
          <div key={n.id} className={`ni ${page===n.id&&!selAgency?"na":""}`} onClick={()=>{setPage(n.id);setSelAgency(null);}}>
            <span>{n.icon}</span><span style={{flex:1}}>{n.label}</span>
            {n.badge>0&&<span className="nav-badge">{n.badge}</span>}
          </div>
        ))}
        <div style={{flex:1}}/>
        <div className="sidebar-footer" style={{padding:"12px 14px",borderRadius:10,background:"#2a0e0e"}}>
          <div style={{fontSize:10,color:"#6b2a2a",textTransform:"uppercase"}}>Signed in as</div>
          <div style={{fontSize:13,fontWeight:700,color:"#f5c518",marginTop:2}}>{user?.name||"Owner"}</div>
          <div style={{fontSize:10,color:"#6b2a2a",marginTop:1}}>{user?.role}</div>
          <button className="btn btn-danger" style={{marginTop:10,width:"100%",fontSize:11,padding:6}} onClick={doLogout}>Logout</button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="main-content" style={{flex:1,overflow:"auto",padding:"24px 28px"}}>

        {/* DASHBOARD HOME */}
        {page==="dashboard"&&!selAgency&&(
          <div className="fi">
            <PH title={`Good morning, ${user?.name?.split(" ")[0]||"Owner"} 🌅`}
              sub={new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              action={<button className="btn btn-red hide-mobile" onClick={()=>setBillMod({open:true,preId:""})}>+ New Bill</button>}/>
            {loadingData?<div style={{textAlign:"center",padding:60,color:C.textLight}}><Spin/> &nbsp;Loading...</div>:(
              <>
                <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:22}}>
                  <SC label="Total Agencies"    value={agencies.length} icon="🏢" color={C.redDark} accent={C.red} sub={`${agencies.filter(a=>a.status==="overdue").length} overdue`}/>
                  <SC label="Pending Orders"    value={pendingOrders.length} icon="📦" color="#d97706" accent={C.yellow} sub="awaiting approval"/>
                  <SC label="Total Outstanding" value={`Rs.${totalOut.toLocaleString()}`} icon="⚠️" color={C.red} accent={C.red} sub="from agencies"/>
                  <SC label="Bills This Month"  value={`Rs.${bills.filter(b=>{const d=b.createdAt?.toDate?.();return d&&d.getMonth()===new Date().getMonth();}).reduce((s,b)=>s+(b.total||0),0).toLocaleString()}`} icon="🧾" color="#065f46" accent="#10b981" sub="total billed"/>
                </div>
                {pendingOrders.length>0&&<div style={{background:"#fffbeb",border:`1px solid ${C.yellow}`,borderLeft:`4px solid ${C.yellow}`,borderRadius:12,padding:"14px 18px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:800,color:C.redDark,fontSize:14}}>🔔 {pendingOrders.length} New Orders Waiting</div>
                    <div style={{fontSize:12,color:"#92400e",marginTop:3}}>{pendingOrders.slice(0,3).map(o=>agencies.find(a=>a.id===o.agencyId)?.name||"Agency").join(" · ")}</div>
                  </div>
                  <button className="btn btn-yellow" style={{fontSize:12}} onClick={()=>setPage("orders")}>Review →</button>
                </div>}
                <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:18}}>
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontWeight:800,fontSize:15,color:C.text}}>Agency Overview</div>
                      <button className="btn btn-ghost" style={{fontSize:11}} onClick={()=>setPage("agencies")}>View All →</button>
                    </div>
                    {agencies.length===0?<div className="empty-state"><div className="icon">🏢</div><p>No agencies yet</p><button className="btn btn-red" style={{fontSize:12}} onClick={()=>setAgMod({open:true,editing:null})}>+ Add First Agency</button></div>
                    :agencies.slice(0,6).map(a=>(
                      <div key={a.id} className="tr" style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:8,cursor:"pointer"}} onClick={()=>{setPage("agencies");setSelAgency(a);}}>
                        <div><div style={{fontWeight:700,fontSize:13,color:C.text}}>{a.name}</div><div style={{fontSize:11,color:C.textLight}}>{a.city} · {a.totalShops||0} shops</div></div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontWeight:800,fontSize:13,color:(a.outstanding||0)>0?C.red:"#065f46"}}>Rs.{(a.outstanding||0).toLocaleString()}</div>
                          <Tag cls={`b${a.status==="active"?"a":"o"}`}>{a.status}</Tag>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="card">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                      <div style={{fontWeight:800,fontSize:15,color:C.text}}>Recent Bills</div>
                      <button className="btn btn-red" style={{fontSize:11}} onClick={()=>setBillMod({open:true,preId:""})}>+ Bill</button>
                    </div>
                    {bills.length===0?<div className="empty-state"><div className="icon">🧾</div><p>No bills yet</p></div>
                    :bills.slice(0,5).map(b=>(
                      <div key={b.id} style={{padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <div style={{fontSize:12,fontWeight:700,color:C.text}}>{b.agencyName||"—"}</div>
                          <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                          <div style={{fontSize:11,color:C.textLight}}>{b.billNo}</div>
                          <div style={{fontWeight:800,fontSize:12,color:C.redDark}}>Rs.{(b.total||0).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ORDERS */}
        {page==="orders"&&(
          <div className="fi">
            <PH title="Agency Orders 📦" sub={`${pendingOrders.length} pending`}/>
            {orders.length===0?<div className="empty-state card"><div className="icon">📦</div><p>No orders yet.</p></div>
            :orders.map(o=>{
              const ag=agencies.find(a=>a.id===o.agencyId);
              return(
                <div key={o.id} className="card" style={{marginBottom:14,borderLeft:`4px solid ${o.status==="pending"?C.yellow:o.status==="approved"?"#10b981":"#ef4444"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <Tag cls={`b${o.status==="pending"?"p":o.status==="approved"?"a":"o"}`}>{o.status}</Tag>
                      <div style={{fontWeight:800,fontSize:15,color:C.text,marginTop:6}}>{ag?.name||o.agencyId}</div>
                      <div style={{fontSize:12,color:C.textLight}}>{o.createdAt?.toDate?.()?.toLocaleString("en-IN")||"Just now"}</div>
                      {o.notes&&<div style={{fontSize:12,color:"#7c3aed",marginTop:4}}>📝 {o.notes}</div>}
                    </div>
                    <div style={{fontWeight:800,fontSize:20,color:C.redDark}}>Rs.{(o.total||0).toLocaleString()}</div>
                  </div>
                  {o.status==="pending"&&<div style={{display:"flex",gap:10}}>
                    <button className="btn btn-red" style={{flex:1}} onClick={()=>approveOrder(o)}>✓ Approve & Bill</button>
                    <button className="btn btn-ghost" onClick={()=>rejectOrder(o)}>✕ Reject</button>
                  </div>}
                </div>
              );
            })}
          </div>
        )}

        {/* BILLING */}
        {page==="billing"&&(
          <div className="fi">
            <PH title="Billing 🧾" sub={`${bills.length} invoices`} action={<button className="btn btn-red" onClick={()=>setBillMod({open:true,preId:""})}>+ Create Bill</button>}/>
            <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
              <SC label="Total Billed" value={`Rs.${bills.reduce((s,b)=>s+(b.total||0),0).toLocaleString()}`} icon="🧾" color={C.redDark} accent={C.red}/>
              <SC label="Pending"      value={`Rs.${bills.filter(b=>b.status==="pending").reduce((s,b)=>s+(b.total||0),0).toLocaleString()}`} icon="⏳" color="#d97706" accent={C.yellow}/>
              <SC label="Collected"    value={`Rs.${bills.filter(b=>b.status==="paid").reduce((s,b)=>s+(b.total||0),0).toLocaleString()}`} icon="✅" color="#065f46" accent="#10b981"/>
            </div>
            {bills.length===0?<div className="empty-state card"><div className="icon">🧾</div><p>No bills yet.</p><button className="btn btn-red" onClick={()=>setBillMod({open:true,preId:""})}>+ Create First Bill</button></div>
            :<div className="card" style={{padding:0}}>
              <div style={{display:"grid",gridTemplateColumns:"1.1fr 1.5fr 1fr 80px 80px 70px 70px 70px",gap:6,padding:"10px 14px",background:"#fff8f8",borderRadius:"14px 14px 0 0",borderBottom:`1px solid ${C.border}`}}>
                {["Bill No","Agency","Total","Status","Date","","PDF","WA"].map((h,i)=><div key={i} style={{fontSize:10,color:C.textLight,fontWeight:700,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {bills.map(b=>(
                <div key={b.id} className="tr" style={{display:"grid",gridTemplateColumns:"1.1fr 1.5fr 1fr 80px 80px 70px 70px 70px",gap:6,alignItems:"center"}}>
                  <div style={{fontWeight:700,fontSize:12,color:C.red}}>{b.billNo}</div>
                  <div style={{fontWeight:600,fontSize:13}}>{b.agencyName||"—"}</div>
                  <div style={{fontWeight:800,color:C.redDark}}>Rs.{(b.total||0).toLocaleString()}</div>
                  <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                  <div style={{fontSize:11,color:C.textLight}}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")||"—"}</div>
                  {b.status!=="paid"?<button className="btn btn-ghost" style={{fontSize:10,padding:"4px 6px"}} onClick={()=>markPaid(b)}>Paid</button>:<div/>}
                  <button className="btn btn-yellow" style={{fontSize:10,padding:"4px 6px"}} onClick={()=>printInvoice(b,agencies.find(a=>a.id===b.agencyId))}>🖨️</button>
                  <button className="btn btn-green"  style={{fontSize:10,padding:"4px 6px"}} onClick={()=>shareWhatsApp(b,agencies.find(a=>a.id===b.agencyId))}>💬</button>
                </div>
              ))}
            </div>}
          </div>
        )}

        {/* AGENCIES LIST */}
        {page==="agencies"&&!selAgency&&(
          <div className="fi">
            <PH title="Agencies 🏢" sub={`${agencies.length} agencies · Saurashtra`} action={<button className="btn btn-red" onClick={()=>setAgMod({open:true,editing:null})}>+ Add Agency</button>}/>
            {agencies.length===0?<div className="empty-state card"><div className="icon">🏢</div><p>No agencies yet.</p><button className="btn btn-red" onClick={()=>setAgMod({open:true,editing:null})}>+ Add Agency</button></div>
            :<div className="card" style={{padding:0}}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 0.6fr 80px 60px 70px 70px",gap:6,padding:"10px 14px",background:"#fff8f8",borderRadius:"14px 14px 0 0",borderBottom:`1px solid ${C.border}`}}>
                {["Agency","Owner","Outstanding","Shops","Status","","",""].map((h,i)=><div key={i} style={{fontSize:10,color:C.textLight,fontWeight:700,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {agencies.map(a=>(
                <div key={a.id} className="tr" style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1fr 0.6fr 80px 60px 70px 70px",gap:6,alignItems:"center"}}>
                  <div style={{cursor:"pointer"}} onClick={()=>setSelAgency(a)}><div style={{fontWeight:700,fontSize:13,color:C.text}}>{a.name}</div><div style={{fontSize:11,color:C.textLight}}>{a.city}</div></div>
                  <div style={{cursor:"pointer"}} onClick={()=>setSelAgency(a)}><div style={{fontSize:12,color:C.text}}>{a.owner}</div><div style={{fontSize:11,color:C.textLight}}>{a.phone}</div></div>
                  <div style={{fontWeight:800,color:(a.outstanding||0)>0?C.red:"#065f46",cursor:"pointer"}} onClick={()=>setSelAgency(a)}>Rs.{(a.outstanding||0).toLocaleString()}</div>
                  <div style={{fontSize:12,color:C.textMid}}>{a.totalShops||0}</div>
                  <Tag cls={`b${a.status==="active"?"a":"o"}`}>{a.status}</Tag>
                  <button className="btn btn-ghost" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>setAgMod({open:true,editing:a})}>✏️</button>
                  <button className="btn btn-ghost" style={{fontSize:11,padding:"4px 8px",color:"#7c3aed",borderColor:"#ddd6fe"}} onClick={()=>setHistMod(a)}>📋</button>
                  <button className="btn btn-ghost" style={{fontSize:11,padding:"4px 8px",color:"#128C7E",borderColor:"#a7f3d0"}} onClick={()=>{const b=bills.filter(x=>x.agencyId===a.id&&x.status!=="paid");if(b.length>0)shareWhatsApp(b[0],a);}}>💬</button>
                </div>
              ))}
            </div>}
          </div>
        )}

        {/* AGENCY DETAIL */}
        {page==="agencies"&&selAgency&&(()=>{
          const ab=bills.filter(b=>b.agencyId===selAgency.id);
          const now=new Date();
          const mBills=ab.filter(b=>{const d=b.createdAt?.toDate?.();return d&&d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
          const mTotal=mBills.reduce((s,b)=>s+(b.total||0),0);
          const pTotal=ab.filter(b=>b.status!=="paid").reduce((s,b)=>s+(b.total||0),0);
          return(
            <div className="fi">
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22,flexWrap:"wrap"}}>
                <button className="btn btn-ghost" onClick={()=>setSelAgency(null)}>← Back</button>
                <div><h1 style={{fontSize:20,fontWeight:800,color:C.redDark,fontFamily:"'Playfair Display',serif"}}>{selAgency.name}</h1><p style={{color:C.textLight,fontSize:13}}>{selAgency.city}</p></div>
                <div style={{marginLeft:"auto",display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button className="btn btn-ghost" style={{color:"#7c3aed",borderColor:"#ddd6fe"}} onClick={()=>setHistMod(selAgency)}>📋 History</button>
                  <button className="btn btn-ghost" onClick={()=>setAgMod({open:true,editing:selAgency})}>✏️ Edit</button>
                  <button className="btn btn-red"   onClick={()=>setBillMod({open:true,preId:selAgency.id})}>+ New Bill</button>
                  {selAgency.phone&&<a href={`https://wa.me/91${selAgency.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"><button className="btn btn-green">💬 Chat</button></a>}
                  <button className="btn btn-danger" onClick={()=>delAgency(selAgency.id)}>🗑️</button>
                </div>
              </div>

              {/* this-month stats */}
              <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
                <SC label="This Month Billed" value={`Rs.${mTotal.toLocaleString()}`} icon="📅" color={C.redDark} accent={C.red} sub={`${mBills.length} invoices`}/>
                <SC label="Pending Amount"    value={`Rs.${pTotal.toLocaleString()}`} icon="⏳" color="#d97706" accent={C.yellow}/>
                <SC label="Total Invoices"    value={ab.length} icon="🧾" color="#065f46" accent="#10b981"/>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:18}}>
                <div className="card">
                  <div style={{fontWeight:800,marginBottom:14,color:C.text}}>📋 Profile</div>
                  {[["Owner",selAgency.owner],["Phone",selAgency.phone],["City",selAgency.city],["Email",selAgency.email],["GST",selAgency.gst]].filter(([,v])=>v).map(([k,v])=>(
                    <div key={k} style={{display:"grid",gridTemplateColumns:"90px 1fr",gap:8,marginBottom:10}}>
                      <div style={{fontSize:10,color:C.textLight,fontWeight:700,textTransform:"uppercase"}}>{k}</div>
                      <div style={{fontSize:13,color:C.text}}>{v}</div>
                    </div>
                  ))}
                  {selAgency.address&&<div style={{marginTop:8,fontSize:12,color:C.textLight}}>{selAgency.address}</div>}
                </div>
                <div className="card">
                  <div style={{fontWeight:800,marginBottom:14,color:C.text}}>💰 Financials</div>
                  {[["Credit Limit",`Rs.${(selAgency.creditLimit||0).toLocaleString()}`,C.text],["Outstanding",`Rs.${(selAgency.outstanding||0).toLocaleString()}`,(selAgency.outstanding||0)>0?C.red:"#065f46"],["Total Shops",selAgency.totalShops||0,C.text]].map(([k,v,color])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                      <span style={{fontSize:12,color:C.textLight}}>{k}</span>
                      <span style={{fontWeight:800,fontSize:14,color}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{padding:0}}>
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,fontWeight:800,color:C.text,background:"#fff8f8",borderRadius:"14px 14px 0 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span>🧾 All Invoices</span>
                  <button className="btn btn-red" style={{fontSize:11,padding:"5px 14px"}} onClick={()=>setBillMod({open:true,preId:selAgency.id})}>+ New Bill</button>
                </div>
                {ab.length===0?<div className="empty-state" style={{padding:24}}><p>No invoices yet.</p></div>
                :ab.map(b=>(
                  <div key={b.id} className="tr" style={{display:"grid",gridTemplateColumns:"1.1fr 1fr 1fr 80px 80px 60px 60px",gap:8,alignItems:"center"}}>
                    <div style={{fontWeight:700,fontSize:12,color:C.red}}>{b.billNo}</div>
                    <div style={{fontSize:11,color:C.textLight}}>{b.createdAt?.toDate?.()?.toLocaleDateString("en-IN")}</div>
                    <div style={{fontWeight:800,color:C.redDark}}>Rs.{(b.total||0).toLocaleString()}</div>
                    <Tag cls={`b${b.status==="paid"?"a":b.status==="overdue"?"o":"p"}`}>{b.status}</Tag>
                    {b.status!=="paid"?<button className="btn btn-ghost" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>markPaid(b)}>Mark Paid</button>:<div/>}
                    <button className="btn btn-yellow" style={{fontSize:10,padding:"4px 8px"}} onClick={()=>printInvoice(b,selAgency)}>🖨️</button>
                    <button className="btn btn-green"  style={{fontSize:10,padding:"4px 8px"}} onClick={()=>shareWhatsApp(b,selAgency)}>💬</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* VEHICLES */}
        {page==="vehicles"&&(
          <div className="fi">
            <PH title="Vehicles 🚚" sub="Fleet management"/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
              {[{id:"V01",name:"GJ-03-AB-1234",driver:"Ramesh Bhai",status:"on-route",route:"Rajkot → Jamnagar"},{id:"V02",name:"GJ-03-CD-5678",driver:"Suresh Patel",status:"idle",route:null},{id:"V03",name:"GJ-03-EF-9012",driver:"Dinesh Mer",status:"on-route",route:"Factory → Junagadh"},{id:"V04",name:"GJ-03-GH-3456",driver:"Vijay Bhai",status:"idle",route:null}].map(v=>(
                <div key={v.id} className="card" style={{borderLeft:`4px solid ${v.status==="on-route"?C.red:C.yellow}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}><div style={{fontWeight:800,fontSize:15,color:C.text}}>{v.name}</div><Tag cls={v.status==="on-route"?"ba":"bp"}>{v.status}</Tag></div>
                  <div style={{fontSize:12,color:C.textMid}}>Driver: <b>{v.driver}</b></div>
                  <div style={{fontSize:11,color:v.route?C.red:C.textLight,marginTop:4}}>{v.route||"Idle at factory"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]=useState("loading");
  const [user,setUser]=useState(null);
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async fu=>{
      if(fu){
        try{
          const snap=await getDoc(doc(db,"users",fu.uid));
          const p=snap.exists()?snap.data():{};
          setUser({uid:fu.uid,name:p.firstName?`${p.firstName} ${p.lastName}`.trim():fu.displayName||fu.email,email:fu.email,role:p.role||"staff"});
          setScreen("dashboard");
        }catch{setUser({uid:fu.uid,name:fu.displayName||fu.email,email:fu.email,role:"staff"});setScreen("dashboard");}
      }else setScreen("signin");
    });
    return()=>unsub();
  },[]);

  if(screen==="loading") return<div className="loading-screen"><style>{CSS}</style><div style={{textAlign:"center"}}><Logo size={60} showText={false}/><div style={{marginTop:18,fontSize:14,color:C.textLight}}><Spin/> &nbsp;Loading...</div></div></div>;
  if(screen==="signup") return<SignupScreen onDone={u=>{if(u){setUser(u);setScreen("dashboard");}else setScreen("signin");}}/>;
  if(screen==="signin") return<SigninScreen onLogin={u=>{setUser(u);setScreen("dashboard");}} onSignup={()=>setScreen("signup")}/>;
  return<Dashboard user={user} onLogout={()=>{setUser(null);setScreen("signin");}}/>;
}
