"use client";

import { useRouter } from "next/navigation";
import {
  ChangeEvent,
  FormEvent,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ko } from "date-fns/locale";
import { JobFooter, JobHeader } from "@/features/jobs/components/JobChrome";
import { createResume, getResume, getResumeParseJob, updateResume, uploadResumeFile } from "../my.api";
import type { ResumeEntryDto, ResumePayloadDto } from "../my.dto";
import styles from "./My.module.css";

registerLocale("ko", ko);

const emptyPayload: ResumePayloadDto = {
  title: "",
  sourceType: "manual",
  fileId: null,
  name: "",
  birthYear: "",
  birthDate: "",
  email: "",
  desiredJob: "",
  highestEducation: "",
  gpa: "",
  gpaScore: "",
  gpaMax: "",
  schoolMajor: "",
  graduationStatus: "",
  educationStartDate: "",
  educationEndDate: "",
  educationSummary: "",
  careerSummary: "",
  certificationSummary: "",
  educations: [],
  experiences: [],
  certifications: [],
  awards: [],
  activities: [],
  languages: [],
};

function createEmptyPayload(sourceType: "upload" | "manual"): ResumePayloadDto {
  return { ...emptyPayload, sourceType };
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const RESUME_ACCEPT_EXTENSIONS = [
  ".hwp",
  ".hwpx",
  ".hwt",
  ".hml",
  ".pdf",
  ".doc",
  ".docx",
  ".docm",
  ".dot",
  ".dotx",
  ".dotm",
  ".rtf",
];
const RESUME_ACCEPT = RESUME_ACCEPT_EXTENSIONS.join(",");
const RESUME_ACCEPT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/vnd.ms-word.template.macroEnabled.12",
  "application/rtf",
  "text/rtf",
  "application/x-hwp",
  "application/vnd.hancom.hwp",
  "application/vnd.hancom.hwpx",
];
const RESUME_FILE_PICKER_TYPES = [
  {
    description: "이력서 문서",
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc", ".dot"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-word.document.macroEnabled.12": [".docm"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.template": [".dotx"],
      "application/vnd.ms-word.template.macroEnabled.12": [".dotm"],
      "application/rtf": [".rtf"],
      "application/x-hwp": [".hwp", ".hwt", ".hml"],
      "application/vnd.hancom.hwp": [".hwp"],
      "application/vnd.hancom.hwpx": [".hwpx"],
    },
  },
];
const ACCEPTED_UPLOAD_EXTENSIONS = new Set([
  "hwp",
  "hwpx",
  "hwt",
  "hml",
  "pdf",
  "doc",
  "docx",
  "docm",
  "dot",
  "dotx",
  "dotm",
  "rtf",
]);
const ACCEPTED_UPLOAD_MIME_TYPES = new Set(RESUME_ACCEPT_MIME_TYPES);

type ResumeFilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: typeof RESUME_FILE_PICKER_TYPES;
  }) => Promise<Array<{ getFile: () => Promise<File> }>>;
};

const JOB_CATEGORIES = [
  "건설",
  "경비·청소",
  "경영·회계·사무",
  "교육·자연·사회과학",
  "금융·보험",
  "기계",
  "농림어업",
  "문화·예술·디자인·방송",
  "법률·경찰·소방·교도·국방",
  "보건·의료",
  "사업관리",
  "사회복지·종교",
  "섬유·의복",
  "식품가공",
  "연구",
  "영업·판매",
  "운전·운송",
  "음식서비스",
  "이용·숙박·여행·오락·스포츠",
  "인쇄·목재·가구·공예",
  "재료",
  "전기·전자",
  "정보통신",
  "화학",
  "환경·에너지·안전",
];
const GPA_MAX_OPTIONS = ["4.5", "4.3", "4.0", "100"];

type EntryModalState =
  | { type: "experience"; draft: ResumeEntryDto; index?: number }
  | { type: "certification"; draft: ResumeEntryDto; index?: number }
  | { type: "award"; draft: ResumeEntryDto; index?: number }
  | { type: "activity"; draft: ResumeEntryDto; index?: number }
  | { type: "language"; draft: ResumeEntryDto; index?: number }
  | null;

type PickerMode = "date" | "month";

