// src/constants.js
// ── Brand colors ──────────────────────────────────────────────────────────────
export const C = {
  red:       "#c8181e",
  redDark:   "#9e1015",
  redLight:  "#f03035",
  yellow:    "#f5c518",
  yellowDark:"#d4a012",
  white:     "#ffffff",
  sidebar:   "#110606",
  text:      "#1a0505",
  textMid:   "#6b3333",
  textLight: "#a07070",
  border:    "#f0dada",
  cardBg:    "#ffffff",
  pageBg:    "#fdf5f5",
};

// ── Global CSS ────────────────────────────────────────────────────────────────
export const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Nunito:wght@400;500;600;700;800&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Nunito',sans-serif;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:#f0dada;}
::-webkit-scrollbar-thumb{background:#c8181e;border-radius:4px;}

.sidebar{width:230px;background:#110606;display:flex;flex-direction:column;gap:4px;padding:20px 10px;flex-shrink:0;position:sticky;top:0;height:100vh;overflow-y:auto;}
.brand-name{font-family:'Playfair Display',serif;font-size:15px;color:#f5c518;line-height:1.2;}
.brand-sub{font-size:9px;color:#6b2a2a;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
.ni{cursor:pointer;padding:10px 14px;border-radius:10px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;transition:all 0.2s;color:#9a5555;}
.ni:hover{background:#2a0e0e;color:#f5c518;}
.na{background:linear-gradient(135deg,#7a0c10,#c8181e)!important;color:#fff!important;box-shadow:0 4px 12px rgba(200,24,30,0.4);}
.nav-badge{background:#f5c518;color:#9e1015;border-radius:20px;font-size:10px;font-weight:800;padding:1px 7px;margin-left:auto;}

.card{background:#fff;border:1px solid #f0dada;border-radius:14px;padding:18px;box-shadow:0 2px 8px rgba(200,24,30,0.06);}
.sc{background:#fff;border:1px solid #f0dada;border-radius:14px;padding:20px;transition:transform 0.2s,box-shadow 0.2s;box-shadow:0 2px 8px rgba(200,24,30,0.06);}
.sc:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(200,24,30,0.12);}

.badge{padding:3px 9px;border-radius:20px;font-size:10px;font-weight:800;letter-spacing:0.5px;display:inline-block;text-transform:uppercase;}
.ba{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;}
.bo{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
.bp{background:#fffbeb;color:#92400e;border:1px solid #fde68a;}
.bd{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;}

.btn{padding:9px 20px;border-radius:10px;border:none;cursor:pointer;font-family:'Nunito',sans-serif;font-size:13px;font-weight:700;transition:all 0.2s;}
.btn-red{background:linear-gradient(135deg,#c8181e,#9e1015);color:#fff;box-shadow:0 4px 12px rgba(200,24,30,0.3);}
.btn-red:hover{background:linear-gradient(135deg,#f03035,#c8181e);transform:translateY(-1px);}
.btn-red:disabled{opacity:0.6;cursor:not-allowed;transform:none;}
.btn-yellow{background:linear-gradient(135deg,#f5c518,#d4a012);color:#9e1015;}
.btn-yellow:hover{transform:translateY(-1px);}
.btn-green{background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;}
.btn-green:hover{transform:translateY(-1px);}
.btn-ghost{background:#fff5f5;color:#6b3333;border:1px solid #f0dada;}
.btn-ghost:hover{background:#fef2f2;color:#c8181e;}
.btn-danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;}
.btn-danger:hover{background:#fee2e2;}

.inp{background:#fff;border:1.5px solid #f0dada;border-radius:10px;padding:10px 14px;color:#1a0505;font-family:'Nunito',sans-serif;font-size:13px;outline:none;transition:border-color 0.2s,box-shadow 0.2s;width:100%;}
.inp:focus{border-color:#c8181e;box-shadow:0 0 0 3px rgba(200,24,30,0.08);}
.sel{background:#fff;border:1.5px solid #f0dada;border-radius:10px;padding:10px 14px;color:#1a0505;font-family:'Nunito',sans-serif;font-size:13px;outline:none;width:100%;cursor:pointer;}
.sel:focus{border-color:#c8181e;}
.lbl{font-size:11px;color:#6b3333;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:6px;display:block;}

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

.auth-wrap{min-height:100vh;display:flex;background:#fdf5f5;}
.auth-left{width:420px;background:linear-gradient(160deg,#9e1015 0%,#c8181e 50%,#e03535 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;flex-shrink:0;}
.auth-right{flex:1;display:flex;align-items:center;justify-content:center;padding:32px;}
.auth-card{background:#fff;border-radius:20px;padding:36px;width:100%;max-width:460px;box-shadow:0 8px 32px rgba(200,24,30,0.1);}

.toggle{position:relative;width:42px;height:24px;flex-shrink:0;}
.toggle input{opacity:0;width:0;height:0;}
.toggle-slider{position:absolute;inset:0;background:#e5e7eb;border-radius:24px;cursor:pointer;transition:0.3s;}
.toggle-slider:before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:white;border-radius:50%;transition:0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2);}
.toggle input:checked+.toggle-slider{background:#c8181e;}
.toggle input:checked+.toggle-slider:before{transform:translateX(18px);}

.otp-wrap{display:flex;gap:10px;justify-content:center;margin:16px 0;}
.otp-inp{width:48px;height:52px;text-align:center;font-size:20px;font-weight:800;border:2px solid #f0dada;border-radius:12px;outline:none;font-family:'Nunito',sans-serif;color:#9e1015;transition:border-color 0.2s;}
.otp-inp:focus{border-color:#c8181e;box-shadow:0 0 0 3px rgba(200,24,30,0.1);}

.err-box{font-size:12px;color:#c8181e;margin-bottom:12px;background:#fef2f2;padding:10px 12px;border-radius:8px;border-left:3px solid #c8181e;}
.ok-box{font-size:12px;color:#065f46;margin-bottom:12px;background:#ecfdf5;padding:10px 12px;border-radius:8px;border-left:3px solid #10b981;}

.loading-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fdf5f5;}
.empty-state{text-align:center;padding:48px 20px;color:#a07070;}
.empty-state .icon{font-size:48px;margin-bottom:12px;}
.empty-state p{font-size:14px;margin-bottom:16px;}

.iswrap{position:relative;}
.idrop{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:2px solid #c8181e;border-radius:12px;z-index:999;max-height:240px;overflow-y:auto;box-shadow:0 12px 32px rgba(200,24,30,0.18);}
.iopt{padding:10px 14px;cursor:pointer;border-bottom:1px solid #fdf0f0;transition:background 0.12s;}
.iopt:hover{background:#fff0f0;}
.iopt:last-child{border-bottom:none;}
.iopt-name{font-size:12px;font-weight:700;color:#1a0505;}
.iopt-rate{font-size:11px;color:#c8181e;font-weight:700;margin-top:2px;}

@media(max-width:768px){
  .sidebar{width:100%;height:auto;flex-direction:row;padding:10px;overflow-x:auto;position:fixed;bottom:0;top:auto;z-index:100;border-top:2px solid #2a0e0e;}
  .ni{flex-direction:column;gap:3px;font-size:10px;padding:8px 12px;min-width:60px;text-align:center;}
  .brand-logo-wrap,.sidebar-footer{display:none;}
  .main-content{padding:16px 14px 80px!important;}
  .auth-left{display:none;}
  .auth-card{padding:24px;}
  .stat-grid{grid-template-columns:1fr 1fr!important;}
  .hide-mobile{display:none!important;}
  .page-title{font-size:18px!important;}
  .mbox{padding:20px;width:98vw;}
}
@media(max-width:480px){.stat-grid{grid-template-columns:1fr!important;}}
`;

// ── Full item catalog — 237 items from Vrundavan product list ─────────────────
export const ITEM_CATALOG = [
  { id:1,   name:"02. JEERA MASALA PEPSI [1*52] [P]",                         rate:70    },
  { id:2,   name:"02. KACHI KERI [1*52] [P]",                                 rate:70    },
  { id:3,   name:"02. MANGO PEPSI [1*52] [P]",                                rate:70    },
  { id:4,   name:"02. ORANGE PEPSI [1*52] [P]",                               rate:70    },
  { id:5,   name:"05. JEERA MASALA [1*30]",                                   rate:125   },
  { id:6,   name:"05. [J] JALJEERA JYUSI [1*30]",                             rate:125   },
  { id:7,   name:"05. [J] KACHHA AAM JYUSI [1*30]",                           rate:125   },
  { id:8,   name:"05. [ ] KALA KHATTA JYUSHI [1*30]",                         rate:125   },
  { id:9,   name:"05. [J] MENGO JYUSI [1*30]",                                rate:125   },
  { id:10,  name:"05. [J] ORANGE JYUSI [1*30]",                               rate:125   },
  { id:11,  name:"05. CHIKU CANDY [1*30]",                                    rate:125   },
  { id:12,  name:"05. CHOCOLATE BOMB [1*50]",                                 rate:200   },
  { id:13,  name:"05. GULKAND CANDY [1*24]",                                  rate:101   },
  { id:14,  name:"05. GULKAND CANDY [1*25]",                                  rate:105   },
  { id:15,  name:"05. MAVA CHOPATY [1*30]",                                   rate:125   },
  { id:16,  name:"05. MINI CHOCOBAR [1*30]",                                  rate:127   },
  { id:17,  name:"05. MINI CHOPATY [1*30]",                                   rate:125   },
  { id:18,  name:"05. NANA GULAB CUP [1*40]",                                 rate:160   },
  { id:19,  name:"05. NANA MANGO CUP [1*40]",                                 rate:160   },
  { id:20,  name:"05. NANA VANILLA CUP [1*40]",                               rate:160   },
  { id:21,  name:"05. PEPSI MANGO [1*52] [P]",                                rate:200   },
  { id:22,  name:"05. PEPSI COCO [1*52] [P]",                                 rate:200   },
  { id:23,  name:"05. PEPSI MAVA MALAI [1*52] [P]",                           rate:200   },
  { id:24,  name:"05. PEPSI PISTA [1*52] [P]",                                rate:200   },
  { id:25,  name:"05. PEPSI ROSE [1*52] [P]",                                 rate:200   },
  { id:26,  name:"05. RAJBHOG CANDY [1*30]",                                  rate:125   },
  { id:27,  name:"05. RAJBHOG PEPSI [1*52] (P)",                              rate:200   },
  { id:28,  name:"05. VANILLA CHOPATY [1*30]",                                rate:125   },
  { id:29,  name:"10. BUTTER CUP [1*24] [60ML]",                              rate:190   },
  { id:30,  name:"10. BUTTER SCOTCH CONE [1*20] [90ML]",                      rate:165   },
  { id:31,  name:"10. CHIKU CANDY [1*30]",                                    rate:237   },
  { id:32,  name:"10. CHOCO VANILLA CONE [1*20] [80ML]",                      rate:155   },
  { id:33,  name:"10. CLASSIC CHOCOBAR [1*30]",                               rate:250   },
  { id:34,  name:"10. COCONUT CANDY [1*24]",                                  rate:190   },
  { id:35,  name:"10. CRUNCHY CHOCOBAR [1*30]",                               rate:250   },
  { id:36,  name:"10. DAHI MASTI [1*30]",                                     rate:190   },
  { id:37,  name:"10. FRESH MANGO CUP [1*24] [60ML]",                         rate:190   },
  { id:38,  name:"10. GREEN CHOCOBAR [1*30]",                                 rate:127   },
  { id:39,  name:"10. GREEN COCONUT CANDY [1*30]",                            rate:195   },
  { id:40,  name:"10. JUNIOR BUTTER SCOTCH CONE [1*20] [80ML]",               rate:155   },
  { id:41,  name:"10. JUNIOR CHOCOLATE CONE [1*20] [80ML]",                   rate:155   },
  { id:42,  name:"10. JUNIOR PINKY BAR [1*24]",                               rate:200   },
  { id:43,  name:"10. KESAR CHOWPATY [1*16]",                                 rate:130   },
  { id:44,  name:"10. KESAR ELAICHI CUP [1*24] [60ML]",                       rate:190   },
  { id:45,  name:"10. MANGO DOLLY [1*30]",                                    rate:237   },
  { id:46,  name:"10. MASTI CHOWPATY [1*16]",                                 rate:130   },
  { id:47,  name:"10. MAVA MALAI [1*30]",                                     rate:250   },
  { id:48,  name:"10. MOTA VANILLA CUP [1*24] [60ML]",                        rate:190   },
  { id:49,  name:"10. PAN PASAND [1*16]",                                     rate:130   },
  { id:50,  name:"10. PLAIN PISTA CUP [1*24] [60ML]",                         rate:190   },
  { id:51,  name:"10. RIPPLE FUNDAY [1*8]",                                   rate:70    },
  { id:52,  name:"10. ROYAL RAJWADI [1*16]",                                  rate:130   },
  { id:53,  name:"20. ALPHONSO MANGO [1*20]",                                 rate:320   },
  { id:54,  name:"20. AMERICAN DRYFRUIT CUP [1*15] [100ML]",                  rate:245   },
  { id:55,  name:"20. BUTTER CARAMEL CONE [1*14] [100ML]",                    rate:175   },
  { id:56,  name:"20. BUTTER SCOTCH CONE [1*14] DOUBLE",                      rate:125   },
  { id:57,  name:"20. CHOCOLATE CHIPS CUP [1*15]",                            rate:245   },
  { id:58,  name:"20. CHOCOLATE CONE [1*14] [100ML]",                         rate:225   },
  { id:59,  name:"20. CLASSIC CHOCOBAR [1*15]",                               rate:150   },
  { id:60,  name:"20. DREAM MAGIC CONE [1*14] [100ML]",                       rate:175   },
  { id:61,  name:"20. FESTIVAL MANGODOLLY [1*24]",                            rate:240   },
  { id:62,  name:"20. FESTIVAL MAVA MALAI [1*24]",                            rate:240   },
  { id:63,  name:"20. FESTIVAL RASPBERRY DOLLY [1*24]",                       rate:240   },
  { id:64,  name:"20. GOLD MAGIC CUP [1*15] [100ML]",                         rate:245   },
  { id:65,  name:"20. GOLDEN PEARL [1*15] [100ML]",                           rate:245   },
  { id:66,  name:"20. JUNIOR NUTTY BAR [1*20]",                               rate:300   },
  { id:67,  name:"20. KAJU DRAKSH CONE [1*14] [100ML]",                       rate:225   },
  { id:68,  name:"20. KAJU DRAKSH CUP [1*12] [120ML]",                        rate:180   },
  { id:69,  name:"20. KESAR BADAM [1*15] [100ML]",                            rate:245   },
  { id:70,  name:"20. MALAI MASTI [1*14]",                                    rate:225   },
  { id:71,  name:"20. MAVA BADAM CUP [1*15] [100ML]",                         rate:245   },
  { id:72,  name:"20. PINKY BAR [1*20]",                                      rate:310   },
  { id:73,  name:"20. PISTA MALAI [1*20]",                                    rate:320   },
  { id:74,  name:"20. PREMIUM BUTTER SCOTCH CONE [1*14] [100ML]",             rate:225   },
  { id:75,  name:"20. PREMIUM CHOCOBAR [1*20]",                               rate:260   },
  { id:76,  name:"20. PREMIUM MANGODOLLY [1*20]",                             rate:327   },
  { id:77,  name:"20. PREMIUM RASPBERRY DOLLY [1*20]",                        rate:260   },
  { id:78,  name:"20. PREMIUM VANILLA CUP [1*12] [120ML]",                    rate:160   },
  { id:79,  name:"20. RAJVADI MATKA [1*22] [100ML]",                          rate:355   },
  { id:80,  name:"20. ROYAL MAVA MALAI [1*20]",                               rate:320   },
  { id:81,  name:"20. SPECIAL THABADI [1*15] [100ML]",                        rate:245   },
  { id:82,  name:"25. CP VANILLA [250ML 1*12]",                               rate:240   },
  { id:83,  name:"25. RAJAVADI KULFI [1*15]",                                 rate:315   },
  { id:84,  name:"30. ALMOND CARNIVAL CUP [1*12] [120ML]",                    rate:285   },
  { id:85,  name:"30. ANJEER KULFI [1*12]",                                   rate:290   },
  { id:86,  name:"30. CHOCO BROWNIE [1*8] [120ML]",                           rate:200   },
  { id:87,  name:"30. KAJU GULKAND CUP [1*12] [120ML]",                       rate:285   },
  { id:88,  name:"30. KESAR PISTA CONE [1*14] [110ML]",                       rate:280   },
  { id:89,  name:"30. KESAR PISTA CUP [1*12] [120ML]",                        rate:285   },
  { id:90,  name:"30. RABDI KULFI 60ML [1*12]",                               rate:285   },
  { id:91,  name:"30. RAJASTHANI FANDA [1*15]",                               rate:344   },
  { id:92,  name:"30. RAJBHOG CUP [1*12] [120ML]",                            rate:285   },
  { id:93,  name:"30. SITAPHAL CUP [1*12] [120ML]",                           rate:288   },
  { id:94,  name:"30. SP. VRUNDAVAN RABDI KULFI [1*20]",                      rate:475   },
  { id:95,  name:"30. SUGAR FREE VANILLA [1*12] [120ML]",                     rate:288   },
  { id:96,  name:"35. FROSTIC CANDY [1*20]",                                  rate:555   },
  { id:97,  name:"35. PUNJABI KULFI [1*12]",                                  rate:330   },
  { id:98,  name:"40. COOKIES & CREAM CUP 125ML [1*8]",                       rate:270   },
  { id:99,  name:"40. COOKIES & CREAM CUP [1*8] [100ML]",                     rate:270   },
  { id:100, name:"40. CP KAJU DRAKSH [250ML] [1*12]",                         rate:360   },
  { id:101, name:"40. KREKAL NATS CUP 125ML [1*8]",                           rate:270   },
  { id:102, name:"40. NUTTY BUDDY [1*15] [60ML]",                             rate:480   },
  { id:103, name:"40. NUTTY DRYFRUTS [1*15]",                                 rate:480   },
  { id:104, name:"40. ROASTED ALMOND [70ML] [1*20]",                          rate:640   },
  { id:105, name:"40. ROLL CUT ICE CREAM [100ML] [1*10]",                     rate:300   },
  { id:106, name:"40. SLICE KASATA [1*15] [100ML]",                           rate:450   },
  { id:107, name:"40. SP. VRUNDAVAN 125ML [1*8]",                             rate:270   },
  { id:108, name:"45. CHOCO BROWNIE CUP [1*8] [140ML]",                       rate:280   },
  { id:109, name:"45. CP AMERICAN DRYFRUIT [250ML] [1*12]",                   rate:420   },
  { id:110, name:"45. CP CHOCOLATE CHIPS [250ML] [1*12]",                     rate:420   },
  { id:111, name:"45. CP COOKIES & CREAM [250ML] [1*12]",                     rate:420   },
  { id:112, name:"45. CP RAJBHOG [250ML] [1*12]",                             rate:420   },
  { id:113, name:"45. CP REAL MANGO [250ML] [1*12]",                          rate:420   },
  { id:114, name:"45. CP SPECIAL THABADI [250ML] [1*12]",                     rate:420   },
  { id:115, name:"45. SINGAL SUNDAY [1*4] [100ML]",                           rate:145   },
  { id:116, name:"50. CLASSIC CASSATA [100ML] [1*8]",                         rate:320   },
  { id:117, name:"50. CP MAVA BADAM [250ML] [1*12]",                          rate:480   },
  { id:118, name:"50. TRIPAL SUNDAY [1*4] [120ML]",                           rate:160   },
  { id:119, name:"AFAGHAN MEVA [1-KG]",                                       rate:300   },
  { id:120, name:"ALMAND KARNIVAL [1-KG]",                                    rate:300   },
  { id:121, name:"AMERICAN BULK - 5 LITER",                                   rate:700   },
  { id:122, name:"AMERICAN DRYFRUIT [2.5 LITR]",                              rate:380   },
  { id:123, name:"AMERICAN ICE CREAM [1-KG]",                                 rate:320   },
  { id:124, name:"BAG (1)",                                                    rate:4500  },
  { id:125, name:"BUTTER MILK [CHASH]",                                        rate:8.34  },
  { id:126, name:"BUTTER SCOTCH [1-KG]",                                      rate:250   },
  { id:127, name:"BUTTER [1-KG]",                                              rate:500   },
  { id:128, name:"CLOD WAVE FREEZER [1]",                                      rate:18000 },
  { id:129, name:"DAHI [PER-1KG]",                                             rate:60    },
  { id:130, name:"FAMILY PACK AFGHAN MEVA 700ML [1+1]",                        rate:250   },
  { id:131, name:"FAMILY PACK BUTTER SCOTCH 500ML [1+1]",                      rate:120   },
  { id:132, name:"FAMILY PACK BUTTER SCOTCH 750ML [1+1]",                      rate:200   },
  { id:133, name:"FAMILY PACK CHOCO BROWNIE 750ML [1+1]",                      rate:240   },
  { id:134, name:"FAMILY PACK CHOCOLATE CHIPS 700ML [1+1]",                    rate:230   },
  { id:135, name:"FAMILY PACK COOKIES & CREAM 700ML [1+1]",                    rate:230   },
  { id:136, name:"FAMILY PACK DRY AMERICAN 500ML [1+1]",                       rate:140   },
  { id:137, name:"FAMILY PACK DRY AMERICAN 750ML [1+1]",                       rate:230   },
  { id:138, name:"FAMILY PACK GOLD MAGIC 500ML [1+1]",                         rate:140   },
  { id:139, name:"FAMILY PACK GOLD MAGIC 700ML [1+1]",                         rate:200   },
  { id:140, name:"FAMILY PACK KAJU DRAKSH 500ML [1+1]",                        rate:120   },
  { id:141, name:"FAMILY PACK KAJU DRAKSH 750ML [1+1]",                        rate:200   },
  { id:142, name:"FAMILY PACK KAJU GULKAND 700ML [1+1]",                       rate:230   },
  { id:143, name:"FAMILY PACK KESAR PISTA 700ML [1+1]",                        rate:240   },
  { id:144, name:"FAMILY PACK KREKAL NUTS 700ML [1+1]",                        rate:200   },
  { id:145, name:"FAMILY PACK MANGO KAJU 750ML [1+1]",                         rate:230   },
  { id:146, name:"FAMILY PACK MAVA BADAM 500ML [1+1]",                         rate:140   },
  { id:147, name:"FAMILY PACK MAVA BADAM 750ML [1+1]",                         rate:240   },
  { id:148, name:"FAMILY PACK PAN MASALA 700ML [1+1]",                         rate:200   },
  { id:149, name:"FAMILY PACK RAJBHOG 750ML [1+1]",                            rate:250   },
  { id:150, name:"FAMILY PACK VANILLA 500ML [1+1]",                            rate:90    },
  { id:151, name:"FAMILY PACK VANILLA 750ML [1+1]",                            rate:145   },
  { id:152, name:"GHORAVU [1-KG]",                                             rate:60    },
  { id:153, name:"GS. SRIKHAND AMERICAN DRYFRUIT [PER-1KG]",                   rate:215   },
  { id:154, name:"GS. SRIKHAND BORN BON [PER-1KG]",                            rate:215   },
  { id:155, name:"GS. SRIKHAND FRUIT [PER-1KG]",                               rate:215   },
  { id:156, name:"GS. SRIKHAND JELLY [PER-1KG]",                               rate:175   },
  { id:157, name:"GS. SRIKHAND KESAR [PER-1KG]",                               rate:215   },
  { id:158, name:"GS. SRIKHAND MANGO [PER-1KG]",                               rate:215   },
  { id:159, name:"GS. SRIKHAND RAJBHOG [PER-1KG]",                             rate:215   },
  { id:160, name:"ICE CREAM SPOON SCOOPER",                                    rate:1100  },
  { id:161, name:"J. SHRIKHAND FRUIT [PER-1KG]",                               rate:200   },
  { id:162, name:"J. SHRIKHAND KESAR [PER-1KG]",                               rate:200   },
  { id:163, name:"J. SRIKHAND RAJBHOG [PER-1KG]",                              rate:200   },
  { id:164, name:"KAJU GULKAND BULK [2.5 LITR]",                               rate:380   },
  { id:165, name:"KEKAL NATAS [1-KG]",                                         rate:300   },
  { id:166, name:"KESAR PISTA [2.5 LITR]",                                     rate:400   },
  { id:167, name:"LOOSE AMERICAN SRIKHAND [PER-1KG]",                          rate:210   },
  { id:168, name:"LOOSE BORN BON [PER-1KG]",                                   rate:210   },
  { id:169, name:"LOOSE BUTTER SCOTCH SRIKHAND [PER-1KG]",                     rate:240   },
  { id:170, name:"LOOSE FRUIT SRIKHAND [PER-1KG]",                             rate:200   },
  { id:171, name:"LOOSE JELLY SRIKHAND [PER-1KG]",                             rate:170   },
  { id:172, name:"LOOSE KESAR SRIKHAND [PER-1KG]",                             rate:200   },
  { id:173, name:"LOOSE KESAR SRIKHAND DOLL [PER-1KG]",                        rate:200   },
  { id:174, name:"LOOSE MANGO SRIKHAND [PER-1KG]",                             rate:195   },
  { id:175, name:"LOOSE RAJBHOG SRIKHAND [PER-1KG]",                           rate:210   },
  { id:176, name:"LOOSE RAJWADI SRIKHAND [PER-1KG]",                           rate:285   },
  { id:177, name:"LOOSE VANILLA SRIKHAND [PER-1KG]",                           rate:210   },
  { id:178, name:"LS. SRIKHAND FRUIT [10KG]",                                  rate:200   },
  { id:179, name:"MASKO [1-KG]",                                               rate:140   },
  { id:180, name:"MAVA BADAM [1-KG]",                                          rate:200   },
  { id:181, name:"MAVA BADAM [2.5 LITR]",                                      rate:400   },
  { id:182, name:"MAVA MASTI [1-KG]",                                          rate:300   },
  { id:183, name:"MANGO ICE CREAM [1-KG]",                                     rate:150   },
  { id:184, name:"MITHO MAVO [LAATO]",                                         rate:200   },
  { id:185, name:"MORO MAVO [1-KG]",                                           rate:350   },
  { id:186, name:"PANEER [1-KG]",                                              rate:400   },
  { id:187, name:"PENDA [1-KG]",                                               rate:400   },
  { id:188, name:"RAAJBHOG [1-KG]",                                            rate:320   },
  { id:189, name:"SAGAR POWDER",                                               rate:372   },
  { id:190, name:"SP. SHRIKHAND RAJAWADI [PER-1KG]",                           rate:300   },
  { id:191, name:"SP. PINEAPPLE MATHHO [PER-1KG]",                             rate:300   },
  { id:192, name:"SP. SHRIKHAND BADAM PISTA [PER-1KG]",                        rate:260   },
  { id:193, name:"SP. SHRIKHAND FRUIT [PER-1KG]",                              rate:260   },
  { id:194, name:"SP. SHRIKHAND RAJBHOG [PER-1KG]",                            rate:270   },
  { id:195, name:"SP. SRIKHAND AMERICAN DRYFRUIT [PER-1KG]",                   rate:310   },
  { id:196, name:"SP. SRIKHAND BUTTER SCOTCH [PER-1KG]",                       rate:270   },
  { id:197, name:"SP. SRIKHAND KESAR [PER-1KG]",                               rate:270   },
  { id:198, name:"SP. SRIKHAND MANGO MATHHO [PER-1KG]",                        rate:300   },
  { id:199, name:"SRIKHAND AMERICAN CHOPSI [250GM]",                           rate:60    },
  { id:200, name:"SRIKHAND AMERICAN DRYFRUIT [PER-1KG]",                       rate:220   },
  { id:201, name:"SRIKHAND BORN BON [PER-1KG]",                                rate:220   },
  { id:202, name:"SRIKHAND FRUIT [PER-1KG]",                                   rate:220   },
  { id:203, name:"SRIKHAND JELLY [PER-1KG]",                                   rate:210   },
  { id:204, name:"SRIKHAND KESAR [PER-1KG]",                                   rate:220   },
  { id:205, name:"SRIKHAND MANGO [PER-1KG]",                                   rate:220   },
  { id:206, name:"SRIKHAND RAJBHOG [PER-1KG]",                                 rate:220   },
  { id:207, name:"SRIKHAND RAJBHOG [250GM]",                                   rate:60    },
  { id:208, name:"SRIKHAND VANILLA DRYFRUIT [PER-1KG]",                        rate:220   },
  { id:209, name:"VANILLA ICE CREAM [1-KG]",                                   rate:130   },
  { id:210, name:"VRUNDAVAN SPECIAL [1-KG]",                                   rate:350   },
  { id:211, name:"FREEZE COLDWAVE FREEZER [1]",                                rate:20000 },
  { id:212, name:"KOOLEX FREEZER [1]",                                         rate:22000 },
  { id:213, name:"DIESEL [PER-LITR]",                                          rate:92    },
  { id:214, name:"CASE AAPEL [1]",                                             rate:850   },
  { id:215, name:"ICE CREAM SPOON SCOOPER [1]",                                rate:1100  },
  { id:216, name:"SAGAR POWDER [1-KG]",                                        rate:372   },
];