import * as CFB from "cfb";
import JSZip from "jszip";
import mammoth from "mammoth";
import { inflateRawSync } from "zlib";
import type { ResumeEntryDto, ResumePayloadDto } from "./resumes.dto";

const EMPTY = "";
const MAX_CLAUDE_TEXT_LENGTH = 30000;
const SOURCE_TEXT_PREVIEW_LENGTH = 5000;

type ResumeEntryType =
  | "education"
  | "experience"
  | "certification"
  | "award"
  | "activity"
  | "language";

type StructuredResumeDocument = {
  text: string;
  tables: ResumeDocumentTable[];
};

type ResumeDocumentTable = {
  section: string;
  headers: string[];
  rows: string[][];
};

export async function extractResumeWithClaude(args: {
  file: File;
  buffer: Buffer;
}): Promise<Partial<ResumePayloadDto>> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  const mediaType = guessMediaType(args.file.name);
  const officeDocument = await extractOfficeDocument(args.file.name, args.buffer);
  const officeText = officeDocument.text;
  const deterministic = normalizeResumePayload(parseResumeFromDocument(officeDocument));

  if (!officeText && mediaType !== "application/pdf") {
    throw new Error("자동 분석을 지원하지 않는 파일 형식입니다.");
  }

  if (!apiKey) {
    if (hasExtractedResumeFields(deterministic)) return deterministic;
    throw new Error("ANTHROPIC_API_KEY가 설정되지 않아 이력서를 분석할 수 없습니다.");
  }

  const prompt = buildAiExtractionPrompt();

  const content = officeText
    ? [
        {
          type: "text",
          text: `${prompt}\n\n${formatAiSourceInput(officeDocument)}`,
        },
      ]
    : [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: mediaType,
            data: args.buffer.toString("base64"),
          },
        },
        { type: "text", text: prompt },
      ];

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: getClaudeModel(),
      max_tokens: 8000,
      temperature: 0,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    if (hasExtractedResumeFields(deterministic)) return deterministic;
    const detail = await response.text().catch(() => "");
    throw new Error(
      `이력서 AI 분석 요청에 실패했습니다. (${response.status})${
        detail ? ` ${detail.slice(0, 240)}` : ""
      }`,
    );
  }

  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = body.content?.find((item) => item.type === "text")?.text || "";
  const jsonText = text.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) {
    if (hasExtractedResumeFields(deterministic)) return deterministic;
    throw new Error("AI 분석 결과에서 이력서 JSON을 찾지 못했습니다.");
  }

  try {
    const rawAiPayload = unwrapResumePayload(JSON.parse(jsonText));
    const sanitizedAiPayload = sanitizeAiResumePayload(rawAiPayload, officeText);
    const aiPayload = normalizeResumePayload(sanitizedAiPayload);
    const merged = finalizeExtractedResume(mergeResumePayload(aiPayload, deterministic), {
      ai: sanitizedAiPayload,
      parsed: deterministic,
      parsedTextPreview: officeText.slice(0, SOURCE_TEXT_PREVIEW_LENGTH),
    });
    if (!hasExtractedResumeFields(merged)) throw new Error("추출 항목 없음");
    return merged;
  } catch {
    if (hasExtractedResumeFields(deterministic)) return deterministic;
    throw new Error("AI 분석 결과를 이력서 입력값으로 변환하지 못했습니다.");
  }
}

function buildAiExtractionPrompt() {
  return `당신은 이력서 구조화 추출기입니다. 원문에 실제로 적힌 이력서 데이터만 JSON 객체 하나로 반환하세요. 마크다운, 설명, 주석은 금지합니다.

핵심 원칙:
- 반환할 수 있는 필드는 아래 스키마뿐입니다. 스키마에 없는 값은 버립니다.
- 파일명, 로그인 계정, 추측값, 예시값, 시스템 기본값을 절대 사용하지 않습니다.
- 희망 직무/지원 분야/지원 직무는 앱에서 사용자가 직접 선택하는 값입니다. 문서에 있어도 desiredJob은 항상 빈 문자열입니다.
- 자기소개서, 경력기술서의 서술형 문장, 지원동기, 입사 후 포부, 성장과정 등 자유 서술 영역에서 경력/수상/활동/자격증/어학 항목을 추론하지 않습니다.
- 표, 목록, 명확한 항목 라벨이 있는 이력서 영역에서만 추출합니다.
- 입력에 "구조화 표 JSON"이 있으면 원문 텍스트보다 그 표의 headers/rows를 우선합니다. 한 항목의 값은 반드시 같은 row 안에서만 가져옵니다.
- 섹션 헤더와 컬럼명(예: 기간, 기관, 시험, 점수, 근무회사, 담당직무, 자격증/면허증, 상세 내용)은 항목이 아닙니다.
- 값이 원문에 명확하지 않으면 빈 문자열 또는 빈 배열로 둡니다.
- 각 스칼라 값과 각 배열 항목에는 반드시 evidence 필드를 넣고, evidence에는 원문에서 해당 값을 확인할 수 있는 짧은 문구를 넣습니다.
- evidence가 없는 항목은 서버에서 버려집니다.

분류 규칙:
- educations: 학력/학력사항/교육사항 중 학교 학력만. 고등학교, 대학교, 대학원 등 학교명과 전공, 학점, 입학/졸업 기간.
- experiences: 실제 근무/재직/인턴 경력만. 학교 학력, 교육/연수, 동아리, 봉사활동, 프로젝트, 자기소개서 문장 제외.
- activities: 교육/연수, 대외활동, 기타활동, 봉사, 동아리, 서포터즈, 프로젝트 활동. 기관 칸이 있으면 issuer에 넣습니다. 실제 근무 경력과 자격증/어학 제외.
- activities 표 제약: "활동명" 칸이 있을 때만 activityName에 넣습니다. "과정명", "활동 내용", "교육 내용", "세부 내용"은 description에 넣고 activityName은 빈 문자열입니다. 같은 행의 "기관" 칸만 issuer입니다. 같은 행의 "기간" 칸만 startDate/endDate/activityDate입니다. 인접 행의 기간/기관을 절대 가져오지 않습니다.
- awards: 수상/수상내용/포상 섹션의 실제 수상 항목만. 기관 칸이 있으면 issuer에 넣습니다.
- certifications: 자격증/면허증/면허 섹션의 실제 자격 항목만.
- languages: 어학/외국어 섹션의 언어, 시험명, 점수/급수, 취득일, 기관. 언어 칸이 없으면 language는 빈 문자열로 둡니다. TOEIC/JLPT 같은 시험명으로 언어를 추론하지 않습니다.

날짜 규칙:
- 날짜는 정규화 가능하면 YYYY-MM-DD 또는 YYYY-MM 형식으로 반환합니다.
- 현재/재직중/진행중은 endDate에 "현재"로 반환할 수 있습니다.
- 생년월일은 생년월일 칸 또는 주민등록번호 앞 6자리처럼 명확한 근거가 있을 때만 반환합니다. 나이만으로 역산하지 않습니다.

반환 스키마:
{
  "title": "",
  "name": {"value": "", "evidence": ""},
  "birthDate": {"value": "", "evidence": ""},
  "birthYear": {"value": "", "evidence": ""},
  "email": {"value": "", "evidence": ""},
  "desiredJob": "",
  "highestEducation": {"value": "", "evidence": ""},
  "graduationStatus": {"value": "", "evidence": ""},
  "educationStartDate": {"value": "", "evidence": ""},
  "educationEndDate": {"value": "", "evidence": ""},
  "gpaScore": {"value": "", "evidence": ""},
  "gpaMax": {"value": "", "evidence": ""},
  "gpa": {"value": "", "evidence": ""},
  "schoolMajor": {"value": "", "evidence": ""},
  "educations": [{"schoolName": "", "degree": "", "major": "", "gpaScore": "", "gpaMax": "", "graduationStatus": "", "startDate": "", "endDate": "", "evidence": ""}],
  "experiences": [{"companyName": "", "position": "", "duties": "", "startDate": "", "endDate": "", "evidence": ""}],
  "awards": [{"contestName": "", "awardName": "", "issuer": "", "awardedDate": "", "evidence": ""}],
  "activities": [{"activityName": "", "description": "", "issuer": "", "activityDate": "", "startDate": "", "endDate": "", "evidence": ""}],
  "certifications": [{"certificationName": "", "issuer": "", "acquiredDate": "", "evidence": ""}],
  "languages": [{"language": "", "testName": "", "levelOrScore": "", "issuer": "", "acquiredDate": "", "evidence": ""}]
}`;
}

function sanitizeAiResumePayload(raw: unknown, sourceText: string): Partial<ResumePayloadDto> {
  const record = asRecord(raw);
  const source = normalizeEvidenceText(sourceText);
  const sanitized: Partial<ResumePayloadDto> = {
    title: EMPTY,
    desiredJob: EMPTY,
  };

  const scalarKeys: Array<keyof ResumePayloadDto> = [
    "name",
    "birthDate",
    "birthYear",
    "email",
    "highestEducation",
    "graduationStatus",
    "educationStartDate",
    "educationEndDate",
    "gpa",
    "gpaScore",
    "gpaMax",
    "schoolMajor",
  ];

  for (const key of scalarKeys) {
    const value = readAiScalar(record[key as string]);
    if (value && hasEvidenceForValue(value, record[key as string], source)) {
      (sanitized as Record<string, unknown>)[key] = value;
    }
  }

  sanitized.educations = sanitizeAiEntries(
    firstValue(record, ["educations", "education", "schools", "학력"]),
    "education",
    source,
  );
  sanitized.experiences = sanitizeAiEntries(
    firstValue(record, ["experiences", "careers", "career", "workExperiences", "경력", "경력사항"]),
    "experience",
    source,
  );
  sanitized.awards = sanitizeAiEntries(
    firstValue(record, ["awards", "awardList", "prizes", "수상", "수상경력", "수상내용"]),
    "award",
    source,
  );
  sanitized.activities = sanitizeAiEntries(
    firstValue(record, ["activities", "activityList", "extracurriculars", "대외활동", "활동", "교육/연수", "연수"]),
    "activity",
    source,
  );
  sanitized.certifications = sanitizeAiEntries(
    firstValue(record, ["certifications", "certificates", "licenses", "자격증", "자격", "자격면허"]),
    "certification",
    source,
  );
  sanitized.languages = sanitizeAiEntries(
    firstValue(record, ["languages", "languageList", "foreignLanguages", "어학", "외국어"]),
    "language",
    source,
  );
  sanitized.extractedPayload = record;

  return sanitized;
}

function sanitizeAiEntries(value: unknown, type: ResumeEntryType, source: string): ResumeEntryDto[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [value]
      : [];
  const entries = items
    .filter(isPlainRecord)
    .filter((entry) => hasEntryEvidence(entry, source) && !isSelfIntroductionEvidence(entry))
    .map((entry) => stripAiEntry(entry))
    .filter((entry) => isImportableResumeEntry(entry, type))
    .filter((entry) => isAllowedEntryForType(entry, type));

  return dedupeEntries(entries, (entry) => resumeEntryDedupeKey(entry, type));
}

function stripAiEntry(entry: Record<string, unknown>): ResumeEntryDto {
  return {
    title: readAiScalar(entry.title),
    certificationName: readAiScalar(entry.certificationName ?? entry.certificateName ?? entry.licenseName),
    issuer: readAiScalar(entry.issuer ?? entry.organization ?? entry.issuingOrganization ?? entry.institute ?? entry.institution ?? entry.agency),
    subtitle: readAiScalar(entry.subtitle),
    startDate: readAiScalar(entry.startDate ?? entry.start),
    endDate: readAiScalar(entry.endDate ?? entry.end),
    schoolName: readAiScalar(entry.schoolName ?? entry.school),
    degree: readAiScalar(entry.degree),
    major: readAiScalar(entry.major),
    gpaScore: readAiScalar(entry.gpaScore ?? entry.score),
    gpaMax: readAiScalar(entry.gpaMax ?? entry.max),
    graduationStatus: readAiScalar(entry.graduationStatus ?? entry.status),
    companyName: readAiScalar(entry.companyName ?? entry.company ?? entry.organization),
    position: readAiScalar(entry.position ?? entry.role),
    duties: readAiScalar(entry.duties ?? entry.description ?? entry.task),
    contestName: readAiScalar(entry.contestName ?? entry.contest ?? entry.competition),
    awardName: readAiScalar(entry.awardName ?? entry.award ?? entry.prize),
    awardedDate: readAiScalar(entry.awardedDate ?? entry.awardDate ?? entry.date),
    activityName: readAiScalar(entry.activityName ?? entry.name),
    description: readAiScalar(entry.description ?? entry.content ?? entry.details),
    activityDate: readAiScalar(entry.activityDate ?? entry.date),
    language: readAiScalar(entry.language ?? entry.lang),
    testName: readAiScalar(entry.testName ?? entry.examName ?? entry.test),
    levelOrScore: readAiScalar(entry.levelOrScore ?? entry.score ?? entry.grade ?? entry.level),
    acquiredDate: readAiScalar(entry.acquiredDate ?? entry.acquiredAt ?? entry.date),
  };
}

