"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCurrentUser, getHomeJobs } from "@/features/home/home.api";
import type { CurrentUserDto } from "@/features/home/home.dto";
import { AppFooter, AppHeader } from "@/features/layout/components/AppChrome";
import {
  getDiagnosisResultDetail,
  getDiagnosisResultHistory,
  selectDiagnosisResult,
} from "../diagnosis.api";
import {
  DIAGNOSIS_SHARE_DESCRIPTION,
  DIAGNOSIS_SHARE_TITLE,
  getDiagnosisResultShareUrl,
  getDiagnosisShareImageUrl,
} from "../diagnosis-share";
import type {
  DiagnosisResultDetailResponseDto,
  DiagnosisResultHistoryItemDto,
  DiagnosisTypeCode,
} from "../diagnosis.dto";
import styles from "./DiagnosisResultDetail.module.css";

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      init: (key: string) => void;
      Share?: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

type TypeCopy = {
  color: string;
  heroSummary: string;
  description: string;
  tips: Array<{ title: string; description: string }>;
};

const TYPE_COPY: Record<DiagnosisTypeCode, TypeCopy> = {
  stability: {
    color: "#15489a",
    heroSummary: "묵묵히 준비해 결국 붙는 타입",
    description: "안정적인 환경에서 원칙을 지키며 꾸준히 성과를 내는 타입이에요. 화려하진 않아도 맡은 일을 끝까지 책임지고, 조직 안에서 신뢰를 쌓아가는 데 강해요. 급하게 뛰기보다 차근차근 준비해 결국 합격에 도달하는 스타일이에요.",
      tips: [
      {
        title: "'꾸준함'을 스토리로 만들기",
        description:
          "안정 추구형에게는 짧고 화려한 성과보다 오랜 기간 책임감을 가지고 이어온 경험이 훨씬 강한 무기가 될 수 있어요. 장기 프로젝트, 아르바이트, 자격증 준비, 동아리나 봉사활동처럼 꾸준히 지속한 경험에서 어떤 어려움이 있었고 어떻게 끝까지 유지했는지를 설명해보세요. 단순히 '오래 했다'에서 끝내지 말고, 그 과정에서 맡은 역할과 개선한 점, 마지막에 만들어낸 결과까지 연결하면 신뢰감 있는 스토리가 됩니다.",
      },
      {
        title: "책임감·정확성을 근거로 보여주기",
        description:
          "'책임감이 있습니다', '꼼꼼합니다' 같은 표현만으로는 지원자의 실제 강점이 잘 전달되지 않아요. 실수를 줄이기 위해 체크리스트를 만들었거나, 일정과 자료를 관리해 누락을 막았거나, 끝까지 문제를 해결했던 실제 사례를 함께 제시해보세요. 가능하다면 오류 감소, 일정 단축, 처리 건수처럼 숫자로 확인할 수 있는 결과를 덧붙이면 안정 추구형의 강점이 훨씬 설득력 있게 보여요.",
      },
      {
        title: "'소극적' 인상 주지 않기",
        description:
          "안정을 중요하게 생각하는 성향은 면접관에게 자칫 새로운 일을 피하거나 변화에 소극적인 사람처럼 보일 수 있어요. 그래서 익숙하지 않은 업무라도 필요성을 판단한 뒤 스스로 배우고 시도했던 경험을 하나 준비해두는 것이 좋아요. '무조건 변화를 싫어하는 사람'이 아니라 충분히 검토한 뒤에는 책임 있게 행동하는 사람이라는 점을 보여주면 신중함이 오히려 강점으로 전달됩니다.",
      },
    ],
  },
  challenge: {
    color: "#f3a427",
    heroSummary: "빠르게 부딪히며 성장하는 타입",
    description: "낯선 방식이나 높은 목표 앞에서 움츠러들기보다 먼저 시도해보는 타입이에요. 실패 가능성이 있어도 성장 가능성이 보이면 빠르게 움직이며 경험으로 방향을 잡습니다.",
    tips: [
      {
        title: "도전을 성과 서사로 만들기",
        description:
          "도전 개척형은 새로운 일을 시도했다는 사실 자체보다 그 시도가 어떤 변화를 만들었는지를 보여주는 것이 중요해요. 기존 방식의 문제를 발견하고 새로운 방법을 적용했다면 왜 그 방법을 선택했는지, 실행 과정에서 어떤 어려움을 만났는지까지 구체적으로 설명해보세요. 마지막에는 매출, 참여율, 처리 시간, 완성도처럼 실제로 달라진 결과를 연결해야 단순한 호기심이 아니라 성과를 만드는 도전으로 평가받을 수 있어요.",
      },
      {
        title: "빠른 판단의 근거 보여주기",
        description:
          "빠르게 움직이는 것은 장점이지만 근거 없이 결정하는 사람처럼 보이면 오히려 위험하게 평가될 수 있어요. 새로운 시도를 하기 전에 어떤 정보를 확인했고, 여러 선택지 중 무엇을 기준으로 결정했는지를 함께 설명해보세요. 특히 실패했을 때의 영향을 줄이기 위해 작은 범위에서 먼저 테스트하거나 중간 점검을 했던 경험을 보여주면 도전성과 판단력을 동시에 드러낼 수 있어요.",
      },
      {
        title: "시작만 빠른 인상 피하기",
        description:
          "새로운 일에 쉽게 뛰어드는 성향은 반대로 시작은 많지만 마무리가 약하다는 인상을 줄 수도 있어요. 따라서 자소서나 면접에서는 처음 시작한 순간보다 어려움이 생긴 뒤에도 어떻게 끝까지 이어갔는지를 강조하는 것이 좋아요. 계획을 수정하고 필요한 사람에게 도움을 요청하거나 부족한 부분을 보완해 결국 결과물을 완성했던 경험을 준비하면 추진력과 지속력을 함께 보여줄 수 있습니다.",
      },
    ],
  },
  teamwork: {
    color: "#a154e5",
    heroSummary: "함께 맞춰가며 성과를 내는 타입",
    description: "혼자 밀어붙이기보다 주변과 방향을 맞추고 역할을 나눌 때 강점이 살아나는 타입이에요. 협의와 피드백을 통해 안정적인 결론을 만들고 관계 안에서 성과를 냅니다.",
    tips: [
      {
        title: "조율의 결과를 수치로 말하기",
        description:
          "협업을 잘했다는 설명만으로는 실제로 어떤 기여를 했는지 평가하기 어려워요. 의견이 달랐던 구성원들의 요구를 어떻게 정리했고, 역할이나 일정, 업무 방식을 어떻게 조율했는지를 구체적으로 설명해보세요. 그 결과 회의 시간이 줄었거나 일정이 앞당겨졌거나 작업 오류가 감소했다면 그 변화까지 함께 제시하면 협업 능력이 실제 성과로 연결됐다는 점을 보여줄 수 있어요.",
      },
      {
        title: "내 책임 범위 분명히 하기",
        description:
          "팀워크를 강조하다 보면 모든 결과를 '우리 팀이 했다'고 표현해서 정작 본인의 역할이 보이지 않는 경우가 많아요. 팀 전체 목표를 설명한 뒤 그 안에서 내가 맡은 업무와 직접 결정하거나 실행한 부분을 명확하게 구분해보세요. 내가 어떤 행동을 했고 그 행동이 팀의 결과에 어떤 영향을 줬는지를 연결하면 협업 능력과 개인 역량을 동시에 보여줄 수 있습니다.",
      },
      {
        title: "갈등을 피한 인상 주지 않기",
        description:
          "협업을 중요하게 생각하는 사람은 때때로 의견 충돌을 피하고 상대방에게 맞춰주는 사람처럼 보일 수 있어요. 실제로 의견이 달랐던 상황에서 상대방의 주장을 듣고, 공통된 목표나 객관적인 기준을 세워 합의를 이끌어낸 경험을 준비해보세요. 갈등을 없애는 것이 아니라 필요한 의견 충돌을 생산적인 결론으로 바꿀 수 있다는 점을 보여주는 것이 중요합니다.",
      },
    ],
  },
  individual: {
    color: "#e85759",
    heroSummary: "혼자 집중할 때 최고 능률을 내는 타입",
    description: "스스로 몰입할 시간이 있을 때 결과가 좋아지는 타입이에요. 독립적으로 기준을 세우고 깊게 파고들며, 방해가 적은 환경에서 집중력이 살아납니다.",
    tips: [
      {
        title: "깊이 있는 결과물 제시하기",
        description:
          "독립 몰입형의 가장 큰 장점은 하나의 문제를 깊게 파고들어 높은 완성도의 결과를 만들어낼 수 있다는 점이에요. 혼자 조사하거나 분석하고 개선했던 프로젝트가 있다면 단순히 결과물만 보여주지 말고 처음 상태와 개선 이후의 차이를 함께 설명해보세요. 자료 분석, 오류 수정, 품질 향상처럼 집중력을 통해 다른 사람이 놓친 부분을 찾아낸 경험이 있다면 전문성과 몰입력을 잘 보여줄 수 있습니다.",
      },
      {
        title: "자기주도 과정을 설명하기",
        description:
          "스스로 일을 잘한다는 강점은 구체적인 관리 방식이 함께 설명될 때 더 설득력이 생겨요. 목표를 어떻게 쪼갰는지, 진행 상황을 어떤 방식으로 확인했는지, 문제가 생겼을 때 어떻게 해결 방법을 찾았는지를 단계적으로 이야기해보세요. 누군가 계속 지시하지 않아도 스스로 필요한 일을 찾아 계획하고 끝까지 완성할 수 있다는 점을 보여주면 자기주도성이 강한 인재로 평가받기 좋아요.",
      },
      {
        title: "소통이 부족한 인상 피하기",
        description:
          "혼자 집중하는 것을 선호하는 성향은 자칫 팀과 정보를 공유하지 않거나 협업을 어려워하는 사람처럼 보일 수 있어요. 독립적으로 작업하더라도 중간 결과를 공유하고 피드백을 받은 뒤 방향을 수정했던 경험을 함께 준비해보세요. '혼자 일하는 사람'이 아니라 혼자서도 높은 집중력을 발휘하면서 필요한 순간에는 정확하게 소통할 수 있는 사람이라는 점을 보여주는 것이 중요해요.",
      },
    ],
  },
  execution: {
    color: "#5bbf47",
    heroSummary: "일단 움직여 기어코 끝내는 타입",
    description: "완벽한 계획을 기다리기보다 작은 행동으로 시작하며 방향을 잡는 타입이에요. 해야 할 일이 보이면 빠르게 움직이고 실행 과정에서 필요한 정보를 보완해갑니다.",
    tips: [
      {
        title: "행동 속도를 결과로 증명하기",
        description:
          "실행 추진형은 생각에 머물지 않고 실제 행동으로 옮기는 속도가 큰 강점이에요. 문제가 발생했을 때 다른 사람이 결정해주기를 기다리지 않고 먼저 할 수 있는 일을 찾아 시작했던 경험을 구체적으로 준비해보세요. 빠르게 대응한 결과 일정 지연을 막았거나 고객 불편을 줄였거나 업무 시간을 단축했다면 그 결과까지 함께 제시해 실행력이 조직에 어떤 도움을 줬는지 보여주는 것이 좋아요.",
      },
      {
        title: "우선순위 기준 말하기",
        description:
          "빠른 실행만 강조하면 충분한 판단 없이 일을 처리하는 사람처럼 보일 수도 있어요. 여러 업무가 동시에 발생했을 때 중요도, 긴급도, 영향 범위 등을 기준으로 무엇부터 처리했는지 설명해보세요. 단순히 빨리 움직인 것이 아니라 상황을 판단하고 가장 중요한 일을 먼저 실행했다는 점을 보여주면 추진력과 판단력을 함께 인정받을 수 있습니다.",
      },
      {
        title: "성급한 인상 줄이기",
        description:
          "실행력이 강한 사람에게 가장 필요한 보완점은 속도 때문에 중요한 조건을 놓치지 않는 것이에요. 업무를 시작하기 전에 반드시 확인하는 항목이나 중간 점검 기준, 완료 후 검토하는 습관이 있다면 구체적으로 설명해보세요. 빠르게 움직이면서도 오류와 위험을 관리할 수 있다는 점을 보여주면 단순한 행동파가 아니라 신뢰할 수 있는 실행형 인재로 보일 수 있어요.",
      },
    ],
  },
  planning: {
    color: "#6a7e92",
    heroSummary: "큰 그림을 그리고 방향을 설계하는 타입",
    description: "시작 전 목표와 기준, 순서를 정리해야 힘이 나는 타입이에요. 정보를 비교하고 가능성을 분석해 우선순위를 세우며 복잡한 상황을 구조화하는 데 강합니다.",
    tips: [
      {
        title: "계획이 실행된 장면 보여주기",
        description:
          "계획을 잘 세운다는 강점은 실제 행동과 결과로 이어졌을 때 가장 큰 의미를 가져요. 목표를 정한 뒤 업무를 어떤 단계로 나누고 일정과 역할을 어떻게 배분했는지, 그리고 계획대로 진행되지 않았을 때 무엇을 수정했는지를 설명해보세요. 최종적으로 일정 준수, 비용 절감, 업무 효율 향상과 같은 결과까지 연결하면 단순한 계획형이 아니라 실행 가능한 전략을 만드는 사람이라는 인상을 줄 수 있어요.",
      },
      {
        title: "복잡한 정보를 구조화하기",
        description:
          "전략 기획형은 여러 정보와 조건이 섞여 있는 상황을 정리하고 중요한 기준을 찾아내는 데 강점이 있어요. 서로 다른 요구사항이나 데이터가 주어졌을 때 어떤 기준으로 분류하고 우선순위를 정했는지 구체적인 사례를 준비해보세요. 복잡했던 상황을 표, 일정, 단계, 기준 등으로 정리해 구성원들이 쉽게 이해하고 움직일 수 있게 만든 경험이 있다면 기획력과 커뮤니케이션 능력을 함께 보여줄 수 있습니다.",
      },
      {
        title: "실행이 느린 인상 피하기",
        description:
          "계획과 분석을 중요하게 생각하는 성향은 완벽한 답을 찾느라 시작이 늦어지는 사람처럼 보일 수 있어요. 충분한 정보가 없는 상황에서도 마감과 목표를 고려해 어느 시점에 결정을 내렸는지, 그리고 이후 필요한 내용을 보완했던 경험을 준비해보세요. 모든 것을 완벽하게 준비한 뒤 움직이는 사람이 아니라 필요한 수준까지 분석한 뒤 실제 행동으로 전환할 수 있다는 점을 보여주는 것이 중요합니다.",
      },
    ],
  },
  principle: {
    color: "#bd895e",
    heroSummary: "작은 실수도 놓치지 않는 꼼꼼한 타입",
    description: "규칙과 원칙, 빠진 조건을 중요하게 보는 타입이에요. 작은 오류도 그냥 넘기지 않고 다시 확인하며 정확성과 신뢰가 중요한 일에서 강점을 발휘합니다.",
    tips: [
      {
        title: "정확성을 성과로 연결하기",
        description:
          "정밀 관리형의 꼼꼼함은 단순한 성격적 장점보다 실제 문제를 예방한 사례로 보여줄 때 훨씬 가치가 커져요. 자료를 검토하면서 오류나 누락을 발견했거나, 반복되는 실수를 막기 위해 점검 기준을 만들었던 경험을 구체적으로 설명해보세요. 그 결과 재작업 횟수가 줄었거나 처리 정확도가 높아졌거나 비용과 시간이 절감됐다면 정확성이 실제 조직 성과로 이어졌다는 점을 보여줄 수 있어요.",
      },
      {
        title: "중요 기준부터 점검하기",
        description:
          "모든 내용을 같은 수준으로 꼼꼼하게 확인하면 오히려 업무 속도가 느려질 수 있기 때문에 무엇을 먼저 확인하는지가 중요해요. 오류가 발생했을 때 영향이 큰 항목, 법적·금전적 위험이 있는 부분, 고객에게 직접 영향을 주는 조건을 우선적으로 점검했던 경험을 준비해보세요. 이렇게 중요도에 따라 검토 순서를 정했다는 점을 보여주면 꼼꼼함뿐 아니라 효율적으로 업무를 관리하는 능력도 함께 드러납니다.",
      },
      {
        title: "융통성 없는 인상 피하기",
        description:
          "규칙과 원칙을 중요하게 생각하는 성향은 상황이 달라져도 기존 방식만 고집하는 사람처럼 오해받을 수 있어요. 핵심적으로 반드시 지켜야 하는 기준과 상황에 따라 변경할 수 있는 절차를 구분해서 대응했던 경험을 하나 준비해보세요. 원칙을 무조건 적용하는 사람이 아니라 중요한 기준은 지키면서도 현실적인 대안을 찾을 수 있다는 점을 보여주면 안정감과 유연성을 함께 전달할 수 있습니다.",
      },
    ],
  },
  flexibility: {
    color: "#0b778b",
    heroSummary: "어떤 상황에도 부드럽게 적응하는 타입",
    description: "계획대로 되지 않아도 멈추기보다 그때그때 가능한 방법을 찾는 타입이에요. 기존 기준에만 묶이지 않고 상황을 읽으며 현실적인 선택지를 조정합니다.",
    tips: [
      {
        title: "변화 대응 과정을 구조화하기",
        description:
          "유연 대응형은 예상과 다른 상황에서도 빠르게 적응하는 것이 강점이지만, 단순히 '그때그때 잘 대처했다'고 설명하면 역량이 명확하게 보이지 않을 수 있어요. 어떤 변화가 발생했고 가장 먼저 무엇을 파악했으며, 가능한 대안 중 어떤 기준으로 방법을 선택했는지를 순서대로 설명해보세요. 마지막으로 변경한 방법이 실제로 어떤 결과를 만들었는지까지 연결하면 상황 대응 능력을 훨씬 구체적으로 보여줄 수 있습니다.",
      },
      {
        title: "현실적인 대안 찾기",
        description:
          "계획대로 진행할 수 없는 상황에서는 목표 자체를 포기하는 것이 아니라 현재 가진 자원 안에서 가능한 다른 방법을 찾는 능력이 중요해요. 인력, 시간, 예산, 시스템 등의 제약이 생겼을 때 원래 목표를 유지하면서 방법만 바꿨던 경험을 준비해보세요. 완벽한 조건을 기다리지 않고 현실적인 대안을 찾아 업무를 계속 진행했다는 점을 보여주면 유연성과 문제 해결 능력을 동시에 강조할 수 있어요.",
      },
      {
        title: "기준 없는 인상 피하기",
        description:
          "상황에 따라 방법을 쉽게 바꾸는 성향은 반대로 일관된 기준이 없거나 결정을 자주 번복하는 사람처럼 보일 수 있어요. 업무 방식은 바꾸더라도 품질, 일정, 고객 경험처럼 반드시 지키려고 했던 핵심 기준이 무엇이었는지를 함께 설명해보세요. '무엇이든 바꾸는 사람'이 아니라 목표와 원칙은 유지하면서 상황에 맞는 방법을 선택하는 사람이라는 점을 보여주는 것이 중요합니다.",
      },
    ],
  },
};

