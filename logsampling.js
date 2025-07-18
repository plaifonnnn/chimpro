// ✅ LOGSAMPLING.JS ที่แก้แล้วสมบูรณ์ พร้อมฟีเจอร์:
// - ถ้าเคยกรอกแล้ว: ดึงข้อมูลเก่ามาแสดง + แก้ไขได้
// - ถ้า serve = 0: ให้กรอกหมายเหตุ และบันทึกลงคอลัมน์ "หมายเหตุ"
//
require("dotenv").config();
const { google } = require("googleapis");


function getTargetSheetName(storeType) {
  if (storeType === "Makro") return "เป้าหมายจัดชิม Makro";
  if (storeType === "Lotus") return "เป้าหมายจัดชิม Lotus";
  return "เป้าหมายจัดชิม Other MT"; // สำหรับ Big C, Tops, ฯลฯ
}

exports.handler = async (event) => {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  const sheets = google.sheets({ version: "v4", auth });
  const ssId = process.env.SPREADSHEET_ID;

  if (event.httpMethod === "GET") {
    const { userId, date } = event.queryStringParameters;

    const meta = await sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: "ข้อมูลลงทะเบียนPC!A2:G",
    });
    const users = meta.data.values || [];
    const user = users.find(row => row[6] === userId);
    if (!user) return { statusCode: 200, body: JSON.stringify({ success: true, products: [] }) };

    const storeCode = user[3];
const storeName = user[4];
let storeType = user?.[5]?.trim();
const storeTypeOriginal = storeType;
const isBothUnitStore = ["Big C", "Maxvalu"].includes(storeTypeOriginal);

if (["Big C", "Maxvalu", "Donki", "The mall", "Golden place", "Villa", "Tops", "Food land"].includes(storeType)) {
  storeType = "Other MT";
}


const targetSheet = await sheets.spreadsheets.values.get({
  spreadsheetId: ssId,
  range: `เป้าหมายจัดชิม ${storeType}!A1:AH`,
});

const header = targetSheet.data.values[0];
const rows = targetSheet.data.values.slice(1);

