// backend/seedAllProducts.js
// One-time standalone script — wipes existing products and seeds the full Vrundavan catalog.
// Run from the repo root: node backend/seedAllProducts.js
// Alternatively, use the in-app API endpoints: POST /api/products/seed (first time) or /api/products/reseed (destructive).
// ⚠️  This script directly wipes the products collection — do NOT run in production carelessly.

require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
const mongoose = require("mongoose");
const Product  = require("./models/Product");
const Settings = require("./models/Settings");

// Helper: parse units per box from name like "05. GULKAND CANDY [1*24]" → 24, "[1+1]" → 2, else 1
function parseUnits(name) {
  const m = name.match(/\[1\*(\d+)\]/);
  if (m) return parseInt(m[1], 10);
  const p = name.match(/\[1\+1\]/);
  if (p) return 2;
  return 1;
}

const CATALOG = [
  { name:"02. JEERA MASALA PEPSI [1*52] [P]",                         rate:70    },
  { name:"02. KACHI KERI [1*52] [P]",                                 rate:70    },
  { name:"02. MANGO PEPSI [1*52] [P]",                                rate:70    },
  { name:"02. ORANGE PEPSI [1*52] [P]",                               rate:70    },
  { name:"05. JEERA MASALA [1*30]",                                   rate:125   },
  { name:"05. [J] JALJEERA JYUSI [1*30]",                             rate:125   },
  { name:"05. [J] KACHHA AAM JYUSI [1*30]",                           rate:125   },
  { name:"05. [ ] KALA KHATTA JYUSHI [1*30]",                         rate:125   },
  { name:"05. [J] MENGO JYUSI [1*30]",                                rate:125   },
  { name:"05. [J] ORANGE JYUSI [1*30]",                               rate:125   },
  { name:"05. CHIKU CANDY [1*30]",                                    rate:125   },
  { name:"05. CHOCOLATE BOMB [1*50]",                                 rate:200   },
  { name:"05. GULKAND CANDY [1*24]",                                  rate:101   },
  { name:"05. GULKAND CANDY [1*25]",                                  rate:105   },
  { name:"05. MAVA CHOPATY [1*30]",                                   rate:125   },
  { name:"05. MINI CHOCOBAR [1*30]",                                  rate:127   },
  { name:"05. MINI CHOPATY [1*30]",                                   rate:125   },
  { name:"05. NANA GULAB CUP [1*40]",                                 rate:160   },
  { name:"05. NANA MANGO CUP [1*40]",                                 rate:160   },
  { name:"05. NANA VANILLA CUP [1*40]",                               rate:160   },
  { name:"05. PEPSI MANGO [1*52] [P]",                                rate:200   },
  { name:"05. PEPSI COCO [1*52] [P]",                                 rate:200   },
  { name:"05. PEPSI MAVA MALAI [1*52] [P]",                           rate:200   },
  { name:"05. PEPSI PISTA [1*52] [P]",                                rate:200   },
  { name:"05. PEPSI ROSE [1*52] [P]",                                 rate:200   },
  { name:"05. RAJBHOG CANDY [1*30]",                                  rate:125   },
  { name:"05. RAJBHOG PEPSI [1*52] (P)",                              rate:200   },
  { name:"05. VANILLA CHOPATY [1*30]",                                rate:125   },
  { name:"10. BUTTER CUP [1*24] [60ML]",                              rate:190   },
  { name:"10. BUTTER SCOTCH CONE [1*20] [90ML]",                      rate:165   },
  { name:"10. CHIKU CANDY [1*30]",                                    rate:237   },
  { name:"10. CHOCO VANILLA CONE [1*20] [80ML]",                      rate:155   },
  { name:"10. CLASSIC CHOCOBAR [1*30]",                               rate:250   },
  { name:"10. COCONUT CANDY [1*24]",                                  rate:190   },
  { name:"10. CRUNCHY CHOCOBAR [1*30]",                               rate:250   },
  { name:"10. DAHI MASTI [1*30]",                                     rate:190   },
  { name:"10. FRESH MANGO CUP [1*24] [60ML]",                         rate:190   },
  { name:"10. GREEN CHOCOBAR [1*30]",                                 rate:127   },
  { name:"10. GREEN COCONUT CANDY [1*30]",                            rate:195   },
  { name:"10. JUNIOR BUTTER SCOTCH CONE [1*20] [80ML]",               rate:155   },
  { name:"10. JUNIOR CHOCOLATE CONE [1*20] [80ML]",                   rate:155   },
  { name:"10. JUNIOR PINKY BAR [1*24]",                               rate:200   },
  { name:"10. KESAR CHOWPATY [1*16]",                                 rate:130   },
  { name:"10. KESAR ELAICHI CUP [1*24] [60ML]",                       rate:190   },
  { name:"10. MANGO DOLLY [1*30]",                                    rate:237   },
  { name:"10. MASTI CHOWPATY [1*16]",                                 rate:130   },
  { name:"10. MAVA MALAI [1*30]",                                     rate:250   },
  { name:"10. MOTA VANILLA CUP [1*24] [60ML]",                        rate:190   },
  { name:"10. PAN PASAND [1*16]",                                     rate:130   },
  { name:"10. PLAIN PISTA CUP [1*24] [60ML]",                         rate:190   },
  { name:"10. RIPPLE FUNDAY [1*8]",                                   rate:70    },
  { name:"10. ROYAL RAJWADI [1*16]",                                  rate:130   },
  { name:"20. ALPHONSO MANGO [1*20]",                                 rate:320   },
  { name:"20. AMERICAN DRYFRUIT CUP [1*15] [100ML]",                  rate:245   },
  { name:"20. BUTTER CARAMEL CONE [1*14] [100ML]",                    rate:175   },
  { name:"20. BUTTER SCOTCH CONE [1*14] DOUBLE",                      rate:125   },
  { name:"20. CHOCOLATE CHIPS CUP [1*15]",                            rate:245   },
  { name:"20. CHOCOLATE CONE [1*14] [100ML]",                         rate:225   },
  { name:"20. CLASSIC CHOCOBAR [1*15]",                               rate:150   },
  { name:"20. DREAM MAGIC CONE [1*14] [100ML]",                       rate:175   },
  { name:"20. FESTIVAL MANGODOLLY [1*24]",                            rate:240   },
  { name:"20. FESTIVAL MAVA MALAI [1*24]",                            rate:240   },
  { name:"20. FESTIVAL RASPBERRY DOLLY [1*24]",                       rate:240   },
  { name:"20. GOLD MAGIC CUP [1*15] [100ML]",                         rate:245   },
  { name:"20. GOLDEN PEARL [1*15] [100ML]",                           rate:245   },
  { name:"20. JUNIOR NUTTY BAR [1*20]",                               rate:300   },
  { name:"20. KAJU DRAKSH CONE [1*14] [100ML]",                       rate:225   },
  { name:"20. KAJU DRAKSH CUP [1*12] [120ML]",                        rate:180   },
  { name:"20. KESAR BADAM [1*15] [100ML]",                            rate:245   },
  { name:"20. MALAI MASTI [1*14]",                                    rate:225   },
  { name:"20. MAVA BADAM CUP [1*15] [100ML]",                         rate:245   },
  { name:"20. PINKY BAR [1*20]",                                      rate:310   },
  { name:"20. PISTA MALAI [1*20]",                                    rate:320   },
  { name:"20. PREMIUM BUTTER SCOTCH CONE [1*14] [100ML]",             rate:225   },
  { name:"20. PREMIUM CHOCOBAR [1*20]",                               rate:260   },
  { name:"20. PREMIUM MANGODOLLY [1*20]",                             rate:327   },
  { name:"20. PREMIUM RASPBERRY DOLLY [1*20]",                        rate:260   },
  { name:"20. PREMIUM VANILLA CUP [1*12] [120ML]",                    rate:160   },
  { name:"20. RAJVADI MATKA [1*22] [100ML]",                          rate:355   },
  { name:"20. ROYAL MAVA MALAI [1*20]",                               rate:320   },
  { name:"20. SPECIAL THABADI [1*15] [100ML]",                        rate:245   },
  { name:"25. CP VANILLA [250ML 1*12]",                               rate:240   },
  { name:"25. RAJAVADI KULFI [1*15]",                                 rate:315   },
  { name:"30. ALMOND CARNIVAL CUP [1*12] [120ML]",                    rate:285   },
  { name:"30. ANJEER KULFI [1*12]",                                   rate:290   },
  { name:"30. CHOCO BROWNIE [1*8] [120ML]",                           rate:200   },
  { name:"30. KAJU GULKAND CUP [1*12] [120ML]",                       rate:285   },
  { name:"30. KESAR PISTA CONE [1*14] [110ML]",                       rate:280   },
  { name:"30. KESAR PISTA CUP [1*12] [120ML]",                        rate:285   },
  { name:"30. RABDI KULFI 60ML [1*12]",                               rate:285   },
  { name:"30. RAJASTHANI FANDA [1*15]",                               rate:344   },
  { name:"30. RAJBHOG CUP [1*12] [120ML]",                            rate:285   },
  { name:"30. SITAPHAL CUP [1*12] [120ML]",                           rate:288   },
  { name:"30. SP. VRUNDAVAN RABDI KULFI [1*20]",                      rate:475   },
  { name:"30. SUGAR FREE VANILLA [1*12] [120ML]",                     rate:288   },
  { name:"35. FROSTIC CANDY [1*20]",                                  rate:555   },
  { name:"35. PUNJABI KULFI [1*12]",                                  rate:330   },
  { name:"40. COOKIES & CREAM CUP 125ML [1*8]",                       rate:270   },
  { name:"40. COOKIES & CREAM CUP [1*8] [100ML]",                     rate:270   },
  { name:"40. CP KAJU DRAKSH [250ML] [1*12]",                         rate:360   },
  { name:"40. KREKAL NATS CUP 125ML [1*8]",                           rate:270   },
  { name:"40. NUTTY BUDDY [1*15] [60ML]",                             rate:480   },
  { name:"40. NUTTY DRYFRUTS [1*15]",                                 rate:480   },
  { name:"40. ROASTED ALMOND [70ML] [1*20]",                          rate:640   },
  { name:"40. ROLL CUT ICE CREAM [100ML] [1*10]",                     rate:300   },
  { name:"40. SLICE KASATA [1*15] [100ML]",                           rate:450   },
  { name:"40. SP. VRUNDAVAN 125ML [1*8]",                             rate:270   },
  { name:"45. CHOCO BROWNIE CUP [1*8] [140ML]",                       rate:280   },
  { name:"45. CP AMERICAN DRYFRUIT [250ML] [1*12]",                   rate:420   },
  { name:"45. CP CHOCOLATE CHIPS [250ML] [1*12]",                     rate:420   },
  { name:"45. CP COOKIES & CREAM [250ML] [1*12]",                     rate:420   },
  { name:"45. CP RAJBHOG [250ML] [1*12]",                             rate:420   },
  { name:"45. CP REAL MANGO [250ML] [1*12]",                          rate:420   },
  { name:"45. CP SPECIAL THABADI [250ML] [1*12]",                     rate:420   },
  { name:"45. SINGAL SUNDAY [1*4] [100ML]",                           rate:145   },
  { name:"50. CLASSIC CASSATA [100ML] [1*8]",                         rate:320   },
  { name:"50. CP MAVA BADAM [250ML] [1*12]",                          rate:480   },
  { name:"50. TRIPAL SUNDAY [1*4] [120ML]",                           rate:160   },
  { name:"AFAGHAN MEVA [1-KG]",                                       rate:300   },
  { name:"ALMAND KARNIVAL [1-KG]",                                    rate:300   },
  { name:"AMERICAN BULK - 5 LITER",                                   rate:700   },
  { name:"AMERICAN DRYFRUIT [2.5 LITR]",                              rate:380   },
  { name:"AMERICAN ICE CREAM [1-KG]",                                 rate:320   },
  { name:"BAG (1)",                                                    rate:4500  },
  { name:"BUTTER MILK [CHASH]",                                        rate:8.34  },
  { name:"BUTTER SCOTCH [1-KG]",                                      rate:250   },
  { name:"BUTTER [1-KG]",                                             rate:500   },
  { name:"CLOD WAVE FREEZER [1]",                                     rate:18000 },
  { name:"DAHI [PER-1KG]",                                            rate:60    },
  { name:"FAMILY PACK AFGHAN MEVA 700ML [1+1]",                       rate:250   },
  { name:"FAMILY PACK BUTTER SCOTCH 500ML [1+1]",                     rate:120   },
  { name:"FAMILY PACK BUTTER SCOTCH 750ML [1+1]",                     rate:200   },
  { name:"FAMILY PACK CHOCO BROWNIE 750ML [1+1]",                     rate:240   },
  { name:"FAMILY PACK CHOCOLATE CHIPS 700ML [1+1]",                   rate:230   },
  { name:"FAMILY PACK COOKIES & CREAM 700ML [1+1]",                   rate:230   },
  { name:"FAMILY PACK DRY AMERICAN 500ML [1+1]",                      rate:140   },
  { name:"FAMILY PACK DRY AMERICAN 750ML [1+1]",                      rate:230   },
  { name:"FAMILY PACK GOLD MAGIC 500ML [1+1]",                        rate:140   },
  { name:"FAMILY PACK GOLD MAGIC 700ML [1+1]",                        rate:200   },
  { name:"FAMILY PACK KAJU DRAKSH 500ML [1+1]",                       rate:120   },
  { name:"FAMILY PACK KAJU DRAKSH 750ML [1+1]",                       rate:200   },
  { name:"FAMILY PACK KAJU GULKAND 700ML [1+1]",                      rate:230   },
  { name:"FAMILY PACK KESAR PISTA 700ML [1+1]",                       rate:240   },
  { name:"FAMILY PACK KREKAL NUTS 700ML [1+1]",                       rate:200   },
  { name:"FAMILY PACK MANGO KAJU 750ML [1+1]",                        rate:230   },
  { name:"FAMILY PACK MAVA BADAM 500ML [1+1]",                        rate:140   },
  { name:"FAMILY PACK MAVA BADAM 750ML [1+1]",                        rate:240   },
  { name:"FAMILY PACK PAN MASALA 700ML [1+1]",                        rate:200   },
  { name:"FAMILY PACK RAJBHOG 750ML [1+1]",                           rate:250   },
  { name:"FAMILY PACK VANILLA 500ML [1+1]",                           rate:90    },
  { name:"FAMILY PACK VANILLA 750ML [1+1]",                           rate:145   },
  { name:"GHORAVU [1-KG]",                                            rate:60    },
  { name:"GS. SRIKHAND AMERICAN DRYFRUIT [PER-1KG]",                  rate:215   },
  { name:"GS. SRIKHAND BORN BON [PER-1KG]",                           rate:215   },
  { name:"GS. SRIKHAND FRUIT [PER-1KG]",                              rate:215   },
  { name:"GS. SRIKHAND JELLY [PER-1KG]",                              rate:175   },
  { name:"GS. SRIKHAND KESAR [PER-1KG]",                              rate:215   },
  { name:"GS. SRIKHAND MANGO [PER-1KG]",                              rate:215   },
  { name:"GS. SRIKHAND RAJBHOG [PER-1KG]",                            rate:215   },
  { name:"ICE CREAM SPOON SCOOPER",                                   rate:1100  },
  { name:"J. SHRIKHAND FRUIT [PER-1KG]",                              rate:200   },
  { name:"J. SHRIKHAND KESAR [PER-1KG]",                              rate:200   },
  { name:"J. SRIKHAND RAJBHOG [PER-1KG]",                             rate:200   },
  { name:"KAJU GULKAND BULK [2.5 LITR]",                              rate:380   },
  { name:"KEKAL NATAS [1-KG]",                                        rate:300   },
  { name:"KESAR PISTA [2.5 LITR]",                                    rate:400   },
  { name:"LOOSE AMERICAN SRIKHAND [PER-1KG]",                         rate:210   },
  { name:"LOOSE BORN BON [PER-1KG]",                                  rate:210   },
  { name:"LOOSE BUTTER SCOTCH SRIKHAND [PER-1KG]",                    rate:240   },
  { name:"LOOSE FRUIT SRIKHAND [PER-1KG]",                            rate:200   },
  { name:"LOOSE JELLY SRIKHAND [PER-1KG]",                            rate:170   },
  { name:"LOOSE KESAR SRIKHAND [PER-1KG]",                            rate:200   },
  { name:"LOOSE KESAR SRIKHAND DOLL [PER-1KG]",                       rate:200   },
  { name:"LOOSE MANGO SRIKHAND [PER-1KG]",                            rate:195   },
  { name:"LOOSE RAJBHOG SRIKHAND [PER-1KG]",                          rate:210   },
  { name:"LOOSE RAJWADI SRIKHAND [PER-1KG]",                          rate:285   },
  { name:"LOOSE VANILLA SRIKHAND [PER-1KG]",                          rate:210   },
  { name:"LS. SRIKHAND FRUIT [10KG]",                                 rate:200   },
  { name:"MASKO [1-KG]",                                              rate:140   },
  { name:"MAVA BADAM [1-KG]",                                         rate:200   },
  { name:"MAVA BADAM [2.5 LITR]",                                     rate:400   },
  { name:"MAVA MASTI [1-KG]",                                         rate:300   },
  { name:"MANGO ICE CREAM [1-KG]",                                    rate:150   },
  { name:"MITHO MAVO [LAATO]",                                        rate:200   },
  { name:"MORO MAVO [1-KG]",                                          rate:350   },
  { name:"PANEER [1-KG]",                                             rate:400   },
  { name:"PENDA [1-KG]",                                              rate:400   },
  { name:"RAAJBHOG [1-KG]",                                           rate:320   },
  { name:"SAGAR POWDER",                                              rate:372   },
  { name:"SP. SHRIKHAND RAJAWADI [PER-1KG]",                          rate:300   },
  { name:"SP. PINEAPPLE MATHHO [PER-1KG]",                            rate:300   },
  { name:"SP. SHRIKHAND BADAM PISTA [PER-1KG]",                       rate:260   },
  { name:"SP. SHRIKHAND FRUIT [PER-1KG]",                             rate:260   },
  { name:"SP. SHRIKHAND RAJBHOG [PER-1KG]",                           rate:270   },
  { name:"SP. SRIKHAND AMERICAN DRYFRUIT [PER-1KG]",                  rate:310   },
  { name:"SP. SRIKHAND BUTTER SCOTCH [PER-1KG]",                      rate:270   },
  { name:"SP. SRIKHAND KESAR [PER-1KG]",                              rate:270   },
  { name:"SP. SRIKHAND MANGO MATHHO [PER-1KG]",                       rate:300   },
  { name:"SRIKHAND AMERICAN CHOPSI [250GM]",                          rate:60    },
  { name:"SRIKHAND AMERICAN DRYFRUIT [PER-1KG]",                      rate:220   },
  { name:"SRIKHAND BORN BON [PER-1KG]",                               rate:220   },
  { name:"SRIKHAND FRUIT [PER-1KG]",                                  rate:220   },
  { name:"SRIKHAND JELLY [PER-1KG]",                                  rate:210   },
  { name:"SRIKHAND KESAR [PER-1KG]",                                  rate:220   },
  { name:"SRIKHAND MANGO [PER-1KG]",                                  rate:220   },
  { name:"SRIKHAND RAJBHOG [PER-1KG]",                                rate:220   },
  { name:"SRIKHAND RAJBHOG [250GM]",                                  rate:60    },
  { name:"SRIKHAND VANILLA DRYFRUIT [PER-1KG]",                       rate:220   },
  { name:"VANILLA ICE CREAM [1-KG]",                                  rate:130   },
  { name:"VRUNDAVAN SPECIAL [1-KG]",                                  rate:350   },
  { name:"FREEZE COLDWAVE FREEZER [1]",                               rate:20000 },
  { name:"KOOLEX FREEZER [1]",                                        rate:22000 },
  { name:"DIESEL [PER-LITR]",                                         rate:92    },
  { name:"CASE AAPEL [1]",                                            rate:850   },
  { name:"ICE CREAM SPOON SCOOPER [1]",                               rate:1100  },
  { name:"SAGAR POWDER [1-KG]",                                       rate:372   },
];

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    // Delete all existing products
    const delResult = await Product.deleteMany({});
    console.log(`🗑  Deleted ${delResult.deletedCount} existing products`);

    // Reset seed flag in settings
    const settings = await Settings.getSettings();
    settings.appConfig.productsSeedDone = false;
    await settings.save();

    // Build catalog with auto-parsed unitsPerBox and rateGst = rate
    const catalog = CATALOG.map(item => ({
      ...item,
      rateGst:     item.rate,   // same as non-GST by default — owner can edit later
      unitsPerBox: parseUnits(item.name),
      discount:    14,
      isActive:    true,
    }));

    // Bulk insert
    const result = await Product.insertMany(catalog, { ordered: false });
    console.log(`✅ Seeded ${result.length} products successfully`);

    // Mark as seeded
    settings.appConfig.productsSeedDone = true;
    settings.appConfig.seededAt = new Date();
    await settings.save();

    console.log("✅ Done!");
    process.exit(0);
  } catch (e) {
    console.error("❌ Seed failed:", e.message);
    process.exit(1);
  }
}

run();
