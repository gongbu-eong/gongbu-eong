import { executeQuery } from "@/lib/mssqldb";

export type AlimtalkSendInput = {
  recipientPhone: string | null | undefined;
  templateCode: string | null | undefined;
  message: string;
  title: string;
  targetPath?: string | null;
  buttonName?: string;
};

export async function sendAlimtalk(input: AlimtalkSendInput) {
  const senderKey = process.env.NEXT_PRIVATE_GONGBUEONG_ALIMTALK_KEY?.trim();
  const templateCode = input.templateCode?.trim();
  const phone = normalizePhone(input.recipientPhone);

  if (!senderKey || !templateCode || !phone) {
    return { sent: false, reason: "missing_config_or_recipient" as const };
  }

  const targetUrl = input.targetPath ? toAbsoluteUrl(input.targetPath) : "";
  const attachment = targetUrl
    ? JSON.stringify({
        button: [
          {
            name: input.buttonName || "확인",
            type: "WL",
            url_mobile: targetUrl,
            url_pc: targetUrl,
          },
        ],
      })
    : "";
  const senderNumber =
    process.env.NEXT_PRIVATE_GONGBUEONG_ALIMTALK_SMS_SENDER_NUMBER?.trim() ||
    "02-1577-9577";

  await executeQuery(`
    INSERT INTO dbo.MZSENDTRAN (
      SN,
      SENDER_KEY,
      CHANNEL,
      SND_TYPE,
      PHONE_NUM,
      TMPL_CD,
      SND_MSG,
      REQ_DTM,
      SMS_SND_YN,
      SMS_SND_MSG,
      SLOT1,
      SMS_SND_NUM,
      ATTACHMENT
    ) VALUES (
      (next value for mzsendtran_seq),
      '${escapeMssql(senderKey)}',
      'A',
      'P',
      '${escapeMssql(phone)}',
      '${escapeMssql(templateCode)}',
      N'${escapeMssql(input.message)}',
      convert(varchar(8), getdate(), 112) + replace(convert(varchar(8), getdate(), 108), ':', ''),
      'N',
      N'${escapeMssql(input.message)}',
      N'${escapeMssql(input.title)}',
      '${escapeMssql(senderNumber)}',
      ${attachment ? `N'${escapeMssql(attachment)}'` : "NULL"}
    );
  `);

  return { sent: true };
}

function toAbsoluteUrl(path: string) {
  const baseUrl =
    process.env.GONGBUEONG_MAIN_URL ||
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    "https://gongbueong.career.co.kr";
  return new URL(path, baseUrl).toString();
}

function normalizePhone(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

function escapeMssql(value: string) {
  return value.replace(/'/g, "''");
}
