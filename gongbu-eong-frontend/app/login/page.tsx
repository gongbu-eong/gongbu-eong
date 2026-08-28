import Image from "next/image";
import Link from "next/link";
import styles from "./LoginPage.module.css";

function getOAuthUrl(provider: "kakao" | "naver") {
  const configuredUrl =
    provider === "kakao"
      ? process.env.NEXT_PUBLIC_KAKAO_LOGIN_URL
      : process.env.NEXT_PUBLIC_NAVER_LOGIN_URL;
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const url = new URL(
    configuredUrl ||
      `${backendUrl}/api/auth/oauth/${provider}/start`,
  );

  url.searchParams.set("entrySource", "main_home");
  return url.toString();
}

type LoginPageProps = {
  searchParams: Promise<{
    oauthError?: string;
    provider?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasOAuthError = params.oauthError === "callback_failed";
  const providerName = params.provider === "naver" ? "네이버" : "카카오";

  return (
    <main className={styles.page}>
      <section className={styles.loginFrame} aria-labelledby="login-title">
        <div className={styles.logo}>공부엉이</div>

        <Image
          className={styles.owl}
          src="/login/login-owl.png"
          alt=""
          width={201}
          height={226}
          priority
        />

        <div className={styles.copy}>
          <h1 id="login-title">
            공기업 합격까지,
            <br />
            공부엉이와 함께해요
          </h1>
          <p>
            3초 만에 시작하고
            <br />
            내 유형에 맞는 공고와 코칭을 받아보세요
          </p>
        </div>

        <div className={styles.actions}>
          {hasOAuthError ? (
            <p className={styles.oauthError} role="alert">
              {providerName} 로그인 정보를 저장하지 못했습니다.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
          ) : null}
          <a className={styles.kakaoButton} href={getOAuthUrl("kakao")}>
            <Image src="/login/kakao.png" alt="" width={42} height={42} />
            <span>카카오로 시작하기</span>
          </a>
          <a className={styles.naverButton} href={getOAuthUrl("naver")}>
            <Image src="/login/naver.png" alt="" width={42} height={42} />
            <span>네이버로 시작하기</span>
          </a>
          <Link className={styles.skipLink} href="/">
            다음에 로그인하기 &gt;
          </Link>
        </div>

        <p className={styles.oneStep}>가입과 로그인이 한 번에 진행돼요</p>
        <p className={styles.terms}>
          신규 회원은 로그인 후&nbsp;<Link href="/my/policies/terms">이용약관</Link> 및{" "}
          <Link href="/my/policies/privacy">개인정보 수집·이용</Link> 동의 화면으로
          <br />
          이동합니다.
        </p>
      </section>
    </main>
  );
}