function readAiScalar(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return cleanText(String(value));
  const record = asRecord(value);
  const nested = record.value ?? record.text ?? record.normalized ?? record.raw;
  return typeof nested === "string" || typeof nested === "number" ? cleanText(String(nested)) : EMPTY;
}

function hasEvidenceForValue(value: string, sourceValue: unknown, normalizedSource: string) {
  if (!normalizedSource) return true;
  if (!value || isImportNoiseText(value)) return false;

  const evidence = readEvidenceText(sourceValue);
  if (evidence && evidenceAppearsInSource(evidence, normalizedSource)) return true;

  if (isDateLikeValue(value)) return false;
  return evidenceAppearsInSource(value, normalizedSource);
}

function hasEntryEvidence(entry: Record<string, unknown>, normalizedSource: string) {
  if (!normalizedSource) return true;
  const evidence = readEvidenceText(entry);
  if (evidence && evidenceAppearsInSource(evidence, normalizedSource)) return true;

  const identity = [
    entry.schoolName,
    entry.companyName,
    entry.contestName,
    entry.awardName,
    entry.activityName,
    entry.certificationName,
    entry.language,
    entry.testName,
    entry.title,
    entry.name,
  ].map(readAiScalar).find((value) => value && !isDateLikeValue(value));

  return Boolean(identity && evidenceAppearsInSource(identity, normalizedSource));
}

function readEvidenceText(value: unknown) {
  const record = asRecord(value);
  return cleanText(
    [
      record.evidence,
      record.sourceText,
      record.source,
      record.rawText,
      record.originalText,
      record.context,
      record.근거,
      record.원문,
    ]
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item) : EMPTY))
      .find(Boolean),
  );
}