const POINT_TITLES: Record<DiagnosisTypeCode, [string, string, string, string]> = {
  stability: ["책임감", "꼼꼼함", "지속력", "새로운 시도에 신중한 편"],
  challenge: ["도전성", "추진력", "적응력", "기준 세우기"],
  teamwork: ["협업력", "조율력", "공감력", "독립 판단 연습"],
  individual: ["몰입력", "자기주도", "분석력", "중간 공유 늘리기"],
  execution: ["실행력", "속도감", "문제 해결", "확인 습관 만들기"],
  planning: ["기획력", "구조화", "판단력", "빠른 실행 연습"],
  principle: ["정확성", "신뢰성", "관리력", "유연한 대안 찾기"],
  flexibility: ["유연성", "대응력", "적응력", "일관된 기준 세우기"],
};

export function DiagnosisResultDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedResultId = searchParams.get("resultId") || undefined;
  const [detail, setDetail] = useState<DiagnosisResultDetailResponseDto | null>(null);
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<DiagnosisResultHistoryItemDto[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState("공유하고 코칭 받기 →");
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const shareRewardPollingRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getCurrentUser(),
      getDiagnosisResultDetail(selectedResultId),
      getHomeJobs().catch(() => null),
    ])
      .then(([userResponse, resultResponse, homeResponse]) => {
        if (!active) return;
        setUser(userResponse.user);
        setDetail(resultResponse);
        setBookmarkCount(homeResponse?.bookmarkCount ?? 0);
        setError(null);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "진단 결과를 불러오지 못했습니다."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [selectedResultId]);

  useEffect(() => () => {
    if (shareRewardPollingRef.current) {
      window.clearTimeout(shareRewardPollingRef.current);
    }
  }, []);

  const loadHistory = useCallback(async (cursor?: string) => {
    setHistoryLoading(true);
    try {
      const response = await getDiagnosisResultHistory(cursor);
      const currentItem = detail
        ? {
            resultId: detail.result.resultId,
            runId: detail.result.runId,
            typeCode: detail.result.typeCode,
            typeName: detail.result.typeName,
            completedAt: detail.completedAt,
            isSelected: true,
          }
        : null;
      const responseItems = currentItem && !cursor
        ? response.items.filter((item) => item.resultId !== currentItem.resultId)
        : response.items;
      const nextItems = !cursor && currentItem
        ? [currentItem, ...responseItems]
        : responseItems;
      setHistory((current) => cursor
        ? [...current, ...nextItems.filter((item) => !current.some((saved) => saved.resultId === item.resultId))]
        : nextItems);
      setHistoryCursor(response.nextCursor);
    } finally {
      setHistoryLoading(false);
    }
  }, [detail]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!historyOpen || !sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && historyCursor && !historyLoading) void loadHistory(historyCursor);
    }, { rootMargin: "160px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [historyCursor, historyLoading, historyOpen, loadHistory]);

  const nickname = user?.nickname || user?.displayName || "회원";
  const points = useMemo(() => {
    if (!detail) return [];
    const titles = POINT_TITLES[detail.result.typeCode];
    return [
      ...detail.result.strengths.slice(0, 3).map((text, index) => ({ title: titles[index], text, growth: false })),
      { title: titles[3], text: detail.result.growthPoints[0] || "강점을 유지하면서 보완할 기준을 하나 정해보세요.", growth: true },
    ];
  }, [detail]);

  const waitForShareReward = useCallback((previousBalance?: number) => {
    if (shareRewardPollingRef.current) {
      window.clearTimeout(shareRewardPollingRef.current);
    }

    let attempts = 0;
    let observedBalance = previousBalance;
    const poll = async () => {
      attempts += 1;
      try {
        const response = await getCurrentUser();
        const nextBalance = response.authenticated ? response.user?.creditBalance : undefined;
        if (response.authenticated && response.user) {
          setUser(response.user);
        }

        if (typeof nextBalance === "number") {
          if (typeof observedBalance === "number" && nextBalance > observedBalance) {
            window.dispatchEvent(new CustomEvent("gongbu-ticket-rewarded", {
              detail: {
                message: "진단권 1장이 추가되었습니다.",
                balanceAfter: nextBalance,
              },
            }));
            setShareMessage("티켓 지급 완료!");
            window.setTimeout(() => setShareMessage("공유하고 코칭 받기 →"), 1600);
            return;
          }
          observedBalance = nextBalance;
        }
      } catch {
        // Keep polling briefly; the webhook can arrive a little after the user returns.
      }

      if (attempts < 10) {
        shareRewardPollingRef.current = window.setTimeout(poll, 1500);
      } else {
        setShareMessage("공유하고 코칭 받기 →");
      }
    };

    shareRewardPollingRef.current = window.setTimeout(poll, 1500);
  }, []);

  if (loading) return <ResultState message="진단 결과를 불러오고 있어요." />;
  if (!detail || error) return <ResultState message={error || "진단 결과가 없습니다."} />;

  const { result } = detail;
  const copy = TYPE_COPY[result.typeCode];
  const displayedJobCategories = result.jobCategories.slice(0, 6);
  const maxHiringCount = Math.max(1, ...detail.monthlyHiring.categories.map((item) => item.count));
  const recommendedJobsParams = new URLSearchParams({
    view: "recommended",
    scope: "monthly-regular",
    resultId: result.resultId,
  });
  const recommendedNcsCategories =
    detail.monthlyHiring.categories.map((category) => category.name).filter(Boolean);
  if (recommendedNcsCategories.length) {
    recommendedJobsParams.set("ncs", recommendedNcsCategories.join("|"));
  }
  const recommendedJobsHref = `/jobs?${recommendedJobsParams.toString()}`;

  const openHistory = () => {
    setHistoryOpen(true);
    if (!history.length && !historyLoading) void loadHistory();
  };

  const shareResult = async () => {
    const publicOrigin = window.location.origin;
    const shareUrl = getDiagnosisResultShareUrl(result.resultId, publicOrigin);
    const shareImageUrl = getDiagnosisShareImageUrl(publicOrigin);
    const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY?.trim();
    try {
      if (!kakaoKey) {
        await navigator.clipboard.writeText(shareUrl);
        setShareMessage("링크 복사 완료!");
        window.setTimeout(() => setShareMessage("공유하고 코칭 받기 →"), 1600);
        return;
      }

      const kakao = await loadKakaoSdk();
      if (!kakao.isInitialized()) kakao.init(kakaoKey);
      if (!kakao.Share?.sendDefault) throw new Error("Kakao Share SDK is unavailable");

      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: DIAGNOSIS_SHARE_TITLE,
          description: `${nickname}님의 강점·성향 유형은 ${result.typeName}이에요. ${DIAGNOSIS_SHARE_DESCRIPTION}`,
          imageUrl: shareImageUrl,
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
        buttons: [
          {
            title: "결과 보러가기",
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl,
            },
          },
        ],
        ...(user ? {
          serverCallbackArgs: {
            gb_action: "diagnosis_result_share",
            gb_user_id: user.id,
            gb_result_id: result.resultId,
          },
        } : {}),
      });

      if (user) {
        setShareMessage("공유 완료 후 지급됩니다.");
        waitForShareReward(user.creditBalance);
      } else {
        setShareMessage("공유 완료!");
        window.setTimeout(() => setShareMessage("공유하고 코칭 받기 →"), 1600);
      }
    } catch {
      setShareMessage("다시 시도해 주세요");
    }
  };

  return (
    <main className={styles.page}>
      <article className={styles.frame}>
        <AppHeader user={user} nickname={nickname} bookmarkCount={bookmarkCount} />

        <div className={styles.resultBody}>
          <h1 className={styles.pageTitle}>
            <Image src="/diagnosis/result-detail/title-icon.png" alt="" width={29} height={26} />
            강점·성향 진단 결과
          </h1>

          <section className={styles.hero} style={{ backgroundColor: copy.color }}>
            <p>{nickname}님의 강점·성향 유형은</p>
            <h2>{result.typeName}</h2>
            <span>{copy.heroSummary}</span>
            <Image
              src={`/home/result-types/${result.typeCode}.png`}
              alt=""
              width={190}
              height={132}
              priority
              className={`${styles.heroImage} ${styles[`heroImage_${result.typeCode}`]}`}
            />
          </section>

          <section className={styles.personSection}>
            <h2><FigmaSectionIcon kind="person" />{nickname}님은 이런 사람이에요</h2>
            <p>{copy.description}</p>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="analysis" />나의 성향 분석</h2>
            <p className={styles.sectionCaption}>4가지 축으로 본 {nickname}님의 성향이에요.</p>
            <div className={styles.axisList}>
              {result.axisResults.map((axis) => (
                <div className={styles.axisItem} key={axis.code}>
                  <div><strong>{axis.leftLabel} <i>↔ {axis.rightLabel}</i></strong><b>{axis.percent}%</b></div>
                  <span><i style={{ width: `${axis.percent}%` }} /></span>
                </div>
              ))}
            </div>
            {detail.percentile.topPercent == null ? (
              <div className={styles.percentilePending}>
                가입 사용자 데이터가 쌓이면 성향 순위를 알려드려요.
              </div>
            ) : (
              <div className={styles.percentile}>
                <span>{nickname}님의 {detail.percentile.traitLabel} 은(는)</span>
                <strong>상위 <b>{detail.percentile.topPercent}</b>%</strong>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="strength" />강점과 성장 포인트</h2>
            <p className={styles.sectionCaption}>{nickname}님이 잘하는 것과, 조금만 신경 쓰면 좋을 것</p>
            <div className={styles.pointList}>
              {points.map((point, index) => (
                <article className={point.growth ? styles.growthCard : styles.pointCard} key={point.title}>
                  <span aria-hidden="true">
                    <Image
                      src={point.growth ? "/diagnosis/result-detail/growth.svg" : `/diagnosis/result-detail/strength-${index + 1}.svg`}
                      alt=""
                      width={30}
                      height={39}
                    />
                  </span>
                  <div><strong>{point.title}</strong><p>{point.text}</p></div>
                </article>
              ))}
            </div>
          </section>

          <section
            className={styles.shareTicket}
            role="button"
            tabIndex={0}
            onClick={() => void shareResult()}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              void shareResult();
            }}
          >
            <Image src="/diagnosis/result-detail/gift.png" alt="" width={84} height={89} />
            <div><strong>결과를 공유하고 <em>AI 자소서 코칭</em><br />무료 티켓을 받으세요.</strong><span className={styles.shareTicketCta}>{shareMessage}</span></div>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="tips" />{result.typeName} 취업 팁</h2>
            <p className={styles.sectionCaption}>{nickname}님 유형의 강점은 살리고, 약점은 보완하는 법이에요.</p>
            <div className={styles.tipList}>
              {copy.tips.map((tip, index) => (
                <article key={tip.title}>
                  <span>{index < 2 ? "강점 살리기" : "약점 보완하기"}</span>
                  <strong>{tip.title}</strong>
                  <p>{tip.description}</p>
                </article>
              ))}
            </div>
            <div className={styles.tipNotice}><span aria-hidden="true">💬</span><p><strong>이 팁은 {nickname}님 유형에 대한 조언이에요.</strong><br />지원할 회사·직무별 맞춤 전략은 자소서 코칭에서 내 유형과 함께 분석해드려요.</p></div>
            <button type="button" className={styles.coachingButton} onClick={() => router.push("/ai-tools/coaching")}>내 유형 + 지원 회사로 자소서 코칭 받기 →</button>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="jobs" />이런 직무·기업에 강해요</h2>
            <p className={styles.sectionCaption}>{result.typeName}과 잘 맞는 직무와 공기업이에요.</p>
            <h3>{nickname}님에게 어울리는 직무</h3>
            <div className={styles.jobChips}>{displayedJobCategories.map((category) => <span key={category.name}>{category.name}</span>)}</div>
            <h3>{nickname}님에게 어울리는 공고</h3>
            <div className={styles.postingList}>
              {detail.recommendedPostings.map((posting) => <RecommendedPosting key={posting.id} posting={posting} />)}
              {!detail.recommendedPostings.length && detail.companies.map((company) => <article className={styles.companyFallback} key={company.id}><strong>{company.name}</strong></article>)}
              {!detail.recommendedPostings.length && !detail.companies.length ? <p className={styles.empty}>현재 모집 중인 추천 공고가 없어요.</p> : null}
            </div>
          </section>

          <section className={styles.section}>
            <h2><FigmaSectionIcon kind="hiring" />{result.typeName} 맞춤 채용 현황</h2>
            <p className={styles.sectionCaption}>이번 달 {nickname}님 유형에 맞는 정규직 채용을 모았어요.</p>
            <div className={styles.hiringTotal}>
              <div><span>이번 달 맞춤 정규직 채용</span><small>{detail.monthlyHiring.month}월 기준 · {detail.monthlyHiring.primaryCategory} 계열 중심</small></div>
              <strong>{detail.monthlyHiring.totalCount.toLocaleString("ko-KR")}<small>건</small></strong>
            </div>
            <div className={styles.hiringBars}>
              {detail.monthlyHiring.categories.map((category) => (
                <div key={category.name}><strong>{category.name}</strong><i><b style={{ width: `${(category.count / maxHiringCount) * 100}%` }} /></i><span>{category.count}</span></div>
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            <Link className={styles.recommendedJobsButton} href={recommendedJobsHref}>{result.typeName} 맞춤 공고 보러가기 →</Link>
            {detail.previousResultCount > 0 ? (
              <button type="button" className={styles.historyButton} onClick={openHistory}>이전 결과로 맞춤 공고 받기 →</button>
            ) : null}
            <button type="button" className={styles.shareButton} onClick={shareResult}>공유하고 자소서 코칭 티켓 받기!</button>
          </div>
        </div>

        <AppFooter active="ai" />
      </article>

      {historyOpen ? (
        <div className={styles.historyOverlay} role="dialog" aria-modal="true" aria-label="이전 진단 결과">
          <button className={styles.historyBackdrop} type="button" onClick={() => setHistoryOpen(false)} aria-label="닫기" />
          <section className={styles.historySheet}>
            <header><h2>강점·성향 진단 결과</h2><button type="button" onClick={() => setHistoryOpen(false)} aria-label="닫기">×</button></header>
            <div className={styles.historyList}>
              {history.map((item) => (
                <button type="button" key={item.resultId} className={item.resultId === result.resultId ? styles.selectedHistory : ""} onClick={async () => {
                  setHistoryOpen(false);
                  await selectDiagnosisResult(item.resultId);
                  router.replace(`/ai-tools/diagnosis/result?resultId=${encodeURIComponent(item.resultId)}`);
                }}>
                  <span><strong>{item.typeName}</strong><time>{formatDate(item.completedAt)}</time></span><i aria-hidden="true" />
                </button>
              ))}
              <div ref={sentinelRef} className={styles.sentinel}>{historyLoading ? "이전 결과를 불러오는 중..." : null}</div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

type FigmaSectionIconKind = "person" | "analysis" | "strength" | "tips" | "jobs" | "hiring";

function FigmaSectionIcon({ kind }: { kind: FigmaSectionIconKind }) {
  return <span className={`${styles.figmaSectionIcon} ${styles[`figmaSectionIcon_${kind}`]}`} aria-hidden="true" />;
}

function RecommendedPosting({ posting }: { posting: DiagnosisResultDetailResponseDto["recommendedPostings"][number] }) {
  const ddayClass = posting.dday === "D-1" || posting.dday === "D-Day" ? styles.ddayUrgent : posting.dday === "D-2" ? styles.ddaySoon : styles.ddayNormal;
  return (
    <Link href={`/jobs/${posting.id}`} className={styles.postingCard}>
      <small>{posting.institutionName}</small>
      <strong>{posting.title}</strong>
      <div className={styles.postingBadges}>
        {[posting.employmentType, posting.region, posting.careerRequirement].filter(Boolean).map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className={styles.postingMeta}><time>{posting.applicationEndAt ? `~ ${formatPostingDate(posting.applicationEndAt)}` : "상시 채용"}</time><b className={ddayClass}>{posting.dday}</b><i aria-hidden="true"><Image src="/diagnosis/result-detail/bookmark.svg" alt="" width={25} height={25} /></i></div>
    </Link>
  );
}

function ResultState({ message }: { message: string }) {
  return <main className={styles.page}><section className={styles.state}><p>{message}</p><Link href="/ai-tools/diagnosis">진단 화면으로 이동</Link></section></main>;
}

function loadKakaoSdk() {
  return new Promise<NonNullable<Window["Kakao"]>>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao SDK requires browser"));
      return;
    }

    if (window.Kakao) {
      resolve(window.Kakao);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${KAKAO_SDK_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => window.Kakao ? resolve(window.Kakao) : reject(new Error("Kakao SDK load failed")), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Kakao SDK load failed")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = KAKAO_SDK_SRC;
    script.async = true;
    script.onload = () => window.Kakao ? resolve(window.Kakao) : reject(new Error("Kakao SDK load failed"));
    script.onerror = () => reject(new Error("Kakao SDK load failed"));
    document.head.appendChild(script);
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatPostingDate(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";

  return `${valueOf("year")}. ${valueOf("month")}. ${valueOf("day")}(${valueOf("weekday")})`;
}