export function MyResumeForm({
  mode,
  resumeId,
}: {
  mode: "new" | "edit";
  resumeId?: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [tab, setTab] = useState<"upload" | "manual">("upload");
  const [tabPayloads, setTabPayloads] = useState({
    upload: createEmptyPayload("upload"),
    manual: createEmptyPayload("manual"),
  });
  const [payload, setPayload] = useState<ResumePayloadDto>(createEmptyPayload("upload"));
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size?: number } | null>(null);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [entryModal, setEntryModal] = useState<EntryModalState>(null);
  const [isJobPickerOpen, setIsJobPickerOpen] = useState(false);
  const [jobDraft, setJobDraft] = useState<string[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parseJobMessage, setParseJobMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !resumeId) return;

    getResume(resumeId).then((response) => {
      const sourceType = response.resume.sourceType || "manual";
      const loadedPayload = {
        ...emptyPayload,
        ...response.resume,
        sourceType,
      };
      setPayload(loadedPayload);
      setTabPayloads((current) => ({
        ...current,
        [sourceType]: loadedPayload,
      }));
      setTab(sourceType);
      setUploadedFile(
        sourceType === "upload" && response.resume.file
          ? {
              name: response.resume.file.originalFilename,
              size: response.resume.file.sizeBytes || undefined,
            }
          : null,
      );
      setPendingUploadFile(null);
    });
  }, [mode, resumeId]);

  useEffect(() => {
    if (tab !== "upload") return;

    const preventFileOpen = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types || []).includes("Files")) {
        event.preventDefault();
      }
    };

    window.addEventListener("dragover", preventFileOpen);
    window.addEventListener("drop", preventFileOpen);
    return () => {
      window.removeEventListener("dragover", preventFileOpen);
      window.removeEventListener("drop", preventFileOpen);
    };
  }, [mode, tab]);

  const completionPercent = useMemo(() => calculateCompletion(payload), [payload]);
  const selectedJobs = useMemo(() => parseDesiredJobs(payload.desiredJob), [payload.desiredJob]);

  const replacePayload = (nextPayloadOrUpdater: ResumePayloadDto | ((current: ResumePayloadDto) => ResumePayloadDto)) => {
    setPayload((current) => {
      const nextPayload = typeof nextPayloadOrUpdater === "function"
        ? nextPayloadOrUpdater(current)
        : nextPayloadOrUpdater;
      setTabPayloads((drafts) => ({ ...drafts, [tab]: nextPayload }));
      return nextPayload;
    });
  };

  const patchPayload = (partial: Partial<ResumePayloadDto>) => {
    replacePayload((current) => ({ ...current, ...partial }));
  };

  const switchTab = (nextTab: "upload" | "manual") => {
    if (nextTab === tab) return;

    const saved = { ...tabPayloads, [tab]: payload };
    setTabPayloads(saved);
    setPayload(saved[nextTab]);
    setTab(nextTab);
    setParseJobMessage(null);
  };

  const handleUploadFile = async (file: File) => {
    if (!file) return;

    setError(null);
    if (!isAcceptedResumeFile(file)) {
      setError("한글(HWP/HWPX/HWT/HML), PDF, Word(DOC/DOCX/DOCM/DOT/DOTX/DOTM/RTF) 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("10MB 이하 파일만 업로드할 수 있습니다.");
      return;
    }

    setIsUploading(true);
    setParseJobMessage("AI가 이력서를 분석하고 있어요.");
    setPendingUploadFile(null);
    try {
      const response = await uploadResumeFile(file);
      setUploadedFile({ name: file.name, size: file.size });
      setPendingUploadFile(file);
      const nextPayload = toUploadPayload(response.extracted, response.file.id);
      replacePayload((current) => mergeUploadPayload(current, nextPayload));
      setParseJobMessage("분석이 완료됐어요. 저장하기를 누르면 파일이 보관됩니다.");

      if (response.job?.id && response.job.status !== "completed") {
        const parsedPayload = await waitForParseJob(response.job.id, response.file.id);
        if (parsedPayload) {
          replacePayload((current) => mergeUploadPayload(current, parsedPayload));
        }
      }
      setParseJobMessage("분석이 완료됐어요. 저장하기를 누르면 파일이 보관됩니다.");
    } catch (uploadError) {
      setPendingUploadFile(null);
      setError(uploadError instanceof Error ? uploadError.message : "이력서 업로드에 실패했습니다.");
      setParseJobMessage(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleUploadFile(file);
    }
    event.target.value = "";
  };

  const openResumeFilePicker = async () => {
    setError(null);
    const picker = (window as ResumeFilePickerWindow).showOpenFilePicker;
    if (picker) {
      try {
        const [handle] = await picker({
          multiple: false,
          excludeAcceptAllOption: true,
          types: RESUME_FILE_PICKER_TYPES,
        });
        const file = await handle?.getFile();
        if (file) {
          await handleUploadFile(file);
        }
        return;
      } catch (pickerError) {
        if (pickerError instanceof DOMException && pickerError.name === "AbortError") {
          return;
        }
      }
    }

    fileInputRef.current?.click();
  };

  const handleDrop = async (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleUploadFile(file);
    }
  };

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    if (!cleanText(payload.title)) {
      setError("이력서 제목을 입력해 주세요.");
      setIsSaving(false);
      return;
    }

    const cleaned = cleanPayload({
      ...payload,
      sourceType: payload.sourceType || (tab === "upload" ? "upload" : "manual"),
      completionPercent,
    });

    try {
      const fileToUpload = cleaned.sourceType === "upload" ? pendingUploadFile : null;
      if (mode === "edit" && resumeId) {
        await updateResume(resumeId, cleaned, fileToUpload);
      } else {
        await createResume(cleaned, fileToUpload);
      }
      router.push("/my/resumes");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "이력서 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const addEntry = () => {
    if (!entryModal) return;
    const cleaned = cleanEntry(entryModal.draft, entryModal.type);
    if (!hasEntryContent(cleaned, entryModal.type)) {
      setEntryModal(null);
      return;
    }

    updateEntryList(entryModal.type, (entries) =>
      typeof entryModal.index === "number"
        ? replaceAt(entries, entryModal.index, cleaned)
        : [...entries, cleaned],
    );
    setEntryModal(null);
  };

  const updateEntryList = (
    type: Exclude<EntryModalState, null>["type"],
    updater: (entries: ResumeEntryDto[]) => ResumeEntryDto[],
  ) => {
    if (type === "experience") {
      patchPayload({ experiences: updater(payload.experiences || []) });
    } else if (type === "certification") {
      patchPayload({ certifications: updater(payload.certifications || []) });
    } else if (type === "award") {
      patchPayload({ awards: updater(payload.awards || []) });
    } else if (type === "activity") {
      patchPayload({ activities: updater(payload.activities || []) });
    } else {
      patchPayload({ languages: updater(payload.languages || []) });
    }
  };

  const openEntryEditor = (
    type: Exclude<EntryModalState, null>["type"],
    entry: ResumeEntryDto,
    index: number,
  ) => {
    setEntryModal({ type, draft: normalizeEntryLabels(cleanEntry(entry), type), index });
  };

  const reorderEntries = (
    type: Exclude<EntryModalState, null>["type"],
    fromIndex: number,
    toIndex: number,
  ) => {
    updateEntryList(type, (entries) => moveEntry(entries, fromIndex, toIndex));
  };

  const hasOtherCurrentExperience = (editingIndex?: number) =>
    (payload.experiences || []).some((entry, index) =>
      index !== editingIndex && isCurrentEndDate(entry.endDate),
    );

  const toggleCurrentExperience = (checked: boolean) => {
    if (!entryModal || entryModal.type !== "experience") return;
    if (checked && hasOtherCurrentExperience(entryModal.index)) {
      window.alert("이미 근무 중인 데이터가 존재합니다.");
      return;
    }

    setEntryModal({
      ...entryModal,
      draft: {
        ...entryModal.draft,
        endDate: checked ? "현재" : "",
      },
    });
  };

  return (
    <div className={`${styles.page} ${styles.resumeFormPage}`}>
      <JobHeader />
      <main className={`${styles.frame} ${styles.resumeFormFrame}`}>
        <h1 className={styles.title}>내 이력서 관리</h1>
        <p className={styles.subtitle}>이력서를 채워두면 Ai 도구 분석에 유용합니다.</p>

        {(mode === "new" || mode === "edit") ? (
          <div className={styles.tabs} role="tablist">
            <button
              type="button"
              className={`${styles.tab} ${tab === "upload" ? styles.tabActive : ""}`}
              onClick={() => {
                switchTab("upload");
              }}
            >
              이력서 업로드
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === "manual" ? styles.tabActive : ""}`}
              onClick={() => {
                switchTab("manual");
              }}
            >
              직접 입력
            </button>
          </div>
        ) : null}

        {error ? <div className={styles.error}>{error}</div> : null}

        <form className={styles.form} onSubmit={handleSubmit}>
          {tab === "upload" ? (
            <>
              <input ref={fileInputRef} hidden type="file" accept={RESUME_ACCEPT} multiple={false} onChange={handleUpload} />
              {uploadedFile ? (
                <div className={styles.uploadFile}>
                  <span className={styles.fileSheetIcon} aria-hidden="true" />
                  <span className={styles.uploadFileName}>
                    <strong>{uploadedFile.name}</strong>
                    <span>{formatBytes(uploadedFile.size)} · 방금 첨부</span>
                  </span>
                  <button type="button" className={styles.smallButton} onClick={openResumeFilePicker}>
                    다시 첨부하기
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${styles.uploadDropzone} ${isDragActive ? styles.uploadDropzoneActive : ""}`}
                  onClick={openResumeFilePicker}
                  onDragEnter={handleDragOver}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <span className={styles.fileSheetIcon} aria-hidden="true" />
                  <strong>{isUploading ? "분석 중입니다..." : "파일을 선택하거나 여기에 끌어다 놓으세요"}</strong>
                  <span>HWP · HWPX · PDF · DOC · DOCX (최대 10MB)</span>
                </button>
              )}
              {parseJobMessage ? <p className={styles.uploadStatus}>{parseJobMessage}</p> : null}
            </>
          ) : null}

          {(mode === "edit" || tab === "manual" || payload.fileId) ? (
            <>
              <CompletionCard percent={completionPercent} />
              <TextField label="이력서 제목" value={payload.title} placeholder="이력서 제목을 입력하세요." onChange={(title) => patchPayload({ title })} />

              <h2 className={styles.resumeSectionTitle}>기본 정보</h2>
              <TextField label="이름" value={payload.name || ""} placeholder="이름을 입력하세요." onChange={(name) => patchPayload({ name })} />
              <DatePickerField label="생년월일" value={payload.birthDate || ""} placeholder="연도-월-일" onChange={(birthDate) => patchPayload({ birthDate, birthYear: birthDate.slice(0, 4) })} />
              <div className={styles.fieldGroup}>
                <label>희망 직무·분야</label>
                <button
                  type="button"
                  className={`${styles.input} ${styles.inputButton}`}
                  onClick={() => {
                    setJobDraft(selectedJobs);
                    setIsJobPickerOpen(true);
                  }}
                >
                  <span className={selectedJobs.length ? "" : styles.placeholder}>
                    {selectedJobs.length ? formatSelectedJobLabel(selectedJobs) : "희망 직무·분야를 선택하세요."}
                  </span>
                  <span aria-hidden="true">›</span>
                </button>
              </div>

              <div className={styles.formSectionHeader}>
                <h2>학력</h2>
              </div>
              <SelectField
                label="최종 학력"
                value={normalizeHighestEducationValue(
                  payload.highestEducation || formatHighestEducationFromEntry(selectPreferredEducation(payload.educations)),
                )}
                onChange={(highestEducation) => patchPayload({ highestEducation })}
                options={["", "고등학교", "대학교", "대학원", "기타"]}
              />
              <div className={styles.fieldGroup}>
                <label>학점</label>
                <div className={styles.gpaFields}>
                  <input
                    className={styles.input}
                    value={payload.gpaScore || ""}
                    placeholder="예: 3.7"
                    onChange={(event) => {
                      const gpaScore = event.target.value;
                      patchPayload({ gpaScore, gpa: [gpaScore, payload.gpaMax || ""].filter(Boolean).join(" / ") });
                    }}
                  />
                  <select
                    className={styles.select}
                    value={payload.gpaMax || ""}
                    onChange={(event) => {
                      const gpaMax = event.target.value;
                      patchPayload({ gpaMax, gpa: [payload.gpaScore || "", gpaMax].filter(Boolean).join(" / ") });
                    }}
                  >
                    <option value="">최대 학점</option>
                    {GPA_MAX_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>
              </div>
              <TextField label="학교·전공 (선택)" value={payload.schoolMajor || ""} placeholder="예: OO대학교 전기공학과" onChange={(schoolMajor) => patchPayload({ schoolMajor })} />
              <SelectField label="졸업 여부" value={payload.graduationStatus || ""} onChange={(graduationStatus) => patchPayload({ graduationStatus })} options={["졸업", "졸업 예정", "중퇴"]} />
              <DateRangeField
                startLabel="입학년월"
                endLabel="졸업년월"
                startValue={payload.educationStartDate || ""}
                endValue={payload.educationEndDate || ""}
                type="month"
                onStartChange={(educationStartDate) => patchPayload({ educationStartDate })}
                onEndChange={(educationEndDate) => patchPayload({ educationEndDate })}
              />

              <EntryEditor
                kind="experience"
                title="경력"
                entries={payload.experiences || []}
                emptyText="경력을 추가하면 직무 적합성 분석에 반영돼요."
                onAdd={() => setEntryModal({ type: "experience", draft: {} })}
                onEdit={(entry, index) => openEntryEditor("experience", entry, index)}
                onRemove={(index) => updateEntryList("experience", (entries) => removeAt(entries, index))}
                onReorder={(fromIndex, toIndex) => reorderEntries("experience", fromIndex, toIndex)}
              />
              <EntryEditor
                kind="award"
                title="수상"
                entries={payload.awards || []}
                emptyText="수상 경력을 추가해보세요."
                onAdd={() => setEntryModal({ type: "award", draft: {} })}
                onEdit={(entry, index) => openEntryEditor("award", entry, index)}
                onRemove={(index) => updateEntryList("award", (entries) => removeAt(entries, index))}
                onReorder={(fromIndex, toIndex) => reorderEntries("award", fromIndex, toIndex)}
              />
              <EntryEditor
                kind="activity"
                title="활동"
                entries={payload.activities || []}
                emptyText="활동 경험을 추가해보세요."
                onAdd={() => setEntryModal({ type: "activity", draft: {} })}
                onEdit={(entry, index) => openEntryEditor("activity", entry, index)}
                onRemove={(index) => updateEntryList("activity", (entries) => removeAt(entries, index))}
                onReorder={(fromIndex, toIndex) => reorderEntries("activity", fromIndex, toIndex)}
              />
              <EntryEditor
                kind="certification"
                title="자격증"
                entries={payload.certifications || []}
                emptyText="자격증을 추가해보세요. (예: 전기기능사, 소방설비기사)"
                onAdd={() => setEntryModal({ type: "certification", draft: {} })}
                onEdit={(entry, index) => openEntryEditor("certification", entry, index)}
                onRemove={(index) => updateEntryList("certification", (entries) => removeAt(entries, index))}
                onReorder={(fromIndex, toIndex) => reorderEntries("certification", fromIndex, toIndex)}
              />
              <EntryEditor
                kind="language"
                title="어학"
                entries={payload.languages || []}
                emptyText="어학 정보를 추가해보세요."
                onAdd={() => setEntryModal({ type: "language", draft: {} })}
                onEdit={(entry, index) => openEntryEditor("language", entry, index)}
                onRemove={(index) => updateEntryList("language", (entries) => removeAt(entries, index))}
                onReorder={(fromIndex, toIndex) => reorderEntries("language", fromIndex, toIndex)}
              />

              <button type="submit" className={`${styles.primaryButton} ${styles.saveButton}`} disabled={isSaving || isUploading}>
                {isSaving ? "저장 중..." : "저장하기"}
              </button>
            </>
          ) : (
            <button type="submit" className={`${styles.ghostButton} ${styles.saveButton}`} disabled>
              저장하기
            </button>
          )}
        </form>
      </main>
      <JobFooter active="my" />

      {entryModal ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h2>{entryModal.type === "experience" ? "경력" : entryModal.type === "certification" ? "자격증" : entryModal.type === "award" ? "수상" : entryModal.type === "activity" ? "활동" : "어학"}</h2>
            {entryModal.type === "experience" ? (
              <>
                <TextField label="회사·기관명" value={entryModal.draft.companyName || entryModal.draft.title || ""} placeholder="회사·기관명을 입력하세요." onChange={(companyName) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, companyName, title: companyName } })} />
                <TextField label="직위" value={entryModal.draft.position || ""} placeholder="직위를 입력하세요." onChange={(position) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, position } })} />
                <TextField label="담당 업무" value={entryModal.draft.duties || entryModal.draft.subtitle || ""} placeholder="담당 업무를 입력하세요." onChange={(duties) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, duties, subtitle: duties } })} />
                <DateRangeField
                  label="근무 기간"
                  labelAddon={(
                    <label className={styles.inlineCheckbox}>
                      <input
                        type="checkbox"
                        checked={isCurrentEndDate(entryModal.draft.endDate)}
                        onChange={(event) => toggleCurrentExperience(event.target.checked)}
                      />
                      <span>근무 중</span>
                    </label>
                  )}
                  startLabel="근무 시작일"
                  endLabel="근무 종료일"
                  startValue={entryModal.draft.startDate || ""}
                  endValue={entryModal.draft.endDate || ""}
                  onStartChange={(startDate) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, startDate } })}
                  onEndChange={(endDate) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, endDate } })}
                  endDisabled={isCurrentEndDate(entryModal.draft.endDate)}
                  endDisplayValue={isCurrentEndDate(entryModal.draft.endDate) ? "현재" : undefined}
                />
              </>
            ) : entryModal.type === "certification" ? (
              <>
                <TextField label="자격증명" value={entryModal.draft.certificationName || entryModal.draft.title || ""} placeholder="자격증명을 입력하세요." onChange={(certificationName) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, certificationName, title: certificationName } })} />
                <TextField label="발급기관" value={entryModal.draft.issuer || entryModal.draft.subtitle || ""} placeholder="발급기관을 입력하세요." onChange={(issuer) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, issuer, subtitle: issuer } })} />
                <DatePickerField label="취득일" value={entryModal.draft.acquiredDate || entryModal.draft.startDate || ""} onChange={(acquiredDate) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, acquiredDate, startDate: acquiredDate } })} />
              </>
            ) : entryModal.type === "award" ? (
              <>
                <TextField label="공모전명" value={entryModal.draft.contestName || ""} placeholder="공모전명을 입력하세요." onChange={(contestName) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, contestName, title: contestName } })} />
                <TextField label="수상명" value={entryModal.draft.awardName || ""} placeholder="수상명을 입력하세요." onChange={(awardName) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, awardName, subtitle: awardName } })} />
                <TextField label="수상기관" value={entryModal.draft.issuer || ""} placeholder="수상기관을 입력하세요." onChange={(issuer) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, issuer } })} />
                <DatePickerField label="수상 일자" value={entryModal.draft.awardedDate || ""} onChange={(awardedDate) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, awardedDate, startDate: awardedDate } })} />
              </>
            ) : entryModal.type === "activity" ? (
              <>
                <TextField label="활동명" value={entryModal.draft.activityName || ""} placeholder="활동명을 입력하세요." onChange={(activityName) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, activityName, title: activityName } })} />
                <TextField label="활동 내용" value={entryModal.draft.description || ""} placeholder="활동 내용을 입력하세요." onChange={(description) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, description, subtitle: description } })} />
                <TextField label="활동기관" value={entryModal.draft.issuer || ""} placeholder="활동기관을 입력하세요." onChange={(issuer) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, issuer } })} />
                <DateRangeField
                  label="활동 기간"
                  startLabel="활동 시작일"
                  endLabel="활동 종료일"
                  startValue={entryModal.draft.startDate || entryModal.draft.activityDate || ""}
                  endValue={entryModal.draft.endDate || ""}
                  type="month"
                  onStartChange={(startDate) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, startDate, activityDate: startDate } })}
                  onEndChange={(endDate) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, endDate } })}
                />
              </>
            ) : (
              <>
                <TextField label="어학시험명" value={entryModal.draft.testName || ""} placeholder="예: JLPT" onChange={(testName) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, testName } })} />
                <TextField label="발급기관" value={entryModal.draft.issuer || ""} placeholder="발급기관을 입력하세요." onChange={(issuer) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, issuer } })} />
                <TextField label="어학시험 급수or점수" value={entryModal.draft.levelOrScore || ""} placeholder="어학시험 급수or점수를 입력하세요." onChange={(levelOrScore) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, levelOrScore } })} />
                <DatePickerField label="취득일" value={entryModal.draft.acquiredDate || ""} onChange={(acquiredDate) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, acquiredDate, startDate: acquiredDate } })} />
                <TextField label="언어" value={entryModal.draft.language || ""} placeholder="언어를 입력하세요." onChange={(language) => setEntryModal({ ...entryModal, draft: { ...entryModal.draft, language } })} />
              </>
            )}
            <div className={styles.modalButtonStack}>
              <button type="button" className={styles.primaryButton} onClick={addEntry}>저장</button>
              <button type="button" className={styles.ghostButton} onClick={() => setEntryModal(null)}>닫기</button>
            </div>
          </div>
        </div>
      ) : null}

      {isJobPickerOpen ? (
        <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-labelledby="job-picker-title">
          <div className={`${styles.modal} ${styles.jobPickerModal}`}>
            <h2 id="job-picker-title">희망 직무·분야</h2>
            <p className={styles.modalHint}>관심 있는 직무·분야를 선택해 주세요.</p>
            <div className={styles.jobChecklist}>
              {JOB_CATEGORIES.map((job) => (
                <label key={job} className={styles.jobCheckItem}>
                  <input
                    type="checkbox"
                    checked={jobDraft.includes(job)}
                    onChange={(event) => setJobDraft((current) => event.target.checked ? [...current, job] : current.filter((item) => item !== job))}
                  />
                  <span>{job}</span>
                </label>
              ))}
            </div>
            <div className={styles.modalButtonStack}>
              <button type="button" className={styles.primaryButton} onClick={() => { patchPayload({ desiredJob: jobDraft.join(", ") }); setIsJobPickerOpen(false); }}>선택하기</button>
              <button type="button" className={styles.ghostButton} onClick={() => setIsJobPickerOpen(false)}>닫기</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.fieldGroup}>
      <label>{label}</label>
      <input className={styles.input} type="text" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function DatePickerField({
  label,
  value,
  placeholder = "연도-월-일",
  type = "date",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: PickerMode;
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.fieldGroup}>
      <label>{label}</label>
      <DatePickerControl
        ariaLabel={label}
        value={value}
        placeholder={placeholder}
        type={type}
        onChange={onChange}
      />
    </div>
  );
}