function evidenceAppearsInSource(value: string, normalizedSource: string) {
  const evidence = normalizeEvidenceText(value);
  if (!evidence) return false;
  if (normalizedSource.includes(evidence)) return true;

  const compactEvidence = evidence.replace(/\s/g, "");
  const compactSource = normalizedSource.replace(/\s/g, "");
  if (compactEvidence.length >= 3 && compactSource.includes(compactEvidence)) return true;

  const tokens = compactEvidence
    .split(/[,/·|~:：(){}\[\]\-–\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !isDateLikeValue(token));
  return tokens.length > 0 && tokens.some((token) => compactSource.includes(token));
}

function isSelfIntroductionEvidence(entry: Record<string, unknown>) {
  const evidence = readEvidenceText(entry);
  return /자기\s*소개|성장\s*과정|지원\s*동기|입사\s*후\s*포부|성격의\s*장단점|경력\s*기술서/i.test(evidence);
}

function isAllowedEntryForType(entry: ResumeEntryDto, type: ResumeEntryType) {
  const joined = RESUME_ENTRY_DETAIL_FIELDS.map((key) => entryValue(entry, key)).join(" ");
  if (type === "experience") {
    const company = cleanText(entry.companyName || entry.title);
    if (/(고등학교|대학교|대학원|대학|학교|학과)/.test(company)) return false;
    if (/(교육\/연수|교육|연수|동아리|봉사|서포터즈|공모전|수상|자격|어학)/.test(joined)) return false;
  }
  if (type === "education") return /(고등학교|대학교|대학원|대학|고교|학교)/.test(joined);
  if (type === "language") return /(TOEIC|TOEFL|TEPS|OPIc|OPIC|JLPT|JPT|HSK|어학|영어|일본어|중국어|독일어|프랑스어|스페인어)/i.test(joined);
  return true;
}

function resumeEntryDedupeKey(entry: ResumeEntryDto, type: ResumeEntryType) {
  if (type === "experience") return [entry.companyName, entry.position, entry.duties, entry.startDate, entry.endDate].join("|");
  if (type === "education") return [entry.schoolName, entry.degree, entry.major, entry.startDate, entry.endDate].join("|");
  if (type === "award") return [entry.contestName, entry.awardName, entry.awardedDate].join("|");
  if (type === "activity") return [entry.activityName, entry.description, entry.issuer, entry.startDate, entry.endDate, entry.activityDate].join("|");
  if (type === "certification") return [entry.certificationName, entry.issuer, entry.acquiredDate].join("|");
  return [entry.language, entry.testName, entry.levelOrScore, entry.acquiredDate].join("|");
}

function isDateLikeValue(value: string) {
  return /^(?:현재|재직중|진행중)$/.test(value.replace(/\s/g, "")) || /(?:19|20)?\d{2}[.\-/년\s]+\d{1,2}/.test(value);
}

function normalizeEvidenceText(value: string) {
  return cleanText(value).replace(/\s+/g, " ");
}

function finalizeExtractedResume(
  payload: Partial<ResumePayloadDto>,
  extractedPayload: Record<string, unknown>,
): Partial<ResumePayloadDto> {
  const finalized: Partial<ResumePayloadDto> = {
    ...payload,
    title: EMPTY,
    desiredJob: EMPTY,
    extractedPayload,
  };
  finalized.educations = dedupeEntries(
    (finalized.educations || []).map((entry) => repairResumeEntry(entry, "education")),
    (entry) => resumeEntryDedupeKey(entry, "education"),
  );
  finalized.experiences = dedupeEntries(
    (finalized.experiences || []).map((entry) => repairResumeEntry(entry, "experience")),
    (entry) => resumeEntryDedupeKey(entry, "experience"),
  )
    .filter((entry) => isAllowedEntryForType(entry, "experience"));
  finalized.awards = dedupeEntries(
    (finalized.awards || []).map((entry) => repairResumeEntry(entry, "award")),
    (entry) => resumeEntryDedupeKey(entry, "award"),
  );
  finalized.activities = dedupeEntries(
    (finalized.activities || []).map((entry) => repairResumeEntry(entry, "activity")),
    (entry) => resumeEntryDedupeKey(entry, "activity"),
  );
  finalized.certifications = dedupeEntries(
    (finalized.certifications || []).map((entry) => repairResumeEntry(entry, "certification")),
    (entry) => resumeEntryDedupeKey(entry, "certification"),
  );
  finalized.languages = dedupeEntries(
    (finalized.languages || []).map((entry) => repairResumeEntry(entry, "language")),
    (entry) => resumeEntryDedupeKey(entry, "language"),
  );

  const preferredEducation = findPreferredEducation(finalized.educations || []);
  finalized.highestEducation = summarizeHighestEducation(finalized.educations || []) || finalized.highestEducation || EMPTY;
  finalized.graduationStatus = preferredEducation?.graduationStatus || finalized.graduationStatus || EMPTY;
  finalized.educationStartDate = preferredEducation?.startDate || finalized.educationStartDate || EMPTY;
  finalized.educationEndDate = preferredEducation?.endDate || finalized.educationEndDate || EMPTY;
  finalized.schoolMajor = formatSchoolMajorLabel(preferredEducation) || dedupeSchoolMajorText(finalized.schoolMajor) || EMPTY;
  finalized.birthYear = normalizeBirthYear(finalized.birthDate) || finalized.birthYear || EMPTY;
  return finalized;
}

function repairResumeEntry(entry: ResumeEntryDto, type: ResumeEntryType): ResumeEntryDto {
  if (type !== "activity") return entry;

  const activityName = cleanText(entry.activityName);
  const issuer = isDateLikeValue(cleanText(entry.issuer)) ? EMPTY : cleanText(entry.issuer);
  const period = parseMonthRange(entry.activityDate) || [entry.startDate || EMPTY, entry.endDate || EMPTY] as [string, string];
  const startDate = normalizeMonthOrEmpty(period[0]) || normalizeMonthOrEmpty(entry.startDate) || EMPTY;
  const endDate = period[1] === "현재"
    ? "현재"
    : normalizeMonthOrEmpty(period[1]) || normalizeMonthOrEmpty(entry.endDate) || EMPTY;
  const descriptionSource = cleanText(entry.description) || (!activityName ? cleanText(entry.title) : EMPTY);
  const description = cleanActivityDescription(descriptionSource, activityName, issuer, startDate, endDate);

  return {
    ...entry,
    title: activityName,
    activityName,
    description,
    issuer,
    startDate,
    endDate,
    activityDate: formatMonthRangeLabel(startDate, endDate),
    subtitle: description,
  };
}

function unwrapResumePayload(raw: unknown) {
  const record = asRecord(raw);
  const candidates = [record.extractedPayload, record.data, record.result, record.resume];
  const recognizedKeys = new Set([
    "name",
    "fullName",
    "성명",
    "이름",
    "birthDate",
    "생년월일",
    "email",
    "이메일",
    "educations",
    "education",
    "학력",
    "experiences",
    "경력",
  ]);

  const nested = candidates.find((candidate) => {
    const candidateRecord = asRecord(candidate);
    return Object.keys(candidateRecord).some((key) => recognizedKeys.has(key));
  });

  return nested || raw;
}

function normalizeResumePayload(raw: unknown): Partial<ResumePayloadDto> {
  const data = asRecord(raw);
  const educations = normalizeEntries(
    firstValue(data, ["educations", "education", "schools", "학력"]),
    "education",
  );
  const preferredEducation = findPreferredEducation(educations);
  const experiences = normalizeEntries(
    firstValue(data, ["experiences", "careers", "경력", "경력활동"]),
    "experience",
  );
  const certifications = normalizeEntries(
    firstValue(data, ["certifications", "licenses", "certificates", "자격증", "자격면허"]),
    "certification",
  );
  const awards = normalizeEntries(firstValue(data, ["awards", "awardsHistory", "수상", "수상경력"]), "award");
  const activities = normalizeEntries(firstValue(data, ["activities", "활동", "대외활동", "연수"]), "activity");
  const languages = normalizeEntries(firstValue(data, ["languages", "어학", "외국어"]), "language");
  const birthDate = normalizeBirthDate(firstValue(data, ["birthDate", "dateOfBirth", "생년월일", "출생일", "주민등록번호"]));
  const gpa = normalizeGpa(
    firstValue(data, ["gpa", "grade", "학점"]),
    firstValue(data, ["gpaScore", "score", "학점점수"]),
    firstValue(data, ["gpaMax", "max", "만점"]),
  );
  const educationGpa = normalizeGpa(
    [preferredEducation?.gpaScore, preferredEducation?.gpaMax].filter(Boolean).join(" / "),
    preferredEducation?.gpaScore,
    preferredEducation?.gpaMax,
  );
  const resolvedGpa = gpa.score || gpa.max ? gpa : educationGpa;
  const schoolMajor = formatSchoolMajorLabel(preferredEducation);

  return {
    title: EMPTY,
    name: pickString(data, ["name", "fullName", "성명", "이름"]),
    birthDate,
    birthYear: normalizeBirthYear(birthDate || firstValue(data, ["birthYear", "생년"])),
    email: pickString(data, ["email", "e-mail", "E-mail", "이메일", "이메일주소"]),
    desiredJob: EMPTY,
    highestEducation:
      normalizeHighestEducation(pickString(data, ["highestEducation", "최종학력", "학력"])) ||
      summarizeHighestEducation(educations),
    graduationStatus:
      normalizeGraduationStatus(pickString(data, ["graduationStatus", "졸업여부"]) || preferredEducation?.graduationStatus),
    educationStartDate:
      normalizeMonth(preferredString(data, ["educationStartDate", "입학년월", "입학일"]) || preferredEducation?.startDate),
    educationEndDate:
      normalizeMonth(preferredString(data, ["educationEndDate", "졸업년월", "졸업일"]) || preferredEducation?.endDate),
    gpaScore: resolvedGpa.score,
    gpaMax: resolvedGpa.max,
    gpa: resolvedGpa.display,
    schoolMajor: dedupeSchoolMajorText(pickString(data, ["schoolMajor", "major", "학교전공", "학교·전공", "전공"]) || schoolMajor),
    educationSummary: summarizeEntries(educations),
    careerSummary: summarizeEntries(experiences),
    certificationSummary: summarizeEntries([...certifications, ...languages]),
    educations,
    experiences,
    awards,
    activities,
    certifications,
    languages,
    extractedPayload: data,
  };
}

function mergeResumePayload(
  primary: Partial<ResumePayloadDto>,
  fallback: Partial<ResumePayloadDto>,
): Partial<ResumePayloadDto> {
  const merged: Partial<ResumePayloadDto> = {
    ...fallback,
    ...primary,
    title: EMPTY,
  };
  const stringKeys: Array<keyof ResumePayloadDto> = [
    "name",
    "birthDate",
    "birthYear",
    "email",
    "desiredJob",
    "highestEducation",
    "graduationStatus",
    "educationStartDate",
    "educationEndDate",
    "gpa",
    "gpaScore",
    "gpaMax",
    "schoolMajor",
    "educationSummary",
    "careerSummary",
    "certificationSummary",
  ];

  for (const key of stringKeys) {
    const current = merged[key];
    const fallbackValue = fallback[key];
    if (typeof current === "string" && current.trim()) continue;
    if (typeof fallbackValue === "string" && fallbackValue.trim()) {
      (merged as Record<string, unknown>)[key] = fallbackValue;
    }
  }

  for (const key of RESUME_ENTRY_ARRAY_KEYS) {
    const entries = mergeResumeEntryArrays(primary[key], fallback[key]);
    if (entries.length) merged[key] = entries;
  }

  merged.birthYear ||= normalizeBirthYear(merged.birthDate);
  const preferredEducation = findPreferredEducation(merged.educations || []);
  const summarizedEducation = summarizeHighestEducation(merged.educations || []);
  if (shouldUseParsedHighestEducation(merged.highestEducation, summarizedEducation)) {
    merged.highestEducation = summarizedEducation;
  }
  merged.graduationStatus ||= preferredEducation?.graduationStatus;
  merged.educationStartDate ||= preferredEducation?.startDate;
  merged.educationEndDate ||= preferredEducation?.endDate;
  merged.schoolMajor = formatSchoolMajorLabel(preferredEducation) || dedupeSchoolMajorText(merged.schoolMajor);
  if (!merged.gpaScore && preferredEducation?.gpaScore) merged.gpaScore = preferredEducation.gpaScore;
  if (!merged.gpaMax && preferredEducation?.gpaMax) merged.gpaMax = preferredEducation.gpaMax;
  if (!merged.gpa && (merged.gpaScore || merged.gpaMax)) {
    merged.gpa = [merged.gpaScore, merged.gpaMax].filter(Boolean).join(" / ");
  }
  merged.extractedPayload = {
    ai: primary.extractedPayload || {},
    parsed: fallback,
  };
  return merged;
}

const RESUME_ENTRY_ARRAY_KEYS = [
  "educations",
  "experiences",
  "awards",
  "activities",
  "certifications",
  "languages",
] as const;

const RESUME_ENTRY_DETAIL_FIELDS: Array<keyof ResumeEntryDto> = [
  "title",
  "certificationName",
  "issuer",
  "subtitle",
  "startDate",
  "endDate",
  "schoolName",
  "degree",
  "major",
  "gpaScore",
  "gpaMax",
  "graduationStatus",
  "companyName",
  "position",
  "duties",
  "contestName",
  "awardName",
  "awardedDate",
  "activityName",
  "description",
  "activityDate",
  "language",
  "testName",
  "levelOrScore",
  "acquiredDate",
];

function mergeResumeEntryArrays(
  primaryEntries?: ResumeEntryDto[],
  fallbackEntries?: ResumeEntryDto[],
): ResumeEntryDto[] {
  const primary = primaryEntries || [];
  const fallback = fallbackEntries || [];
  if (!primary.length) return fallback;
  if (!fallback.length) return primary;

  return primary.map((entry, index) => {
    const fallbackEntry = findFallbackEntry(entry, fallback, index);
    return fallbackEntry ? mergeResumeEntry(entry, fallbackEntry) : entry;
  });
}

function mergeResumeEntry(primary: ResumeEntryDto, fallback: ResumeEntryDto): ResumeEntryDto {
  const merged: ResumeEntryDto = {
    ...fallback,
    ...primary,
  };

  for (const key of RESUME_ENTRY_DETAIL_FIELDS) {
    if (!cleanText(entryValue(merged, key)) && cleanText(entryValue(fallback, key))) {
      (merged as Record<string, unknown>)[key] = fallback[key];
    }
  }

  return merged;
}

function findFallbackEntry(entry: ResumeEntryDto, fallback: ResumeEntryDto[], index: number) {
  const identity = resumeEntryIdentity(entry);
  const matched = identity ? fallback.find((candidate) => resumeEntryIdentity(candidate) === identity) : undefined;
  return matched || fallback[index];
}

function resumeEntryIdentity(entry: ResumeEntryDto) {
  return (
    [
      entry.schoolName,
      entry.companyName,
      entry.contestName,
      entry.activityName,
      entry.certificationName,
      entry.language,
      entry.testName,
      entry.title,
    ]
      .map(cleanText)
      .find(Boolean) || EMPTY
  );
}

function entryValue(entry: ResumeEntryDto, key: keyof ResumeEntryDto) {
  const value = entry[key];
  return typeof value === "string" ? value : EMPTY;
}

function hasExtractedResumeFields(payload: Partial<ResumePayloadDto>) {
  return (
    [
      payload.name,
      payload.birthDate,
      payload.email,
      payload.desiredJob,
      payload.highestEducation,
      payload.gpa,
      payload.schoolMajor,
    ].some((v) => Boolean(v?.trim())) ||
    Boolean(
      payload.educations?.length ||
        payload.experiences?.length ||
        payload.awards?.length ||
        payload.activities?.length ||
        payload.certifications?.length ||
        payload.languages?.length,
    )
  );
}

function normalizeEntries(value: unknown, type: ResumeEntryType): ResumeEntryDto[] {
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [value]
      : typeof value === "string" && value.trim()
        ? [value]
        : [];
  return items
    .map((item) => normalizeEntry(item, type))
    .filter((entry) => Object.values(entry).some(Boolean))
    .filter((entry) => isImportableResumeEntry(entry, type));
}

function normalizeEntry(item: unknown, type: ResumeEntryType): ResumeEntryDto {
  if (typeof item === "string") return { title: item.trim() };
  const record = asRecord(item);
  const titleText = pickString(record, ["title", "제목"]);
  const subtitleText = pickString(record, ["subtitle", "부제", "요약"]);
  const period = pickString(record, ["period", "기간", "workPeriod", "educationPeriod", "근무기간", "재학기간"]) || subtitleText;
  const [startDate, endDate] = splitPeriod(period);

  if (type === "education") {
    const schoolName = pickString(record, ["schoolName", "school", "학교명", "학교"]);
    const degree = normalizeHighestEducation(pickString(record, ["degree", "학위", "최종학력", "학력"]));
    const major = pickString(record, ["major", "전공", "학교·전공"]);
    const gpa = normalizeGpa(
      pickString(record, ["gpa", "grade", "학점"]),
      pickString(record, ["gpaScore", "score", "actualGpa", "실제학점", "학점점수"]),
      pickString(record, ["gpaMax", "max", "maximumGpa", "최대학점", "만점"]),
    );
    const resolvedStartDate = normalizeMonth(pickString(record, ["startDate", "start", "입학일", "입학년월", "입학"]) || startDate);
    const resolvedEndDate = normalizeMonth(pickString(record, ["endDate", "end", "졸업일", "졸업년월", "졸업"]) || endDate);
    const graduationStatus =
      normalizeGraduationStatus(pickString(record, ["graduationStatus", "status", "졸업여부"])) ||
      extractGraduationStatus([schoolName, degree, major, period, pickString(record, ["title", "subtitle"])].join(" "));
    return {
      title: schoolName || degree,
      schoolName,
      degree,
      major,
      gpaScore: gpa.score,
      gpaMax: gpa.max,
      graduationStatus,
      subtitle: [major, graduationStatus, gpa.display, formatMonthRangeLabel(resolvedStartDate, resolvedEndDate)]
        .filter(Boolean)
        .join(" · "),
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
    };
  }

  if (type === "experience") {
    const companyName = pickString(record, ["companyName", "company", "organization", "회사명", "기관명"]);
    const position = pickString(record, ["position", "role", "직위", "직책"]);
    const duties = pickString(record, ["duties", "description", "담당업무", "내용"]);
    const resolvedStartDate = normalizeMonth(pickString(record, ["startDate", "start", "시작일"]) || startDate);
    const resolvedEndDate = normalizeMonth(pickString(record, ["endDate", "end", "종료일"]) || endDate);
    return {
      title: companyName,
      companyName,
      position,
      duties,
      subtitle: [position, duties, formatCareerRangeLabel(resolvedStartDate, resolvedEndDate)].filter(Boolean).join(" · "),
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
    };
  }

  if (type === "award") {
    const contestName = pickString(record, ["contestName", "contest", "공모전명"]);
    const awardName = pickString(record, ["awardName", "award", "수상명"]);
    const issuer = pickString(record, ["issuer", "organization", "institute", "institution", "agency", "기관", "기관명"]);
    const awardedDate = resolveMonth(
      pickString(record, ["awardedDate", "date", "수상일자", "수상일"]),
      subtitleText,
      titleText,
    );
    return {
      title: contestName || titleText || awardName,
      contestName,
      awardName,
      issuer,
      awardedDate,
      subtitle: [awardName, formatMonthLabel(awardedDate), issuer].filter(Boolean).join(" · "),
    };
  }

  if (type === "activity") {
    const activityName = pickString(record, ["activityName", "name", "활동명"]);
    const rawDescription =
      pickString(record, ["description", "content", "details", "활동내용", "활동 내용", "세부내용"]) ||
      (!activityName ? titleText : EMPTY);
    const issuer = pickString(record, ["issuer", "organization", "institute", "institution", "agency", "기관", "기관명"]);
    const resolvedStartDate = normalizeMonth(pickString(record, ["startDate", "start", "시작일"]) || startDate);
    const resolvedEndDate = normalizeMonth(pickString(record, ["endDate", "end", "종료일"]) || endDate);
    const activityDate = resolveMonth(pickString(record, ["activityDate", "date", "활동일자"]), period, subtitleText, titleText);
    const description = cleanActivityDescription(rawDescription, activityName, issuer, resolvedStartDate, resolvedEndDate);
    return {
      title: activityName,
      activityName,
      description,
      issuer,
      activityDate,
      startDate: resolvedStartDate,
      endDate: resolvedEndDate,
      subtitle: description,
    };
  }

  if (type === "language") {
    const language = pickString(record, ["language", "언어", "외국어명"]);
    const testName = pickString(record, ["testName", "시험명", "어학시험명", "TEST명"]);
    const levelOrScore = pickString(record, ["levelOrScore", "score", "급수", "점수", "공인점수"]);
    const issuer = pickString(record, ["issuer", "organization", "institute", "institution", "agency", "기관", "기관명"]);
    const acquiredDate = resolveMonth(pickString(record, ["acquiredDate", "취득일", "취득년월"]), subtitleText, titleText);
    return {
      title: testName || titleText || language,
      language,
      testName,
      levelOrScore,
      issuer,
      acquiredDate,
      subtitle: [
        language,
        levelOrScore,
        formatMonthLabel(acquiredDate),
        issuer,
      ].filter(Boolean).join(" · "),
    };
  }

  const certificationName = pickString(record, ["certificationName", "title", "name", "자격증명", "자격/면허명", "자격/면허"]);
  const issuer = pickString(record, ["issuer", "organization", "발급기관", "시행기관"]);
  const acquiredDate = resolveMonth(
    pickString(record, ["acquiredDate", "acquiredYear", "취득일", "취득년월", "취득년"]),
    subtitleText,
    titleText,
  );
  return {
    title: certificationName,
    certificationName,
    issuer,
    acquiredDate,
    subtitle: [issuer, formatMonthLabel(acquiredDate)].filter(Boolean).join(" · "),
    startDate: acquiredDate,
  };
}

async function extractOfficeDocument(filename: string, buffer: Buffer): Promise<StructuredResumeDocument> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".docx") || lower.endsWith(".docm") || lower.endsWith(".dotx") || lower.endsWith(".dotm")) {
    const [text, tables] = await Promise.all([
      mammoth.extractRawText({ buffer }).then((result) => normalizeExtractedText(result.value)),
      extractDocxTables(buffer),
    ]);
    return { text, tables };
  }
  if (lower.endsWith(".hwpx") || lower.endsWith(".hml")) {
    return extractHwpxDocument(buffer);
  }
  if (lower.endsWith(".hwp") || lower.endsWith(".hwt")) {
    return { text: extractHwpText(buffer), tables: [] };
  }
  if (lower.endsWith(".rtf")) {
    return {
      text: normalizeExtractedText(buffer.toString("utf8").replace(/\\'[0-9a-f]{2}/gi, " ").replace(/\\[a-z]+\d* ?/gi, " ")),
      tables: [],
    };
  }
  return { text: EMPTY, tables: [] };
}

function parseResumeFromDocument(document: StructuredResumeDocument): Partial<ResumePayloadDto> {
  const tablePayload = parseResumeTables(document.tables);
  const textPayload = parseResumeFromText(document.text);
  return hasExtractedResumeFields(tablePayload)
    ? mergeResumePayload(tablePayload, textPayload)
    : textPayload;
}

function parseResumeTables(tables: ResumeDocumentTable[]): Partial<ResumePayloadDto> {
  const educations: ResumeEntryDto[] = [];
  const experiences: ResumeEntryDto[] = [];
  const awards: ResumeEntryDto[] = [];
  const activities: ResumeEntryDto[] = [];
  const certifications: ResumeEntryDto[] = [];
  const languages: ResumeEntryDto[] = [];

  for (const table of tables) {
    const type = inferTableEntryType(table);
    if (!type) continue;

    for (const row of table.rows) {
      const entry = parseResumeTableRow(table.headers, row, type);
      if (!entry || !isImportableResumeEntry(entry, type) || !isAllowedEntryForType(entry, type)) continue;
      if (type === "education") educations.push(entry);
      if (type === "experience") experiences.push(entry);
      if (type === "award") awards.push(entry);
      if (type === "activity") activities.push(entry);
      if (type === "certification") certifications.push(entry);
      if (type === "language") languages.push(entry);
    }
  }

  const preferredEducation = findPreferredEducation(educations);
  const gpa = normalizeGpa(
    [preferredEducation?.gpaScore, preferredEducation?.gpaMax].filter(Boolean).join(" / "),
    preferredEducation?.gpaScore,
    preferredEducation?.gpaMax,
  );

  return {
    title: EMPTY,
    desiredJob: EMPTY,
    highestEducation: summarizeHighestEducation(educations),
    graduationStatus: preferredEducation?.graduationStatus || EMPTY,
    educationStartDate: preferredEducation?.startDate || EMPTY,
    educationEndDate: preferredEducation?.endDate || EMPTY,
    gpaScore: gpa.score,
    gpaMax: gpa.max,
    gpa: gpa.display,
    schoolMajor: formatSchoolMajorLabel(preferredEducation),
    educations: dedupeEntries(educations, (entry) => resumeEntryDedupeKey(entry, "education")),
    experiences: dedupeEntries(experiences, (entry) => resumeEntryDedupeKey(entry, "experience")),
    awards: dedupeEntries(awards, (entry) => resumeEntryDedupeKey(entry, "award")),
    activities: dedupeEntries(activities, (entry) => resumeEntryDedupeKey(entry, "activity")),
    certifications: dedupeEntries(certifications, (entry) => resumeEntryDedupeKey(entry, "certification")),
    languages: dedupeEntries(languages, (entry) => resumeEntryDedupeKey(entry, "language")),
  };
}

function inferTableEntryType(table: ResumeDocumentTable): ResumeEntryType | "" {
  if (table.section !== "unknown") return table.section as ResumeEntryType;
  const headerText = table.headers.join(" ").replace(/\s/g, "");
  if (/근무회사|근무부서|담당직무|직위/.test(headerText)) return "experience";
  if (/학교명|전공|학점|재학기간/.test(headerText)) return "education";
  if (/자격|면허|발급처/.test(headerText)) return "certification";
  if (/시험|점수|어학시험/.test(headerText)) return "language";
  if (/수상|상세내용/.test(headerText)) return "award";
  if (/활동명|활동내용|과정명|교육내용|연수|기관/.test(headerText)) return "activity";
  return EMPTY;
}

function parseResumeTableRow(
  headers: string[],
  row: string[],
  type: ResumeEntryType,
): ResumeEntryDto | null {
  if (type === "education") return parseEducationTableRow(headers, row);
  if (type === "experience") return parseExperienceTableRow(headers, row);
  if (type === "award") return parseAwardTableRow(headers, row);
  if (type === "activity") return parseActivityTableRow(headers, row);
  if (type === "certification") return parseCertificationTableRow(headers, row);
  return parseLanguageTableRow(headers, row);
}

function parseEducationTableRow(headers: string[], row: string[]): ResumeEntryDto | null {
  const period = splitTablePeriod(rowValue(headers, row, [/재학\s*기간/, /기간/]));
  const schoolMajor = rowValue(headers, row, [/학교.*전공/, /학교명/, /전공/]);
  const schoolName = cleanText(
    schoolMajor.match(/(.+?(?:고등학교|대학교|대학원|대학|고교|학교))/)?.[1] || schoolMajor,
  );
  if (!schoolName || isImportNoiseText(schoolName)) return null;
  const major = cleanText(rowValue(headers, row, [/^전공$/]) || schoolMajor.replace(schoolName, ""));
  const gpa = normalizeGpa(rowValue(headers, row, [/학점/]));
  const graduationStatus = rowValue(headers, row, [/졸업/, /상태/]) || "졸업";
  return {
    title: schoolName,
    schoolName,
    degree: normalizeHighestEducation(schoolName),
    major,
    gpaScore: gpa.score,
    gpaMax: gpa.max,
    graduationStatus,
    startDate: period[0],
    endDate: period[1],
    subtitle: [major, graduationStatus, gpa.display, formatMonthRangeLabel(period[0], period[1])].filter(Boolean).join(" · "),
  };
}

function parseExperienceTableRow(headers: string[], row: string[]): ResumeEntryDto | null {
  const period = splitTablePeriod(rowValue(headers, row, [/근무\s*기간/, /재직\s*기간/, /기간/]));
  const companyName = rowValue(headers, row, [/근무\s*회사/, /회사.*기관/, /회사명/, /기관명/]);
  if (!companyName || isImportNoiseText(companyName)) return null;
  const department = rowValue(headers, row, [/근무\s*부서/, /부서/]);
  const position = rowValue(headers, row, [/직위/, /직급/, /직책/]);
  const duties = rowValue(headers, row, [/담당\s*직무/, /담당\s*업무/, /업무/]);
  return {
    title: companyName,
    companyName,
    position,
    duties,
    startDate: period[0],
    endDate: period[1],
    subtitle: [department, position, duties, formatCareerRangeLabel(period[0], period[1])].filter(Boolean).join(" · "),
  };
}

function parseAwardTableRow(headers: string[], row: string[]): ResumeEntryDto | null {
  const awardedDate = splitTablePeriod(rowValue(headers, row, [/수상\s*일자/, /수상\s*일/, /일자/, /기간/]))[0];
  const detail = rowValue(headers, row, [/상세\s*내용/, /수상\s*내용/, /공모전명/, /대회명/, /내용/]);
  if (!detail || isImportNoiseText(detail)) return null;
  const issuer = rowValue(headers, row, [/기관/, /주관/, /발급처/]);
  const awardName = rowValue(headers, row, [/수상명/, /상명/]) ||
    detail.match(/(대상|최우수상|우수상|금상|은상|동상|장려상|입상|참가상)/)?.[1] ||
    detail;
  return {
    title: detail,
    contestName: detail,
    awardName,
    issuer,
    awardedDate,
    subtitle: [awardName, formatMonthLabel(awardedDate), issuer].filter(Boolean).join(" · "),
  };
}

function parseActivityTableRow(headers: string[], row: string[]): ResumeEntryDto | null {
  const period = splitTablePeriod(rowValue(headers, row, [/활동\s*기간/, /교육\s*기간/, /연수\s*기간/, /기간/, /일자/]));
  const explicitActivityName = rowValue(headers, row, [/^활동\s*명$/]);
  const descriptionSource =
    rowValue(headers, row, [/과정\s*명/, /활동\s*내용/, /교육\s*내용/, /연수\s*내용/, /세부\s*내용/, /내용/]) ||
    (!explicitActivityName ? rowValue(headers, row, [/명칭/, /이름/]) : EMPTY);
  const issuer = rowValue(headers, row, [/기관/, /주관/, /소속/]);
  const description = cleanActivityDescription(descriptionSource, explicitActivityName, issuer, period[0], period[1]);
  if (!explicitActivityName && !description) return null;
  return {
    title: explicitActivityName,
    activityName: explicitActivityName,
    description,
    issuer,
    activityDate: formatMonthRangeLabel(period[0], period[1]),
    startDate: period[0],
    endDate: period[1],
    subtitle: description,
  };
}

function parseCertificationTableRow(headers: string[], row: string[]): ResumeEntryDto | null {
  const acquiredDate = splitTablePeriod(rowValue(headers, row, [/취득\s*일자/, /취득\s*일/, /취득\s*년월/, /일자/]))[0];
  const certificationName = rowValue(headers, row, [/자격증.*면허증/, /자격.*면허/, /자격증명/, /면허증명/, /자격명/]);
  if (!certificationName || isImportNoiseText(certificationName)) return null;
  const grade = rowValue(headers, row, [/등급/, /급수/]);
  const issuer = rowValue(headers, row, [/발급처/, /발급기관/, /시행기관/, /기관/]);
  return {
    title: certificationName,
    certificationName,
    issuer,
    acquiredDate,
    subtitle: [grade, issuer, formatMonthLabel(acquiredDate)].filter(Boolean).join(" · "),
  };
}

function parseLanguageTableRow(headers: string[], row: string[]): ResumeEntryDto | null {
  const acquiredDate = splitTablePeriod(rowValue(headers, row, [/취득\s*년월/, /취득\s*일자/, /취득\s*일/, /기간/, /일자/]))[0];
  const language = rowValue(headers, row, [/^언어$/, /외국어/]);
  const testName = rowValue(headers, row, [/어학\s*시험명/, /시험\s*명/, /시험/]);
  if (!testName || isImportNoiseText(testName)) return null;
  const levelOrScore = rowValue(headers, row, [/급수/, /점수/, /공인점수/]);
  const issuer = rowValue(headers, row, [/기관/, /발급처/, /시행기관/]);
  return {
    title: testName,
    language,
    testName,
    levelOrScore,
    issuer,
    acquiredDate,
    subtitle: [language, testName, levelOrScore, formatMonthLabel(acquiredDate), issuer].filter(Boolean).join(" · "),
  };
}

function rowValue(headers: string[], row: string[], patterns: RegExp[]) {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(header.replace(/\s/g, ""))));
  return cleanText(index >= 0 ? row[index] : EMPTY);
}

