require("dotenv").config();
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));


exports.handler = async (event) => {
  try {
    console.log("LINE Webhook received:", event.body);
    const body = JSON.parse(event.body);
    const evt = body.events?.[0];
    const userMessage = evt?.message?.text?.trim();

    if (!evt || evt.type !== "message" || evt.message.type !== "text") {
      return { statusCode: 200, body: "Non-text event ignored" };
    }

    if (userMessage.includes("วันนี้หยุด")) {
      // ✅ ตอบกลับ LINE
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          replyToken: evt.replyToken,
          messages: [{ type: "text", text: "✅ รับทราบค่ะ จะบันทึกไว้ในระบบให้อัตโนมัติ" }],
        }),
      });

      // ✅ รอให้ leaveSheet รันจบก่อนตอบกลับ LINE
      await fetch(`${process.env.BASE_URL}/.netlify/functions/leaveSheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: evt.source.userId }),
      });
    }

    return { statusCode: 200, body: "Webhook received" };
  } catch (err) {
    console.error("Webhook error", err);
    return { statusCode: 500, body: "Error" };
  }
};