function DateRangeField({
  label,
  labelAddon,
  startLabel,
  endLabel,
  startValue,
  endValue,
  type = "date",
  onStartChange,
  onEndChange,
  endDisabled = false,
  endDisplayValue,
}: {
  label?: string;
  labelAddon?: ReactNode;
  startLabel: string;
  endLabel: string;
  startValue: string;
  endValue: string;
  type?: PickerMode;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  endDisabled?: boolean;
  endDisplayValue?: string;
}) {
  return (
    <div className={styles.fieldGroup}>
      {labelAddon ? (
        <div className={styles.fieldLabelRow}>
          <label>{label || `${startLabel} ~ ${endLabel}`}</label>
          {labelAddon}
        </div>
      ) : (
        <label>{label || `${startLabel} ~ ${endLabel}`}</label>
      )}
      <div className={styles.dateRangeInput}>
        <DatePickerControl
          ariaLabel={startLabel}
          value={startValue}
          placeholder={type === "month" ? "YYYY-MM" : "YYYY-MM-DD"}
          type={type}
          compact
          onChange={onStartChange}
        />
        <span className={styles.dateRangeSeparator} aria-hidden="true">~</span>
        <DatePickerControl
          ariaLabel={endLabel}
          value={endValue}
          placeholder={type === "month" ? "YYYY-MM" : "YYYY-MM-DD"}
          type={type}
          compact
          disabled={endDisabled}
          displayValue={endDisplayValue}
          onChange={onEndChange}
        />
      </div>
    </div>
  );
}