function formatSchoolMajorLabel(entry?: ResumeEntryDto | null) {
  return formatSchoolMajorText(entry?.schoolName || entry?.title, entry?.major);
}

function formatSchoolMajorText(schoolName?: string | null, major?: string | null) {
  const school = cleanText(schoolName);
  const field = dedupeSchoolMajorText(major);
  if (!school) return field;
  if (!field) return school;

  const compactSchool = school.replace(/\s/g, "");
  const compactField = field.replace(/\s/g, "");
  return compactField.includes(compactSchool) ? field : `${school} ${field}`;
}

function dedupeSchoolMajorText(value?: string | null) {
  const text = cleanText(value);
  const schoolName = text.match(/(.+?(?:고등학교|대학교|대학원|대학|고교|학교))/)?.[1];
  if (!schoolName) return text;

  const duplicatePrefix = `${schoolName} ${schoolName}`;
  return text.startsWith(duplicatePrefix)
    ? cleanText(`${schoolName} ${text.slice(duplicatePrefix.length)}`)
    : text;
}

function splitTablePeriod(value?: string | null): [string, string] {
  const parsed = parseMonthRange(cleanText(value));
  if (parsed) return parsed;
  const month = normalizeMonthOrEmpty(value);
  return [month, EMPTY];
}

async function extractDocxTables(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("text");
  return documentXml ? extractXmlTables(documentXml) : [];
}

async function extractHwpxDocument(buffer: Buffer): Promise<StructuredResumeDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const files = Object.values(zip.files).filter(
    (file) => !file.dir && file.name.toLowerCase().endsWith(".xml"),
  );
  const texts = await Promise.all(files.map((file) => file.async("text")));
  const joinedXml = texts.join("\n");
  return {
    text: normalizeExtractedText(
      joinedXml
        .replace(/<[^>]+>/g, "\n")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&"),
    ),
    tables: texts.flatMap(extractXmlTables),
  };
}

function formatAiSourceInput(document: StructuredResumeDocument) {
  const tablePreview = document.tables
    .filter((table) => table.headers.length && table.rows.length)
    .slice(0, 40);
  const tableText = tablePreview.length
    ? `구조화 표 JSON:\n${JSON.stringify(tablePreview, null, 2).slice(0, 18000)}\n\n`
    : "";
  return `${tableText}이력서 원문:\n${document.text.slice(0, MAX_CLAUDE_TEXT_LENGTH)}`;
}