const isOtherMT = ["Big C", "Maxvalu", "Donki", "The mall", "Golden place", "Villa", "Tops", "Food land"].includes(storeTypeOriginal);
const logSheetName = isOtherMT ? "ยอดจัดชิมรายวัน Other MT" : "ยอดจัดชิมรายวัน";
const matchedRows = rows.filter(r => {
  return isOtherMT
    ? r[1]?.trim() === storeName?.trim()
    : r[0]?.trim() === storeCode?.trim();
});



    const parts = date.split("/");
    const formattedDate = `${parts[0].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[2]}`;
    const dateColIndex = header.findIndex(h => h && h.trim() === formattedDate);

    const products = matchedRows.filter(r => r[dateColIndex]).map(r => ({
      sku: r[2], storeCode, storeName,storeType: storeTypeOriginal
    }));

    // 🔍 Check if already submitted today
    const existingRes = await sheets.spreadsheets.values.get({
      spreadsheetId: ssId,
      range: `${logSheetName}!A2:T`,
    });
    const existing = existingRes.data.values || [];
    const todayLogs = existing.filter(row => row[0] === date && row[1] === userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        products,
        isOtherMT,
        alreadySubmitted: todayLogs.length > 0,
        previousData: todayLogs.map(r => ({
          sku: r[4], start: r[5], end: r[6], serve: r[7], buy: r[8], pack: r[9], remark: r[18] || ""
        }))
      }),
    };

  }

  if (event.httpMethod === "POST") {
  
  const body = JSON.parse(event.body);
  const { date, userId, storeCode, storeName, products } = body;

  // 🔍 โหลดข้อมูล user เพื่อดึง storeType
  // ก่อนเข้าถึง storeType:
const userMeta = await sheets.spreadsheets.values.get({
  spreadsheetId: ssId,
  range: "ข้อมูลลงทะเบียนPC!A2:G",
});
const users = userMeta.data.values || []; // << ขาดตรงนี้
const user = users.find(row => row[6] === userId);

let storeType = user?.[5]?.trim();
const storeTypeOriginal = storeType;

if (["Big C", "Maxvalu", "Donki", "The mall", "Golden place", "Villa", "Tops", "Food land"].includes(storeType)) {
  storeType = "Other MT";
}
const isBothUnitStore = ["Big C", "Maxvalu"].includes(storeTypeOriginal);

console.log("🟡 storeType =", storeType, "🟡 storeTypeOriginal =", storeTypeOriginal);

// 👇 โหลดชีตเป้าหมาย
const sheetName = getTargetSheetName(storeType);
const targetSheet = await sheets.spreadsheets.values.get({
  spreadsheetId: ssId,
  range: `${sheetName}!A1:AH`,
});

const isOtherMT = ["Big C", "Maxvalu", "Donki", "The mall", "Golden place", "Villa", "Tops", "Food land"].includes(storeTypeOriginal);


  const header = targetSheet.data.values[0];
  const rows = targetSheet.data.values.slice(1);

  
const normalize = s => (s || "").replace(/\s+/g, "").toLowerCase();
const matchedRows = rows.filter(r => {
  return isOtherMT
    ? normalize(storeName) === normalize(r[1])
    : r[0]?.trim() === storeCode?.trim();
});




  const [dd, mm, yyyy] = date.split("/");
  const formattedDate = `${dd.padStart(2, "0")}/${mm.padStart(2, "0")}/${yyyy}`;
  const dateCol = header.findIndex(h => h && h.trim() === formattedDate);
  const currentDate = Number(dd);
  const monthIndex = Number(mm) - 1;
  const year = Number(yyyy);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const startDay = currentDate <= 15 ? 1 : 16;
  const endDay = currentDate <= 15 ? 15 : lastDay;
  const totalDays = endDay - startDay + 1;
  const timeGoneDays = currentDate - startDay + 1;
  const timeGonePercent = (timeGoneDays / totalDays) * 100;
  const targetSheetName = isOtherMT ? "ยอดจัดชิมรายวัน Other MT" : "ยอดจัดชิมรายวัน";
  const summaryRes = await sheets.spreadsheets.values.get({
  spreadsheetId: ssId,
  range: `${targetSheetName}!A2:T`,
});

  const allLog = summaryRes.data.values || [];

  const skuMap = {};
  for (const item of products) {
    const key = item.sku;
    if (!skuMap[key]) {
      skuMap[key] = { 
  sku: key, serve: 0, taste: 0, buy: 0, pack: 0, baht: 0, remark: "", start: [], end: [] };
  }
    skuMap[key].serve += Number(item.serve || 0);
    skuMap[key].taste += Number(item.taste || 0);
    skuMap[key].buy += Number(item.buy || 0);
    skuMap[key].pack += Number(item.pack || 0);
    if (item.remark) skuMap[key].remark = item.remark;
    skuMap[key].baht += Number(item.baht || 0);
    skuMap[key].start.push(item.start);
    skuMap[key].end.push(item.end);
  }
  const displayStoreType = storeTypeOriginal;
  let summary = `📊 สรุปยอดจัดชิมประจำวันที่ ${date}\nห้าง: ${displayStoreType}\nสาขา: ${storeName}\n\n`;
  const valuesToAppend = [];
  


for (const key in skuMap) {
  const item = skuMap[key];
  const row = matchedRows.find((r) => r[2] === item.sku);
  const target = row && dateCol !== -1 ? Number(row[dateCol] || 0) : 0;
    const actualPack = item.pack;
    const actualBaht = item.baht;
    const actual = isBothUnitStore || isOtherMT ? actualBaht : actualPack;
    const diff = target - actual;




    const totalAccum = allLog
      .filter(r => r[2] === storeCode && r[4] === item.sku && new Date(r[0].split("/").reverse().join("-")) <= new Date(`${yyyy}-${mm}-${dd}`))
      .reduce((sum, r) => sum + Number(r[9] || 0), 0); // pack = col 9

    const targetValues = matchedRows.find(r => r[2] === item.sku);
    let targetSum = 0;
    for (let d = startDay; d <= endDay; d++) {
      const colLabel = `${String(d).padStart(2, "0")}/${mm}/${yyyy}`;
      const colIdx = header.findIndex(h => h === colLabel);
      if (colIdx !== -1) {
        targetSum += Number(targetValues?.[colIdx] || 0);
      }
    }

    const todayAch = target > 0 ? (actual / target) * 100 : 0;
    const convRate = item.taste > 0 ? (item.buy / item.taste) * 100 : 0;
    const achAccum = targetSum > 0 ? (totalAccum / targetSum) * 100 : 0;
    const achAccumVsTime = timeGonePercent > 0 ? (achAccum / timeGonePercent) * 100 : 0;
    const engageRate = item.serve > 0 ? (item.taste / item.serve) * 100 : 0;


    const unit = isBothUnitStore || isOtherMT ? "บาท" : "แพ็ก";
    summary += `• ${item.sku}\n`;
    summary += `จัดชิม: ${item.serve} เสิร์ฟ\nลูกค้าชิมจริง: ${item.taste} ชิม\nลูกค้าซื้อ: ${item.buy} คน\n`;

    if (isBothUnitStore) {
      summary += `จำนวน: ${actualPack} แพ็ก\nยอดขายรวม: ${actualBaht.toLocaleString()} บาท\nเป้ายอดขาย: ${target.toLocaleString()} บาท\n`;
    } else if (isOtherMT) {
      summary += `ยอดขายรวม: ${actualBaht.toLocaleString()} บาท\nเป้ายอดขาย: ${target.toLocaleString()} บาท\n`;
    } else {
      summary += `จำนวน: ${actualPack} แพ็ก\nเป้า: ${target} แพ็ก\n`;
    }

    summary += `🎯 %Engagement: ${engageRate.toFixed(1)}%\n🎯 %Conversion Rate: ${convRate.toFixed(1)}%\n`;
    summary += `🎯 %ACH วันนี้: ${todayAch.toFixed(1)}%\n`;
    summary += `⏳ Time Gone: ${timeGoneDays}/${totalDays} วัน (${timeGonePercent.toFixed(1)}%)\n`;
    summary += actual >= target
    ? "✅ ถึงเป้าแล้ว! เก่งมากค่ะ 🎉\n\n"
    : `📈 ยังไม่ถึงเป้า เหลืออีก ${Math.max(0, diff).toLocaleString()} ${unit} ✌️\n\n`;


    // บันทึกข้อมูลแยกรอบ
    const entryRounds = products.filter(p => p.sku === item.sku);
      entryRounds.forEach(p => {
        const roundConv = Number(p.taste) > 0 ? (Number(p.buy) / Number(p.taste)) * 100 : 0;
        const roundEngage = Number(p.serve) > 0 ? (Number(p.taste) / Number(p.serve)) * 100 : 0;

        valuesToAppend.push([
          date, userId, storeCode, storeName, storeType, item.sku,
          p.start, p.end, p.serve, p.taste, p.buy, p.pack,
          roundConv, roundEngage, timeGoneDays, timeGonePercent,
          todayAch, achAccum, achAccumVsTime,
          new Date().toISOString(), p.remark || "", Number(p.baht || 0)
        ]);

    });
  }
  // 🔁 ลบบรรทัดที่เคยกรอกวันนี้ก่อน (กรณีกรอกซ้ำ)
if (allLog.length > 0) {
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: ssId });
  const sheetId = sheetMeta.data.sheets.find(s => s.properties.title === targetSheetName)?.properties.sheetId;


  const rowsToDelete = allLog
    .map((r, idx) => ({ row: idx + 1, userId: r[1], date: r[0] })) // +1 เพราะ A2 = row 1 (หลัง header)
    .filter(r => r.date === date && r.userId === userId);

  if (rowsToDelete.length > 0 && sheetId != null) {
    const requests = rowsToDelete.reverse().map(r => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: r.row,
          endIndex: r.row + 1
        }
      }
    }));
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ssId,
      requestBody: { requests }
    });
  }
}

await sheets.spreadsheets.values.append({
  spreadsheetId: ssId,
  range: `${targetSheetName}!A1`,
  valueInputOption: "USER_ENTERED",
  requestBody: { values: valuesToAppend },
});


  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: summary.trim() }],
    }),
  });

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
}}