function DatePickerControl({
  ariaLabel,
  value,
  placeholder,
  type = "date",
  compact = false,
  disabled = false,
  displayValue,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  placeholder: string;
  type?: PickerMode;
  compact?: boolean;
  disabled?: boolean;
  displayValue?: string;
  onChange: (value: string) => void;
}) {
  const selected = parsePickerDate(value, type);

  return (
    <div className={`${styles.datePickerControl} ${compact ? styles.datePickerControlCompact : ""} ${disabled ? styles.datePickerControlDisabled : ""}`}>
      <DatePicker
        aria-label={ariaLabel}
        selected={selected}
        disabled={disabled}
        locale="ko"
        dateFormat={type === "month" ? "yyyy.MM" : "yyyy.MM.dd"}
        showMonthYearPicker={type === "month"}
        showYearDropdown={type === "date"}
        showMonthDropdown={type === "date"}
        dropdownMode="select"
        showPopperArrow={false}
        customInput={<DatePickerButton ariaLabel={ariaLabel} placeholder={placeholder} disabled={disabled} displayValue={displayValue} />}
        portalId="datepicker-root"
        enableTabLoop={false}
        shouldCloseOnSelect
        placeholderText={placeholder}
        wrapperClassName={styles.datePickerWrapper}
        calendarClassName={styles.datePickerCalendar}
        popperClassName={styles.datePickerPopper}
        popperPlacement="bottom-end"
        openToDate={selected || new Date()}
        onChange={(date: Date | null) => {
          if (disabled) return;
          onChange(formatPickerDate(date, type));
        }}
      />
      <span className={styles.dateRangeCalendar} aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M7 2v3M17 2v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

const DatePickerButton = forwardRef<
  HTMLButtonElement,
  {
    value?: string;
    onClick?: () => void;
    placeholder?: string;
    ariaLabel: string;
    disabled?: boolean;
    displayValue?: string;
  }
>(({ value, onClick, placeholder, ariaLabel, disabled = false, displayValue }, ref) => (
  <button
    ref={ref}
    type="button"
    className={styles.datePickerInput}
    onClick={onClick}
    aria-label={ariaLabel}
    disabled={disabled}
  >
    <span className={!(displayValue || value) ? styles.datePickerPlaceholder : undefined}>
      {displayValue || value || placeholder}
    </span>
  </button>
));

DatePickerButton.displayName = "DatePickerButton";

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className={styles.fieldGroup}>
      <label>{label}</label>
      <select className={styles.select} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">선택</option>
        {options.filter(Boolean).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

function CompletionCard({ percent }: { percent: number }) {
  return (
    <div className={styles.completionCard}>
      <div className={styles.completionHeader}>
        <span>이력서 완성도</span>
        <strong>{percent}%</strong>
      </div>
      <div className={styles.progressTrack}>
        <div className={styles.progressBar} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.completionHint}>
        {percent >= 100 ? "이력서를 모두 채웠어요! 코칭 정확도가 높아져요 🎉" : "기본 정보와 희망 직무부터 채워보세요."}
      </p>
    </div>
  );
}

function EntryEditor({
  kind,
  title,
  entries,
  emptyText,
  onAdd,
  onEdit,
  onRemove,
  onReorder,
}: {
  kind: ResumeEntryKind;
  title: string;
  entries: ResumeEntryDto[];
  emptyText: string;
  onAdd: () => void;
  onEdit: (entry: ResumeEntryDto, index: number) => void;
  onRemove: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const pointerDragRef = useRef<{
    fromIndex: number;
    targetIndex: number;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
    element: HTMLDivElement;
    longPressTimer?: number;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const getEntryIndexFromPoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    const target = element?.closest<HTMLElement>("[data-entry-kind][data-entry-index]");
    if (!target || target.dataset.entryKind !== kind) return null;
    const index = Number(target.dataset.entryIndex);
    return Number.isInteger(index) ? index : null;
  };

  const clearPointerDragTimer = () => {
    const timer = pointerDragRef.current?.longPressTimer;
    if (timer) {
      window.clearTimeout(timer);
    }
  };

  const activatePointerDrag = (pointerId: number) => {
    const dragState = pointerDragRef.current;
    if (!dragState) return;
    dragState.active = true;
    suppressClickRef.current = true;
    setDragIndex(dragState.fromIndex);
    setDropIndex(dragState.targetIndex);
    dragState.element.setPointerCapture(pointerId);
  };

  const resetPointerDrag = () => {
    const dragState = pointerDragRef.current;
    if (dragState?.active && dragState.element.hasPointerCapture(dragState.pointerId)) {
      dragState.element.releasePointerCapture(dragState.pointerId);
    }
    clearPointerDragTimer();
    pointerDragRef.current = null;
    setDragIndex(null);
    setDropIndex(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const beginPointerDrag = (event: ReactPointerEvent<HTMLDivElement>, index: number) => {
    if (entries.length < 2 || (event.pointerType === "mouse" && event.button !== 0)) return;

    const dragState: NonNullable<typeof pointerDragRef.current> = {
      fromIndex: index,
      targetIndex: index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      element: event.currentTarget,
    };
    pointerDragRef.current = dragState;

    if (event.pointerType === "mouse") {
      return;
    }

    dragState.longPressTimer = window.setTimeout(() => {
      const currentDragState = pointerDragRef.current;
      if (!currentDragState || currentDragState.pointerId !== event.pointerId) return;
      activatePointerDrag(event.pointerId);
    }, 250);
  };

  const movePointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = pointerDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.active) {
      if (event.pointerType === "mouse" && distance > 6) {
        activatePointerDrag(event.pointerId);
      } else if (event.pointerType !== "mouse" && distance > 10) {
        resetPointerDrag();
      }
    }

    if (!pointerDragRef.current?.active) return;

    event.preventDefault();
    const nextDropIndex = getEntryIndexFromPoint(event.clientX, event.clientY);
    if (nextDropIndex !== null) {
      pointerDragRef.current.targetIndex = nextDropIndex;
      setDropIndex(nextDropIndex);
    }
  };

  const finishPointerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = pointerDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (dragState.active && dragState.fromIndex !== dragState.targetIndex) {
      onReorder(dragState.fromIndex, dragState.targetIndex);
    }
    resetPointerDrag();
  };

  return (
    <section>
      <div className={styles.formSectionHeader}>
        <h2>{title}</h2>
        <button type="button" className={styles.pillButton} onClick={onAdd}>+ 추가</button>
      </div>
      <div className={styles.entryList}>
        {entries.length === 0 ? (
          <div className={styles.emptyEntry}>{emptyText}</div>
        ) : entries.map((entry, index) => {
          const display = formatEntryDisplay(kind, entry);
          const requiredTitlePlaceholder = getRequiredTitlePlaceholder(kind);
          return (
            <div
              key={`${kind}-${display.title}-${index}`}
              className={`${styles.entryEditCard} ${dragIndex === index ? styles.entryDragging : ""} ${dropIndex === index && dragIndex !== index ? styles.entryDropTarget : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${title} 항목 수정`}
              data-entry-kind={kind}
              data-entry-index={index}
              onClick={() => {
                if (suppressClickRef.current) return;
                onEdit(entry, index);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onEdit(entry, index);
                }
              }}
              onPointerDown={(event) => beginPointerDrag(event, index)}
              onPointerMove={movePointerDrag}
              onPointerUp={finishPointerDrag}
              onPointerCancel={resetPointerDrag}
            >
              <span className={styles.entryContent}>
                <strong className={!display.title ? styles.entryMissingTitle : undefined}>
                  {display.title || requiredTitlePlaceholder}
                </strong>
                {display.lines.map((line) => (
                  <small key={line}>{line}</small>
                ))}
              </span>
              <button
                type="button"
                className={styles.entryRemove}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(index);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                aria-label={`${title} 삭제`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function calculateCompletion(payload: ResumePayloadDto) {
  const scalarChecks = [
    payload.title,
    payload.name,
    payload.birthDate,
    payload.desiredJob,
    payload.highestEducation,
    payload.schoolMajor,
    payload.graduationStatus,
    payload.educationStartDate,
    payload.educationEndDate,
    payload.gpaScore,
    payload.gpaMax,
  ];
  const sectionScores = [
    entrySectionCompletion(payload.experiences || [], "experience"),
    entrySectionCompletion(payload.awards || [], "award"),
    entrySectionCompletion(payload.activities || [], "activity"),
    entrySectionCompletion(payload.certifications || [], "certification"),
    entrySectionCompletion(payload.languages || [], "language"),
  ];
  const total = scalarChecks.length + sectionScores.length;
  const filled = scalarChecks.filter(isFilled).length + sectionScores.reduce((sum, score) => sum + score, 0);
  return Math.round((filled / total) * 100);
}

function formatSelectedJobLabel(jobs: string[]) {
  const [first, ...rest] = jobs;
  if (!first) return "";
  return rest.length ? `${first} 외 ${rest.length}개` : first;
}

function entrySectionCompletion(entries: ResumeEntryDto[], kind: ResumeEntryKind) {
  if (!entries.length) return 0;
  const completeCount = entries.filter((entry) => isCompleteEntry(entry, kind)).length;
  if (completeCount === entries.length) return 1;
  return completeCount > 0 || entries.some((entry) => hasEntryContent(entry, kind)) ? 0.5 : 0;
}

function isCompleteEntry(entry: ResumeEntryDto, kind: ResumeEntryKind) {
  const normalized = normalizeEntryLabels(cleanEntry(entry), kind);
  if (kind === "experience") {
    return [
      normalized.companyName || normalized.title,
      normalized.position,
      normalized.duties,
      normalized.startDate,
      normalized.endDate,
    ].every(isFilled);
  }
  if (kind === "award") {
    return [
      normalized.contestName || normalized.title,
      normalized.awardName,
      normalized.awardedDate || normalized.startDate,
    ].every(isFilled);
  }
  if (kind === "activity") {
    return [
      normalized.activityName || normalized.title || normalized.description,
      normalized.startDate || normalized.activityDate,
    ].every(isFilled);
  }
  if (kind === "certification") {
    return [
      normalized.certificationName || normalized.title,
      normalized.acquiredDate || normalized.startDate,
    ].every(isFilled);
  }
  return [
    normalized.testName,
    normalized.levelOrScore,
    normalized.acquiredDate || normalized.startDate,
  ].every(isFilled);
}

function cleanPayload(payload: ResumePayloadDto): ResumePayloadDto {
  const gpaScore = cleanText(payload.gpaScore);
  const gpaMax = cleanText(payload.gpaMax);
  return {
    ...payload,
    title: cleanText(payload.title),
    name: cleanText(payload.name),
    birthYear: cleanText(payload.birthYear),
    birthDate: cleanText(payload.birthDate),
    email: cleanText(payload.email),
    desiredJob: cleanText(payload.desiredJob),
    highestEducation: cleanText(payload.highestEducation),
    gpa: [gpaScore, gpaMax].filter(Boolean).join(" / ") || cleanText(payload.gpa),
    gpaScore,
    gpaMax,
    schoolMajor: cleanText(payload.schoolMajor),
    graduationStatus: cleanText(payload.graduationStatus),
    educationStartDate: cleanText(payload.educationStartDate),
    educationEndDate: cleanText(payload.educationEndDate),
    educationSummary: cleanText(payload.educationSummary),
    careerSummary: cleanText(payload.careerSummary),
    certificationSummary: cleanText(payload.certificationSummary),
    educations: (payload.educations || []).map((entry) => cleanEntry(entry, "education")).filter((entry) => hasEntryContent(entry, "education")),
    experiences: (payload.experiences || []).map((entry) => cleanEntry(entry, "experience")).filter((entry) => hasEntryContent(entry, "experience")),
    certifications: (payload.certifications || []).map((entry) => cleanEntry(entry, "certification")).filter((entry) => hasEntryContent(entry, "certification")),
    awards: (payload.awards || []).map((entry) => cleanEntry(entry, "award")).filter((entry) => hasEntryContent(entry, "award")),
    activities: (payload.activities || []).map((entry) => cleanEntry(entry, "activity")).filter((entry) => hasEntryContent(entry, "activity")),
    languages: (payload.languages || []).map((entry) => cleanEntry(entry, "language")).filter((entry) => hasEntryContent(entry, "language")),
  };
}

function cleanEntry(entry: ResumeEntryDto, kind?: ResumeEntryKind): ResumeEntryDto {
  const cleaned: ResumeEntryDto = {
    ...entry,
    title: cleanText(entry.title),
    certificationName: cleanText(entry.certificationName),
    issuer: cleanText(entry.issuer),
    subtitle: cleanText(entry.subtitle),
    startDate: cleanText(entry.startDate),
    endDate: cleanText(entry.endDate),
    schoolName: cleanText(entry.schoolName),
    degree: cleanText(entry.degree),
    major: cleanText(entry.major),
    gpaScore: cleanText(entry.gpaScore),
    gpaMax: cleanText(entry.gpaMax),
    graduationStatus: cleanText(entry.graduationStatus),
    companyName: cleanText(entry.companyName),
    position: cleanText(entry.position),
    duties: cleanText(entry.duties),
    contestName: cleanText(entry.contestName),
    awardName: cleanText(entry.awardName),
    awardedDate: cleanText(entry.awardedDate),
    activityName: cleanText(entry.activityName),
    description: cleanText(entry.description),
    activityDate: cleanText(entry.activityDate),
    language: cleanText(entry.language),
    testName: cleanText(entry.testName),
    levelOrScore: cleanText(entry.levelOrScore),
    acquiredDate: cleanText(entry.acquiredDate),
  };

  return kind ? normalizeEntryLabels(cleaned, kind) : cleaned;
}

function normalizeEntryLabels(entry: ResumeEntryDto, kind: ResumeEntryKind): ResumeEntryDto {
  if (kind === "education") {
    const title = entry.title || [entry.schoolName, entry.major].filter(Boolean).join(" ");
    const subtitle = entry.subtitle || compactLines([
      [entry.degree, normalizeGraduationStatus(entry.graduationStatus)].filter(Boolean).join(" · "),
      entry.gpaScore && entry.gpaMax ? `학점 ${entry.gpaScore} / ${entry.gpaMax}` : "",
      formatMonthRangeLabel(entry.startDate, entry.endDate),
    ]).join(" · ");
    return { ...entry, title, subtitle };
  }

  if (kind === "experience") {
    const companyName = entry.companyName || entry.title;
    const duties = entry.duties || entry.subtitle;
    return {
      ...entry,
      companyName,
      duties,
      title: entry.title || companyName,
      subtitle: entry.subtitle || [entry.position, duties].filter(Boolean).join(" · "),
    };
  }

  if (kind === "award") {
    const contestName = entry.contestName || entry.title;
    const awardName = entry.awardName || entry.subtitle;
    const awardedDate = entry.awardedDate || entry.startDate;
    const issuer = entry.issuer;
    return {
      ...entry,
      contestName,
      awardName,
      awardedDate,
      issuer,
      title: entry.title || contestName,
      subtitle: entry.subtitle || awardName,
      startDate: entry.startDate || awardedDate,
    };
  }

  if (kind === "activity") {
    return normalizeActivityEntry(entry);
  }

  if (kind === "certification") {
    const certificationName = entry.certificationName || entry.title;
    const issuer = entry.issuer || entry.subtitle;
    const acquiredDate = entry.acquiredDate || entry.startDate;
    return {
      ...entry,
      certificationName,
      issuer,
      acquiredDate,
      title: entry.title || certificationName,
      subtitle: entry.subtitle || issuer,
      startDate: entry.startDate || acquiredDate,
    };
  }

  const language = entry.language;
  const acquiredDate = entry.acquiredDate || entry.startDate;
  const issuer = entry.issuer;
  return {
    ...entry,
    language,
    acquiredDate,
    issuer,
    title: entry.testName || entry.title || language,
    subtitle: entry.subtitle || [language, entry.levelOrScore, formatDateLabel(acquiredDate), issuer].filter(Boolean).join(" · "),
    startDate: entry.startDate || acquiredDate,
  };
}

function formatEntryDisplay(kind: ResumeEntryKind, entry: ResumeEntryDto) {
  const normalized = normalizeEntryLabels(cleanEntry(entry), kind);

  if (kind === "education") {
    return {
      title: normalized.schoolName || normalized.title,
      lines: compactLines([
        [normalized.degree, normalizeGraduationStatus(normalized.graduationStatus)].filter(Boolean).join(" · "),
        normalized.major,
        normalized.gpaScore && normalized.gpaMax ? `학점 ${normalized.gpaScore} / ${normalized.gpaMax}` : "",
        formatMonthRangeLabel(normalized.startDate, normalized.endDate),
      ]),
    };
  }

  if (kind === "experience") {
    return {
      title: normalized.companyName || normalized.title,
      lines: compactLines([
        [normalized.position, normalized.duties || normalized.subtitle].filter(Boolean).join(" · "),
        formatCareerRangeLabel(normalized.startDate, normalized.endDate),
      ]),
    };
  }

  if (kind === "award") {
    return {
      title: normalized.contestName || normalized.title,
      lines: compactLines([
        [normalized.awardName || normalized.subtitle, formatDateLabel(normalized.awardedDate || normalized.startDate), normalized.issuer].filter(Boolean).join(" · "),
      ]),
    };
  }

  if (kind === "activity") {
    const activity = normalizeActivityEntry(normalized);
    return {
      title: activity.activityName || activity.title,
      lines: compactLines([
        activity.description,
        activity.issuer,
        formatMonthRangeLabel(activity.startDate, activity.endDate) || formatDateLabel(activity.activityDate || activity.startDate),
      ]),
    };
  }

  if (kind === "certification") {
    return {
      title: normalized.certificationName || normalized.title,
      lines: compactLines([
        [normalized.issuer || normalized.subtitle, formatDateLabel(normalized.acquiredDate || normalized.startDate)].filter(Boolean).join(" · "),
      ]),
    };
  }

  return {
    title: normalized.testName || normalized.title || normalized.language,
    lines: compactLines([
      [normalized.language, normalized.levelOrScore, formatDateLabel(normalized.acquiredDate || normalized.startDate), normalized.issuer].filter(Boolean).join(" · "),
    ]),
  };
}

function compactLines(lines: Array<string | null | undefined>) {
  return lines.map((line) => cleanText(line)).filter(Boolean);
}

function getRequiredTitlePlaceholder(kind: ResumeEntryKind) {
  if (kind === "experience") return "회사·기관명을 입력해주세요.";
  if (kind === "award") return "공모전명을 입력해주세요.";
  if (kind === "activity") return "활동명을 입력해주세요.";
  if (kind === "certification") return "자격증명을 입력해주세요.";
  if (kind === "language") return "어학시험명을 입력해주세요.";
  return "학교명을 입력해주세요.";
}

function hasEntryContent(entry: ResumeEntryDto, kind: ResumeEntryKind) {
  const display = formatEntryDisplay(kind, entry);
  return Boolean(display.title || display.lines.length);
}

function cleanText(value?: string | null) {
  const next = value?.trim();
  return next || "";
}

function isDateLikeText(value?: string | null) {
  const text = cleanText(value);
  if (!text) return false;

  const compact = text.replace(/\s/g, "");
  const monthMatches = compact.match(/(?:19|20)?\d{2}[.\-/년]+(?:0?[1-9]|1[0-2])/g) || [];
  if (!monthMatches.length) return false;

  const withoutDateParts = compact
    .replace(/(?:19|20)?\d{2}[.\-/년]+(?:0?[1-9]|1[0-2])/g, "")
    .replace(/현재|재직중|진행중|부터|까지/g, "")
    .replace(/[.~～–\-·年月]/g, "");

  return !withoutDateParts;
}

function normalizeActivityEntry(entry: ResumeEntryDto): ResumeEntryDto {
  const rawIssuer = cleanText(entry.issuer);
  const rawActivityName = cleanText(entry.activityName);
  const activityName = shouldTreatAsActivityDescription(rawActivityName, rawIssuer) ? "" : rawActivityName;
  const rawTitle = cleanText(entry.title);
  const title = activityName ? rawTitle || activityName : "";
  const subtitle = cleanText(entry.subtitle);
  const rawDescription = cleanText(entry.description) || (!activityName ? rawActivityName || rawTitle : "");
  const subtitleRange = extractMonthRangeText(subtitle);
  const activityDateRange = extractMonthRangeText(entry.activityDate);
  const [subtitleStartDate, subtitleEndDate] = splitMonthRange(subtitleRange);
  const [activityStartDate, activityEndDate] = splitMonthRange(activityDateRange);
  const startDate = activityStartDate || normalizeMonthInputValue(entry.startDate) || subtitleStartDate;
  const endDate = activityEndDate || normalizeMonthInputValue(entry.endDate) || subtitleEndDate;
  const issuer = isDateLikeText(rawIssuer)
    ? extractActivityIssuerFromMetadata(subtitle, activityName)
    : rawIssuer || extractActivityIssuerFromMetadata(subtitle, activityName) || inferActivityIssuerFromDescription(rawDescription);
  const description = cleanActivityDescription(rawDescription, {
    activityName,
    issuer,
    startDate,
    endDate,
  });
  const activityDate = normalizeMonthInputValue(entry.activityDate) || startDate;

  return {
    ...entry,
    title,
    activityName,
    description,
    issuer,
    activityDate,
    startDate,
    endDate,
    subtitle: description,
  };
}

function cleanActivityDescription(
  value: string | null | undefined,
  context: { activityName?: string | null; issuer?: string | null; startDate?: string | null; endDate?: string | null },
) {
  const parts = splitMetadataParts(value);
  const rangeLabel = formatMonthRangeLabel(context.startDate, context.endDate);
  const cleanedParts = parts.filter((part) => {
    if (isDateLikeText(part)) return false;
    if (isSameCleanText(part, context.activityName)) return false;
    if (isSameCleanText(part, context.issuer)) return false;
    if (rangeLabel && isSameCleanText(part, rangeLabel)) return false;
    if (looksLikeOrganizationText(part)) return false;
    return true;
  });
  return cleanedParts.join(" · ");
}

function shouldTreatAsActivityDescription(activityName?: string | null, issuer?: string | null) {
  const name = cleanText(activityName);
  if (!name) return false;
  if (/동아리|봉사|서포터즈|인턴|프로젝트|활동|캠프|대회|공모전/.test(name)) return false;
  if (/university|college|어학원|학교|대학교|대학원|academy/i.test(cleanText(issuer))) return true;
  return false;
}

function extractActivityIssuerFromMetadata(value?: string | null, activityName?: string | null) {
  return splitMetadataParts(value).find((part) => !isSameCleanText(part, activityName) && looksLikeOrganizationText(part)) || "";
}

function inferActivityIssuerFromDescription(value?: string | null) {
  const text = cleanText(value);
  if (!text || isDateLikeText(text)) return "";
  if (looksLikeOrganizationText(text)) {
    return text;
  }
  return "";
}

function splitMetadataParts(value?: string | null) {
  return cleanText(value)
    .split(/·|\n/)
    .map((part) => cleanText(part))
    .filter(Boolean);
}

function looksLikeOrganizationText(value?: string | null) {
  const text = cleanText(value);
  return Boolean(text && !isDateLikeText(text) && /대학교|대학원|고등학교|학교|기관|협회|센터|연구원|재단|공사|공단|회사|법인|어학원|university|college|institute|center|centre|academy/i.test(text));
}

function isSameCleanText(left?: string | null, right?: string | null) {
  const cleanLeft = cleanText(left).replace(/\s/g, "").toLowerCase();
  const cleanRight = cleanText(right).replace(/\s/g, "").toLowerCase();
  return Boolean(cleanLeft && cleanRight && cleanLeft === cleanRight);
}

function isCurrentEndDate(value?: string | null) {
  return /^(현재|재직중|진행중)$/.test(cleanText(value).replace(/\s/g, ""));
}

function parseDesiredJobs(value?: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDateInputValue(value?: string | null) {
  const text = cleanText(value);
  if (!text) return "";

  const fullDate = text.match(/^((?:19|20)\d{2})[./\\-\s년]+(\d{1,2})[./\\-\s월]+(\d{1,2})/);
  if (fullDate) {
    return `${fullDate[1]}-${fullDate[2].padStart(2, "0")}-${fullDate[3].padStart(2, "0")}`;
  }

  const monthDate = text.match(/^((?:19|20)\d{2})[./\\-\s년]+(\d{1,2})/);
  if (monthDate) return `${monthDate[1]}-${monthDate[2].padStart(2, "0")}-01`;

  const compactDate = text.replace(/\D/g, "").match(/^(\d{2})(\d{2})(\d{2})/);
  if (compactDate) {
    const yearNumber = Number(compactDate[1]);
    const year = yearNumber <= 26 ? 2000 + yearNumber : 1900 + yearNumber;
    return `${year}-${compactDate[2]}-${compactDate[3]}`;
  }

  return text;
}

function normalizeMonthInputValue(value?: string | null) {
  const text = cleanText(value);
  if (!text) return "";
  if (/^(현재|재직중|진행중)$/.test(text.replace(/\s/g, ""))) return "현재";

  const monthDate = text.match(/^((?:19|20)\d{2})[./\\-\s년]+(\d{1,2})/);
  if (monthDate) {
    const month = Number(monthDate[2]);
    return month >= 1 && month <= 12 ? `${monthDate[1]}-${monthDate[2].padStart(2, "0")}` : "";
  }

  const shortMonthDate = text.match(/^(\d{2})[./\\-\s년]+(\d{1,2})/);
  if (shortMonthDate) {
    const yearNumber = Number(shortMonthDate[1]);
    const month = Number(shortMonthDate[2]);
    if (month < 1 || month > 12) return "";
    const year = yearNumber <= 26 ? 2000 + yearNumber : 1900 + yearNumber;
    return `${year}-${shortMonthDate[2].padStart(2, "0")}`;
  }

  return "";
}

function parsePickerDate(value?: string | null, type: PickerMode = "date") {
  const normalized = type === "month"
    ? normalizeMonthInputValue(value)
    : normalizeDateInputValue(value);
  if (!normalized) return null;

  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  if (!year || !month) return null;
  return new Date(year, month - 1, type === "month" ? 1 : day || 1);
}

function formatPickerDate(date: Date | null, type: PickerMode = "date") {
  if (!date) return "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  if (type === "month") return `${year}-${month}`;
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeGraduationStatus(value?: string | null) {
  const text = cleanText(value).replace(/\s/g, "");
  if (text.includes("예정")) return "졸업 예정";
  if (text.includes("중퇴")) return "중퇴";
  if (text.includes("졸업")) return "졸업";
  return "";
}

type ResumeEntryKind = "education" | "experience" | "award" | "activity" | "certification" | "language";

function extractMonthFromText(value?: string | null) {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(/((?:19|20)?\d{2})[.\-/\s년]+(0?[1-9]|1[0-2])/);
  return normalizeMonthInputValue(match?.[0] || "");
}

function resolveMonthValue(...values: Array<string | number | null | undefined>) {
  for (const value of values) {
    const text = cleanText(value === undefined || value === null ? "" : String(value));
    const normalized = normalizeMonthInputValue(text);
    if (/^\d{4}-\d{2}$/.test(normalized)) return normalized;
    const extracted = extractMonthFromText(text);
    if (extracted) return extracted;
  }
  return "";
}

const PERIOD_KEYS = [
  "period",
  "기간",
  "workPeriod",
  "careerPeriod",
  "educationPeriod",
  "activityPeriod",
  "근무기간",
  "재직기간",
  "재학기간",
  "활동기간",
  "입학년월졸업년월",
  "입학년월~졸업년월",
];

const START_DATE_KEYS = [
  "start",
  "startedAt",
  "from",
  "startDate",
  "startedDate",
  "시작일",
  "시작일자",
  "시작년월",
  "근무시작일",
  "입학년월",
  "입학일",
  "활동시작일",
];

const END_DATE_KEYS = [
  "end",
  "endedAt",
  "to",
  "endDate",
  "endedDate",
  "종료일",
  "종료일자",
  "종료년월",
  "근무종료일",
  "졸업년월",
  "졸업일",
  "활동종료일",
];

const RESUME_ENTRY_ARRAY_KEYS = [
  "educations",
  "experiences",
  "certifications",
  "awards",
  "activities",
  "languages",
] as const;

const RESUME_SCALAR_KEYS = [
  "name",
  "birthYear",
  "birthDate",
  "email",
  "desiredJob",
  "highestEducation",
  "gpa",
  "gpaScore",
  "gpaMax",
  "schoolMajor",
  "graduationStatus",
  "educationStartDate",
  "educationEndDate",
  "educationSummary",
  "careerSummary",
  "certificationSummary",
] as const;

function normalizeUploadEntries(entries: unknown, type: ResumeEntryKind) {
  if (!Array.isArray(entries)) return [];

  const normalizedEntries = entries.map((rawEntry) => {
    const entry = rawEntry as ResumeEntryDto & Record<string, unknown>;
    const titleText = cleanText(entry.title);
    const subtitleText = cleanText(entry.subtitle);
    const period = cleanText(readString(entry, PERIOD_KEYS)) || extractMonthRangeText(subtitleText || titleText) || subtitleText;
    const [periodStartDate, periodEndDate] = splitMonthRange(period);
    const certificationName =
      cleanText(entry.certificationName) ||
      cleanText(readString(entry, ["certificateName", "licenseName", "name", "자격증명", "자격명", "자격/면허명"]));
    const issuer =
      cleanText(entry.issuer) ||
      cleanText(readString(entry, ["organization", "issuingOrganization", "institute", "institution", "agency", "issuer", "기관", "기관명", "발급기관", "발급처", "시행기관"]));
    const acquiredDate =
      cleanText(entry.acquiredDate) ||
      cleanText(readString(entry, ["date", "acquiredAt", "acquiredYear", "취득일", "취득년월", "취득년월일"])) ||
      subtitleText ||
      titleText;
    const awardName =
      cleanText(entry.awardName) ||
      cleanText(readString(entry, ["name", "prize", "수상명"]));
    const contestName =
      cleanText(entry.contestName) ||
      cleanText(readString(entry, ["contest", "competition", "공모전명"]));
    const activityName =
      cleanText(entry.activityName) ||
      cleanText(readString(entry, ["name", "활동명"]));
    const language =
      cleanText(entry.language) ||
      cleanText(readString(entry, ["lang", "언어", "외국어명"]));
    const testName =
      cleanText(entry.testName) ||
      cleanText(readString(entry, ["examName", "test", "어학시험명", "시험명"]));
    const levelOrScore =
      cleanText(entry.levelOrScore) ||
      cleanText(readString(entry, ["score", "grade", "level", "급수", "점수", "급수or점수"]));
    const startDate = cleanText(entry.startDate) || cleanText(readString(entry, START_DATE_KEYS));
    const endDate = cleanText(entry.endDate) || cleanText(readString(entry, END_DATE_KEYS));

    if (type === "education") {
      const schoolName = cleanText(entry.schoolName) || cleanText(readString(entry, ["school", "schoolName", "학교명", "학교"]));
      const major = cleanText(entry.major) || cleanText(readString(entry, ["major", "전공", "학교·전공"]));
      const degree = cleanText(entry.degree) || cleanText(readString(entry, ["degree", "학위", "최종학력", "학력"]));
      const resolvedStartDate = normalizeMonthInputValue(startDate) || periodStartDate;
      const resolvedEndDate = normalizeMonthInputValue(endDate) || periodEndDate;
      const parsedGpa = splitGpa(cleanText(entry.gpaScore) && cleanText(entry.gpaMax) ? `${entry.gpaScore} / ${entry.gpaMax}` : cleanText(readString(entry, ["gpa", "grade", "학점"])));
      const gpaScore = cleanText(entry.gpaScore) || parsedGpa.score || cleanText(readString(entry, ["score", "actualGpa", "실제학점", "학점점수"]));
      const gpaMax = cleanText(entry.gpaMax) || parsedGpa.max || cleanText(readString(entry, ["max", "maximumGpa", "최대학점", "만점"]));
      const graduationStatus =
        normalizeGraduationStatus(entry.graduationStatus || readString(entry, ["status", "졸업여부"])) ||
        normalizeGraduationStatus([entry.title, entry.subtitle, degree, period].filter(Boolean).join(" "));
      const gpaLabel = [gpaScore, gpaMax].filter(Boolean).join(" / ");
      return {
        ...entry,
        title: cleanText(entry.title) || schoolName || degree,
        subtitle: [major, graduationStatus, gpaLabel, formatMonthRangeLabel(resolvedStartDate, resolvedEndDate)]
          .filter(Boolean)
          .join(" · "),
        schoolName,
        degree,
        major,
        gpaScore,
        gpaMax,
        graduationStatus,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      };
    }

    if (type === "experience") {
      const companyName = cleanText(entry.companyName) || cleanText(readString(entry, ["company", "organization", "회사명", "기관명", "회 사 명"]));
      const position = cleanText(entry.position) || cleanText(readString(entry, ["role", "직위", "직책", "담당직무", "담당 직무"]));
      const duties = cleanText(entry.duties) || cleanText(readString(entry, ["description", "duties", "task", "담당업무", "담당 업무", "내용"]));
      const resolvedStartDate = normalizeMonthInputValue(startDate) || periodStartDate;
      const resolvedEndDate = normalizeMonthInputValue(endDate) || periodEndDate;
      return {
        ...entry,
        title: cleanText(entry.title) || companyName,
        subtitle: [position, duties, formatCareerRangeLabel(resolvedStartDate, resolvedEndDate)].filter(Boolean).join(" · "),
        companyName,
        position,
        duties,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      };
    }

    if (type === "award") {
      const awardedDate = resolveMonthValue(
        entry.awardedDate,
        readString(entry, ["awardedDate", "awardDate", "date", "prizeDate", "수상일", "수상일자", "일시", "날짜"]),
        subtitleText,
        titleText,
      );
      return {
        ...entry,
        title: cleanText(entry.title) || contestName || awardName,
        subtitle: [awardName, formatMonthLabel(awardedDate), issuer].filter(Boolean).join(" · "),
        contestName,
        awardName,
        issuer,
        awardedDate,
        startDate: awardedDate,
      };
    }

    if (type === "activity") {
      const rawDescription =
        cleanText(entry.description) ||
        cleanText(readString(entry, ["content", "details", "활동내용", "내용"]));
      const resolvedStartDate = normalizeMonthInputValue(startDate) || periodStartDate;
      const resolvedEndDate = normalizeMonthInputValue(endDate) || periodEndDate;
      const activityDate = resolveMonthValue(
        entry.activityDate,
        readString(entry, ["activityDate", "date", "활동일", "활동일자", "활동일자/기간", "일자", "날짜"]),
        period,
        subtitleText,
        titleText,
      );
      return normalizeActivityEntry({
        ...entry,
        title: cleanText(entry.title) || activityName,
        subtitle: subtitleText,
        activityName,
        description: rawDescription,
        issuer,
        activityDate,
        startDate: resolvedStartDate,
        endDate: resolvedEndDate,
      });
    }

    if (type === "language") {
      const normalizedAcquiredDate = resolveMonthValue(acquiredDate, subtitleText, titleText);
      return {
        ...entry,
        title: testName || cleanText(entry.title) || language,
        subtitle: [language, levelOrScore, formatMonthLabel(normalizedAcquiredDate), issuer].filter(Boolean).join(" · "),
        language,
        testName,
        levelOrScore,
        issuer,
        acquiredDate: normalizedAcquiredDate,
        startDate: normalizedAcquiredDate,
      };
    }

    const normalizedAcquiredDate = resolveMonthValue(acquiredDate, subtitleText, titleText);
    return {
      ...entry,
      title: cleanText(entry.title) || certificationName,
      subtitle: [issuer, formatMonthLabel(normalizedAcquiredDate)].filter(Boolean).join(" · "),
      certificationName,
      issuer,
      acquiredDate: normalizedAcquiredDate,
      startDate: normalizedAcquiredDate,
    };
  });

  return dedupeUploadEntries(
    normalizedEntries.filter((entry) => isImportableUploadEntry(entry, type)),
    type,
  );
}

function dedupeUploadEntries(entries: ResumeEntryDto[], type: ResumeEntryKind) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = uploadEntryKey(entry, type);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uploadEntryKey(entry: ResumeEntryDto, type: ResumeEntryKind) {
  const parts =
    type === "experience"
      ? [entry.companyName || entry.title, entry.position, entry.duties, entry.startDate, entry.endDate]
      : type === "award"
        ? [entry.contestName || entry.title, entry.awardName, entry.issuer, entry.awardedDate || entry.startDate]
        : type === "activity"
          ? [entry.activityName || entry.title, entry.description, entry.issuer, entry.startDate, entry.endDate, entry.activityDate]
          : type === "certification"
            ? [entry.certificationName || entry.title, entry.issuer, entry.acquiredDate || entry.startDate]
            : type === "language"
              ? [entry.language, entry.testName || entry.title, entry.levelOrScore, entry.issuer, entry.acquiredDate || entry.startDate]
              : [entry.schoolName || entry.title, entry.degree, entry.major, entry.startDate, entry.endDate];

  return parts.map((part) => cleanText(part).replace(/\s+/g, "").toLowerCase()).join("|");
}

function isImportableUploadEntry(entry: ResumeEntryDto, type: ResumeEntryKind) {
  if (type === "experience") {
    const title = cleanText(entry.companyName || entry.title);
    return Boolean(title && !isImportNoiseText(title));
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
  if (/^0{2,4}[.\-/년]+0{1,2}/.test(compact)) return true;
  return false;
}

function isFilled(value?: string | null) {
  return Boolean(value?.trim());
}

function removeAt<T>(items: T[], index: number) {
  return items.filter((_, itemIndex) => itemIndex !== index);
}

function replaceAt<T>(items: T[], index: number, nextItem: T) {
  return items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));
}

function moveEntry<T>(items: T[], fromIndex: number, toIndex: number) {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

function formatBytes(value?: number) {
  if (!value) return "0KB";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}

function isAcceptedResumeFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return ACCEPTED_UPLOAD_EXTENSIONS.has(extension) || ACCEPTED_UPLOAD_MIME_TYPES.has(file.type);
}

function selectPreferredEducation(entries?: ResumeEntryDto[]) {
  const candidates = [...(entries || [])].filter((entry) => [entry.title, entry.schoolName, entry.degree].some(Boolean));
  const graduated = candidates.filter(isGraduatedEducation);
  return (graduated.length ? graduated : candidates)
    .sort((left, right) => {
      const dateDelta = educationDateScore(right) - educationDateScore(left);
      if (dateDelta !== 0) return dateDelta;

      return educationRank(right) - educationRank(left);
    })[0];
}

function educationRank(entry?: ResumeEntryDto) {
  const text = [entry?.degree, entry?.schoolName, entry?.title, entry?.major]
    .filter(Boolean)
    .join(" ");
  if (/박사|Doctor|Ph\.?D/i.test(text)) return 60;
  if (/석사|Master/i.test(text)) return 50;
  if (/대학원/.test(text)) return 45;
  if (/대학교|4년|학사|Bachelor/i.test(text)) return 40;
  if (/전문대|대학/.test(text)) return 30;
  if (/고등학교|고교/.test(text)) return 20;
  return text ? 10 : 0;
}

function isGraduatedEducation(entry?: ResumeEntryDto) {
  const status = normalizeGraduationStatus(entry?.graduationStatus);
  if (status) return status === "졸업";

  const text = [entry?.title, entry?.subtitle, entry?.degree].filter(Boolean).join(" ");
  return /졸업/.test(text) && !/졸업\s*예정|졸업예정|중퇴/.test(text);
}

function educationDateScore(entry?: ResumeEntryDto) {
  const end = monthDateScore(entry?.endDate);
  const start = monthDateScore(entry?.startDate);
  return end || start;
}

function monthDateScore(value?: string | null) {
  if (/^(현재|재직중|진행중)$/.test(cleanText(value).replace(/\s/g, ""))) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth() + 1;
  }
  const month = normalizeMonthInputValue(value);
  const match = month.match(/^((?:19|20)\d{2})-(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 12 + Number(match[2]);
}

function inferEducationLevel(entry?: ResumeEntryDto) {
  const text = [entry?.degree, entry?.schoolName, entry?.title, entry?.major].filter(Boolean).join(" ");
  if (/대학원|석사|박사|Master|Doctor|Ph\.?D/i.test(text)) return "대학원";
  if (/대학교|4년|학사|Bachelor/i.test(text)) return "대학교";
  if (/전문대|대학/.test(text)) return "대학교";
  if (/고등학교|고교/.test(text)) return "고등학교";
  return "";
}

function formatHighestEducationFromEntry(entry?: ResumeEntryDto) {
  const level = inferEducationLevel(entry);
  if (!level) return "";
  return level;
}

function normalizeHighestEducationValue(value?: string | null) {
  const text = cleanText(value);
  if (!text) return "";
  if (/선택|미상|없음|unknown|n\/a/i.test(text)) return "";
  if (/대학원|석사|박사/.test(text)) return "대학원";
  if (/대학교|대학|학사|전문대/.test(text)) return "대학교";
  if (/고등학교|고교/.test(text)) return "고등학교";
  return ["고등학교", "대학교", "대학원", "기타"].includes(text) ? text : "";
}

function highestEducationRank(value?: string | null) {
  const text = cleanText(value);
  if (/대학원|석사|박사/.test(text)) return 3;
  if (/대학교|대학|학사|전문대/.test(text)) return 2;
  if (/고등학교|고교/.test(text)) return 1;
  return text ? 0 : -1;
}

function resolveHighestEducationValue(sourceValue?: string | null, preferredEducation?: ResumeEntryDto) {
  const normalizedSource = normalizeHighestEducationValue(sourceValue);
  const preferredValue = formatHighestEducationFromEntry(preferredEducation);
  if (!normalizedSource) return preferredValue;
  if (!preferredValue) return normalizedSource;
  return highestEducationRank(preferredValue) >= highestEducationRank(normalizedSource)
    ? preferredValue
    : normalizedSource;
}

function splitMonthRange(value?: string | null): [string, string] {
  const text = cleanText(value);
  if (!text) return ["", ""];
  const parts = text
    .split(/~|～|–|부터|까지/)
    .map((part) => normalizeMonthInputValue(part))
    .filter(Boolean);
  return [parts[0] || "", parts[1] || ""];
}

function extractMonthRangeText(value?: string | null) {
  const text = cleanText(value);
  if (!text) return "";
  const match = text.match(
    /((?:19|20)?\d{2}\s*[.\-/년]\s*(?:0?[1-9]|1[0-2]))\s*(?:~|～|–|-|부터)\s*((?:19|20)?\d{2}\s*[.\-/년]\s*(?:0?[1-9]|1[0-2])|현재|재직중|진행중)/,
  );
  return match ? `${match[1]}~${match[2]}` : "";
}

function formatMonthLabel(value?: string | null) {
  if (/^(현재|재직중|진행중)$/.test(cleanText(value).replace(/\s/g, ""))) return "현재";
  const month = normalizeMonthInputValue(value);
  return month ? month.replace("-", ".") : "";
}

function formatMonthRangeLabel(start?: string | null, end?: string | null) {
  const startLabel = formatMonthLabel(start);
  const endLabel = formatMonthLabel(end);
  if (startLabel && endLabel) return `${startLabel}~${endLabel}`;
  return startLabel || endLabel || "";
}

function formatCareerRangeLabel(start?: string | null, end?: string | null) {
  const range = formatMonthRangeLabel(start, end);
  if (!range) return "";
  const years = careerYearsLabel(start, end);
  return years ? `${range}(${years})` : range;
}

function formatDateLabel(value?: string | null) {
  const text = cleanText(value);
  if (!text) return "";

  const hasExplicitDay = /(?:19|20)?\d{2}\s*[./\-\s년]+\d{1,2}\s*[./\-\s월]+\d{1,2}/.test(text);
  const normalizedMonth = normalizeMonthInputValue(text);
  if (!hasExplicitDay && /^\d{4}-\d{2}$/.test(normalizedMonth)) {
    return normalizedMonth.replace("-", ".");
  }

  const normalizedDate = normalizeDateInputValue(text);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    return normalizedDate.replace(/-/g, ".");
  }

  if (/^\d{4}-\d{2}$/.test(normalizedMonth)) {
    return normalizedMonth.replace("-", ".");
  }

  return text;
}

function careerYearsLabel(start?: string | null, end?: string | null) {
  const startScore = monthDateScore(start);
  const endScore = monthDateScore(end);
  if (!startScore || !endScore) return "";
  const months = Math.max(1, endScore - startScore + 1);
  return `${Math.max(1, Math.ceil(months / 12))}년차`;
}

function toUploadPayload(
  extracted: Partial<ResumePayloadDto> | undefined,
  fileId: string,
): ResumePayloadDto {
  const source = getExtractedSource(extracted);
  const sourceRecord = source as Record<string, unknown>;
  const educations = normalizeUploadEntries(
    pickEntryList(sourceRecord, ["educations", "education", "schools", "학력", "학력사항", "학력정보", "educationList"]),
    "education",
  );
  const experiences = normalizeUploadEntries(
    pickEntryList(sourceRecord, ["experiences", "careers", "career", "workExperiences", "experienceList", "경력", "경력사항", "경력활동", "경력·활동", "근무경력"]),
    "experience",
  );
  const certifications = normalizeUploadEntries(
    pickEntryList(sourceRecord, ["certifications", "certificates", "licenses", "licenseList", "certificateList", "자격증", "자격", "자격면허", "자격/면허", "자격증내역"]),
    "certification",
  );
  const awards = normalizeUploadEntries(
    pickEntryList(sourceRecord, ["awards", "awardList", "prizes", "수상", "수상경력", "수상이력", "수상내역", "포상"]),
    "award",
  );
  const activities = normalizeUploadEntries(
    pickEntryList(sourceRecord, ["activities", "activityList", "extracurriculars", "대외활동", "활동", "활동내역", "연수", "연수활동"]),
    "activity",
  );
  const languages = normalizeUploadEntries(
    pickEntryList(sourceRecord, ["languages", "languageList", "foreignLanguages", "어학", "어학사항", "외국어", "외국어능력", "외국어명"]),
    "language",
  );
  const preferredEducation = selectPreferredEducation(educations);
  const parsedGpa = splitGpa(source.gpa);
  const nestedGpa = splitGpa(
    [preferredEducation?.gpaScore, preferredEducation?.gpaMax].filter(Boolean).join(" / "),
  );
  const gpaScore = cleanText(source.gpaScore) || parsedGpa.score || nestedGpa.score || cleanText(preferredEducation?.gpaScore);
  const gpaMax = cleanText(source.gpaMax) || parsedGpa.max || nestedGpa.max || cleanText(preferredEducation?.gpaMax);
  const birthDate = normalizeDateInputValue(source.birthDate);
  const educationSchoolMajor = [preferredEducation?.schoolName, preferredEducation?.major]
    .filter(Boolean)
    .join(" ");
  const highestEducation = resolveHighestEducationValue(source.highestEducation, preferredEducation);
  return {
    ...emptyPayload,
    ...source,
    sourceType: "upload",
    fileId,
    title: "",
    name: cleanText(source.name),
    birthYear: cleanText(source.birthYear) || birthDate.slice(0, 4),
    birthDate,
    email: cleanText(source.email),
    desiredJob: "",
    highestEducation,
    gpa: [gpaScore, gpaMax].filter(Boolean).join(" / ") || cleanText(source.gpa),
    gpaScore,
    gpaMax,
    schoolMajor: cleanText(source.schoolMajor) || educationSchoolMajor,
    graduationStatus: normalizeGraduationStatus(source.graduationStatus || preferredEducation?.graduationStatus),
    educationStartDate: normalizeMonthInputValue(source.educationStartDate || preferredEducation?.startDate),
    educationEndDate: normalizeMonthInputValue(source.educationEndDate || preferredEducation?.endDate),
    educationSummary: cleanText(source.educationSummary),
    careerSummary: cleanText(source.careerSummary),
    certificationSummary: cleanText(source.certificationSummary),
    educations,
    experiences,
    certifications,
    awards,
    activities,
    languages,
    extractedPayload: source.extractedPayload || source || {},
  };
}

function mergeUploadPayload(current: ResumePayloadDto, incoming: ResumePayloadDto): ResumePayloadDto {
  const merged: ResumePayloadDto = {
    ...current,
    ...incoming,
    sourceType: "upload",
    fileId: incoming.fileId || current.fileId || null,
    title: cleanText(current.title) || cleanText(incoming.title),
  };
  const scalarTarget = merged as unknown as Record<(typeof RESUME_SCALAR_KEYS)[number], string | null | undefined>;
  for (const key of RESUME_SCALAR_KEYS) {
    scalarTarget[key] = cleanText(incoming[key]) || cleanText(current[key]);
  }

  const entryTarget = merged as unknown as Record<(typeof RESUME_ENTRY_ARRAY_KEYS)[number], ResumeEntryDto[]>;
  for (const key of RESUME_ENTRY_ARRAY_KEYS) {
    entryTarget[key] = incoming[key]?.length ? incoming[key] || [] : current[key] || [];
  }

  const preferredEducation = selectPreferredEducation(merged.educations);
  if (preferredEducation) {
    const preferredHighestEducation = formatHighestEducationFromEntry(preferredEducation);
    const educationSchoolMajor = [preferredEducation.schoolName, preferredEducation.major].filter(Boolean).join(" ");
    merged.highestEducation = preferredHighestEducation || cleanText(merged.highestEducation);
    merged.schoolMajor = educationSchoolMajor || cleanText(merged.schoolMajor);
    merged.graduationStatus =
      normalizeGraduationStatus(preferredEducation.graduationStatus) || cleanText(merged.graduationStatus);
    merged.educationStartDate = normalizeMonthInputValue(preferredEducation.startDate) || cleanText(merged.educationStartDate);
    merged.educationEndDate = normalizeMonthInputValue(preferredEducation.endDate) || cleanText(merged.educationEndDate);
    merged.gpaScore = cleanText(preferredEducation.gpaScore) || cleanText(merged.gpaScore);
    merged.gpaMax = cleanText(preferredEducation.gpaMax) || cleanText(merged.gpaMax);
  }

  merged.gpa = [merged.gpaScore, merged.gpaMax].map((value) => cleanText(value)).filter(Boolean).join(" / ") || cleanText(merged.gpa);
  merged.birthDate = normalizeDateInputValue(merged.birthDate);
  merged.birthYear = cleanText(merged.birthYear) || cleanText(merged.birthDate).slice(0, 4);
  merged.extractedPayload = incoming.extractedPayload || current.extractedPayload || {};
  return merged;
}

function pickEntryList(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }
  return [];
}

function getExtractedSource(extracted?: Partial<ResumePayloadDto>) {
  const merged: Partial<ResumePayloadDto> = {};
  const visited = new Set<unknown>();
  const nestedKeys = new Set(["extractedPayload", "parsed", "ai", "data", "result", "resume", "payload"]);

  const mergeSource = (source: unknown) => {
    if (!source || typeof source !== "object" || Array.isArray(source) || visited.has(source)) return;
    visited.add(source);
    const record = source as Record<string, unknown>;

    // Backend can return { extractedPayload: { ai, parsed } } after async parsing.
    // Flatten parser fallback first, then AI/top-level values can override it.
    mergeSource(record.extractedPayload);
    mergeSource(record.parsed);
    mergeSource(record.ai);
    mergeSource(record.data);
    mergeSource(record.result);
    mergeSource(record.resume);
    mergeSource(record.payload);

    for (const [key, value] of Object.entries(record)) {
      if (nestedKeys.has(key) || !hasExtractedValue(value)) continue;
      const currentValue = (merged as Record<string, unknown>)[key];
      (merged as Record<string, unknown>)[key] = mergeExtractedValue(currentValue, value);
    }
  };

  mergeSource(extracted);
  return merged;
}

function mergeExtractedValue(current: unknown, incoming: unknown) {
  if (!hasExtractedValue(current)) return incoming;
  if (!hasExtractedValue(incoming)) return current;
  if (Array.isArray(current) && Array.isArray(incoming)) {
    return mergeRawEntryLists(current, incoming);
  }
  if (isPlainRecord(current) && isPlainRecord(incoming)) {
    return mergeRawRecord(current, incoming);
  }
  return incoming;
}

function mergeRawEntryLists(current: unknown[], incoming: unknown[]) {
  const result = [...current];
  for (let index = 0; index < incoming.length; index += 1) {
    const incomingEntry = incoming[index];
    const key = rawEntryKey(incomingEntry);
    const matchIndex = key
      ? result.findIndex((entry) => rawEntryKey(entry) === key)
      : index < result.length
        ? index
        : -1;

    if (matchIndex >= 0 && isPlainRecord(result[matchIndex]) && isPlainRecord(incomingEntry)) {
      result[matchIndex] = mergeRawRecord(result[matchIndex], incomingEntry);
    } else if (matchIndex < 0) {
      result.push(incomingEntry);
    }
  }
  return result;
}

function mergeRawRecord(current: Record<string, unknown>, incoming: Record<string, unknown>) {
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (!hasExtractedValue(value)) continue;
    const currentValue = merged[key];
    merged[key] = Array.isArray(currentValue) && Array.isArray(value)
      ? mergeRawEntryLists(currentValue, value)
      : value;
  }
  return merged;
}

function rawEntryKey(value: unknown) {
  if (!isPlainRecord(value)) return "";
  const key = readString(value, [
    "title",
    "name",
    "schoolName",
    "school",
    "companyName",
    "company",
    "organization",
    "certificationName",
    "certificateName",
    "licenseName",
    "contestName",
    "awardName",
    "activityName",
    "language",
    "testName",
    "학교명",
    "회사명",
    "기관명",
    "자격증명",
    "수상명",
    "공모전명",
    "활동명",
    "언어",
    "어학시험명",
  ]);
  return cleanText(key).replace(/\s+/g, "").toLowerCase();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExtractedValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function splitGpa(value?: string | null) {
  const match = cleanText(value).match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  return { score: match?.[1] || "", max: match?.[2] || "" };
}

function readString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
  }
  return "";
}

async function waitForParseJob(jobId: string, fileId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await sleep(1500);
    const response = await getResumeParseJob(jobId);
    if (response.job.status === "completed") {
      const parsedPayload = toUploadPayload(response.job.extractedPayload || {}, fileId);
      return hasMeaningfulExtractedPayload(parsedPayload) ? parsedPayload : null;
    }
    if (response.job.status === "failed") {
      throw new Error(response.job.errorMessage || "이력서 분석에 실패했습니다.");
    }
  }

  throw new Error("이력서 분석 시간이 길어지고 있습니다. 잠시 후 다시 시도해 주세요.");
}

function hasMeaningfulExtractedPayload(payload: ResumePayloadDto) {
  return Boolean(
    cleanText(payload.name) ||
      cleanText(payload.birthDate) ||
      cleanText(payload.email) ||
      cleanText(payload.desiredJob) ||
      cleanText(payload.highestEducation) ||
      cleanText(payload.schoolMajor) ||
      cleanText(payload.gpaScore) ||
      cleanText(payload.gpaMax) ||
      payload.educations?.length ||
      payload.experiences?.length ||
      payload.awards?.length ||
      payload.activities?.length ||
      payload.certifications?.length ||
      payload.languages?.length,
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