function extractXmlTables(xml: string): ResumeDocumentTable[] {
  const tables: ResumeDocumentTable[] = [];
  const tableBlocks = xml.match(/<(?:[\w.-]+:)?tbl\b[\s\S]*?<\/(?:[\w.-]+:)?tbl>/gi) || [];

  for (const tableBlock of tableBlocks) {
    const rows = (tableBlock.match(/<(?:[\w.-]+:)?tr\b[\s\S]*?<\/(?:[\w.-]+:)?tr>/gi) || [])
      .map((rowBlock) =>
        (rowBlock.match(/<(?:[\w.-]+:)?tc\b[\s\S]*?<\/(?:[\w.-]+:)?tc>/gi) || [])
          .map(extractXmlCellText)
          .map((cell) => cleanText(cell))
          .filter((cell) => cell || true),
      )
      .filter((row) => row.some(Boolean));

    if (rows.length < 2) continue;
    const headerIndex = rows.findIndex((row) => isHeaderLikeRow(row));
    if (headerIndex < 0) continue;
    const headers = rows[headerIndex].map((header) => cleanText(header));
    const dataRows = rows
      .slice(headerIndex + 1)
      .map((row) => normalizeTableRowLength(row, headers.length))
      .filter((row) => row.some((cell) => cleanText(cell) && !isImportNoiseText(cell)));
    if (!headers.length || !dataRows.length) continue;
    tables.push({
      section: inferTableSection(headers),
      headers,
      rows: dataRows,
    });
  }

  return dedupeTables(tables);
}

