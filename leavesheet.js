require("dotenv").config();
const { google } = require("googleapis");

exports.handler = async (event) => {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  const sheets = google.sheets({ version: "v4", auth });
  const ssId = process.env.SPREADSHEET_ID;

  const { userId } = JSON.parse(event.body);

  // ✅ โหลดข้อมูลผู้ใช้
  const meta = await sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range: "ข้อมูลลงทะเบียนPC!A2:G", // ใช้ A2:G เพราะ storeType อยู่คอลัมน์ F, line_user_id = G
  });

  const users = meta.data.values || [];
  const user = users.find((r) => r[6] === userId); // r[6] = line_user_id
  if (!user) return { statusCode: 404, body: "User not found" };

  const storeCode = user[3];
  const storeName = user[4];
  const storeType = user[5];

  const today = new Date();
  today.setHours(today.getHours() + 7); // 🇹🇭 เวลาประเทศไทย
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const date = `${dd}/${mm}/${yyyy}`;

  // ✅ ตรวจสอบว่าเคยแจ้ง "วันนี้หยุด" แล้วหรือยัง
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range: "ยอดจัดชิมรายวัน!A2:T",
  });

  const existing = existingRes.data.values || [];
  const alreadyLogged = existing.some(row =>
    row[0] === date && row[1] === userId && row[19] === "วันนี้หยุด"
  );

  if (alreadyLogged) {
    return { statusCode: 200, body: "Already logged leave today." };
  }

  // ✅ ดึง SKU ที่มีเป้าในวันนี้
  const targetSheet = await sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range: `เป้าหมายจัดชิม ${storeType}!A1:AH`,
  });

  const header = targetSheet.data.values[0];
  const rows = targetSheet.data.values.slice(1);
  const dateCol = header.findIndex((h) => h && h.trim() === date);

  const matchedRows = rows.filter((r) => r[0] === storeCode && r[dateCol]);

  const values = matchedRows.map((r) => [
    date, userId, storeCode, storeName, storeType, r[2], "", "", "", "", "", "", "", "", "", "", "", "", new Date().toISOString(), "วันนี้หยุด"
  ]);

  if (values.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: ssId,
      range: "ยอดจัดชิมรายวัน!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  }

  return { statusCode: 200, body: "Leave logged" };
};
