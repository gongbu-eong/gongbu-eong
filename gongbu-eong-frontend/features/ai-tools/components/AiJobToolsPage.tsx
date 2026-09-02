"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { getCurrentUser } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import { ComingSoonAlert } from "@/features/layout/components/ComingSoonAlert";
import styles from "./AiJobToolsPage.module.css";

type ToolKey = "salary" | "text" | "severance" | "vacation" | "unemployment" | "grade";
type PickerMode = "date" | "month";
type SalaryCalculationResult = {
  pension: number;
  health: number;
  longTermCare: number;
  employment: number;
  incomeTax: number;
  localTax: number;
  totalDeduction: number;
  netPay: number;
};

const MIN_PICKER_YEAR = 1900;
const MAX_MONEY_AMOUNT = 9999999999;
const MAX_DEPENDENTS = 11;
const MAX_CHILDREN = 10;
const SALARY_PENSION_MONTHLY_CAP = 6590000;
const SALARY_HEALTH_EMPLOYEE_MONTHLY_CAP = 4300520;
const SALARY_PENSION_RATE = 0.0475;
const SALARY_HEALTH_RATE = 0.03595;
const SALARY_LONG_TERM_CARE_RATE = 0.1314;
const SALARY_EMPLOYMENT_RATE = 0.009;

const tools: Array<{ key: ToolKey; label: string }> = [
  { key: "salary", label: "연봉계산기" },
  { key: "text", label: "글자수세기/맞춤법" },
  { key: "severance", label: "퇴직금 계산기" },
  { key: "vacation", label: "연차/휴가 계산기" },
  { key: "unemployment", label: "실업급여 계산기" },
  { key: "grade", label: "학점 변환기" },
];