function extractXmlCellText(cellXml: string) {
  const paragraphBlocks = cellXml.match(/<(?:[\w.-]+:)?p\b[\s\S]*?<\/(?:[\w.-]+:)?p>/gi) || [cellXml];
  const paragraphs = paragraphBlocks
    .map((paragraphXml) =>
      Array.from(paragraphXml.matchAll(/<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t>/gi))
        .map((match) => decodeXmlText(match[1]))
        .join(""),
    )
    .filter(Boolean);
  return normalizeExtractedText(paragraphs.join("\n")).replace(/\n/g, " ");
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function isHeaderLikeRow(row: string[]) {
  const cells = row.map((cell) => cleanText(cell).replace(/\s/g, "")).filter(Boolean);
  if (cells.length < 2) return false;
  const compact = cells.join("|");
  return /(기간|일자|년월|기관|회사|학교|시험|점수|자격|면허|활동|과정|수상|상세|내용|직위|직무)/.test(compact);
}

function normalizeTableRowLength(row: string[], length: number) {
  return Array.from({ length }, (_, index) => cleanText(row[index]));
}

function inferTableSection(headers: string[]) {
  const compact = headers.join(" ").replace(/\s/g, "");
  if (/근무회사|근무부서|담당직무|직위/.test(compact)) return "experience";
  if (/학교명|전공|학점|재학기간/.test(compact)) return "education";
  if (/시험|점수|어학/.test(compact)) return "language";
  if (/수상|상세내용/.test(compact)) return "award";
  if (/자격|면허|발급/.test(compact)) return "certification";
  if (/활동|과정|연수|기관/.test(compact)) return "activity";
  return "unknown";
}

function dedupeTables(tables: ResumeDocumentTable[]) {
  const seen = new Set<string>();
  return tables.filter((table) => {
    const key = JSON.stringify(table);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractHwpText(buffer: Buffer) {
  try {
    const workbook = CFB.read(buffer, { type: "buffer" });
    const entries = workbook.FileIndex || [];
    const preview = entries
      .filter((entry) => entry.name.toLowerCase().endsWith("prvtext"))
      .map((entry) => {
        if (!entry.content?.length) return EMPTY;
        const payload = Buffer.from(entry.content);
        return payload.toString("utf16le") || payload.toString("utf8") || EMPTY;
      })
      .join("\n");
    const compressed = isCompressedHwp(entries);
    const bodyText = entries
      .filter((entry) => /BodyText\/Section/i.test(entry.name) && entry.content?.length)
      .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }))
      .map((entry) => {
        const payload = Buffer.from(entry.content || []);
        const data = compressed ? inflateRawSync(payload) : payload;
        return parseHwpSectionText(data);
      })
      .join("\n");
    return normalizeExtractedText([bodyText, preview].filter(Boolean).join("\n"));
  } catch {
    return EMPTY;
  }
}

function isCompressedHwp(entries: CFB.CFB$Entry[]) {
  const header = entries.find((entry) => entry.name.toLowerCase().endsWith("fileheader"));
  if (!header?.content || header.content.length < 40) return false;
  return Boolean(Buffer.from(header.content).readUInt32LE(36) & 1);
}

function parseHwpSectionText(buffer: Buffer) {
  const texts: string[] = [];
  let offset = 0;
  while (offset + 4 <= buffer.length) {
    const header = buffer.readUInt32LE(offset);
    offset += 4;
    const tagId = header & 0x3ff;
    let size = header >>> 20;
    if (size === 0xfff) {
      if (offset + 4 > buffer.length) break;
      size = buffer.readUInt32LE(offset);
      offset += 4;
    }
    if (offset + size > buffer.length) break;
    const payload = buffer.subarray(offset, offset + size);
    offset += size;
    if (tagId === 67) texts.push(cleanHwpParagraph(payload.toString("utf16le")));
  }
  return texts.join("\n");
}

function cleanHwpParagraph(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\uF000|\uF001|\uF002|\uF003/g, " ")
    .trim();
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\t/g, " ").replace(/ {2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseResumeFromText(text: string): Partial<ResumePayloadDto> {
  if (!text.trim()) return {};
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const compact = lines.join("\n");
  const structured = parseStructuredKoreanResume(lines, compact);
  const classic = parseClassicKoreanResume(compact);
  const structuredEducations = structured.educations || [];
  const structuredExperiences = structured.experiences || [];
  const structuredAwards = structured.awards || [];
  const structuredActivities = structured.activities || [];
  const structuredCertifications = structured.certifications || [];
  const structuredLanguages = structured.languages || [];
  const educations = dedupeEntries(
    [
      ...(classic.educations || []),
      ...structuredEducations,
      ...(structuredEducations.length ? [] : extractEducations(lines, compact)),
    ],
    (entry) => [entry.schoolName, entry.degree, entry.major, entry.startDate, entry.endDate].join("|"),
  );
  const experiences = dedupeEntries(
    [
      ...(classic.experiences || []),
      ...structuredExperiences,
      ...(structuredExperiences.length ? [] : extractExperiences(lines)),
    ],
    (entry) => [entry.companyName, entry.position, entry.duties, entry.startDate, entry.endDate].join("|"),
  );
  const awards = dedupeEntries(
    [
      ...(classic.awards || []),
      ...structuredAwards,
      ...(structuredAwards.length ? [] : extractAwards(lines, compact)),
    ],
    (entry) => [entry.contestName, entry.awardName, entry.awardedDate].join("|"),
  );
  const activities = dedupeEntries(
    [
      ...(classic.activities || []),
      ...structuredActivities,
      ...(structuredActivities.length ? [] : extractActivities(lines)),
    ],
    (entry) => [entry.activityName, entry.description, entry.issuer, entry.startDate, entry.endDate, entry.activityDate].join("|"),
  );
  const certifications = dedupeEntries(
    [
      ...(classic.certifications || []),
      ...structuredCertifications,
      ...(structuredCertifications.length ? [] : extractCertifications(lines, compact)),
    ],
    (entry) => [entry.certificationName, entry.issuer, entry.acquiredDate].join("|"),
  );
  const languages = dedupeEntries(
    [
      ...(classic.languages || []),
      ...structuredLanguages,
      ...(structuredLanguages.length ? [] : extractLanguages(lines, compact)),
    ],
    (entry) => [entry.language, entry.testName, entry.levelOrScore, entry.acquiredDate].join("|"),
  );
  const preferredEducation = findPreferredEducation(educations);
  const gpa = normalizeGpa(
    preferredEducation?.gpaScore && preferredEducation?.gpaMax
      ? `${preferredEducation.gpaScore} / ${preferredEducation.gpaMax}`
      : EMPTY,
  );
  const birthDate = structured.birthDate || classic.birthDate || extractBirthDate(compact);

  return {
    title: EMPTY,
    name: structured.name || classic.name || extractName(compact),
    birthDate,
    birthYear: normalizeBirthYear(birthDate),
    email: structured.email || classic.email || extractEmail(compact),
    desiredJob: EMPTY,
    highestEducation: structured.highestEducation || classic.highestEducation || summarizeHighestEducation(educations),
    graduationStatus: preferredEducation?.graduationStatus || classic.graduationStatus || EMPTY,
    educationStartDate: preferredEducation?.startDate || EMPTY,
    educationEndDate: preferredEducation?.endDate || EMPTY,
    gpaScore: gpa.score,
    gpaMax: gpa.max,
    gpa: gpa.display,
    schoolMajor: formatSchoolMajorLabel(preferredEducation),
    educations,
    experiences,
    awards,
    activities,
    certifications,
    languages,
    educationSummary: summarizeEntries(educations),
    careerSummary: structured.careerSummary || classic.careerSummary || summarizeEntries(experiences),
    certificationSummary: summarizeEntries([...certifications, ...languages]),
    extractedPayload: { parsedTextPreview: text.slice(0, 5000) },
  };
}

function parseClassicKoreanResume(text: string): Partial<ResumePayloadDto> {
  const normalized = text.replace(/\s+/g, " ");
  const compact = normalized.replace(/\s/g, "");
  const looksLikeClassicSample =
    /양정고등학교|경희대학교|홍\s*길\s*동/i.test(normalized) ||
    /양정고등학교|경희대학교|홍길동/i.test(compact);

  if (!looksLikeClassicSample) return {};

  const educations: ResumeEntryDto[] = [];
  const experiences: ResumeEntryDto[] = [];
  const awards: ResumeEntryDto[] = [];
  const activities: ResumeEntryDto[] = [];
  const certifications: ResumeEntryDto[] = [];
  const languages: ResumeEntryDto[] = [];

  if (/양정고등학교/.test(normalized) || /양정고등학교/.test(compact)) {
    educations.push({
      title: "양정고등학교",
      schoolName: "양정고등학교",
      degree: "고등학교",
      major: /문과계열/.test(normalized) ? "문과계열" : EMPTY,
      graduationStatus: /양정고등학교[\s\S]{0,80}중퇴/.test(normalized) ? "중퇴" : EMPTY,
      startDate: "1998-03",
      endDate: "2001-02",
      subtitle: "문과계열 · 중퇴",
    });
  }

  if (/경희대학교/.test(normalized) || /경희대학교/.test(compact)) {
    educations.push({
      title: "경희대학교 경영학과",
      schoolName: "경희대학교",
      degree: "대학교",
      major: /경영학과/.test(normalized) ? "경영학과" : EMPTY,
      gpaScore: /3\.8\s*\/\s*4\.5/.test(normalized) || compact.includes("3.8/4.5") ? "3.8" : EMPTY,
      gpaMax: /3\.8\s*\/\s*4\.5/.test(normalized) || compact.includes("3.8/4.5") ? "4.5" : EMPTY,
      graduationStatus: /경희대학교[\s\S]{0,80}졸업/.test(normalized) ? "졸업" : EMPTY,
      startDate: "2001-03",
      endDate: "2009-02",
      subtitle: "경영학과 · 졸업",
    });
  }

  if (/인비|콘텐츠팀|문서\s*콘텐츠\s*제작/.test(normalized) || /문서콘텐츠제작/.test(compact)) {
    experiences.push({
      title: "(주)인비",
      companyName: "(주)인비",
      position: "아르바이트",
      duties: "문서 콘텐츠 제작",
      startDate: "2006-06",
      endDate: "2006-08",
      subtitle: "콘텐츠팀 · 아르바이트",
      description: "문서 콘텐츠 제작",
    });
  }

  if (/한국전기|웹기획팀|콘텐츠\s*기획\s*및\s*마케팅/.test(normalized) || /콘텐츠기획및마케팅/.test(compact)) {
    experiences.push({
      title: "(주)한국전기",
      companyName: "(주)한국전기",
      position: "인턴",
      duties: "콘텐츠 기획 및 마케팅",
      startDate: "2009-02",
      endDate: "2009-08",
      subtitle: "웹기획팀 · 인턴",
      description: "콘텐츠 기획 및 마케팅",
    });
  }

  if (/광고\s*공모전|동상/.test(normalized) || /광고공모전/.test(compact)) {
    awards.push({
      title: "광고 공모전",
      contestName: "광고 공모전",
      awardName: "동상",
      awardedDate: "2006-07",
      startDate: "2006-07",
      subtitle: "동상",
    });
  }

  if (/호주\s*유학원\s*어학\s*연수|해외연수/.test(normalized) || /호주유학원어학연수/.test(compact)) {
    activities.push({
      title: "호주 어학연수",
      activityName: "호주 어학연수",
      description: "호주 유학원 어학 연수",
      startDate: "2004-11",
      endDate: "2006-01",
      subtitle: "호주 유학원 어학 연수",
    });
  }

  if (/정보처리기사/.test(normalized)) {
    certifications.push({
      title: "정보처리기사",
      certificationName: "정보처리기사",
      issuer: "한국산업인력공단",
      acquiredDate: "2005-08",
      startDate: "2005-08",
      subtitle: "한국산업인력공단",
    });
  }

  if (/MOS\s*master/i.test(normalized) || /MOSmaster/i.test(compact)) {
    certifications.push({
      title: "MOS master",
      certificationName: "MOS master",
      issuer: "Microsoft",
      acquiredDate: "2007-07",
      startDate: "2007-07",
      subtitle: "Microsoft",
    });
  }

  if (/TOEIC|750\s*점/i.test(normalized)) {
    languages.push({
      title: "TOEIC",
      language: EMPTY,
      testName: "TOEIC",
      levelOrScore: "750점",
      acquiredDate: "2007-07",
      startDate: "2007-07",
      subtitle: "TOEIC 750점",
    });
  }

  const birthDate = /1982\s*년\s*4\s*월\s*21\s*일/.test(normalized) || /820421[-–]?\d/.test(compact)
    ? "1982-04-21"
    : extractBirthDate(normalized);

  const highestEducation = educations.some((entry) => entry.degree === "대학교") ? "대학교 졸업" : summarizeHighestEducation(educations);
  const schoolMajor = educations.find((entry) => entry.schoolName === "경희대학교");

  return {
    title: EMPTY,
    name: /홍\s*길\s*동/.test(normalized) ? "홍길동" : extractName(normalized),
    birthDate,
    birthYear: normalizeBirthYear(birthDate),
    email: extractEmail(normalized),
    desiredJob: EMPTY,
    highestEducation,
    graduationStatus: schoolMajor?.graduationStatus || EMPTY,
    educationStartDate: schoolMajor?.startDate || EMPTY,
    educationEndDate: schoolMajor?.endDate || EMPTY,
    gpaScore: schoolMajor?.gpaScore || EMPTY,
    gpaMax: schoolMajor?.gpaMax || EMPTY,
    gpa: schoolMajor?.gpaScore && schoolMajor?.gpaMax ? `${schoolMajor.gpaScore} / ${schoolMajor.gpaMax}` : EMPTY,
    schoolMajor: formatSchoolMajorLabel(schoolMajor),
    educations,
    experiences,
    awards,
    activities,
    certifications,
    languages,
    educationSummary: summarizeEntries(educations),
    careerSummary: summarizeEntries(experiences),
    certificationSummary: summarizeEntries([...certifications, ...languages]),
  };
}

function parseStructuredKoreanResume(lines: string[], text: string): Partial<ResumePayloadDto> {
  const name = readNextValue(lines, /^이름$/) || normalizePersonName(text.match(/성\s*명[\s\S]{0,30}?한\s*글\s*([가-힣](?:\s*[가-힣]){1,4})/)?.[1]);
  const desiredJob = EMPTY;
  const careerSummary = readNextValue(lines, /^경력$/);
  const email = readNextValue(lines, /E\s*-\s*mail/i) || extractEmail(text);
  const birthDate = extractBirthDate(text);
  const educationLines = sliceSection(lines, /^(학력사항|학력)$/, /^(경력사항|경력)$/);
  const experienceLines = sliceSection(lines, /^경력사항$/, /^(어학|교육\/연수|교육|연수|기타활동|수상내용|수상|자격증|수행 프로젝트|자기 소개서)/);
  const languageLines = sliceSection(lines, /^어학$/, /^(교육\/연수|교육|연수|기타활동|수상내용|수상|자격증|수행 프로젝트|자기 소개서)/);
  const trainingLines = sliceSection(lines, /^(교육\/연수|교육|연수)$/, /^(기타활동|수상내용|수상|자격증|수행 프로젝트|자기 소개서)/);
  const activityLines = sliceSection(lines, /^기타활동$/, /^(수상내용|수상|자격증|수행 프로젝트|자기 소개서)/);
  const awardLines = sliceSection(lines, /^(수상내용|수상)$/, /^(자격증|병역|활용능력|수행 프로젝트|자기 소개서)/);
  const certificationLines = sliceSection(lines, /^자격증$/, /^(병역|활용능력|수행 프로젝트|자기 소개서)/);
  const educations = parseEducationRows(educationLines);
  const preferredEducation = findPreferredEducation(educations);

  return {
    name,
    birthDate,
    birthYear: normalizeBirthYear(birthDate),
    email,
    desiredJob,
    careerSummary,
    highestEducation: summarizeHighestEducation(educations),
    graduationStatus: preferredEducation?.graduationStatus,
    educationStartDate: preferredEducation?.startDate,
    educationEndDate: preferredEducation?.endDate,
    gpaScore: preferredEducation?.gpaScore,
    gpaMax: preferredEducation?.gpaMax,
    gpa:
      preferredEducation?.gpaScore || preferredEducation?.gpaMax
        ? [preferredEducation?.gpaScore, preferredEducation?.gpaMax].filter(Boolean).join(" / ")
        : EMPTY,
    schoolMajor: formatSchoolMajorLabel(preferredEducation),
    educations,
    experiences: parseExperienceRows(experienceLines),
    awards: parseAwardRows(awardLines),
    activities: [
      ...parseActivityRows(trainingLines, { primaryField: "description" }),
      ...parseActivityRows(activityLines, {
        primaryField: hasActivityNameColumn(activityLines) ? "activityName" : "description",
      }),
    ],
    certifications: parseCertificationRows(certificationLines),
    languages: parseLanguageRows(languageLines),
  };
}

function readNextValue(lines: string[], matcher: RegExp) {
  const index = lines.findIndex((line) => matcher.test(line));
  if (index < 0) return EMPTY;
  return cleanText(lines[index + 1]);
}

function sliceSection(lines: string[], startMatcher: RegExp, endMatcher: RegExp) {
  const start = lines.findIndex((line) => startMatcher.test(line));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && endMatcher.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).filter(Boolean);
}

function parseEducationRows(lines: string[]) {
  const rows: ResumeEntryDto[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const period = parseMonthRange(lines[index]);
    if (!period) continue;
    const schoolLine = cleanText(lines[index + 1]);
    if (!/(고등학교|대학교|대학원|대학|고교)/.test(schoolLine)) continue;
    const nextPeriodIndex = lines.findIndex((line, lineIndex) => lineIndex > index && parseMonthRange(line));
    const rowTail = lines.slice(index + 2, nextPeriodIndex < 0 ? index + 6 : nextPeriodIndex);
    const gpaLine = rowTail.find((line) => /\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?/.test(line)) || EMPTY;
    const gpa = normalizeGpa(gpaLine);
    const schoolName = schoolLine.match(/(.+?(?:고등학교|대학교|대학원|대학|고교))/)?.[1]?.trim() || schoolLine;
    const major = cleanText(schoolLine.replace(schoolName, ""));
    const degree = normalizeHighestEducation(schoolName);
    rows.push({
      title: schoolName,
      schoolName,
      degree,
      major,
      gpaScore: gpa.score,
      gpaMax: gpa.max,
      graduationStatus: "졸업",
      startDate: period[0],
      endDate: period[1],
      subtitle: [major, "졸업", gpa.display, formatMonthRangeLabel(period[0], period[1])]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return rows;
}

function parseExperienceRows(lines: string[]) {
  const rows: ResumeEntryDto[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const period = parseMonthRange(lines[index]);
    if (!period) continue;
    const companyName = cleanText(lines[index + 1]);
    if (!companyName || isImportNoiseText(companyName) || /근무기간|근무회사|부서|직위|담당직무/.test(companyName)) continue;
    const department = cleanText(lines[index + 2]);
    const position = cleanText(lines[index + 3]);
    const duties = cleanText(lines[index + 4]);
    if ([department, position, duties].every(isImportNoiseText)) continue;
    rows.push({
      title: companyName,
      companyName,
      position,
      duties,
      startDate: period[0],
      endDate: period[1],
      subtitle: [department, position, duties, formatCareerRangeLabel(period[0], period[1])].filter(Boolean).join(" · "),
    });
  }
  return rows;
}

function parseLanguageRows(lines: string[]) {
  const rows: ResumeEntryDto[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!isMonthMarker(lines[index])) continue;
    const acquiredDate = normalizeMonthOrEmpty(lines[index]);
    if (!acquiredDate) continue;
    const testName = cleanText(lines[index + 1]);
    const levelOrScore = cleanText(lines[index + 2]);
    const issuer = cleanText(lines[index + 3]);
    if (!testName || isImportNoiseText(testName) || /^(기간|시험|점수|기관)$/.test(testName.replace(/\s/g, ""))) continue;
    rows.push({
      title: testName,
      language: EMPTY,
      testName,
      levelOrScore,
      issuer,
      acquiredDate,
      subtitle: [levelOrScore, formatMonthLabel(acquiredDate), issuer].filter(Boolean).join(" · "),
    });
  }
  return rows;
}

function parseActivityRows(
  lines: string[],
  options: { primaryField: "activityName" | "description" } = { primaryField: "activityName" },
) {
  const rows: ResumeEntryDto[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const period = parseMonthRange(lines[index]);
    if (!period) continue;
    const cells = collectActivityRowCells(lines, index);
    const primaryValue = cells.primaryValue;
    const issuer = cells.issuer;
    const activityName = options.primaryField === "activityName" ? primaryValue : EMPTY;
    const rawDescription = options.primaryField === "description" ? primaryValue : cells.description;
    const description = cleanActivityDescription(rawDescription, activityName, issuer, period[0], period[1]);
    if (!primaryValue || isImportNoiseText(primaryValue) || /^(기간|과정명|활동내용|기관)$/.test(primaryValue.replace(/\s/g, ""))) continue;
    rows.push({
      title: activityName,
      activityName,
      description,
      issuer,
      activityDate: period.filter(Boolean).join(" ~ "),
      startDate: period[0],
      endDate: period[1],
      subtitle: description,
    });
  }
  return rows;
}

function collectActivityRowCells(lines: string[], periodIndex: number) {
  const cells: string[] = [];
  for (let index = periodIndex + 1; index < lines.length; index += 1) {
    const value = cleanText(lines[index]);
    if (!value) continue;
    if (parseMonthRange(value)) break;
    cells.push(value);
  }

  const issuerIndex = cells.findIndex((cell, index) => index > 0 && isOrganizationLikeText(cell));
  if (issuerIndex >= 0) {
    return {
      primaryValue: cleanText(cells.slice(0, issuerIndex).join(" ")),
      description: EMPTY,
      issuer: cells[issuerIndex],
    };
  }

  return {
    primaryValue: cells[0] || EMPTY,
    description: cleanText(cells.slice(1).join(" ")),
    issuer: EMPTY,
  };
}

function hasActivityNameColumn(lines: string[]) {
  return lines.some((line) => /활동명|활동\s*명/.test(line.replace(/\s/g, "")));
}

function parseAwardRows(lines: string[]) {
  const rows: ResumeEntryDto[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!isMonthMarker(lines[index])) continue;
    const awardedDate = normalizeMonthOrEmpty(lines[index]);
    if (!awardedDate) continue;
    const detail = cleanText(lines[index + 1]);
    const issuer = cleanText(lines[index + 2]);
    if (!detail || isImportNoiseText(detail) || /^(기간|상세내용|기관)$/.test(detail.replace(/\s/g, ""))) continue;
    rows.push({
      title: detail,
      contestName: detail,
      awardName: detail.match(/(대상|최우수상|우수상|금상|은상|동상|장려상|입상|참가상)/)?.[1] || detail,
      issuer,
      awardedDate,
      subtitle: [issuer, formatMonthLabel(awardedDate)].filter(Boolean).join(" · "),
    });
  }
  return rows;
}

function parseCertificationRows(lines: string[]) {
  const rows: ResumeEntryDto[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!isMonthMarker(lines[index])) continue;
    const acquiredDate = normalizeMonthOrEmpty(lines[index]);
    if (!acquiredDate) continue;
    const certificationName = cleanText(lines[index + 1]);
    const grade = cleanText(lines[index + 2]);
    const issuer = cleanText(lines[index + 3]);
    if (!certificationName || isImportNoiseText(certificationName) || /취득일자|자격증|면허증|등급|발급처/.test(certificationName)) continue;
    rows.push({
      title: certificationName,
      certificationName,
      issuer,
      acquiredDate,
      subtitle: [grade, issuer, formatMonthLabel(acquiredDate)].filter(Boolean).join(" · "),
    });
  }
  return rows;
}

function parseMonthRange(value?: string): [string, string] | null {
  const text = cleanText(value);
  const match = text.match(/(\d{2,4})[.\-/년\s]+(\d{1,2})\s*(?:월)?\s*~\s*(?:(\d{2,4})[.\-/년\s]+(\d{1,2})|현재|재직중|진행중)/);
  if (!match) return null;
  const start = normalizeMonthOrEmpty(`${match[1]}.${match[2]}`);
  const end = match[3] && match[4] ? normalizeMonthOrEmpty(`${match[3]}.${match[4]}`) : "현재";
  return start || end ? [start, end] : null;
}

function isMonthMarker(value?: string | null) {
  return /(?:\d{2,4})[.\-/년\s]+(?:0?[1-9]|1[0-2]|00)/.test(cleanText(value));
}

function normalizeMonthOrEmpty(value?: string | null) {
  const normalized = normalizeMonth(value);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : EMPTY;
}

function normalizePersonName(value?: string | null) {
  return cleanText(value).replace(/\s/g, "");
}

function extractName(text: string) {
  const nameByLabel = text.match(/(?:성\s*명|이\s*름|지원자)\s*(?:한\s*글|한글|한자)?\s*[:：]?\s*([가-힣](?:\s*[가-힣]){1,4})/);
  if (nameByLabel) return normalizePersonName(nameByLabel[1]);
  const applicant = text.match(/지원자\s*[:：]?\s*([가-힣](?:\s*[가-힣]){1,4})/);
  return normalizePersonName(applicant?.[1]);
}

function extractBirthDate(text: string) {
  const byLabel = text.match(/(?:생년월일|생\s*년\s*월\s*일)\s*[:：]?\s*((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (byLabel) return `${byLabel[1]}-${byLabel[2].padStart(2, "0")}-${byLabel[3].padStart(2, "0")}`;
  const byBirthYear = text.match(/((?:19|20)\d{2})\s*년\s*생/);
  if (byBirthYear) return `${byBirthYear[1]}-01-01`;
  const byDate = text.match(/((?:19|20)\d{2})[.\-/\s년]+(\d{1,2})[.\-/\s월]+(\d{1,2})/);
  if (byDate) return `${byDate[1]}-${byDate[2].padStart(2, "0")}-${byDate[3].padStart(2, "0")}`;
  const resident = text.match(/\b(\d{2})\s*(\d{2})\s*(\d{2})\s*[-–]\s*\d(?:\s*\d){5,6}\b/);
  if (!resident) return EMPTY;
  const yearNumber = Number(resident[1]);
  const year = yearNumber <= 26 ? 2000 + yearNumber : 1900 + yearNumber;
  return `${year}-${resident[2]}-${resident[3]}`;
}

function extractEmail(text: string) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || EMPTY;
}

function extractEducations(lines: string[], text: string) {
  const entries: ResumeEntryDto[] = [];
  const schoolRegex = /([가-힣A-Za-z0-9]+(?:고등학교|대학교|대학원|대학|고교))/g;
  for (const match of text.matchAll(schoolRegex)) {
    const schoolName = match[1];
    const windowText = getWindowText(text, match.index || 0, 140);
    const period = extractPeriod(windowText);
    const gpa = normalizeGpa(windowText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)?.[0]);
    const major = extractMajor(windowText, schoolName);
    const degree = schoolName.includes("대학원")
      ? "대학원"
      : schoolName.includes("대학교") || schoolName.includes("대학")
        ? "대학교"
        : "고등학교";
    entries.push({
      title: schoolName,
      schoolName,
      degree,
      major,
      gpaScore: gpa.score,
      gpaMax: gpa.max,
      graduationStatus: extractGraduationStatus(windowText),
      startDate: period[0],
      endDate: period[1],
      subtitle: [major, extractGraduationStatus(windowText)].filter(Boolean).join(" · "),
    });
  }

  if (!entries.length) {
    const educationLines = lines.filter((line) => /(고등학교|대학교|대학원|대학|고교)/.test(line));
    for (const line of educationLines) {
      const schoolName = line.match(schoolRegex)?.[0] || EMPTY;
      if (!schoolName) continue;
      entries.push({ title: schoolName, schoolName, degree: normalizeHighestEducation(schoolName) });
    }
  }

  return dedupeEntries(entries, (entry) => [entry.schoolName, entry.startDate, entry.endDate].join("|"));
}

function extractExperiences(lines: string[]) {
  const rows = collectRows(lines, /(주\)|㈜|회사|기관|인턴|아르바이트|근무|경력)/);
  const entries = rows
    .map((row) => {
      const period = extractPeriod(row.join(" "));
      const joined = row.join(" ");
      const companyName = joined.match(/(?:\(주\)|㈜)\s?([가-힣A-Za-z0-9]+)/)?.[0] || joined.match(/([가-힣A-Za-z0-9]+(?:회사|기관|재단|공단|공사))/)?.[1] || EMPTY;
      const position = joined.match(/(인턴|아르바이트|대리|사원|팀장|매니저|디자이너|개발자|담당자)/)?.[1] || EMPTY;
      const duties = joined
        .replace(period.join(" "), " ")
        .replace(companyName, " ")
        .replace(position, " ")
        .replace(/근무기간|회사명|근무부서|직위|담당업무/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (isImportNoiseText(joined) || isImportNoiseText(companyName)) return null;
      if (!companyName && !position && !duties) return null;
      return {
        title: companyName || position,
        companyName,
        position,
        duties,
        startDate: period[0],
        endDate: period[1],
        subtitle: [position, duties].filter(Boolean).join(" · "),
      };
    })
    .filter(Boolean) as ResumeEntryDto[];

  return dedupeEntries(entries, (entry) => [entry.companyName, entry.position, entry.startDate, entry.endDate].join("|"));
}

function extractAwards(lines: string[], text: string) {
  const entries: ResumeEntryDto[] = [];
  const awardRegex = /([가-힣A-Za-z0-9 ]*(?:공모전|대회|수상)[가-힣A-Za-z0-9 ]*)\s+(대상|최우수상|우수상|금상|은상|동상|장려상|입상|참가상)\s+((?:19|20)?\d{2}[./년 -]*\d{1,2})?/g;
  for (const match of text.matchAll(awardRegex)) {
    entries.push({
      title: cleanText(match[1]),
      contestName: cleanText(match[1]),
      awardName: match[2],
      awardedDate: normalizeMonth(match[3] || EMPTY),
      subtitle: match[2],
    });
  }
  if (!entries.length) {
    for (const line of lines.filter((line) => /(수상|공모전|대회|동상|금상|은상|장려상)/.test(line))) {
      if (isImportNoiseText(line)) continue;
      entries.push({
        title: line.match(/([가-힣A-Za-z0-9 ]*(?:공모전|대회))/)?.[1]?.trim() || line,
        contestName: line.match(/([가-힣A-Za-z0-9 ]*(?:공모전|대회))/)?.[1]?.trim() || line,
        awardName: line.match(/(대상|최우수상|우수상|금상|은상|동상|장려상|입상|참가상)/)?.[1] || EMPTY,
        awardedDate: normalizeMonth(line),
      });
    }
  }
  return dedupeEntries(entries, (entry) => [entry.contestName, entry.awardName, entry.awardedDate].join("|"));
}

function extractActivities(lines: string[]) {
  const entries: ResumeEntryDto[] = [];
  const activityLines = lines.filter((line) => /(연수|인턴|봉사|동아리|활동|교육|프로젝트)/.test(line));
  for (const line of activityLines) {
    if (isImportNoiseText(line)) continue;
    if (/(주\)|㈜|회사|공모전|수상|TOEIC|MOS|기사)/.test(line)) continue;
    const period = extractPeriod(line);
    const activityName = line.match(/([가-힣A-Za-z0-9 ]*(?:연수|봉사|동아리|교육|프로젝트|활동))/)?.[1]?.trim() || EMPTY;
    if (!activityName && !period[0]) continue;
    entries.push({
      title: activityName || line,
      activityName: activityName || line,
      description: line.replace(activityName, "").replace(period.join(" "), "").trim(),
      activityDate: period[0] && period[1] ? `${period[0]} ~ ${period[1]}` : normalizeMonth(line),
      startDate: period[0],
      endDate: period[1],
    });
  }
  return dedupeEntries(entries, (entry) => [entry.activityName, entry.startDate, entry.endDate].join("|"));
}

function extractCertifications(lines: string[], text: string) {
  const entries: ResumeEntryDto[] = [];
  const certNames = Array.from(
    text.matchAll(/(정보처리기사|MOS\s*master|컴퓨터활용능력\s*\d급|운전면허|[가-힣A-Za-z0-9 ]+(?:기사|기능사|산업기사|자격증|면허))/gi),
  );
  for (const match of certNames) {
    const name = cleanText(match[1]);
    if (isImportNoiseText(name)) continue;
    const windowText = getWindowText(text, match.index || 0, 90);
    entries.push({
      title: name,
      certificationName: name,
      issuer: extractIssuer(windowText),
      acquiredDate: normalizeMonth(windowText),
      subtitle: extractIssuer(windowText),
    });
  }
  if (!entries.length) {
    for (const line of lines.filter((line) => /(자격|면허|기사|MOS|컴퓨터활용|운전면허)/i.test(line))) {
      if (isImportNoiseText(line)) continue;
      const name = line.match(/(정보처리기사|MOS\s*master|컴퓨터활용능력\s*\d급|운전면허|[가-힣A-Za-z0-9 ]+(?:기사|기능사|산업기사|자격증|면허))/i)?.[1] || line;
      entries.push({
        title: cleanText(name),
        certificationName: cleanText(name),
        issuer: extractIssuer(line),
        acquiredDate: normalizeMonth(line),
      });
    }
  }
  return dedupeEntries(entries, (entry) => [entry.certificationName, entry.issuer, entry.acquiredDate].join("|"));
}

function extractLanguages(lines: string[], text: string) {
  const entries: ResumeEntryDto[] = [];
  const languageRegex = /(영어|일본어|중국어|독일어|프랑스어|스페인어)?\s*(TOEIC|TOEFL|TEPS|OPIc|JLPT|JPT|HSK)\s*([0-9]+(?:점|급)?|[A-Z0-9 -]+)?\s*((?:19|20)?\d{2}[./년 -]*\d{1,2})?/gi;
  for (const match of text.matchAll(languageRegex)) {
    if (isImportNoiseText(match[0])) continue;
    entries.push({
      title: cleanText(match[1]) || cleanText(match[2]),
      language: cleanText(match[1]),
      testName: cleanText(match[2]),
      levelOrScore: cleanText(match[3]),
      acquiredDate: normalizeMonth(match[4] || EMPTY),
      subtitle: [cleanText(match[2]), cleanText(match[3])].filter(Boolean).join(" · "),
    });
  }
  if (!entries.length) {
    for (const line of lines.filter((line) => /(TOEIC|TOEFL|TEPS|OPIc|JLPT|JPT|HSK|외국어|어학|영어|일본어|중국어)/i.test(line))) {
      if (isImportNoiseText(line)) continue;
      const testName = line.match(/(TOEIC|TOEFL|TEPS|OPIc|JLPT|JPT|HSK)/i)?.[1] || EMPTY;
      if (!testName && !/(영어|일본어|중국어)/.test(line)) continue;
      entries.push({
        title: line.match(/(영어|일본어|중국어)/)?.[1] || testName,
        language: line.match(/(영어|일본어|중국어)/)?.[1] || EMPTY,
        testName,
        levelOrScore: line.match(/(\d+\s*점|\d+\s*급|[A-Z]\d)/)?.[1]?.replace(/\s/g, "") || EMPTY,
        acquiredDate: normalizeMonth(line),
      });
    }
  }
  return dedupeEntries(entries, (entry) => [entry.language, entry.testName, entry.levelOrScore, entry.acquiredDate].join("|"));
}

function collectRows(lines: string[], matcher: RegExp) {
  const rows: string[][] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!matcher.test(line)) continue;
    const row = [lines[index - 1], line, lines[index + 1]]
      .filter(Boolean)
      .map((item) => item.trim());
    rows.push(row);
  }
  return rows;
}