export function AiJobToolsPage({
  initialTool = "salary",
}: {
  initialTool?: string | null;
}) {
  const router = useRouter();
  const [activeTool, setActiveTool] = useState<ToolKey>(parseTool(initialTool));
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((response) => {
        if (mounted) setUser(response.authenticated ? response.user : null);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setAuthResolved(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectTool = (tool: ToolKey) => {
    setActiveTool(tool);
    router.replace(`/ai-tools/job-tools?tool=${tool}`, { scroll: false });
  };

  return (
    <main className={styles.page}>
      <section className={styles.mobileFrame} aria-label="공부엉이의 취업 도구">
        <AppHeader user={authResolved ? user : undefined} ticketCount={user?.creditBalance} />
        <div className={styles.content}>
          <h1 className={styles.pageTitle}>공부엉이의 취업 도구</h1>
          <nav className={styles.tabs} aria-label="취업 도구 선택">
            {tools.map((tool) => (
              <button
                type="button"
                key={tool.key}
                className={activeTool === tool.key ? styles.activeTab : undefined}
                onClick={() => selectTool(tool.key)}
              >
                {tool.label}
              </button>
            ))}
          </nav>
          {activeTool === "salary" ? <SalaryTool /> : null}
          {activeTool === "text" ? <TextTool /> : null}
          {activeTool === "severance" ? <SeveranceTool /> : null}
          {activeTool === "vacation" ? <VacationTool /> : null}
          {activeTool === "unemployment" ? <UnemploymentTool /> : null}
          {activeTool === "grade" ? <GradeTool /> : null}
        </div>
        <AppFooter active="ai" />
      </section>
    </main>
  );
}

function SalaryTool() {
  const [payType, setPayType] = useState<"year" | "month">("year");
  const [retirement, setRetirement] = useState<"separate" | "included">("separate");
  const [income, setIncome] = useState("0");
  const [dependents, setDependents] = useState("1");
  const [children, setChildren] = useState("");
  const [taxFree, setTaxFree] = useState("200000");
  const [taxFreeCustom, setTaxFreeCustom] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [salaryResult, setSalaryResult] = useState<SalaryCalculationResult | null>(null);
  const [limitAlert, setLimitAlert] = useState<{ title: string; description: string } | null>(null);

  const dependentCount = Math.max(1, number(dependents));
  const childCount = number(children);
  const salaryMonths = retirement === "included" ? 13 : 12;
  const grossMonthly = payType === "year" ? Math.floor(number(income) / salaryMonths) : number(income);
  const taxable = Math.max(0, grossMonthly - number(taxFree));
  const pension = floorTen(Math.min(taxable, SALARY_PENSION_MONTHLY_CAP) * SALARY_PENSION_RATE);
  const health = Math.min(floorTen(taxable * SALARY_HEALTH_RATE), SALARY_HEALTH_EMPLOYEE_MONTHLY_CAP);
  const longTermCare = floorTen(health * SALARY_LONG_TERM_CARE_RATE);
  const employment = floorTen(taxable * SALARY_EMPLOYMENT_RATE);
  const incomeTax = estimateIncomeTax(taxable, dependentCount, childCount);
  const localTax = floorTen(incomeTax * 0.1);
  const totalDeduction = pension + health + longTermCare + employment + incomeTax + localTax;
  const netPay = Math.max(0, grossMonthly - totalDeduction);

  const changePayType = (nextPayType: "year" | "month") => {
    setPayType(nextPayType);
    if (nextPayType === "month") {
      setRetirement("separate");
    }
  };

  const reset = () => {
    setPayType("year");
    setRetirement("separate");
    setIncome("0");
    setDependents("1");
    setChildren("");
    setTaxFree("200000");
    setTaxFreeCustom(false);
    setCalculated(false);
    setSalaryResult(null);
  };

  const toggleTaxFreeCustom = () => {
    setTaxFreeCustom((current) => {
      const next = !current;
      setTaxFree(next ? "0" : "200000");
      return next;
    });
  };

  const updateIncome = (value: string) => {
    setIncome(clampMoneyAmount(value));
  };

  const updateTaxFree = (value: string) => {
    setTaxFree(clampMoneyAmount(value));
  };

  const updateDependents = (value: string) => {
    setDependents(normalizeLimitedInteger(value, 1, MAX_DEPENDENTS, () => {
      setLimitAlert({
        title: "부양가족수(본인포함)을 확인해 주세요.",
        description: "부양가족수 12명 이상은 11명과 동일하게 계산되므로 11까지만 입력이 가능합니다.",
      });
    }));
  };

  const updateChildren = (value: string) => {
    setChildren(normalizeLimitedInteger(value, 0, MAX_CHILDREN, () => {
      setLimitAlert({
        title: "20세 이하 자녀수를 확인해 주세요.",
        description: "20세 이하 자녀수 11명 이상은 10명과 동일하게 계산되므로 10명까지만 입력이 가능합니다.",
      });
    }));
  };

  const calculateSalary = () => {
    if (number(income) <= 0) {
      setLimitAlert({
        title: "연봉이 입력되지 않았습니다",
        description: "",
      });
      return;
    }

    if (number(taxFree) > grossMonthly) {
      setLimitAlert({
        title: "비과세액이 월급보다 많습니다.",
        description: "",
      });
      return;
    }

    setSalaryResult({
      pension,
      health,
      longTermCare,
      employment,
      incomeTax,
      localTax,
      totalDeduction,
      netPay,
    });
    setCalculated(true);
  };

  return (
    <ToolPanel title="연봉계산기" onReset={reset}>
      <div className={styles.twoColumn}>
        <SegmentField label="연봉/월급 선택" required>
          <Segmented
            value={payType}
            onChange={changePayType}
            options={[
              { value: "year", label: "연봉" },
              { value: "month", label: "월급" },
            ]}
          />
        </SegmentField>
        <SegmentField label="퇴직금 포함여부" required>
          {payType === "year" ? (
            <Segmented
              value={retirement}
              onChange={setRetirement}
              options={[
                { value: "separate", label: "별도" },
                { value: "included", label: "포함" },
              ]}
            />
          ) : (
            <p className={styles.fieldGuide}>연봉일 경우에만 선택</p>
          )}
        </SegmentField>
      </div>
      <MoneyField
        label={payType === "year" ? "연봉" : "월급"}
        value={income}
        onChange={updateIncome}
        description={income ? formatKoreanWon(number(income)) : undefined}
        required
      />
      <div className={styles.twoColumn}>
        <NumberField label="부양가족수(본인포함)" value={dependents} onChange={updateDependents} unit="명" />
        <NumberField label="20세 이하 자녀수" value={children} onChange={updateChildren} unit="명" />
      </div>
      <MoneyField
        label="비과세액"
        actionLabel="✓ 직접선택"
        actionActive={taxFreeCustom}
        onActionClick={toggleTaxFreeCustom}
        value={taxFree}
        onChange={updateTaxFree}
        description={taxFree ? formatKoreanWon(number(taxFree)) : undefined}
        disabled={!taxFreeCustom}
      />
      {calculated && salaryResult ? (
        <ResultBox title="한 달 기준 공제액">
          <ResultRow label="국민연금" value={salaryResult.pension} />
          <ResultRow label="건강보험" value={salaryResult.health} />
          <ResultRow label="장기요양" value={salaryResult.longTermCare} />
          <ResultRow label="고용보험" value={salaryResult.employment} />
          <ResultRow label="소득세" value={salaryResult.incomeTax} />
          <ResultRow label="지방소득세" value={salaryResult.localTax} />
          <ResultRow label="공제액 합계" value={salaryResult.totalDeduction} />
          <hr />
          <ResultRow label="월 예상 실수령액" value={salaryResult.netPay} accent />
        </ResultBox>
      ) : null}
      <PrimaryButton tone={calculated ? "secondary" : "primary"} onClick={calculateSalary}>
        {calculated ? "다시 계산하기" : "계산하기"}
      </PrimaryButton>
      <Notice lines={[
        "본 연봉계산기는 가장 범용적인 기준으로 만들었으나,",
        "연봉 지급 조건과 상황에 따라 약간의 오차가 발생할 수 있으니",
        "참고용으로 활용하시기 바랍니다.",
      ]} />
      {limitAlert ? (
        <ComingSoonAlert
          title={limitAlert.title}
          description={limitAlert.description}
          onClose={() => setLimitAlert(null)}
        />
      ) : null}
    </ToolPanel>
  );
}

function TextTool() {
  const [text, setText] = useState("");
  const included = text.length;
  const excludedText = text.replace(/\s/g, "");
  const excluded = excludedText.length;
  const includedByte = byteLength(text);
  const excludedByte = byteLength(excludedText);

  return (
    <ToolPanel title="글자수세기/맞춤법">
      <textarea
        className={styles.textArea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="직접 작성하거나 복사하여 붙여 넣으세요."
      />
      <CountRow label="공백포함" count={included} byte={includedByte} />
      <CountRow label="공백제외" count={excluded} byte={excludedByte} />
      <div className={styles.actionGrid}>
        <PrimaryButton tone="secondary" onClick={() => setText("")}>모두 지우기</PrimaryButton>
        <PrimaryButton onClick={() => navigator.clipboard?.writeText(text)}>전체 복사</PrimaryButton>
      </div>
    </ToolPanel>
  );
}

function SeveranceTool() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [basePay, setBasePay] = useState("");
  const [extraPay, setExtraPay] = useState("");
  const [bonus, setBonus] = useState("");
  const [unusedVacationPay, setUnusedVacationPay] = useState("");
  const [calculated, setCalculated] = useState(false);
  const workDays = Math.max(0, diffDays(startDate, endDate) + (startDate && endDate ? 1 : 0));
  const monthlyTotal = number(basePay) + number(extraPay);
  const threeMonthWage = monthlyTotal * 3;
  const additional = number(bonus) * 0.25 + number(unusedVacationPay) * 0.25;
  const averageDailyWage = workDays > 0 ? Math.round((threeMonthWage + additional) / 90) : 0;
  const severancePay = workDays > 0 ? Math.round(averageDailyWage * 30 * (workDays / 365)) : 0;

  const reset = () => {
    setStartDate("");
    setEndDate("");
    setBasePay("");
    setExtraPay("");
    setBonus("");
    setUnusedVacationPay("");
    setCalculated(false);
  };

  return (
    <ToolPanel title="퇴직금 계산기" onReset={reset}>
      <DateRangeField
        label="입사일과 퇴사일(마지막 근무일)"
        start={startDate}
        end={endDate}
        onStart={setStartDate}
        onEnd={setEndDate}
        required
      />
      {calculated && workDays > 0 ? <p className={styles.inlineResult}>재직일수 {formatNumber(workDays)}일</p> : null}
      <section className={styles.salaryMonths}>
        <div className={styles.sectionLabel}>
          <span><Required />퇴사 전 3개월 월급(세전 금액)</span>
          <button type="button" onClick={() => setExtraPay(extraPay || basePay)}>✓ 모두동일</button>
        </div>
        <div className={styles.monthCard}>
          {[0, 1, 2, 3].map((index) => (
            <MonthPayRows
              key={index}
              title={calculated ? sampleSeveranceMonthTitle(index) : "월급[입사일과 퇴사일을 선택하세요.]"}
              basePay={basePay}
              extraPay={extraPay}
              setBasePay={setBasePay}
              setExtraPay={setExtraPay}
            />
          ))}
          <div className={styles.monthSummary}>
            <strong>합계{calculated ? "(총90일)" : "()"}</strong>
            <ResultRow label="기본금" value={number(basePay) * 4} accent={calculated} />
            <ResultRow label="기타수당" value={number(extraPay) * 4} accent={calculated} />
          </div>
        </div>
      </section>
      <section>
        <p className={styles.sectionLabelText}>그 외 조건 입력 (선택항목)</p>
        <MoneyField label="연간상여금" value={bonus} onChange={setBonus} />
        <MoneyField label="연차수당" value={unusedVacationPay} onChange={setUnusedVacationPay} />
      </section>
      {calculated ? (
        <ResultBox compact>
          <p><strong>1</strong>일 평균 임금은 <strong>{formatNumber(averageDailyWage)}</strong>원이며,</p>
          <p>퇴직금은 총 <strong>{formatNumber(severancePay)}</strong>원입니다.</p>
        </ResultBox>
      ) : null}
      <PrimaryButton tone={calculated ? "secondary" : "primary"} onClick={() => calculated ? reset() : setCalculated(true)}>
        {calculated ? "다시 계산하기" : "계산하기"}
      </PrimaryButton>
      <Notice lines={[
        "본 계산기는 모의계산 결과로 법적 효력이 없습니다.",
        "사용자가 입력한 근무기간 및 임금 기준으로만 산정합니다.",
        "근로자퇴직급여보장법에 의거 퇴직금은 계속근로기간 1년에",
        "   대하여 30일분 이상의 평균임금으로 계산합니다.",
        "통상임금이 평균임금보다 클 경우에는 통상임금을 기준으로",
        "   계산합니다.",
        "회사별 상이한 임금체계에 따라 실제 산정되는 금액과 차이가",
        "   발생할 수 있으니 참고용으로만 활용하세요.",
      ]} />
    </ToolPanel>
  );
}

function VacationTool() {
  const [joinDate, setJoinDate] = useState("");
  const [calculated, setCalculated] = useState(false);
  const tenure = getTenure(joinDate);
  const vacationDays = tenure.years < 1 ? Math.min(11, tenure.months) : Math.min(25, 15 + Math.floor((tenure.years - 1) / 2));

  const reset = () => {
    setJoinDate("");
    setCalculated(false);
  };

  return (
    <ToolPanel title="연차/휴가 계산기" onReset={reset}>
      <NoticeBody>연차/휴가는 입사일 기준으로 계산됩니다.<br />회사의 회계연도에 따라 차이가 날 수 있습니다. (±1일)</NoticeBody>
      <DateField label="입사일" value={joinDate} onChange={setJoinDate} placeholder="입사일을 입력하세요." required />
      {calculated ? (
        <ResultBox compact>
          <p><strong>{tenure.years}</strong>년 <strong>{tenure.months}</strong>개월 <strong>{tenure.days}</strong>일간 근무했습니다.</p>
          <p>햇수로 <strong>{tenure.years + 1}</strong>년 차입니다.</p>
          <p>총 <strong>{vacationDays}</strong>일의 연차/휴가가 지급됩니다.</p>
        </ResultBox>
      ) : null}
      <PrimaryButton tone={calculated ? "secondary" : "primary"} onClick={() => calculated ? reset() : setCalculated(true)}>
        {calculated ? "다시 계산하기" : "계산하기"}
      </PrimaryButton>
      <Notice lines={[
        "본 계산기는 1일도 사용하지 않았다는 가정하에 총 연차/휴가",
        "   일수를 계산합니다.",
        "본 계산기는 모의계산 결과로 법적 효력이 없습니다.",
      ]} />
    </ToolPanel>
  );
}

function UnemploymentTool() {
  const [birthDate, setBirthDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pay1, setPay1] = useState("");
  const [pay2, setPay2] = useState("");
  const [pay3, setPay3] = useState("");
  const [calculated, setCalculated] = useState(false);
  const averageMonthly = Math.round((number(pay1) + number(pay2) + number(pay3)) / 3);
  const dailyPay = Math.min(66000, Math.max(63104, Math.round(averageMonthly / 30 * 0.6)));
  const insuredDays = Math.max(0, diffDays(startDate, endDate));
  const age = getAge(birthDate);
  const benefitDays = age >= 50 ? 210 : insuredDays >= 1080 ? 180 : 150;
  const total = dailyPay * benefitDays;

  const reset = () => {
    setBirthDate("");
    setStartDate("");
    setEndDate("");
    setPay1("");
    setPay2("");
    setPay3("");
    setCalculated(false);
  };

  return (
    <ToolPanel title="실업급여 계산기" onReset={reset}>
      <NoticeBody>퇴사 당시 나이와 고용보험 가입 기간에 따라 실업급여를 받을 수 있는 기간이 달라집니다.<br />퇴사 전 3개월간의 평균 월급을 기준으로 산정됩니다.</NoticeBody>
      <TextField label="생년월일 (주민번호 앞자리 기준)" value={birthDate} onChange={setBirthDate} placeholder="ex) 1999.09.10" required />
      <DateRangeField
        label="입사일과 퇴사일(고용보험 가입일, 종료일)"
        start={startDate}
        end={endDate}
        onStart={setStartDate}
        onEnd={setEndDate}
        required
      />
      <section className={styles.stackedPay}>
        <div className={styles.sectionLabel}>
          <span><Required />퇴사 전 월급</span>
          <button type="button" onClick={() => { setPay2(pay1); setPay3(pay1); }}>✓ 모두동일</button>
        </div>
        <PayLine title="1개월 전" value={pay1} onChange={setPay1} />
        <PayLine title="2개월 전" value={pay2} onChange={setPay2} />
        <PayLine title="3개월 전" value={pay3} onChange={setPay3} />
      </section>
      {calculated ? (
        <ResultBox compact>
          <p><strong>1</strong>일 <strong>{formatNumber(dailyPay)}</strong>원씩 <strong>{benefitDays}</strong>일간 지급됩니다.</p>
          <p>월 평균 <strong>{formatNumber(averageMonthly)}</strong>원이며,</p>
          <p>총 <strong>{formatNumber(total)}</strong>원입니다.</p>
        </ResultBox>
      ) : null}
      <PrimaryButton tone={calculated ? "secondary" : "primary"} onClick={() => calculated ? reset() : setCalculated(true)}>
        {calculated ? "다시 계산하기" : "계산하기"}
      </PrimaryButton>
      <Notice lines={[
        "본 계산기는 모의계산 결과로 법적 효력이 없습니다.",
        "수급 여부 및 정확한 금액은 반드시 관할 고용센터로",
        "   문의하시기 바랍니다.",
      ]} />
    </ToolPanel>
  );
}

function GradeTool() {
  const [score, setScore] = useState("");
  const [max, setMax] = useState("4.5");
  const base = Math.max(0, number(score));
  const maxScore = number(max) || 4.5;
  const converted = [4.0, 4.3, 4.5, 5.0, 7.0, 100].map((target) => ({
    target,
    value: maxScore > 0 ? Math.min(target, base / maxScore * target) : 0,
  }));

  return (
    <ToolPanel title="학점 변환기" onReset={() => setScore("")}>
      <NoticeBody>나의 평균평점을 지원하려는 기업의 기준에 맞게 변환합니다.</NoticeBody>
      <div className={styles.gradeInputs}>
        <input value={score} onChange={(event) => setScore(onlyDecimal(event.target.value))} placeholder="0" inputMode="decimal" />
        <span>/</span>
        <select value={max} onChange={(event) => setMax(event.target.value)}>
          <option value="4.0">4.0</option>
          <option value="4.3">4.3</option>
          <option value="4.5">4.5</option>
          <option value="5.0">5.0</option>
          <option value="7.0">7.0</option>
          <option value="100">100</option>
        </select>
      </div>
      <PrimaryButton onClick={() => undefined}>변환하기</PrimaryButton>
      <div className={styles.gradeResult}>
        {converted.map((item) => (
          <p key={item.target}>
            <strong>{formatGrade(item.value)} / {item.target.toFixed(item.target === 100 ? 0 : 1)}</strong>
            <span>만점</span>
          </p>
        ))}
      </div>
      <Notice lines={[
        "사람인 학점변환기는 서울 및 수도권 4년제 대학에서",
        "   가장 많이 사용하는 환산식을 적용하였습니다.",
        "   따라서, 학교에 따라 오차가 발생할 수 있습니다.",
        "학점변환 점수는 회원님의 성적증명서나 학교 학사과에서",
        "   확인하시는 것이 가장 정확한 점 참고 부탁드립니다.",
      ]} />
    </ToolPanel>
  );
}

function ToolPanel({ title, onReset, children }: { title: string; onReset?: () => void; children: ReactNode }) {
  return (
    <section className={styles.toolPanel}>
      <div className={styles.panelHeader}>
        <h2>{title}</h2>
        {onReset ? <button type="button" onClick={onReset}>초기화</button> : null}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div className={styles.segmented}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className={value === option.value ? styles.activeSegment : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SegmentField({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className={styles.fieldBlock}>
      <span>{required ? <Required /> : null}{label}</span>
      {children}
    </label>
  );
}

function MoneyField({
  label,
  hint,
  actionLabel,
  actionActive,
  onActionClick,
  value,
  onChange,
  description,
  required,
  disabled,
}: {
  label: string;
  hint?: string;
  actionLabel?: string;
  actionActive?: boolean;
  onActionClick?: () => void;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const inputId = useId();

  return (
    <div className={styles.moneyField}>
      <span>
        <label htmlFor={inputId}>{required ? <Required /> : null}{label}</label>
        {hint ? <em>{hint}</em> : null}
        {actionLabel ? (
          <button
            type="button"
            className={actionActive ? styles.moneyActionActive : undefined}
            onClick={(event) => {
              event.stopPropagation();
              onActionClick?.();
            }}
          >
            {actionLabel}
          </button>
        ) : null}
      </span>
      <span className={styles.moneyInput}>
        <input
          id={inputId}
          value={value ? formatNumber(number(value)) : ""}
          onChange={(event) => onChange(onlyNumber(event.target.value))}
          placeholder="0"
          inputMode="numeric"
          disabled={disabled}
        />
        <b>원</b>
      </span>
      {description ? <p className={styles.moneyDescription}>{description}</p> : null}
    </div>
  );
}

function NumberField({ label, value, onChange, unit }: { label: string; value: string; onChange: (value: string) => void; unit: string }) {
  return (
    <label className={styles.moneyField}>
      <span>{label}</span>
      <span className={styles.moneyInput}>
        <input value={value ? formatNumber(number(value)) : ""} onChange={(event) => onChange(onlyNumber(event.target.value))} placeholder="0" inputMode="numeric" />
        <b>{unit}</b>
      </span>
    </label>
  );
}

function TextField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className={styles.textField}>
      <span>{required ? <Required /> : null}{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function DateField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className={styles.dateField}>
      <span>{required ? <Required /> : null}{label}</span>
      <DatePickerControl
        ariaLabel={label}
        value={value}
        placeholder={placeholder || "YYYY-MM-DD"}
        onChange={onChange}
      />
    </label>
  );
}

function DateRangeField({ label, start, end, onStart, onEnd, required }: { label: string; start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void; required?: boolean }) {
  return (
    <div className={styles.dateRangeField}>
      <p>{required ? <Required /> : null}{label}</p>
      <div className={styles.dateRange}>
        <DateInput value={start} onChange={onStart} label={`${label} 시작일`} />
        <span>~</span>
        <DateInput value={end} onChange={onEnd} label={`${label} 종료일`} />
      </div>
    </div>
  );
}

function DateInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <DatePickerControl ariaLabel={label} value={value} placeholder="YYYY-MM-DD" compact onChange={onChange} />;
}

function DatePickerControl({
  ariaLabel,
  value,
  placeholder,
  compact = false,
  type = "date",
  onChange,
}: {
  ariaLabel: string;
  value: string;
  placeholder: string;
  compact?: boolean;
  type?: PickerMode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = parsePickerDate(value, type) || new Date();
  const shownValue = formatPickerDisplayValue(value, type);

  return (
    <div className={`${styles.datePickerControl} ${compact ? styles.datePickerControlCompact : ""}`}>
      <button
        type="button"
        className={styles.datePickerInput}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
      >
        <span className={!shownValue ? styles.datePickerPlaceholder : undefined}>
          {shownValue || placeholder}
        </span>
      </button>
      <span className={styles.dateRangeCalendar} aria-hidden="true" />
      {open && typeof document !== "undefined" ? createPortal(
        <BottomDatePicker
          type={type}
          initialDate={selected}
          onClose={() => setOpen(false)}
          onConfirm={(date) => {
            onChange(formatPickerDate(date, type));
            setOpen(false);
          }}
          onReset={() => {
            onChange("");
            setOpen(false);
          }}
        />,
        document.body,
      ) : null}
    </div>
  );
}

function BottomDatePicker({
  type,
  initialDate,
  onClose,
  onConfirm,
  onReset,
}: {
  type: PickerMode;
  initialDate: Date;
  onClose: () => void;
  onConfirm: (date: Date) => void;
  onReset: () => void;
}) {
  const [draftDate, setDraftDate] = useState(initialDate);
  const [view, setView] = useState<PickerMode>(type === "month" ? "month" : "date");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const scrollY = window.scrollY;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyWidth = document.body.style.width;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.width = previousBodyWidth;
      document.body.style.overflow = previousBodyOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className={styles.bottomSheetBackdrop} role="dialog" aria-modal="true" aria-label="날짜선택">
      <button type="button" className={styles.bottomSheetScrim} aria-label="닫기" onClick={onClose} />
      <div className={`${styles.dateSheet} ${view === "month" ? styles.dateSheetMonth : ""}`}>
        <span className={styles.dateSheetHandle} aria-hidden="true" />
        <div className={styles.dateSheetHeader}>
          <h2>날짜선택</h2>
          <button type="button" className={styles.dateSheetClose} aria-label="닫기" onClick={onClose}>×</button>
        </div>
        {view === "month" ? (
          <MonthPickerSheet date={draftDate} onChange={setDraftDate} />
        ) : (
          <DayPickerSheet date={draftDate} onChange={setDraftDate} onTitleClick={() => setView("month")} />
        )}
        <div className={styles.dateSheetActions}>
          {view === "date" ? (
            <button type="button" className={styles.dateSheetReset} onClick={onReset}>초기화</button>
          ) : null}
          <button
            type="button"
            className={styles.dateSheetConfirm}
            onClick={() => {
              if (type === "date" && view === "month") {
                setView("date");
                return;
              }
              onConfirm(draftDate);
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function DayPickerSheet({
  date,
  onChange,
  onTitleClick,
}: {
  date: Date;
  onChange: (date: Date) => void;
  onTitleClick: () => void;
}) {
  const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const next = new Date(calendarStart);
    next.setDate(calendarStart.getDate() + index);
    return next;
  });

  const moveMonth = (offset: number) => {
    onChange(clampDayToMonth(date.getFullYear(), date.getMonth() + offset, date.getDate()));
  };

  return (
    <div className={styles.dayPicker}>
      <div className={styles.dateSheetMonthNav}>
        <button type="button" aria-label="이전 달" onClick={() => moveMonth(-1)}>‹</button>
        <button type="button" className={styles.dateSheetMonthTitle} onClick={onTitleClick}>
          {date.getFullYear()}.{String(date.getMonth() + 1).padStart(2, "0")} <span aria-hidden="true">⌄</span>
        </button>
        <button type="button" aria-label="다음 달" onClick={() => moveMonth(1)}>›</button>
      </div>
      <div className={styles.dayPickerWeekdays}>
        {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className={styles.dayPickerGrid}>
        {days.map((day) => {
          const selected = isSameDate(day, date);
          const muted = day.getMonth() !== date.getMonth();
          return (
            <button
              type="button"
              key={day.toISOString()}
              className={`${styles.dayPickerDay} ${selected ? styles.dayPickerDaySelected : ""} ${muted ? styles.dayPickerDayMuted : ""}`}
              onClick={() => onChange(day)}
            >
              <span>{day.getDate()}</span>
              {selected ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthPickerSheet({
  date,
  onChange,
}: {
  date: Date;
  onChange: (date: Date) => void;
}) {
  const currentYear = new Date().getFullYear();
  const minYear = Math.min(MIN_PICKER_YEAR, date.getFullYear());
  const maxYear = Math.max(currentYear, date.getFullYear());
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => maxYear - index);
  const months = Array.from({ length: 12 }, (_, index) => index + 1);

  return (
    <div className={styles.monthPicker}>
      <button type="button" className={styles.monthPickerTitle} aria-label="선택한 년월">
        {date.getFullYear()}.{String(date.getMonth() + 1).padStart(2, "0")} <span aria-hidden="true">⌃</span>
      </button>
      <div className={styles.monthPickerFields}>
        <label>
          <select value={date.getFullYear()} onChange={(event) => onChange(clampDayToMonth(Number(event.target.value), date.getMonth(), 1))}>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <span>년</span>
        </label>
        <label>
          <select value={date.getMonth() + 1} onChange={(event) => onChange(clampDayToMonth(date.getFullYear(), Number(event.target.value) - 1, 1))}>
            {months.map((month) => <option key={month} value={month}>{String(month).padStart(2, "0")}</option>)}
          </select>
          <span>월</span>
        </label>
      </div>
    </div>
  );
}

function MonthPayRows({ title, basePay, extraPay, setBasePay, setExtraPay }: { title: string; basePay: string; extraPay: string; setBasePay: (value: string) => void; setExtraPay: (value: string) => void }) {
  return (
    <div className={styles.monthRows}>
      <p>{title}</p>
      <MoneyLine label="기본금" value={basePay} onChange={setBasePay} />
      <MoneyLine label="기타수당" value={extraPay} onChange={setExtraPay} />
    </div>
  );
}

function PayLine({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className={styles.payLine}>
      <p>{title}</p>
      <MoneyLine label="" value={value} onChange={onChange} />
    </div>
  );
}

function MoneyLine({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={styles.moneyLine}>
      {label ? <span>{label}</span> : null}
      <input value={value ? formatNumber(number(value)) : ""} onChange={(event) => onChange(onlyNumber(event.target.value))} placeholder="0" inputMode="numeric" />
      <b>원</b>
    </label>
  );
}

function ResultBox({ title, compact, children }: { title?: string; compact?: boolean; children: React.ReactNode }) {
  return (
    <section className={`${styles.resultBox} ${compact ? styles.resultBoxCompact : ""}`}>
      {title ? <h3>{title}</h3> : null}
      {children}
    </section>
  );
}

function ResultRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <p className={accent ? styles.accentRow : undefined}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <em>원</em>
    </p>
  );
}

function CountRow({ label, count, byte }: { label: string; count: number; byte: number }) {
  return (
    <p className={styles.countRow}>
      <span>{label}</span>
      <strong>{formatNumber(count)}</strong><em>자</em>
      <strong>{formatNumber(byte)}</strong><em>byte</em>
    </p>
  );
}

function PrimaryButton({ children, onClick, tone = "primary" }: { children: ReactNode; onClick: () => void; tone?: "primary" | "secondary" }) {
  return (
    <button type="button" className={`${styles.primaryButton} ${tone === "secondary" ? styles.secondaryButton : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Notice({ lines }: { lines: string[] }) {
  return <div className={styles.notice}>{lines.map((line) => <p key={line}>- {line}</p>)}</div>;
}

function NoticeBody({ children }: { children: ReactNode }) {
  return <p className={styles.noticeBody}>{children}</p>;
}

function Required() {
  return <b className={styles.required}>*</b>;
}

function parseTool(value: string | null | undefined): ToolKey {
  return tools.some((tool) => tool.key === value) ? (value as ToolKey) : "salary";
}

function onlyNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function normalizeLimitedInteger(value: string, min: number, max: number, onLimit: () => void) {
  const numericValue = onlyNumber(value);
  if (!numericValue) return min > 0 ? String(min) : "";
  const nextValue = Number(numericValue);
  if (nextValue > max) {
    onLimit();
    return String(max);
  }
  return String(Math.max(min, nextValue));
}

function clampMoneyAmount(value: string) {
  const numericValue = onlyNumber(value);
  if (!numericValue) return "";
  return String(Math.min(Number(numericValue), MAX_MONEY_AMOUNT));
}

function onlyDecimal(value: string) {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

function number(value: string) {
  return Number(value.replace(/[^\d.]/g, "")) || 0;
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatKoreanWon(value: number) {
  const amount = Math.min(Math.max(0, Math.floor(value)), MAX_MONEY_AMOUNT);
  if (!amount) return "영원";

  const digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
  const smallUnits = ["", "십", "백", "천"];
  const bigUnits = ["", "만", "억"];
  const parts: string[] = [];
  let rest = amount;
  let unitIndex = 0;

  while (rest > 0) {
    const chunk = rest % 10000;
    if (chunk > 0) {
      parts.unshift(`${formatKoreanChunk(chunk, digits, smallUnits)}${bigUnits[unitIndex] || ""}`);
    }
    rest = Math.floor(rest / 10000);
    unitIndex += 1;
  }

  return `${parts.join(" ")}원`;
}

function formatKoreanChunk(value: number, digits: string[], smallUnits: string[]) {
  const parts: string[] = [];

  for (let index = 3; index >= 0; index -= 1) {
    const divisor = 10 ** index;
    const digit = Math.floor(value / divisor) % 10;
    if (digit) {
      parts.push(`${digits[digit]}${smallUnits[index]}`);
    }
  }

  return parts.join("");
}

function formatGrade(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "");
}

function normalizeDateInputValue(value?: string | null) {
  const text = (value || "").trim();
  if (!text) return "";
  const isoDate = text.match(/^((?:19|20)\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/);
  if (isoDate) return isoDate[0];

  const dottedDate = text.match(/^((?:19|20)\d{2})[.\-/\s년]+(0?[1-9]|1[0-2])[.\-/\s월]+(0?[1-9]|[12]\d|3[01])/);
  if (dottedDate) {
    return `${dottedDate[1]}-${dottedDate[2].padStart(2, "0")}-${dottedDate[3].padStart(2, "0")}`;
  }

  return "";
}

function parsePickerDate(value?: string | null, type: PickerMode = "date") {
  const normalized = normalizeDateInputValue(value);
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

function formatPickerDisplayValue(value?: string | null, type: PickerMode = "date") {
  const normalized = normalizeDateInputValue(value);
  if (!normalized) return "";
  if (type === "month") return normalized.slice(0, 7).replace(/-/g, ".");
  return normalized.replace(/-/g, ".");
}

function clampDayToMonth(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function isSameDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
}

function byteLength(value: string) {
  return new Blob([value]).size;
}

function roundWon(value: number) {
  return Math.round(value / 10) * 10;
}

function floorTen(value: number) {
  return Math.floor(value / 10) * 10;
}

function estimateIncomeTax(taxable: number, dependents: number, children: number) {
  if (taxable <= 0) return 0;

  if (taxable > 10000000) {
    return estimateHighIncomeTax(taxable, dependents, children);
  }

  const familyDiscount = Math.max(0, dependents - 1) * 0.001 + children * 0.001;
  if (taxable <= 1400000) return 0;
  if (taxable <= 3000000) return floorTen(taxable * Math.max(0, 0.012 - familyDiscount));
  if (taxable <= 5000000) return floorTen(taxable * Math.max(0, 0.025 - familyDiscount));
  return floorTen(taxable * Math.max(0, 0.04 - familyDiscount));
}

function estimateHighIncomeTax(taxable: number, dependents: number, children: number) {
  const baseAtTenMillion = estimateTenMillionTax(dependents, children);

  if (taxable <= 14000000) {
    return floorTen(baseAtTenMillion + (taxable - 10000000) * 0.98 * 0.35);
  }

  if (taxable <= 28000000) {
    return floorTen(baseAtTenMillion + 1372000 + (taxable - 14000000) * 0.98 * 0.38);
  }

  if (taxable <= 30000000) {
    return floorTen(baseAtTenMillion + 6585600 + (taxable - 28000000) * 0.98 * 0.4);
  }

  if (taxable <= 45000000) {
    return floorTen(baseAtTenMillion + 7369600 + (taxable - 30000000) * 0.4);
  }

  if (taxable <= 87000000) {
    return floorTen(baseAtTenMillion + 13369600 + (taxable - 45000000) * 0.42);
  }

  return floorTen(baseAtTenMillion + 31009600 + (taxable - 87000000) * 0.45);
}

function estimateTenMillionTax(dependents: number, children: number) {
  const effectiveDependents = Math.min(MAX_DEPENDENTS, Math.max(1, dependents + children));
  const baseForElevenDependents = 756680;
  const dependentStep = 50000;

  return Math.max(0, baseForElevenDependents + (MAX_DEPENDENTS - effectiveDependents) * dependentStep);
}

function diffDays(start: string, end: string) {
  if (!start || !end) return 0;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000));
}

function getTenure(joinDate: string) {
  if (!joinDate) return { years: 0, months: 0, days: 0 };
  const start = new Date(`${joinDate}T00:00:00`);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) };
}

function getAge(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  if (normalized.length < 8) return 0;
  const birth = new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return Math.max(0, age);
}

function sampleSeveranceMonthTitle(index: number) {
  const labels = [
    "월급[2022. 04. 01 ~ 2022. 04. 10(총10일)]",
    "월급[2022. 03. 01 ~ 2022. 03. 31(총31일)]",
    "월급[2022. 02. 01 ~ 2022. 02. 28(총28일)]",
    "월급[2022. 01. 11 ~ 2022. 01. 31(총21일)]",
  ];
  return labels[index] || labels[0];
}