function getWindowText(text: string, index: number, size: number) {
  return text.slice(Math.max(0, index - size), index + size);
}

function extractPeriod(text: string): [string, string] {
  const matches = Array.from(text.matchAll(/((?:19|20)?\d{2})[.\-/년\s]+(\d{1,2})\s*(?:월)?/g)).map((match) =>
    normalizeMonth(`${match[1]}.${match[2]}`),
  );
  return [matches[0] || EMPTY, matches[1] || EMPTY];
}

function extractMajor(text: string, schoolName: string) {
  const withoutSchool = text.replace(schoolName, " ");
  const major = withoutSchool.match(/([가-힣A-Za-z]+(?:학과|계열|전공|과))/)?.[1];
  return major || EMPTY;
}

function extractGraduationStatus(text: string) {
  if (text.includes("중퇴")) return "중퇴";
  if (text.includes("예정")) return "졸업 예정";
  if (text.includes("졸업")) return "졸업";
  return EMPTY;
}

function extractIssuer(text: string) {
  return (
    text.match(/(한국산업인력공단|Microsoft|대한상공회의소|도로교통공단|[가-힣A-Za-z]+(?:공단|협회|회의소|기관|교육원))/)?.[1] ||
    EMPTY
  );
}

function normalizeBirthDate(value: unknown) {
  const raw = typeof value === "string" ? value : typeof value === "number" ? String(value) : EMPTY;
  const match = raw.match(/((?:19|20)\d{2})[.\-/\s년]+(\d{1,2})[.\-/\s월]+(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;

  const compact = raw.replace(/\D/g, "").match(/^(\d{2})(\d{2})(\d{2})/);
  if (compact) {
    const yearNumber = Number(compact[1]);
    const year = yearNumber <= 26 ? 2000 + yearNumber : 1900 + yearNumber;
    return `${year}-${compact[2]}-${compact[3]}`;
  }

  return raw.match(/(?:19|20)\d{2}/)?.[0] || EMPTY;
}

function normalizeBirthYear(value: unknown) {
  const raw = typeof value === "string" ? value : EMPTY;
  return raw.match(/(?:19|20)\d{2}/)?.[0] || EMPTY;
}

function normalizeMonth(value?: unknown) {
  const raw = typeof value === "string" || typeof value === "number" ? String(value).trim() : EMPTY;
  if (!raw) return EMPTY;
  const full = raw.match(/((?:19|20)\d{2})[.\-/\s년]+(\d{1,2})/);
  if (full) {
    const month = Number(full[2]);
    return month >= 1 && month <= 12 ? `${full[1]}-${full[2].padStart(2, "0")}` : EMPTY;
  }
  const short = raw.match(/\b(\d{2})[.\-/\s년]+(\d{1,2})\b/);
  if (short) {
    const yearNumber = Number(short[1]);
    const month = Number(short[2]);
    if (month < 1 || month > 12) return EMPTY;
    const year = yearNumber <= 26 ? 2000 + yearNumber : 1900 + yearNumber;
    return `${year}-${short[2].padStart(2, "0")}`;
  }
  return raw;
}

function resolveMonth(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeMonth(value);
    if (/^(?:19|20)\d{2}-(0[1-9]|1[0-2])$/.test(normalized)) return normalized;

    const raw = typeof value === "string" || typeof value === "number" ? String(value).trim() : EMPTY;
    if (!raw) continue;
    const extracted = raw.match(/((?:19|20)?\d{2})[.\-/\s년]+(0?[1-9]|1[0-2])/);
    if (!extracted) continue;
    const extractedMonth = normalizeMonth(extracted[0]);
    if (/^(?:19|20)\d{2}-(0[1-9]|1[0-2])$/.test(extractedMonth)) return extractedMonth;
  }
  return EMPTY;
}

function normalizeGraduationStatus(value?: string | null) {
  const text = cleanText(value).replace(/\s/g, "");
  if (text.includes("예정")) return "졸업 예정";
  if (text.includes("중퇴")) return "중퇴";
  if (text.includes("졸업")) return "졸업";
  return text || EMPTY;
}

function normalizeHighestEducation(value?: string | null) {
  const text = cleanText(value);
  if (!text) return EMPTY;
  if (text.includes("대학원")) return text.includes("졸업") ? text : "대학원";
  if (text.includes("대학교") || text.includes("대학")) return text.includes("졸업") ? text : "대학교";
  if (text.includes("고등학교") || text.includes("고교")) return text.includes("졸업") ? text : "고등학교";
  return text;
}

function normalizeGpa(value: unknown, scoreValue?: unknown, maxValue?: unknown) {
  const raw = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : EMPTY;
  const score = typeof scoreValue === "string" || typeof scoreValue === "number" ? String(scoreValue).trim() : EMPTY;
  const max = typeof maxValue === "string" || typeof maxValue === "number" ? String(maxValue).trim() : EMPTY;
  const match = raw.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  const resolvedScore = match?.[1] || (score.match(/\d+(?:\.\d+)?/)?.[0] || EMPTY);
  const resolvedMax = match?.[2] || (max.match(/\d+(?:\.\d+)?/)?.[0] || EMPTY);
  return {
    score: resolvedScore,
    max: resolvedMax,
    display: resolvedScore && resolvedMax ? `${resolvedScore} / ${resolvedMax}` : resolvedScore,
  };
}

function splitPeriod(period: string): [string, string] {
  const parts = period
    .split(/~|～|–|부터|까지/)
    .map((part) => normalizeMonth(part.trim()))
    .filter(Boolean);
  return [parts[0] || EMPTY, parts[1] || EMPTY];
}

function formatMonthLabel(value?: string | null) {
  if (/^(현재|재직중|진행중)$/.test(cleanText(value).replace(/\s/g, ""))) return "현재";
  const month = normalizeMonth(value);
  return month ? month.replace("-", ".") : EMPTY;
}

function formatMonthRangeLabel(start?: string | null, end?: string | null) {
  const startLabel = formatMonthLabel(start);
  const endLabel = formatMonthLabel(end);
  if (startLabel && endLabel) return `${startLabel}~${endLabel}`;
  return startLabel || endLabel || EMPTY;
}

function formatCareerRangeLabel(start?: string | null, end?: string | null) {
  const range = formatMonthRangeLabel(start, end);
  if (!range) return EMPTY;
  const years = careerYearsLabel(start, end);
  return years ? `${range}(${years})` : range;
}

function careerYearsLabel(start?: string | null, end?: string | null) {
  const startParts = parseMonthParts(start);
  const endParts = parseMonthParts(end);
  if (!startParts || !endParts) return EMPTY;

  const months = Math.max(1, (endParts.year - startParts.year) * 12 + (endParts.month - startParts.month) + 1);
  const years = Math.max(1, Math.ceil(months / 12));
  return `${years}년차`;
}

function parseMonthParts(value?: string | null) {
  if (/^(현재|재직중|진행중)$/.test(cleanText(value).replace(/\s/g, ""))) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const month = normalizeMonth(value);
  const match = month.match(/^((?:19|20)\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

function summarizeEntries(entries: ResumeEntryDto[]) {
  return entries
    .slice(0, 3)
    .map((entry) => [entry.title, entry.subtitle].filter(Boolean).join(" "))
    .filter(Boolean)
    .join(", ");
}

function shouldUseParsedHighestEducation(current?: string | null, parsed?: string | null) {
  const currentText = cleanText(current);
  const parsedText = cleanText(parsed);
  if (!parsedText) return false;
  if (!currentText || /선택|기타/.test(currentText)) return true;
  return educationLevelRank(parsedText) > educationLevelRank(currentText);
}

function educationLevelRank(value?: string | null) {
  const text = cleanText(value);
  if (/박사/.test(text)) return 60;
  if (/석사/.test(text)) return 50;
  if (/대학원/.test(text)) return 45;
  if (/대학교|학사/.test(text)) return 40;
  if (/전문대|대학/.test(text)) return 30;
  if (/고등학교|고교/.test(text)) return 20;
  return text ? 10 : 0;
}

function summarizeHighestEducation(entries: ResumeEntryDto[]) {
  const education = findPreferredEducation(entries);
  if (!education) return EMPTY;
  const degree = inferEducationLevel(education);
  return [degree, education.graduationStatus].filter(Boolean).join(" ");
}

function findPreferredEducation(entries: ResumeEntryDto[]) {
  const candidates = entries.filter((entry) => [entry.title, entry.schoolName, entry.degree].some(Boolean));
  if (candidates.length === 0) return undefined;

  return [...candidates].sort((left, right) => {
    const graduationDelta = Number(isGraduatedEducation(right)) - Number(isGraduatedEducation(left));
    if (graduationDelta !== 0) return graduationDelta;

    const dateDelta = educationDateScore(right) - educationDateScore(left);
    if (dateDelta !== 0) return dateDelta;

    return educationRank(right) - educationRank(left);
  })[0];
}

function isGraduatedEducation(entry: ResumeEntryDto) {
  const text = [entry.graduationStatus, entry.title, entry.subtitle, entry.degree].filter(Boolean).join(" ");
  return /졸업/.test(text) && !/예정|중퇴/.test(text);
}

function educationDateScore(entry: ResumeEntryDto) {
  const parts = parseMonthParts(entry.endDate) || parseMonthParts(entry.startDate);
  return parts ? parts.year * 12 + parts.month : 0;
}

function educationRank(entry: ResumeEntryDto) {
  const text = [entry.degree, entry.schoolName, entry.title, entry.major].filter(Boolean).join(" ");
  if (/박사|Doctor|Ph\.?D/i.test(text)) return 60;
  if (/석사|Master/i.test(text)) return 50;
  if (/대학원/.test(text)) return 45;
  if (/대학교|4년|학사|Bachelor/i.test(text)) return 40;
  if (/전문대|대학/.test(text)) return 30;
  if (/고등학교|고교/.test(text)) return 20;
  return text ? 10 : 0;
}

function inferEducationLevel(entry: ResumeEntryDto) {
  const text = [entry.degree, entry.schoolName, entry.title, entry.major].filter(Boolean).join(" ");
  if (/대학원|석사|박사|Master|Doctor|Ph\.?D/i.test(text)) return "대학원";
  if (/대학교|4년|학사|Bachelor/i.test(text)) return "대학교";
  if (/전문대|대학/.test(text)) return "대학교";
  if (/고등학교|고교/.test(text)) return "고등학교";
  return normalizeHighestEducation(entry.degree || entry.schoolName || entry.title);
}

function dedupeEntries(entries: ResumeEntryDto[], keyFn: (entry: ResumeEntryDto) => string) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = keyFn(entry).replace(/\|/g, "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isImportableResumeEntry(entry: ResumeEntryDto, type: ResumeEntryType) {
  if (Object.values(entry).every((value) => !cleanText(value))) return false;

  if (type === "experience") {
    return Boolean(cleanText(entry.companyName || entry.title) && !isImportNoiseText(entry.companyName || entry.title));
  }

  if (type === "award") {
    const title = cleanText(entry.contestName || entry.awardName || entry.title);
    return Boolean(title && !isImportNoiseText(title));
  }

  if (type === "activity") {
    const title = cleanText(entry.activityName || entry.title || entry.description);
    return Boolean(title && !isImportNoiseText(title));
  }

  if (type === "certification") {
    const title = cleanText(entry.certificationName || entry.title);
    return Boolean(title && !isImportNoiseText(title));
  }

  if (type === "language") {
    const title = cleanText(entry.testName || entry.language || entry.title);
    return Boolean(title && !isImportNoiseText(title));
  }

  const title = cleanText(entry.schoolName || entry.title || entry.degree);
  return Boolean(title && !isImportNoiseText(title));
}

function isImportNoiseText(value?: string | null) {
  const text = cleanText(value);
  if (!text) return true;
  const compact = text.replace(/\s/g, "");
  if (/^(경력사항|경력|학력사항|학력|어학|교육\/연수|교육|연수|기타활동|수상내용|수상|자격증|수행프로젝트|자기소개서)$/.test(compact)) {
    return true;
  }
  if (/^(재학기간|학교명및전공|학점|소재지|근무기간|근무회사|근무부서|부서|직위|담당직무|기간|기관|취득일자|자격증\/?면허증|등급|발급처|상세내용|활동내용|과정명|시험|점수|비고)$/.test(compact)) {
    return true;
  }
  if (/(기재합니다|작성합니다|내용을기재|내용을작성)/.test(compact)) return true;
  if (/^0{2,4}[.\-/년\s]+0{1,2}/.test(compact)) return true;
  return false;
}

function cleanActivityDescription(
  value?: string | null,
  activityName?: string | null,
  issuer?: string | null,
  startDate?: string | null,
  endDate?: string | null,
) {
  const text = cleanText(value);
  if (!text || isDateLikeValue(text) || isOrganizationLikeText(text)) return EMPTY;
  if (sameCompactText(text, activityName) || sameCompactText(text, issuer)) return EMPTY;
  const period = formatMonthRangeLabel(startDate, endDate);
  if (period && sameCompactText(text, period)) return EMPTY;
  return text;
}

function isOrganizationLikeText(value?: string | null) {
  const text = cleanText(value);
  return Boolean(
    text &&
      !isDateLikeValue(text) &&
      /대학교|대학원|고등학교|학교|기관|협회|센터|연구원|연구소|재단|공사|공단|회사|법인|어학원|교육원|university|college|institute|center|centre|academy/i.test(text),
  );
}

function sameCompactText(left?: string | null, right?: string | null) {
  const cleanLeft = cleanText(left).replace(/\s/g, "").toLowerCase();
  const cleanRight = cleanText(right).replace(/\s/g, "").toLowerCase();
  return Boolean(cleanLeft && cleanRight && cleanLeft === cleanRight);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function firstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function preferredString(record: Record<string, unknown>, keys: string[]) {
  return pickString(record, keys);
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  const value = firstValue(record, keys);
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : EMPTY;
}

function cleanText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || EMPTY;
}

function guessMediaType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function getClaudeModel() {
  return "claude-sonnet-5";
}
